import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyCustomerJWT } from '@/lib/customerJwt';
import { prisma } from '@/lib/prisma';
import { formatDateForAnalytics, getDefaultStartDate } from '@/lib/dateUtils';

// Environment variables for analytics service
const ANALYTICS_API_URL = process.env.ANALYTICS_API_URL;
const ANALYTICS_API_KEY = process.env.ANALYTICS_STANDARD_API_KEY;
// Environment variable to control analytics API version (default: v1)
const ANALYTICS_API_VERSION = process.env.ANALYTICS_API_VERSION || 'v1';

// Mark this route as dynamic
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    // Get the customer token from cookies
    const cookieStore = cookies();
    const token = cookieStore.get('customer_token')?.value;

    if (!token) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Verify the token
    const payload = await verifyCustomerJWT(token);
    if (!payload) {
      return NextResponse.json(
        { error: 'Invalid token' },
        { status: 401 }
      );
    }

    // Get the customer ID and partner ID from the token
    const { customerId, partnerId } = payload;

    // Get the customer record
    const customer = await prisma.customer.findUnique({
      where: { id: customerId },
      include: {
        credentials: {
          where: { partnerId },
          select: { partnerId: true }
        }
      }
    });

    if (!customer) {
      return NextResponse.json({ error: 'Customer not found' }, { status: 404 });
    }

    // Get the customer record to find their email
    const customerRecord = await prisma.customer.findUnique({
      where: { id: customerId },
      select: { email: true }
    });

    if (!customerRecord || !customerRecord.email) {
      console.log(`Customer ${customerId} has no email`);
      return NextResponse.json({
        error: 'Advanced analytics not enabled',
        message: 'Advanced analytics is not enabled for your account. Please contact your partner for access.'
      }, { status: 403 });
    }

    // Get the customer's features from the UserOnboarding table using email match
    const userOnboarding = await prisma.userOnboarding.findFirst({
      where: {
        email: customerRecord.email,
        partnerId: partnerId
      },
      select: {
        id: true,
        enableAdvancedAnalytics: true
      }
    });

    if (!userOnboarding) {
      console.log(`No user onboarding record found for customer ${customerId} and partner ${partnerId}`);
      return NextResponse.json({
        error: 'Advanced analytics not enabled',
        message: 'Advanced analytics is not enabled for your account. Please contact your partner for access.'
      }, { status: 403 });
    }

    // Check if advanced analytics is enabled
    if (!userOnboarding.enableAdvancedAnalytics) {
      return NextResponse.json({
        error: 'Advanced analytics not enabled',
        message: 'Advanced analytics is not enabled for your account. Please contact your partner for access.'
      }, { status: 403 });
    }

    // Get URL parameters
    const url = new URL(request.url);

    // Format dates to match the expected format (YYYY-MM-DDThh:mm:ss)
    const rawStartDate = url.searchParams.get('start_date') || getDefaultStartDate();
    const rawEndDate = url.searchParams.get('end_date') || new Date().toISOString();

    // Parse and format dates to remove milliseconds
    const startDate = formatDateForAnalytics(rawStartDate, true); // Start of day
    const endDate = formatDateForAnalytics(rawEndDate, false);   // End of day

    // Use the actual customer.id for the analytics service (not userOnboarding.id)
    const analyticsCustomerId = customerId;

    console.log(`Fetching agent analytics data for customer ${analyticsCustomerId} from ${startDate} to ${endDate}`);

    // Validate required environment variables
    if (!ANALYTICS_API_URL || !ANALYTICS_API_KEY) {
      console.error('Missing required environment variables for analytics service');
      return NextResponse.json({
        error: 'Service configuration error',
        message: 'Analytics service is not properly configured. Please contact support.'
      }, { status: 500 });
    }

    // Fetch both basic and advanced analytics data from the analytics service
    // V2 and V3 use the same URL pattern /{version}/analytics/customer/{id}
    const basicAnalyticsEndpoint = (ANALYTICS_API_VERSION === 'v2' || ANALYTICS_API_VERSION === 'v3')
      ? `${ANALYTICS_API_URL}/${ANALYTICS_API_VERSION}/analytics/customer/${analyticsCustomerId}?period=month&v1_compatible=true`
      : `${ANALYTICS_API_URL}/api/v1/app/customer/${analyticsCustomerId}/analytics?period=month`;

    const [basicResponse, advancedResponse] = await Promise.all([
      fetch(
        basicAnalyticsEndpoint,
        {
          method: 'GET',
          headers: {
            'accept': 'application/json',
            'x-api-key': ANALYTICS_API_KEY
          }
        }
      ),
      fetch(
        (ANALYTICS_API_VERSION === 'v2' || ANALYTICS_API_VERSION === 'v3')
          ? `${ANALYTICS_API_URL}/${ANALYTICS_API_VERSION}/analytics/customer/${analyticsCustomerId}?period=30d&v1_compatible=true`
          : `${ANALYTICS_API_URL}/api/v1/app/customer/${analyticsCustomerId}/advanced-analytics?period=30d`,
        {
          method: 'GET',
          headers: {
            'accept': 'application/json',
            'x-api-key': ANALYTICS_API_KEY
          }
        }
      )
    ]);

    // Check if both responses are successful
    if (!basicResponse.ok || !advancedResponse.ok) {
      console.error('Analytics API error:',
        `Basic: ${basicResponse.status} ${basicResponse.statusText}, ` +
        `Advanced: ${advancedResponse.status} ${advancedResponse.statusText}`);

      // Handle 404 errors gracefully by returning an empty array
      if (basicResponse.status === 404 || advancedResponse.status === 404) {
        console.log('No agent analytics data found, returning empty array');
        return NextResponse.json([]);
      }

      // For other errors, still return an error message but with a 500 status
      return NextResponse.json({
        error: 'Failed to fetch agent analytics data',
        message: 'There was an error fetching your agent analytics data. Please try again later.'
      }, { status: 500 });
    }

    const [basicAnalyticsData, advancedAnalyticsData] = await Promise.all([
      basicResponse.json(),
      advancedResponse.json()
    ]);
    console.log('Successfully fetched agent analytics data');

    // Transform the analytics data to match agent analytics format expected by the component
    const agentAnalyticsData = [
      {
        agent_id: "combined",
        agent_name: "All Agents",
        call_count: advancedAnalyticsData.data?.conversionMetrics?.opportunities || basicAnalyticsData.totalCalls || 0,
        avg_duration: (basicAnalyticsData.averageCallDuration || 0) / 60, // Convert seconds to minutes
        avg_sentiment: advancedAnalyticsData.data?.sentimentAnalysis?.averageScore || 0,
        success_rate: (advancedAnalyticsData.data?.conversionMetrics?.rate || 0) / 100, // Convert percentage to decimal
        total_calls: advancedAnalyticsData.data?.conversionMetrics?.opportunities || basicAnalyticsData.totalCalls || 0,
        successful_calls: advancedAnalyticsData.data?.conversionMetrics?.successful || 0,
        top_topics: advancedAnalyticsData.data?.topicAnalysis?.topics?.slice(0, 3) || []
      }
    ];

    return NextResponse.json(agentAnalyticsData);
  } catch (error) {
    console.error('Error fetching agent analytics:', error);
    return NextResponse.json({
      error: 'Internal server error',
      message: 'An unexpected error occurred. Please try again later.'
    }, { status: 500 });
  }
}
