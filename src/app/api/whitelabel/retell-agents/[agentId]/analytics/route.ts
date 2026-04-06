import { NextRequest, NextResponse } from 'next/server';

// This route uses dynamic features, so it must be server-rendered
export const dynamic = 'force-dynamic';

import { cookies } from 'next/headers';
import { verifyCustomerJWT } from '@/lib/customerJwt';
import { prisma } from '@/lib/prisma';
import { decrypt } from '@/lib/encryption';

export async function GET(request: NextRequest, { params }: { params: { agentId: string } }) {
  try {
    // Get the customer token from cookies
    const cookieStore = cookies();
    const token = cookieStore.get('customer_token')?.value;

    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Verify the token
    const payload = await verifyCustomerJWT(token);
    if (!payload) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    const { agentId } = params;
    const { searchParams } = new URL(request.url);
    const period = searchParams.get('period') || 'month';
    
    // Get the customer and their assigned agent
    const customer = await prisma.customer.findUnique({
      where: { id: payload.customerId },
      include: {
        retellAgents: {
          where: { id: agentId },
          select: {
            id: true,
            profitMultiplier: true,
            apiKey: true,
            partner: {
              select: {
                retellApiKey: true,
                defaultProfitMargin: true
              }
            }
          }
        }
      }
    });

    if (!customer) {
      return NextResponse.json({ error: 'Customer not found' }, { status: 404 });
    }

    const agent = customer.retellAgents[0];
    if (!agent) {
      return NextResponse.json({ error: 'Agent not found or not assigned to customer' }, { status: 404 });
    }

    // Determine which API key to use: agent's key first, then partner's key
    let decryptedApiKey: string;

    if (agent.apiKey) {
      // Use agent's individual API key
      decryptedApiKey = await decrypt(agent.apiKey);
      console.log('[whitelabel/retell-analytics] Using agent-specific API key for analytics fetch');
    } else if (agent.partner.retellApiKey) {
      // Fallback to partner's API key
      decryptedApiKey = await decrypt(agent.partner.retellApiKey);
      console.log('[whitelabel/retell-analytics] Using partner API key for analytics fetch (agent has no individual key)');
    } else {
      return NextResponse.json({
        error: 'No API key available',
        message: 'Neither agent-specific nor partner API key found'
      }, { status: 400 });
    }

    // Calculate date range based on period
    const now = new Date();
    const startDate = new Date();
    switch (period) {
      case 'day':
        startDate.setDate(now.getDate() - 1);
        break;
      case 'week':
        startDate.setDate(now.getDate() - 7);
        break;
      case 'month':
        startDate.setMonth(now.getMonth() - 1);
        break;
      default:
        startDate.setMonth(now.getMonth() - 1);
    }

    // Convert to Unix timestamps (milliseconds)
    const startTimestamp = startDate.getTime();
    const endTimestamp = now.getTime();

    // Fetch calls from Retell
    const response = await fetch('https://api.retellai.com/v2/list-calls', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${decryptedApiKey}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify({
        filter_criteria: {
          start_timestamp: {
            lower_threshold: startTimestamp,
            upper_threshold: endTimestamp
          },
          agent_id: [agentId]
        },
        sort_order: "descending",
        limit: 1000 // Get as many calls as possible for analytics
      }),
    });

    if (!response.ok) {
      throw new Error('Failed to fetch Retell calls');
    }

    const calls = await response.json();

    // Process the calls to generate analytics similar to VAPI format
    const totalCalls = calls.length;
    let totalDuration = 0;
    let totalCost = 0;
    let failedCalls = 0;
    const endReasons = new Map<string, number>();

    // Process each call
    calls.forEach((call: any) => {
      // Calculate duration
      const startTime = call.start_timestamp ? new Date(call.start_timestamp).getTime() : 0;
      const endTime = call.end_timestamp ? new Date(call.end_timestamp).getTime() : Date.now();
      const durationMs = endTime - startTime;
      const durationSeconds = Math.round(durationMs / 1000);
      
      totalDuration += durationSeconds;
      
      // Add cost if available
      if (call.call_cost && typeof call.call_cost.combined_cost === 'number') {
        totalCost += call.call_cost.combined_cost / 100; // Convert to dollars
      }
      
      // Count failed calls
      if (call.call_status !== 'ended' || call.disconnection_reason) {
        failedCalls++;
        
        // Track end reasons
        const reason = call.disconnection_reason || 'unknown';
        endReasons.set(reason, (endReasons.get(reason) || 0) + 1);
      }
    });

    // Calculate averages
    const avgDuration = totalCalls > 0 ? totalDuration / totalCalls : 0;
    const avgCost = totalCalls > 0 ? totalCost / totalCalls : 0;
    
    // Convert end reasons to array format
    const endReasonsArray = Array.from(endReasons.entries()).map(([reason, count]) => ({
      endedReason: reason,
      assistantId: agentId,
      countId: count.toString()
    }));

    // Format the analytics data to match VAPI format
    const analyticsData = [
      {
        name: "Total Call Duration",
        result: [{
          assistantId: agentId,
          sumDuration: totalDuration
        }]
      },
      {
        name: "Average Call Cost",
        result: [{
          assistantId: agentId,
          avgCost: avgCost * (agent.profitMultiplier || agent.partner.defaultProfitMargin || 1.2)
        }]
      },
      {
        name: "Number of Calls by Assistants",
        result: [{
          assistantId: agentId,
          countId: totalCalls.toString()
        }]
      },
      {
        name: "Number of Failed Calls",
        result: endReasonsArray
      },
      {
        name: "Average Call Duration by Assistant",
        result: [{
          assistantId: agentId,
          avgDuration: avgDuration
        }]
      },
      {
        name: "Total Spent",
        result: [{
          assistantId: agentId,
          sumCost: totalCost * (agent.profitMultiplier || agent.partner.defaultProfitMargin || 1.2)
        }]
      },
      {
        name: "Success Evaluation",
        result: [
          {
            'analysis.successEvaluation': 'true',
            assistantId: agentId,
            countId: (totalCalls - failedCalls).toString()
          },
          {
            'analysis.successEvaluation': 'false',
            assistantId: agentId,
            countId: failedCalls.toString()
          }
        ]
      }
    ];

    return NextResponse.json(analyticsData);

  } catch (error) {
    console.error('Error fetching agent analytics:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
