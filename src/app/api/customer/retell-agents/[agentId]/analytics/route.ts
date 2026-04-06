import { NextResponse, NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuth } from '@clerk/nextjs/server';
import { decrypt } from '@/lib/encryption';

// Mark this route as dynamic
export const dynamic = 'force-dynamic';

// Define Retell API types
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
      select: {
        id: true
      }
    });

    if (!customer) {
      return NextResponse.json(
        { error: 'Customer not found' },
        { status: 404 }
      );
    }

    // Get the Retell agent and verify it's assigned to this customer
    const agent = await prisma.retellAgent.findUnique({
      where: {
        id: params.agentId,
        customerId: customer.id
      },
      select: {
        id: true,
        partnerId: true,
        profitMultiplier: true,
        partner: {
          select: {
            retellApiKey: true
          }
        }
      }
    });

    if (!agent) {
      return NextResponse.json(
        { error: 'Agent not found or not assigned to customer' },
        { status: 404 }
      );
    }

    // Decrypt the Retell API key
    if (!agent.partner?.retellApiKey) {
      return NextResponse.json(
        { error: 'RETELL_API_KEY_MISSING' },
        { status: 400 }
      );
    }
    const decryptedApiKey = await decrypt(agent.partner.retellApiKey);

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

    // Call Retell API to list calls with pagination
    console.log('Making Retell list-calls request:', {
      url: 'https://api.retellai.com/v2/list-calls',
      agentId: params.agentId,
      startTimestamp,
      endTimestamp
    });

    // Set a reasonable page size
    const PAGE_SIZE = 100;
    let allCalls: RetellCall[] = [];
    let hasMore = true;
    let paginationKey: string | undefined = undefined;

    // Fetch all pages of calls
    while (hasMore) {
      // Add pagination parameters to request body
      const paginatedRequestBody: {
        filter_criteria: typeof requestBody.filter_criteria;
        sort_order: string;
        limit: number;
        pagination_key?: string;
      } = {
        ...requestBody,
        limit: PAGE_SIZE,
        ...(paginationKey && { pagination_key: paginationKey })
      };

      const response = await fetch('https://api.retellai.com/v2/list-calls', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${decryptedApiKey}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify(paginatedRequestBody),
      });

      if (!response.ok) {
        console.error('Retell list-calls error:', {
          status: response.status,
          statusText: response.statusText,
          error: await response.text()
        });
        throw new Error(`Failed to fetch call data from Retell: ${response.status} ${response.statusText}`);
      }

      const pageData: RetellCall[] = await response.json();

      // Add this page of calls to our collection
      if (Array.isArray(pageData) && pageData.length > 0) {
        allCalls = [...allCalls, ...pageData];

        // Check if we need to fetch more pages
        if (pageData.length < PAGE_SIZE) {
          hasMore = false;
        } else {
          // Get the last call ID to use as the next pagination key
          paginationKey = pageData[pageData.length - 1].call_id;
        }
      } else {
        hasMore = false;
      }

      // Log progress
      console.log(`Fetched ${allCalls.length} calls so far`);
    }

    const calls = allCalls;

    // Process the call data to generate analytics with profit multiplier
    const analytics = processRetellCallData(calls, agent.profitMultiplier, params.agentId);

    return NextResponse.json(analytics);
  } catch (error) {
    console.error('Error fetching Retell analytics:', error);
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}

function processRetellCallData(calls: RetellCall[], profitMultiplier: number, agentId: string) {
  // Initialize analytics data
  const totalCalls = calls.length;
  let totalDuration = 0;
  let totalCost = 0;
  const productCosts: Record<string, number> = {};
  const failedCalls = calls.filter(call => call.call_status !== 'ended').length;

  // Process each call
  for (const call of calls) {
    // Add to total duration (keep in seconds)
    totalDuration += call.duration_ms / 1000;

    // Add to total cost (cost is in cents, divide by 100 to get dollars)
    if (call.call_cost) {
      // Apply profit multiplier to the cost
      const rawCost = call.call_cost.combined_cost / 100;
      const billedCost = rawCost * profitMultiplier;
      totalCost += billedCost;

      // Track costs by product
      for (const product of call.call_cost.product_costs) {
        const productName = product.product;
        const productCost = (product.cost / 100) * profitMultiplier;

        if (!productCosts[productName]) {
          productCosts[productName] = 0;
        }

        productCosts[productName] += productCost;
      }
    }
  }

  // Calculate average duration and cost
  const avgDuration = totalCalls > 0 ? totalDuration / totalCalls : 0;
  const avgCost = totalCalls > 0 ? totalCost / totalCalls : 0;

  // Format the analytics data to match the VAPI format
  const formattedAnalytics = [
    {
      name: "Total Call Duration",
      result: [
        {
          assistantId: agentId,
          sumDuration: totalDuration
        }
      ]
    },
    {
      name: "Average Call Duration by Assistant",
      result: [
        {
          assistantId: agentId,
          avgDuration: avgDuration
        }
      ]
    },
    {
      name: "Number of Calls by Assistants",
      result: [
        {
          assistantId: agentId,
          countId: totalCalls.toString()
        }
      ]
    },
    {
      name: "Average Call Cost",
      result: [
        {
          assistantId: agentId,
          avgCost: avgCost
        }
      ]
    },
    {
      name: "Total Spent",
      result: [
        {
          assistantId: agentId,
          sumCost: totalCost
        }
      ]
    },
    {
      name: "Number of Failed Calls",
      result: calls.filter(call => call.call_status !== 'ended').map(call => ({
        assistantId: agentId,
        endedReason: call.call_status,
        countId: "1"
      }))
    },
    {
      name: "Success Evaluation",
      result: [
        {
          assistantId: agentId,
          "analysis.successEvaluation": "true",
          countId: (totalCalls - failedCalls).toString()
        },
        {
          assistantId: agentId,
          "analysis.successEvaluation": "false",
          countId: failedCalls.toString()
        }
      ]
    }
  ];

  return formattedAnalytics;
}
