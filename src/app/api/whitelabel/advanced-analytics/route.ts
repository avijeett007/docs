import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyCustomerJWT } from '@/lib/customerJwt';
import { prisma } from '@/lib/prisma';
import { formatDateForAnalytics, getDefaultStartDate } from '@/lib/dateUtils';

// Mark this route as dynamic
export const dynamic = 'force-dynamic';

// Environment variables for analytics service
const ANALYTICS_API_URL = process.env.ANALYTICS_API_URL;
const ANALYTICS_API_KEY = process.env.ANALYTICS_STANDARD_API_KEY;
// Environment variable to control analytics API version (default: v1)
const ANALYTICS_API_VERSION = process.env.ANALYTICS_API_VERSION || 'v1';

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

    // Get URL parameters
    const url = new URL(request.url);

    // Format dates to match the expected format (YYYY-MM-DDThh:mm:ss)
    const rawStartDate = url.searchParams.get('start_date') || getDefaultStartDate();
    const rawEndDate = url.searchParams.get('end_date') || new Date().toISOString();

    // Parse and format dates to remove milliseconds
    const startDate = formatDateForAnalytics(rawStartDate, true); // Start of day
    const endDate = formatDateForAnalytics(rawEndDate, false);   // End of day

    // Get the customer record
    const customer = await prisma.customer.findUnique({
      where: { id: customerId },
      select: {
        id: true,
        email: true
      }
    });

    if (!customer) {
      console.log(`Customer ${customerId} not found`);
      return NextResponse.json({ error: 'Customer not found' }, { status: 404 });
    }

    // Get the customer's features from the UserOnboarding table using email match
    const userOnboarding = await prisma.userOnboarding.findFirst({
      where: {
        email: customer.email,
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
    const userHasAnalytics = userOnboarding.enableAdvancedAnalytics === true;

    console.log('Advanced Analytics Access Check:', {
      customerId: customerId, // Use actual customer ID
      userOnboardingId: userOnboarding.id,
      customerEmail: customer.email,
      userHasAnalytics,
      userSettings: {
        enableAdvancedAnalytics: userOnboarding.enableAdvancedAnalytics
      }
    });

    if (!userHasAnalytics) {
      return NextResponse.json({
        error: 'Advanced analytics not enabled',
        message: 'Advanced analytics is not enabled for your account. Please contact your partner for access.'
      }, { status: 403 });
    }

    // Validate required environment variables
    if (!ANALYTICS_API_URL || !ANALYTICS_API_KEY) {
      console.error('Missing required environment variables for analytics service');
      return NextResponse.json({
        error: 'Service configuration error',
        message: 'Analytics service is not properly configured. Please contact support.'
      }, { status: 500 });
    }

    // Use the actual customer.id for the analytics service (not userOnboarding.id)
    const analyticsCustomerId = customerId;

    console.log(`Fetching analytics data for customer ${analyticsCustomerId} from ${startDate} to ${endDate}`);

    // Fetch analytics data from the analytics service using correct advanced analytics endpoint
    // V2 and V3 use the same URL pattern /{version}/analytics/customer/{id}
    const endpoint = (ANALYTICS_API_VERSION === 'v2' || ANALYTICS_API_VERSION === 'v3')
      ? `${ANALYTICS_API_URL}/${ANALYTICS_API_VERSION}/analytics/customer/${analyticsCustomerId}?period=30d&v1_compatible=true`
      : `${ANALYTICS_API_URL}/api/v1/app/customer/${analyticsCustomerId}/advanced-analytics?period=30d`;

    const response = await fetch(
      endpoint,
      {
        method: 'GET',
        headers: {
          'accept': 'application/json',
          'x-api-key': ANALYTICS_API_KEY
        }
      }
    );

    if (!response.ok) {
      console.error('Analytics API error:', response.status, response.statusText);

      // Try to get more detailed error information
      try {
        const errorData = await response.text();
        console.error('Analytics API error details:', errorData);
      } catch (err) {
        console.error('Could not parse error response:', err);
      }

      // Handle 404 errors gracefully by returning an empty object with default structure
      if (response.status === 404) {
        console.log('No analytics data found, returning empty data structure');
        return NextResponse.json({
          customer_id: analyticsCustomerId,
          sentiment_history: [],
          top_topics: [],
          common_issues: [],
          product_interests: [],
          call_outcome_stats: {
            successful: 0,
            follow_up_needed: 0,
            unsuccessful: 0
          },
          booking_metrics: {
            total_bookings: 0,
            conversion_rate: 0
          }
        });
      }

      // For other errors, still return an error message but with a 500 status
      return NextResponse.json({
        error: 'Failed to fetch analytics data',
        message: 'There was an error fetching your analytics data. Please try again later.'
      }, { status: 500 });
    }

    const analyticsData = await response.json();
    console.log('Successfully fetched analytics data');

    // Transform the new analytics service data to match the legacy component format
    // plus new Phase 7 aggregation fields
    const data = analyticsData.data || {};
    const transformedData = {
      customer_id: analyticsData.customerId || analyticsCustomerId,
      sentiment_history: data.sentimentAnalysis?.trend?.map((score: number, index: number) => ({
        timestamp: new Date(Date.now() - (index * 24 * 60 * 60 * 1000)).toISOString(),
        sentiment_score: score,
        call_id: `call_${index}`
      })) || [],
      top_topics: data.topicAnalysis?.topics?.map((topic: any) => ({
        topic: topic.name,
        count: topic.count
      })) || [],
      common_issues: data.commonIssues?.map((item: any) => ({
        issue: item.issue,
        count: item.count
      })) || [],
      product_interests: data.productInterests?.map((item: any) => ({
        product: item.product,
        count: item.count
      })) || [],
      call_outcome_stats: {
        successful: data.conversionMetrics?.successful || 0,
        follow_up_needed: Math.round((data.actionItems?.followUpRate || 0) / 100 * (data.conversionMetrics?.opportunities || 0)),
        unsuccessful: (data.conversionMetrics?.opportunities || 0) - (data.conversionMetrics?.successful || 0)
      },
      booking_metrics: {
        total_bookings: data.conversionMetrics?.successful || 0,
        conversion_rate: data.conversionMetrics?.rate || 0
      },
      // New Phase 7 aggregation fields (passed through from Python service)
      intent_distribution: data.intentDistribution || [],
      outcome_breakdown: data.outcomeBreakdown || { successful: 0, unsuccessful: 0, escalated: 0, inconclusive: 0 },
      customer_satisfaction: data.customerSatisfaction || { satisfied: 0, neutral: 0, dissatisfied: 0 },
      conversion_funnel: data.conversionFunnel || { ready_to_buy: 0, needs_more_info: 0, not_interested: 0 },
      sentiment_breakdown: data.sentimentBreakdown || { avg_customer: null, avg_agent: null },
      follow_up_rate: data.followUpRate || 0,
    };

    return NextResponse.json(transformedData);
  } catch (error) {
    console.error('Error in whitelabel advanced analytics API:', error);
    return NextResponse.json({
      error: 'Internal server error',
      message: 'An unexpected error occurred. Please try again later.'
    }, { status: 500 });
  }
}
