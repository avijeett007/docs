import { NextResponse, NextRequest } from 'next/server';

// This route uses dynamic features, so it must be server-rendered
export const dynamic = 'force-dynamic';

import { prisma } from '@/lib/prisma';
import { verifyPartnerJWT } from '@/lib/auth';
import { decrypt } from '@/lib/encryption';

// Add a timeout utility to avoid API rate limiting issues
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

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

export async function GET(request: NextRequest) {
  try {
    // Verify JWT and get partner
    const auth = await verifyPartnerJWT(request);
    if (!auth.isValid) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get Retell API key from partner
    const partnerId = auth.payload?.partnerId;
    if (!partnerId) {
      return NextResponse.json(
        { error: 'Invalid partner ID' },
        { status: 401 }
      );
    }

    const partner = await prisma.partner.findUnique({
      where: { id: partnerId },
      select: { 
        retellApiKey: true,
        retellAgents: {
          where: { isActive: true },
          select: { id: true }
        }
      }
    });

    if (!partner?.retellApiKey) {
      return NextResponse.json(
        { error: 'RETELL_API_KEY_MISSING' },
        { status: 400 }
      );
    }

    // Decrypt the Retell API key
    const decryptedApiKey = await decrypt(partner.retellApiKey);

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

    // Get all agent IDs for this partner
    const agentIds = partner.retellAgents.map(agent => agent.id);

    if (agentIds.length === 0) {
      return NextResponse.json({
        totalCost: 0,
        totalDuration: 0,
        totalCalls: 0
      });
    }

    // Collect all calls using pagination
    let allCalls: RetellCall[] = [];
    let paginationKey: string | null = null;
    let hasMorePages = true;
    let pageCount = 0;
    const MAX_PAGES = 10; // Safety limit to prevent infinite loops

    while (hasMorePages && pageCount < MAX_PAGES) {
      pageCount++;
      
      // Prepare request body for Retell API with pagination
      const requestBody: any = {
        filter_criteria: {
          start_timestamp: {
            lower_threshold: startTimestamp,
            upper_threshold: endTimestamp
          }
          // No agent_id filter to get all calls
        },
        sort_order: "descending"
      };
      
      // Add pagination key if we have one from previous request
      if (paginationKey) {
        requestBody.pagination_key = paginationKey;
      }

      console.log(`Making Retell list-calls request (page ${pageCount}):`, {
        url: 'https://api.retellai.com/v2/list-calls',
        paginationKey,
        startTimestamp,
        endTimestamp
      });

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
        throw new Error(`Failed to fetch call data from Retell: ${response.status} ${response.statusText}`);
      }

      // Get response data
      const responseData = await response.json();
      
      // Extract calls and pagination key from response
      let calls: RetellCall[] = [];
      let nextPaginationKey: string | null = null;
      
      if (Array.isArray(responseData)) {
        // Response is an array of calls
        calls = responseData;
        // Get the last call ID to use as next pagination key if there are calls
        if (calls.length > 0) {
          nextPaginationKey = calls[calls.length - 1].call_id;
        }
      } else if (responseData.calls && Array.isArray(responseData.calls)) {
        // Response has a calls array and possibly a pagination_key
        calls = responseData.calls;
        nextPaginationKey = responseData.pagination_key || null;
      }
      
      // Add calls to our collection
      allCalls = [...allCalls, ...calls];
      
      // Check if we should continue pagination
      if (!nextPaginationKey || calls.length === 0) {
        hasMorePages = false;
      } else {
        paginationKey = nextPaginationKey;
        // Small delay to avoid rate limiting
        await sleep(200);
      }
    }
    
    // Filter calls to only include those from agents owned by this partner
    const partnerCalls = allCalls.filter(call => agentIds.includes(call.agent_id));
    
    // Process the call data to generate summary
    const summary = processRetellCallSummary(partnerCalls);
    
    return NextResponse.json(summary);
  } catch (error) {
    console.error('Error fetching Retell summary:', error);
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}

function processRetellCallSummary(calls: RetellCall[]) {
  // Initialize summary data
  const totalCalls = calls.length;
  let totalDuration = 0;
  let totalCost = 0;
  let failedCalls = 0;
  const productCostBreakdown: Record<string, number> = {};
  
  // Process each call
  for (const call of calls) {
    // Calculate duration correctly (end_timestamp - start_timestamp in seconds)
    const callDuration = call.end_timestamp && call.start_timestamp ? 
      (call.end_timestamp - call.start_timestamp) / 1000 : 
      (call.duration_ms || 0) / 1000;
    
    totalDuration += callDuration;
    
    // Track failed calls
    if (call.call_status !== 'ended') {
      failedCalls++;
    }
    
    // Add to total cost (cost is in cents, divide by 100 to get dollars)
    if (call.call_cost) {
      totalCost += call.call_cost.combined_cost / 100;
      
      // Track product cost breakdown
      if (Array.isArray(call.call_cost.product_costs)) {
        for (const product of call.call_cost.product_costs) {
          const productName = product.product || 'unknown';
          if (!productCostBreakdown[productName]) {
            productCostBreakdown[productName] = 0;
          }
          productCostBreakdown[productName] += product.cost / 100;
        }
      }
    }
  }
  
  // Calculate additional metrics
  const avgDuration = totalCalls > 0 ? totalDuration / totalCalls : 0;
  const avgCost = totalCalls > 0 ? totalCost / totalCalls : 0;
  const successRate = totalCalls > 0 ? ((totalCalls - failedCalls) / totalCalls) * 100 : 0;
  
  // Format product costs for easier display
  const productCosts = Object.entries(productCostBreakdown).map(([product, cost]) => ({
    product,
    cost
  }));
  
  return {
    totalCost,
    totalDuration,
    totalCalls,
    failedCalls,
    successRate,
    avgDuration,
    avgCost,
    productCosts
  };
}
