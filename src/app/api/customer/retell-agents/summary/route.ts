import { NextResponse, NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuth } from '@clerk/nextjs/server';
import { decrypt } from '@/lib/encryption';

// Mark this route as dynamic
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    // Verify user authentication
    const { userId } = getAuth(request);
    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get the customer record for the authenticated user
    const customer = await prisma.customer.findUnique({
      where: { userId },
      include: {
        retellAgents: {
          where: { isActive: true },
          select: {
            id: true,
            profitMultiplier: true,
            partner: {
              select: {
                retellApiKey: true,
                id: true
              }
            }
          }
        }
      }
    });

    if (!customer) {
      return NextResponse.json(
        { error: 'Customer not found' },
        { status: 404 }
      );
    }

    // If no Retell agents are assigned, return empty summary
    if (customer.retellAgents.length === 0) {
      return NextResponse.json({
        totalCost: 0,
        totalDuration: 0,
        totalCalls: 0
      });
    }

    // Parse period from query params and validate
    const searchParams = request.nextUrl.searchParams;
    const period = searchParams.get('period') || 'month';

    // Validate period is one of the allowed values
    if (!['day', 'week', 'month'].includes(period)) {
      return NextResponse.json(
        { error: 'Invalid period. Must be one of: day, week, month' },
        { status: 400 }
      );
    }

    // Type assertion since we've validated the value
    const validatedPeriod = period as 'day' | 'week' | 'month';

    // Calculate date range based on period
    const end = new Date();
    const start = new Date();

    switch (validatedPeriod) {
      case 'day':
        start.setDate(start.getDate() - 1);
        break;
      case 'week':
        start.setDate(start.getDate() - 7);
        break;
      case 'month':
        start.setMonth(start.getMonth() - 1);
        break;
    }

    // Convert to Unix timestamps (milliseconds)
    const startTimestamp = start.getTime();
    const endTimestamp = end.getTime();

    // We need to get the partner's Retell API key
    // Since customer might have agents from different partners, we'll group by partner
    const partnerAgentMap: Record<string, { apiKey: string, agents: string[], profitMultiplier: number }> = {};

    for (const agent of customer.retellAgents) {
      if (!agent.partner?.retellApiKey) continue;

      const partnerId = agent.partner.id;
      
      if (!partnerAgentMap[partnerId]) {
        partnerAgentMap[partnerId] = {
          apiKey: agent.partner.retellApiKey,
          agents: [],
          profitMultiplier: agent.profitMultiplier
        };
      }
      
      partnerAgentMap[partnerId].agents.push(agent.id);
    }

    // Initialize summary data
    let totalCost = 0;
    let totalDuration = 0;
    let totalCalls = 0;

    // Fetch data for each partner's agents
    for (const partnerId in partnerAgentMap) {
      const { apiKey, agents, profitMultiplier } = partnerAgentMap[partnerId];
      
      // Decrypt the Retell API key
      const decryptedApiKey = await decrypt(apiKey);

      // Prepare request body for Retell API
      const requestBody = {
        filter_criteria: {
          start_timestamp: {
            lower_threshold: startTimestamp,
            upper_threshold: endTimestamp
          },
          agent_id: agents
        },
        sort_order: "descending"
      };

      // Call Retell API to list calls
      const response = await fetch('https://api.retellai.com/v2/list-calls', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${decryptedApiKey}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        console.error('Retell list-calls error:', {
          status: response.status,
          statusText: response.statusText,
          error: await response.text()
        });
        continue; // Skip this partner if there's an error
      }

      const calls = await response.json();
      
      // Process call data
      for (const call of calls) {
        // Add to total calls
        totalCalls++;
        
        // Add to total duration (keep in seconds)
        totalDuration += call.duration_ms / 1000;
        
        // Add to total cost (cost is in cents, divide by 100 to get dollars)
        if (call.call_cost) {
          // Apply profit multiplier to the cost
          const rawCost = call.call_cost.combined_cost / 100;
          const billedCost = rawCost * profitMultiplier;
          totalCost += billedCost;
        }
      }
    }

    // Return the summary data
    return NextResponse.json({
      totalCost,
      totalDuration,
      totalCalls
    });
  } catch (error) {
    console.error('Error fetching Retell summary:', error);
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}
