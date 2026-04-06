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
        error: 'Action point analysis not enabled',
        message: 'Action point analysis is not enabled for your account. Please contact your partner for access.'
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
        enableActionPointAnalysis: true
      }
    });

    if (!userOnboarding) {
      console.log(`No user onboarding record found for customer ${customerId} and partner ${partnerId}`);
      return NextResponse.json({
        error: 'Action point analysis not enabled',
        message: 'Action point analysis is not enabled for your account. Please contact your partner for access.'
      }, { status: 403 });
    }

    // Check if action point analysis is enabled
    if (!userOnboarding.enableActionPointAnalysis) {
      return NextResponse.json({
        error: 'Action point analysis not enabled',
        message: 'Action point analysis is not enabled for your account. Please contact your partner for access.'
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

    console.log(`Fetching action points data for customer ${analyticsCustomerId} from ${startDate} to ${endDate}`);

    // Fetch action points data from the analytics service using correct endpoint
    // V2 and V3 use the same URL pattern /{version}/analytics/customer/{id}
    const endpoint = (ANALYTICS_API_VERSION === 'v2' || ANALYTICS_API_VERSION === 'v3')
      ? `${ANALYTICS_API_URL}/${ANALYTICS_API_VERSION}/analytics/customer/${analyticsCustomerId}?period=30d`
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

      // Handle 404 errors gracefully by returning an empty array
      if (response.status === 404) {
        console.log('No action points data found, returning empty array');
        return NextResponse.json([]);
      }

      // For other errors, still return an error message but with a 500 status
      return NextResponse.json({
        error: 'Failed to fetch action points data',
        message: 'There was an error fetching your action points data. Please try again later.'
      }, { status: 500 });
    }

    const analyticsData = await response.json();
    console.log('Successfully fetched action points data');

    // Extract action items from the analytics data and transform to match component expectations
    const actionPointsData = analyticsData.data?.actionItems?.common?.map((item: any, index: number) => ({
      id: `action_${index + 1}`,
      title: `Follow-up Required`,
      description: item.action,
      status: 'pending' as const,
      due_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 days from now
      call_id: `call_${index + 1}`,
      call_date: new Date().toISOString(),
      priority: item.count > 1 ? 'high' as const : 'medium' as const
    })) || [];

    return NextResponse.json(actionPointsData);
  } catch (error) {
    console.error('Error fetching action points:', error);
    return NextResponse.json({
      error: 'Internal server error',
      message: 'An unexpected error occurred. Please try again later.'
    }, { status: 500 });
  }
}
