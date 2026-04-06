import { NextResponse, NextRequest } from 'next/server';
import { verifyPartnerJWT } from '@/lib/auth';
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

    // Verify JWT and get partner
    const auth = await verifyPartnerJWT(request);
    if (!auth.isValid) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const partnerId = auth.payload?.partnerId;
    if (!partnerId) {
      return NextResponse.json(
        { error: 'Invalid partner ID' },
        { status: 401 }
      );
    }

    // Verify agent ownership (check all agent types: VAPI, Retell, Ultravox, GHL, and ElevenLabs)
    const vapiAgent = await prisma.vapiAgent.findFirst({
      where: { id: params.agentId, partnerId },
      select: {
        id: true,
        profitMultiplier: true,
        analyticsAgentId: true,
        name: true
      }
    });

    const retellAgent = await prisma.retellAgent.findFirst({
      where: { id: params.agentId, partnerId },
      select: {
        id: true,
        profitMultiplier: true,
        analyticsAgentId: true,
        name: true
      }
    });

    const ultravoxAgent = await prisma.ultravoxAgent.findFirst({
      where: { id: params.agentId, partnerId },
      select: {
        id: true,
        profitMultiplier: true,
        analyticsAgentId: true,
        name: true
      }
    });

    const ghlAgent = await prisma.ghlAgent.findFirst({
      where: { id: params.agentId, partnerId },
      select: {
        id: true,
        profitMultiplier: true,
        analyticsAgentId: true,
        name: true
      }
    });

    const elevenLabsAgent = await prisma.elevenLabsAgent.findFirst({
      where: { id: params.agentId, partnerId },
      select: {
        id: true,
        profitMultiplier: true,
        analyticsAgentId: true,
        name: true
      }
    });

    const agent = vapiAgent || retellAgent || ultravoxAgent || ghlAgent || elevenLabsAgent;
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

    console.log('Fetching agent analytics from analytics service:', {
      agentId: params.agentId,
      period,
      startDate,
      endDate,
      analyticsApiUrl: ANALYTICS_API_URL,
      hasApiKey: !!ANALYTICS_API_KEY,
      agentFound: !!agent
    });

    // Build query string with cache-busting timestamp
    const timestamp = Date.now();
    let queryString = `period=${period}&_t=${timestamp}`;
    if (startDate) queryString += `&start_date=${startDate}`;
    if (endDate) queryString += `&end_date=${endDate}`;

    // Make request to analytics service using the provider agent ID (agent.id)
    const providerAgentId = agent.id;
    // V2 and V3 use the same URL pattern /{version}/analytics/agent/{id}
    const analyticsUrl = (ANALYTICS_API_VERSION === 'v2' || ANALYTICS_API_VERSION === 'v3')
      ? `${ANALYTICS_API_URL}/${ANALYTICS_API_VERSION}/analytics/agent/${providerAgentId}?${queryString}&v1_compatible=true`
      : `${ANALYTICS_API_URL}/api/v1/app/agent/${providerAgentId}/analytics?${queryString}`;
    console.log(`Calling analytics service ${ANALYTICS_API_VERSION.toUpperCase()}:`, analyticsUrl);
    console.log('Request headers:', {
      'x-api-key': ANALYTICS_API_KEY,
      'Content-Type': 'application/json'
    });
    console.log('Agent details:', {
      databaseAgentId: params.agentId,
      providerAgentId: providerAgentId,
      analyticsAgentId: agent.analyticsAgentId,
      profitMultiplier: agent.profitMultiplier
    });

    // Both V1 and V2 use the same authentication method (x-api-key)
    const response = await fetch(analyticsUrl, {
      headers: {
        'x-api-key': ANALYTICS_API_KEY,
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache'
      }
    });

    console.log('Analytics service response status:', response.status);
    console.log('Analytics service response headers:', Object.fromEntries(response.headers.entries()));

    if (!response.ok) {
      console.error(`Analytics service error: ${response.status}`);
      const errorText = await response.text();
      console.error('Analytics service error response:', errorText);
      // Return empty analytics instead of error
      const errorResponse = NextResponse.json([]);
      errorResponse.headers.set('Cache-Control', 'no-cache, no-store, must-revalidate, max-age=0');
      errorResponse.headers.set('Pragma', 'no-cache');
      errorResponse.headers.set('Expires', '0');
      errorResponse.headers.set('ETag', `"${Date.now()}"`);
      errorResponse.headers.set('Last-Modified', new Date().toUTCString());
      errorResponse.headers.set('Vary', '*');
      return errorResponse;
    }

    let analyticsData = await response.json();
    console.log(`${ANALYTICS_API_VERSION.toUpperCase()} analytics service response for agent:`, JSON.stringify(analyticsData, null, 2));

    // V3 returns costs in cents, convert to dollars for consistency with V1/V2
    if (ANALYTICS_API_VERSION === 'v3' && Array.isArray(analyticsData)) {
      analyticsData = convertV3CostsToDollars(analyticsData);
      console.log('Converted V3 costs from cents to dollars');
    }

    // Both V1 and V2 return the expected format for agent analytics
    console.log(`Returning ${ANALYTICS_API_VERSION.toUpperCase()} analytics data directly`);
    const nextResponse = NextResponse.json(analyticsData);
    nextResponse.headers.set('Cache-Control', 'no-cache, no-store, must-revalidate, max-age=0');
    nextResponse.headers.set('Pragma', 'no-cache');
    nextResponse.headers.set('Expires', '0');
    nextResponse.headers.set('ETag', `"${Date.now()}"`);
    nextResponse.headers.set('Last-Modified', new Date().toUTCString());
    nextResponse.headers.set('Vary', '*');
    return nextResponse;

  } catch (error) {
    console.error('Error fetching agent analytics from analytics service:', error);
    
    // Return empty analytics instead of error
    const errorResponse = NextResponse.json([]);
    errorResponse.headers.set('Cache-Control', 'no-cache, no-store, must-revalidate, max-age=0');
    errorResponse.headers.set('Pragma', 'no-cache');
    errorResponse.headers.set('Expires', '0');
    errorResponse.headers.set('ETag', `"${Date.now()}"`);
    errorResponse.headers.set('Last-Modified', new Date().toUTCString());
    errorResponse.headers.set('Vary', '*');
    return errorResponse;
  }
}
