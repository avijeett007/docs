import { NextResponse, NextRequest } from 'next/server';
import { cookies } from 'next/headers';
import { verifyCustomerJWT } from '@/lib/customerJwt';

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
function convertV3CostsToDollars(data: any): any {
  if (ANALYTICS_API_VERSION !== 'v3' || !data) {
    return data;
  }

  return {
    ...data,
    totalCost: data.totalCost != null ? data.totalCost / 100 : 0,
    avgCost: data.avgCost != null ? data.avgCost / 100 : 0,
    costBreakdown: data.costBreakdown ? {
      llm: data.costBreakdown.llm != null ? data.costBreakdown.llm / 100 : 0,
      stt: data.costBreakdown.stt != null ? data.costBreakdown.stt / 100 : 0,
      tts: data.costBreakdown.tts != null ? data.costBreakdown.tts / 100 : 0,
      provider: data.costBreakdown.provider != null ? data.costBreakdown.provider / 100 : 0
    } : data.costBreakdown
  };
}

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
    const period = searchParams.get('period') || 'month';

    console.log('Fetching dashboard data from analytics service:', { 
      customerId,
      period
    });

    // Make parallel requests for dashboard data
    // V2 and V3 use the same URL pattern /{version}/analytics/customer/{id}
    const analyticsEndpoint = (ANALYTICS_API_VERSION === 'v2' || ANALYTICS_API_VERSION === 'v3')
      ? `${ANALYTICS_API_URL}/${ANALYTICS_API_VERSION}/analytics/customer/${customerId}?period=${period}&v1_compatible=true`
      : `${ANALYTICS_API_URL}/api/v1/app/customer/${customerId}/analytics?period=${period}`;

    const [analyticsResponse, conversationsResponse] = await Promise.all([
      // Get basic analytics
      fetch(
        analyticsEndpoint,
        {
          headers: {
            'x-api-key': ANALYTICS_API_KEY,
            'Content-Type': 'application/json'
          }
        }
      ),
      // Get recent conversations (V2 doesn't have conversations endpoint, so always use V1)
      fetch(
        `${ANALYTICS_API_URL}/api/v1/app/customer/${customerId}/conversations?period=7d&limit=5`,
        {
          headers: {
            'x-api-key': ANALYTICS_API_KEY,
            'Content-Type': 'application/json'
          }
        }
      )
    ]);

    let analyticsData = null;
    let conversationsData = null;

    // Handle analytics response
    if (analyticsResponse.ok) {
      analyticsData = await analyticsResponse.json();
      // V3 returns costs in cents, convert to dollars for consistency with V1/V2
      if (ANALYTICS_API_VERSION === 'v3') {
        analyticsData = convertV3CostsToDollars(analyticsData);
        console.log('Converted V3 costs from cents to dollars');
      }
    } else {
      console.error(`Analytics service error: ${analyticsResponse.status}`);
    }

    // Handle conversations response
    if (conversationsResponse.ok) {
      conversationsData = await conversationsResponse.json();
    } else {
      console.error(`Conversations service error: ${conversationsResponse.status}`);
    }

    // Transform analytics data - analytics service returns data at root level
    const analytics = analyticsData || {};
    const totalCalls = analytics.totalCalls || 0;
    const totalConversations = analytics.totalConversations || totalCalls; // Fallback to totalCalls if not available
    const totalDuration = analytics.totalDuration || 0;
    const totalCost = analytics.totalCost || 0;

    // Transform conversations data - handle both nested and root level
    const conversations = conversationsData?.conversations || conversationsData?.data || [];
    const recentCalls = conversations.slice(0, 5).map((conv: any) => {
      // Calculate duration from startedAt and endedAt
      let durationSeconds = 0;
      if (conv.startedAt && conv.endedAt) {
        const startTime = new Date(conv.startedAt).getTime();
        const endTime = typeof conv.endedAt === 'number' ? conv.endedAt : new Date(conv.endedAt).getTime();
        durationSeconds = Math.floor((endTime - startTime) / 1000);
      }

      const durationMinutes = Math.floor(durationSeconds / 60);
      const remainingSeconds = durationSeconds % 60;
      const duration = `${durationMinutes}:${remainingSeconds.toString().padStart(2, '0')}`;

      return {
        id: conv.id,
        agent: conv.agentName || conv.agent_name || 'Unknown Agent',
        caller: conv.caller || conv.phoneNumber || 'Unknown Caller',
        duration,
        status: conv.status === 'completed' ? 'Completed' : 'Failed',
        time: conv.startedAt ? new Date(conv.startedAt).toLocaleString() : 'Unknown Time'
      };
    });

    // Generate call trend data from analytics service
    const callVolumeByDay = analytics.callVolumeByDay || [];

    // Create a map of dates to calls for easy lookup using actual dates
    const callsByDate = new Map();
    callVolumeByDay.forEach((dayData: any) => {
      const dateKey = new Date(dayData.date).toISOString().split('T')[0]; // "2024-01-15"
      callsByDate.set(dateKey, dayData.calls);
    });

    // Generate last 7 days in order
    const today = new Date();
    const fullCallTrend = [];

    for (let i = 6; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      const dateKey = date.toISOString().split('T')[0];
      const dayName = date.toLocaleDateString('en-US', { weekday: 'short' });
      const calls = callsByDate.get(dateKey) || 0;
      fullCallTrend.push({ day: dayName, calls });
    }

    const dashboardData = {
      summary: {
        totalCalls,
        totalConversations,
        totalDuration, // Keep in seconds for frontend formatting
        totalCost,
        averageCallDuration: analytics.averageCallDuration || 0
      },
      recentCalls,
      callTrend: fullCallTrend,
      agentCount: analytics.agentCount || 0 // Get from analytics service
    };

    console.log('Successfully loaded dashboard data from analytics service:', {
      totalCalls,
      recentCallsCount: recentCalls.length,
      callTrendDays: fullCallTrend.length
    });

    return NextResponse.json(dashboardData);

  } catch (error) {
    console.error('Error fetching dashboard data from analytics service:', error);
    
    // Return empty dashboard data instead of error
    const today = new Date();
    const emptyCallTrend = [];

    for (let i = 6; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      const dayName = date.toLocaleDateString('en-US', { weekday: 'short' });
      emptyCallTrend.push({ day: dayName, calls: 0 });
    }

    return NextResponse.json({
      summary: {
        totalCalls: 0,
        totalConversations: 0,
        totalDuration: 0,
        totalCost: 0,
        averageCallDuration: 0
      },
      recentCalls: [],
      callTrend: emptyCallTrend,
      agentCount: 0
    });
  }
}
