import { NextResponse, NextRequest } from 'next/server';
import { cookies } from 'next/headers';
import { verifyCustomerJWT } from '@/lib/customerJwt';

export const dynamic = 'force-dynamic';

const ANALYTICS_API_URL = process.env.ANALYTICS_API_URL;
const ANALYTICS_API_KEY = process.env.ANALYTICS_STANDARD_API_KEY;
// Environment variable to control analytics API version (default: v1)
const ANALYTICS_API_VERSION = process.env.ANALYTICS_API_VERSION || 'v1';

export async function GET(request: NextRequest) {
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

    // Parse query params
    const searchParams = request.nextUrl.searchParams;
    const agentId = searchParams.get('agentId');
    const period = searchParams.get('period') || '30d';

    console.log('Fetching advanced analytics from analytics service:', { 
      customerId,
      agentId,
      period
    });

    let endpoint;
    // V2 and V3 use the same URL pattern /{version}/analytics/{type}/{id}
    if (agentId) {
      // Get analytics for specific agent
      endpoint = (ANALYTICS_API_VERSION === 'v2' || ANALYTICS_API_VERSION === 'v3')
        ? `${ANALYTICS_API_URL}/${ANALYTICS_API_VERSION}/analytics/agent/${agentId}?period=${period}&v1_compatible=true`
        : `${ANALYTICS_API_URL}/api/v1/app/agent/${agentId}/advanced-analytics?period=${period}`;
    } else {
      // Get aggregated analytics for customer
      endpoint = (ANALYTICS_API_VERSION === 'v2' || ANALYTICS_API_VERSION === 'v3')
        ? `${ANALYTICS_API_URL}/${ANALYTICS_API_VERSION}/analytics/customer/${customerId}?period=${period}&v1_compatible=true`
        : `${ANALYTICS_API_URL}/api/v1/app/customer/${customerId}/advanced-analytics?period=${period}`;
    }

    // Make request to analytics service
    const response = await fetch(endpoint, {
      headers: {
        'x-api-key': ANALYTICS_API_KEY,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      console.error(`Analytics service error: ${response.status}`);
      // Return empty analytics instead of error
      const errorResponse = NextResponse.json({
        sentimentData: [],
        topicData: [],
        keyMomentData: [],
        actionItemData: [],
        callVolumeData: []
      });
      errorResponse.headers.set('Cache-Control', 'no-cache, no-store, must-revalidate');
      errorResponse.headers.set('Pragma', 'no-cache');
      errorResponse.headers.set('Expires', '0');
      return errorResponse;
    }

    const analyticsData = await response.json();
    
    if (!analyticsData) {
      console.warn('No analytics data received from service');
      const errorResponse = NextResponse.json({
        sentimentData: [],
        topicData: [],
        keyMomentData: [],
        actionItemData: [],
        callVolumeData: []
      });
      errorResponse.headers.set('Cache-Control', 'no-cache, no-store, must-revalidate');
      errorResponse.headers.set('Pragma', 'no-cache');
      errorResponse.headers.set('Expires', '0');
      return errorResponse;
    }

    // Analytics service returns data directly at root level, not nested under 'data'
    const data = analyticsData;

    // Transform analytics service data to match expected format
    const transformedData = {
      sentimentData: [
        { sentiment: 'Positive', count: data.sentimentAnalysis?.distribution?.positive || 0 },
        { sentiment: 'Neutral', count: data.sentimentAnalysis?.distribution?.neutral || 0 },
        { sentiment: 'Negative', count: data.sentimentAnalysis?.distribution?.negative || 0 }
      ],
      topicData: (data.topicAnalysis?.topics || []).map((topic: any) => ({
        topic: topic.name,
        count: topic.count
      })),
      keyMomentData: (data.keyMoments?.frequency || []).map((moment: any) => ({
        type: moment.type,
        count: moment.count
      })),
      actionItemData: (data.actionItems?.common || []).map((item: any) => ({
        action: item.action,
        count: item.count
      })),
      callVolumeData: (data.callVolumeOverTime?.daily || []).map((day: any) => ({
        date: day.date,
        count: day.calls
      }))
    };

    console.log('Successfully loaded advanced analytics from analytics service:', {
      sentiment: transformedData.sentimentData.length,
      topics: transformedData.topicData.length,
      keyMoments: transformedData.keyMomentData.length,
      actionItems: transformedData.actionItemData.length,
      callVolume: transformedData.callVolumeData.length
    });

    // Add cache-busting headers to ensure fresh analytics data
    const nextResponse = NextResponse.json(transformedData);
    nextResponse.headers.set('Cache-Control', 'no-cache, no-store, must-revalidate');
    nextResponse.headers.set('Pragma', 'no-cache');
    nextResponse.headers.set('Expires', '0');
    return nextResponse;

  } catch (error) {
    console.error('Error fetching advanced analytics from analytics service:', error);
    
    // Return empty analytics instead of error
    const errorResponse = NextResponse.json({
      sentimentData: [],
      topicData: [],
      keyMomentData: [],
      actionItemData: [],
      callVolumeData: []
    });
    errorResponse.headers.set('Cache-Control', 'no-cache, no-store, must-revalidate');
    errorResponse.headers.set('Pragma', 'no-cache');
    errorResponse.headers.set('Expires', '0');
    return errorResponse;
  }
}
