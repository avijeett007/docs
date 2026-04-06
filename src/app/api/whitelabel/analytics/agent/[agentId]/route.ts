import { NextResponse, NextRequest } from 'next/server';
import { cookies } from 'next/headers';
import { verifyCustomerJWT } from '@/lib/customerJwt';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

const ANALYTICS_API_URL = process.env.ANALYTICS_API_URL;
const ANALYTICS_API_KEY = process.env.ANALYTICS_STANDARD_API_KEY;
// Environment variable to control analytics API version (default: v1)
const ANALYTICS_API_VERSION = process.env.ANALYTICS_API_VERSION || 'v1';

/**
 * Convert V3 analytics cost values from cents to dollars
 * V3 returns all costs in cents for consistency with database storage
 * V1 and V2 already return dollars, so this conversion makes V3 consistent
 */
function convertV3CostsToDollars(data: any[]): any[] {
  if (ANALYTICS_API_VERSION !== 'v3') {
    return data;
  }

  return data.map((item: any) => {
    if (item.name === 'Product Costs' && Array.isArray(item.result)) {
      return {
        ...item,
        result: item.result.map((r: any) => ({
          ...r,
          cost: r.cost != null ? r.cost / 100 : 0
        }))
      };
    }
    if (item.name === 'Average Call Cost' && Array.isArray(item.result)) {
      return {
        ...item,
        result: item.result.map((r: any) => ({
          ...r,
          avgCost: r.avgCost != null ? r.avgCost / 100 : 0
        }))
      };
    }
    if (item.name === 'Total Spent' && Array.isArray(item.result)) {
      return {
        ...item,
        result: item.result.map((r: any) => ({
          ...r,
          sumCost: r.sumCost != null ? r.sumCost / 100 : 0
        }))
      };
    }
    return item;
  });
}

