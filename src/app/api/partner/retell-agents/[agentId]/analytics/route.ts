import { NextResponse, NextRequest } from 'next/server';

// This route uses dynamic features, so it must be server-rendered
export const dynamic = 'force-dynamic';

import { prisma } from '@/lib/prisma';
import { verifyPartnerJWT } from '@/lib/auth';
import { decrypt } from '@/lib/encryption';

interface RetellCallCost {
  total_duration_unit_price: number;
  product_costs: {
    unit_price: number;
    product: string;
    cost: number;
  }[];
  total_one_time_price: number;
  combined_cost: number;
  total_duration_seconds: number;
}

interface RetellCall {
  call_id: string;
  call_type: string;
  agent_id: string;
  call_status: string;
  start_timestamp: number;
  end_timestamp: number;
  duration_ms: number;
  call_cost: RetellCallCost;
}

export async function GET(
  request: NextRequest,
  { params }: { params: { agentId: string } }
) {
  try {
    // Verify JWT and get partner
    const auth = await verifyPartnerJWT(request);
    if (!auth.isValid) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get partner ID
    const partnerId = auth.payload?.partnerId;
    if (!partnerId) {
      return NextResponse.json(
        { error: 'Invalid partner ID' },
        { status: 401 }
      );
    }

    // Get agent and verify ownership
    const agent = await prisma.retellAgent.findUnique({
      where: { id: params.agentId },
      select: {
        id: true,
        partnerId: true,
        profitMultiplier: true,
        customerId: true,
        apiKey: true,
      }
    });

    if (!agent) {
      return NextResponse.json(
        { error: 'Agent not found' },
        { status: 404 }
      );
    }

    if (agent.partnerId !== partnerId) {
      return NextResponse.json(
        { error: 'Unauthorized - Agent does not belong to this partner' },
        { status: 403 }
      );
    }

    // Get partner's API key for fallback
    const partner = await prisma.partner.findUnique({
      where: { id: partnerId },
      select: { retellApiKey: true }
    });

    // Determine which API key to use: agent's key first, then partner's key
    let decryptedApiKey: string;

    if (agent.apiKey) {
      // Use agent's individual API key
      decryptedApiKey = await decrypt(agent.apiKey);
      console.log('[analytics/route] Using agent-specific API key for analytics fetch');
    } else if (partner?.retellApiKey) {
      // Fallback to partner's API key
      decryptedApiKey = await decrypt(partner.retellApiKey);
      console.log('[analytics/route] Using partner API key for analytics fetch (agent has no individual key)');
    } else {
      return NextResponse.json({
        error: 'No API key available',
        message: 'Neither agent-specific nor partner API key found'
      }, { status: 400 });
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

    // Prepare request body for Retell API
    const requestBody = {
      filter_criteria: {
        start_timestamp: {
          lower_threshold: startTimestamp,
          upper_threshold: endTimestamp
        },
        agent_id: [params.agentId]
      },
      sort_order: "descending"
    };

    // Call Retell API to list calls
    console.log('Making Retell list-calls request:', {
      url: 'https://api.retellai.com/v2/list-calls',
      agentId: params.agentId,
      startTimestamp,
      endTimestamp
    });

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
      throw new Error(`Failed to fetch call data from Retell: ${response.status} ${response.statusText}`);
    }

    const calls = await response.json() as RetellCall[];
    
    // Process the call data to generate analytics
    const analytics = processRetellCallData(calls, agent.profitMultiplier);
    
    return NextResponse.json(analytics);
  } catch (error) {
    console.error('Error fetching Retell analytics:', error);
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}

function processRetellCallData(calls: RetellCall[], profitMultiplier: number) {
  // Initialize analytics data
  const totalCalls = calls.length;
  let totalDuration = 0;
  let totalCost = 0;
  const productCosts: Record<string, number> = {};
  const failedCalls = calls.filter(call => call.call_status !== 'ended').length;
  
  // Process each call
  for (const call of calls) {
    // Add to total duration (convert ms to seconds)
    totalDuration += call.duration_ms / 1000;
    
    // Add to total cost (cost is in cents, divide by 100 to get dollars)
    if (call.call_cost) {
      totalCost += call.call_cost.combined_cost / 100;
      
      // Process product costs
      for (const product of call.call_cost.product_costs) {
        if (!productCosts[product.product]) {
          productCosts[product.product] = 0;
        }
        productCosts[product.product] += product.cost / 100;
      }
    }
  }
  
  // Calculate averages
  const avgDuration = totalCalls > 0 ? totalDuration / totalCalls : 0;
  const avgCost = totalCalls > 0 ? totalCost / totalCalls : 0;
  const successRate = totalCalls > 0 ? ((totalCalls - failedCalls) / totalCalls) * 100 : 0;
  
  // Format the analytics data to match the expected structure
  return [
    {
      name: "Product Costs",
      result: Object.entries(productCosts).map(([product, cost]) => ({
        product,
        cost
      }))
    },
    {
      name: "Total Call Duration",
      result: [{
        agentId: calls[0]?.agent_id,
        sumDuration: totalDuration
      }]
    },
    {
      name: "Average Call Cost",
      result: [{
        agentId: calls[0]?.agent_id,
        avgCost
      }]
    },
    {
      name: "Number of Calls by Assistants",
      result: [{
        agentId: calls[0]?.agent_id,
        countId: totalCalls.toString()
      }]
    },
    {
      name: "Number of Failed Calls",
      result: [{
        agentId: calls[0]?.agent_id,
        endedReason: "failed",
        countId: failedCalls.toString()
      }]
    },
    {
      name: "Average Call Duration by Assistant",
      result: [{
        agentId: calls[0]?.agent_id,
        avgDuration
      }]
    },
    {
      name: "Total Spent",
      result: [{
        agentId: calls[0]?.agent_id,
        sumCost: totalCost
      }]
    },
    {
      name: "Success Evaluation",
      result: [{
        agentId: calls[0]?.agent_id,
        'analysis.successEvaluation': 'true',
        countId: (totalCalls - failedCalls).toString()
      }]
    }
  ];
}
