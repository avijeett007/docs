export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyCustomerJWT } from '@/lib/customerJwt';
import { prisma } from '@/lib/prisma';

// Check if we should use analytics service
const USE_ANALYTICS_SERVICE = process.env.NEXT_PUBLIC_USE_ANALYTICS_SERVICE_WHITELABEL_AI_USAGE === 'true';
const ANALYTICS_API_KEY = process.env.ANALYTICS_STANDARD_API_KEY;
const ANALYTICS_BASE_URL = process.env.ANALYTICS_BASE_URL || 'http://localhost:8001';

export async function GET(
  req: NextRequest,
  { params }: { params: { agentId: string } }
) {
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

    const customerId = payload.customerId;
    const agentId = params.agentId;
    const { searchParams } = new URL(req.url);
    const period = searchParams.get('period') || 'month';

    // Verify the agent belongs to this customer
    const agent = await prisma.ultravoxAgent.findFirst({
      where: {
        id: agentId,
        customerId: customerId,
        isActive: true,
      },
      select: {
        id: true,
        name: true,
        profitMultiplier: true,
        partner: {
          select: {
            id: true,
          },
        },
      },
    });

    if (!agent) {
      return NextResponse.json({ error: 'Agent not found or not accessible' }, { status: 404 });
    }

    // Get customer features to check if pricing should be shown
    const customerFeatures = await prisma.userOnboarding.findFirst({
      where: {
        customerId: customerId,
        partnerId: agent.partner.id,
      },
      select: {
        showPricingInformation: true,
      },
    });

    const showPricing = customerFeatures?.showPricingInformation ?? false;

    if (USE_ANALYTICS_SERVICE) {
      // Use analytics service for Ultravox data
      console.log('Using analytics service for whitelabel Ultravox analytics');
      
      if (!ANALYTICS_API_KEY) {
        console.error('Analytics API key not configured');
        return NextResponse.json({ error: 'Analytics service not configured' }, { status: 500 });
      }

      try {
        const response = await fetch(`${ANALYTICS_BASE_URL}/analytics/agent/${agentId}?period=${period}`, {
          headers: {
            'x-api-key': ANALYTICS_API_KEY,
            'Content-Type': 'application/json',
          },
        });

        if (!response.ok) {
          console.error(`Analytics service error: ${response.status} ${response.statusText}`);
          throw new Error('Failed to fetch analytics from analytics service');
        }

        const data = await response.json();
        console.log(`📊 Whitelabel Ultravox analytics data received for ${agentId}:`, data);

        // Process the analytics data for whitelabel display
        const processedData = processAnalyticsData(data, agentId, agent.profitMultiplier, showPricing);
        return NextResponse.json(processedData);
      } catch (error) {
        console.error('Error fetching from analytics service:', error);
        return NextResponse.json({ error: 'Failed to fetch analytics' }, { status: 500 });
      }
    } else {
      // For now, return mock data since we don't have legacy Ultravox API integration
      console.log('Using mock data for whitelabel Ultravox analytics (legacy API not implemented)');
      
      const mockData = {
        totalDuration: 0,
        avgCost: 0,
        callCount: 0,
        failedCalls: 0,
        avgDuration: 0,
        totalCost: 0,
        successRate: 100,
        costBreakdown: {
          llm: 0,
          stt: 0,
          tts: 0,
          ultravox: 0,
        },
        failureReasons: [],
      };

      return NextResponse.json(mockData);
    }
  } catch (error) {
    console.error('[whitelabel/ultravox-agents/analytics] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

function processAnalyticsData(data: any[], agentId: string, profitMultiplier: number, showPricing: boolean) {
  // Extract product costs
  const productCosts = data.find(d => d.name === "Product Costs")?.result || [];

  // Extract other analytics data
  const totalDuration = data.find(d => d.name === "Total Call Duration")?.result.find((r: any) => r.agentId === agentId)?.sumDuration || 0;
  const avgCost = data.find(d => d.name === "Average Call Cost")?.result.find((r: any) => r.agentId === agentId)?.avgCost || 0;
  const callCount = parseInt(data.find(d => d.name === "Number of Calls by Assistants")?.result.find((r: any) => r.agentId === agentId)?.countId || '0');
  const failedCalls = parseInt(data.find(d => d.name === "Number of Failed Calls")?.result.find((r: any) => r.agentId === agentId && r.endedReason === "failed")?.countId || '0');
  const avgDuration = data.find(d => d.name === "Average Call Duration by Assistant")?.result.find((r: any) => r.agentId === agentId)?.avgDuration || 0;
  const totalCost = data.find(d => d.name === "Total Spent")?.result.find((r: any) => r.agentId === agentId)?.sumCost || 0;

  // Calculate success rate
  const successfulCalls = callCount - failedCalls;
  const successRate = callCount > 0 ? (successfulCalls / callCount) * 100 : 0;

  // Process cost breakdown from product costs
  const costBreakdown = productCosts.reduce((acc: any, item: any) => {
    const product = item.product?.toLowerCase();
    if (product) {
      acc[product] = item.cost || 0;
    }
    return acc;
  }, { llm: 0, stt: 0, tts: 0, ultravox: 0 });

  // Apply profit multiplier and convert from cents to dollars if pricing should be shown
  const processedData = {
    totalDuration,
    avgCost: showPricing ? (avgCost * profitMultiplier) / 100 : 0, // Convert from cents to dollars
    callCount,
    failedCalls,
    avgDuration: parseFloat(avgDuration) || 0,
    totalCost: showPricing ? (totalCost * profitMultiplier) / 100 : 0, // Convert from cents to dollars
    successRate,
    costBreakdown: showPricing ? {
      llm: (costBreakdown.llm * profitMultiplier) / 100,
      stt: (costBreakdown.stt * profitMultiplier) / 100,
      tts: (costBreakdown.tts * profitMultiplier) / 100,
      ultravox: (costBreakdown.ultravox * profitMultiplier) / 100,
    } : { llm: 0, stt: 0, tts: 0, ultravox: 0 },
    productCosts: showPricing ? productCosts.map((item: any) => ({
      ...item,
      cost: (item.cost * profitMultiplier) / 100 // Convert from cents to dollars
    })) : [],
    failureReasons: [], // TODO: Extract failure reasons from analytics data
  };

  return processedData;
}