export async function GET(
  request: NextRequest,
  { params }: { params: { agentId: string } }
) {
  try {
    // Check if analytics service is configured
    if (!ANALYTICS_API_URL || !ANALYTICS_API_KEY) {
      return NextResponse.json({ error: 'Analytics service not configured' }, { status: 503 });
    }

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

    const customerId = payload.customerId;

    // Verify agent ownership (check all agent types: VAPI, Retell, Ultravox, GHL, and ElevenLabs)
    const vapiAgent = await prisma.vapiAgent.findFirst({
      where: { id: params.agentId, customerId },
      select: {
        id: true,
        profitMultiplier: true,
        partner: {
          select: {
            defaultProfitMargin: true
          }
        }
      }
    });

    const retellAgent = await prisma.retellAgent.findFirst({
      where: { id: params.agentId, customerId },
      select: {
        id: true,
        profitMultiplier: true,
        partner: {
          select: {
            defaultProfitMargin: true
          }
        }
      }
    });

    const ultravoxAgent = await prisma.ultravoxAgent.findFirst({
      where: { id: params.agentId, customerId },
      select: {
        id: true,
        profitMultiplier: true,
        partner: {
          select: {
            defaultProfitMargin: true
          }
        }
      }
    });

    const ghlAgent = await prisma.ghlAgent.findFirst({
      where: { id: params.agentId, customerId },
      select: {
        id: true,
        profitMultiplier: true,
        partner: {
          select: {
            defaultProfitMargin: true
          }
        }
      }
    });

    const elevenlabsAgent = await prisma.elevenLabsAgent.findFirst({
      where: { id: params.agentId, customerId },
      select: {
        id: true,
        profitMultiplier: true,
        partner: {
          select: {
            defaultProfitMargin: true
          }
        }
      }
    });

    const knovaAgent = await prisma.knovaAgent.findFirst({
      where: { id: params.agentId, customerId },
      select: {
        id: true,
        profitMultiplier: true,
        partner: {
          select: {
            defaultProfitMargin: true
          }
        }
      }
    });

    const n8nChatAgent = await prisma.n8nChatAgent.findFirst({
      where: { id: params.agentId, customerId },
      select: {
        id: true,
        partner: {
          select: {
            defaultProfitMargin: true
          }
        }
      }
    });

    const retellChatAgent = await prisma.retellChatAgent.findFirst({
      where: { id: params.agentId, customerId },
      select: {
        id: true,
        partner: {
          select: {
            defaultProfitMargin: true
          }
        }
      }
    });

    const agent = vapiAgent || retellAgent || ultravoxAgent || ghlAgent || elevenlabsAgent || knovaAgent || n8nChatAgent || retellChatAgent;
    if (!agent) {
      return NextResponse.json(
        { error: 'Agent not found or unauthorized' },
        { status: 404 }
      );
    }

    // Parse period from query params
    const searchParams = request.nextUrl.searchParams;
    const period = searchParams.get('period') || 'month';
    const startDate = searchParams.get('start_date');
    const endDate = searchParams.get('end_date');

    // Get the provider agent ID for analytics service call
    // For all agent types, the 'id' field contains the provider agent ID
    const providerAgentId = agent.id;
    if (!providerAgentId) {
      console.error('Provider agent ID not found for agent:', params.agentId);
      return NextResponse.json([]);
    }

    console.log('Fetching whitelabel agent analytics from analytics service:', {
      databaseAgentId: params.agentId,
      providerAgentId: providerAgentId,
      customerId,
      period,
      startDate,
      endDate,
      analyticsApiVersion: ANALYTICS_API_VERSION,
      analyticsApiUrl: ANALYTICS_API_URL
    });

    // Build query string
    let queryString = `period=${period}`;
    if (startDate) queryString += `&start_date=${startDate}`;
    if (endDate) queryString += `&end_date=${endDate}`;

    // Make request to analytics service using provider agent ID
    // V2 and V3 use the same URL pattern /{version}/analytics/agent/{id}
    const endpoint = (ANALYTICS_API_VERSION === 'v2' || ANALYTICS_API_VERSION === 'v3')
      ? `${ANALYTICS_API_URL}/${ANALYTICS_API_VERSION}/analytics/agent/${providerAgentId}?${queryString}&v1_compatible=true`
      : `${ANALYTICS_API_URL}/api/v1/app/agent/${providerAgentId}/analytics?${queryString}`;

    const response = await fetch(
      endpoint,
      {
        headers: {
          'x-api-key': ANALYTICS_API_KEY,
          'Content-Type': 'application/json'
        }
      }
    );

    if (!response.ok) {
      console.error(`Analytics service error for agent ${providerAgentId}: ${response.status} ${response.statusText}`);
      console.error('Request URL:', endpoint);
      console.error('Request headers:', {
        'x-api-key': ANALYTICS_API_KEY ? 'PRESENT' : 'MISSING',
        'Content-Type': 'application/json'
      });
      // Return empty analytics instead of error
      return NextResponse.json([]);
    }

    let analyticsData = await response.json();
    console.log('Analytics service response for agent', providerAgentId, ':', {
      isArray: Array.isArray(analyticsData),
      length: Array.isArray(analyticsData) ? analyticsData.length : 'N/A',
      responseKeys: Array.isArray(analyticsData) ? 'ARRAY' : Object.keys(analyticsData),
      firstItem: Array.isArray(analyticsData) && analyticsData.length > 0 ? Object.keys(analyticsData[0]) : 'N/A'
    });

    // V3 returns costs in cents, convert to dollars for consistency with V1/V2
    if (ANALYTICS_API_VERSION === 'v3' && Array.isArray(analyticsData)) {
      analyticsData = convertV3CostsToDollars(analyticsData);
      console.log('Converted V3 costs from cents to dollars');
    }

    // Handle different response formats between v1 and v2 APIs
    let totalCalls = 0;
    let totalCost = 0;
    let totalDuration = 0;
    let avgDuration = 0;
    let avgCost = 0;
    let failedCalls = 0;

    if ((ANALYTICS_API_VERSION === 'v2' || ANALYTICS_API_VERSION === 'v3') && Array.isArray(analyticsData)) {
      // V2/V3 API returns array format even with v1_compatible=true
      // We need to extract data from the array structure
      console.log(`Processing ${ANALYTICS_API_VERSION.toUpperCase()} array response format`);

      // V2 returns the same legacy format as an array, so we need to extract the data
      // The array contains the same objects as the legacy format
      if (analyticsData.length > 0) {
        // Find the relevant data from the array structure
        const callsData = analyticsData.find(item => item.name === "Number of Calls by Assistants");
        const costData = analyticsData.find(item => item.name === "Total Spent");
        const durationData = analyticsData.find(item => item.name === "Total Call Duration");
        const avgCostData = analyticsData.find(item => item.name === "Average Call Cost");
        const avgDurationData = analyticsData.find(item => item.name === "Average Call Duration by Assistant");
        const failedCallsData = analyticsData.find(item => item.name === "Number of Failed Calls");

        if (callsData && callsData.result && callsData.result.length > 0) {
          totalCalls = parseInt(callsData.result[0].countId) || 0;
        }
        if (costData && costData.result && costData.result.length > 0) {
          totalCost = parseFloat(costData.result[0].sumCost) || 0;
        }
        if (durationData && durationData.result && durationData.result.length > 0) {
          totalDuration = parseFloat(durationData.result[0].sumDuration) || 0;
        }
        if (avgCostData && avgCostData.result && avgCostData.result.length > 0) {
          avgCost = parseFloat(avgCostData.result[0].avgCost) || 0;
        }
        if (avgDurationData && avgDurationData.result && avgDurationData.result.length > 0) {
          avgDuration = parseFloat(avgDurationData.result[0].avgDuration) || 0;
        }
        if (failedCallsData && failedCallsData.result && failedCallsData.result.length > 0) {
          failedCalls = parseInt(failedCallsData.result[0].countId) || 0;
        }
      }
    } else {
      // V1 API or V2 API returning object format
      console.log('Processing V1 object response format');
      totalCalls = analyticsData.totalCalls || 0;
      totalCost = analyticsData.totalCost || 0;
      totalDuration = analyticsData.totalDuration || 0;
      avgDuration = analyticsData.avgDuration || 0;
      avgCost = analyticsData.avgCost || 0;
      failedCalls = analyticsData.failedCalls || 0;
    }

    console.log('Extracted analytics data:', {
      totalCalls,
      totalCost,
      totalDuration,
      avgDuration,
      avgCost,
      failedCalls
    });
    
    // Apply profit multiplier for customer pricing
    // Chat agents (n8nChatAgent, retellChatAgent) don't have profitMultiplier; voice agents do
    const profitMultiplier: number = Number(('profitMultiplier' in agent ? agent.profitMultiplier : null) || agent.partner?.defaultProfitMargin || 1.2);
    const hideUsageCosts = false; // Default to showing costs for now

    // Format the analytics data to match the expected structure
    const formattedAnalytics = [
      {
        name: "LLM, STT, TTS, VAPI Costs",
        result: hideUsageCosts ? [] : [
          {
            assistantId: params.agentId,
            'costBreakdown.llm': totalCost * 0.4 * profitMultiplier,
            'costBreakdown.stt': totalCost * 0.2 * profitMultiplier,
            'costBreakdown.tts': totalCost * 0.3 * profitMultiplier,
            'costBreakdown.vapi': totalCost * 0.1 * profitMultiplier
          }
        ]
      },
      {
        name: "Total Call Duration",
        result: [{
          assistantId: params.agentId,
          sumDuration: totalDuration
        }]
      },
      {
        name: "Average Call Cost",
        result: [{
          assistantId: params.agentId,
          avgCost: avgCost * profitMultiplier
        }]
      },
      {
        name: "Number of Calls by Assistants",
        result: [{
          assistantId: params.agentId,
          countId: totalCalls.toString()
        }]
      },
      {
        name: "Number of Failed Calls",
        result: [{
          assistantId: params.agentId,
          endedReason: "failed",
          countId: failedCalls.toString()
        }]
      },
      {
        name: "Average Call Duration by Assistant",
        result: [{
          assistantId: params.agentId,
          avgDuration
        }]
      },
      {
        name: "Total Spent",
        result: [{
          assistantId: params.agentId,
          sumCost: totalCost * profitMultiplier
        }]
      },
      {
        name: "Success Evaluation",
        result: [{
          assistantId: params.agentId,
          'analysis.successEvaluation': 'true',
          countId: Math.max(0, totalCalls - failedCalls).toString()
        }]
      }
    ];

    console.log('Successfully loaded whitelabel agent analytics from analytics service');

    // Add cache-busting headers to ensure fresh analytics data
    const nextResponse = NextResponse.json(formattedAnalytics);
    nextResponse.headers.set('Cache-Control', 'no-cache, no-store, must-revalidate');
    nextResponse.headers.set('Pragma', 'no-cache');
    nextResponse.headers.set('Expires', '0');
    return nextResponse;

  } catch (error) {
    console.error('Error fetching whitelabel agent analytics from analytics service:', error);
    
    // Return empty analytics instead of error
    return NextResponse.json([]);
  }
}
