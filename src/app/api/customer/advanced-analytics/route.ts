import { NextResponse } from 'next/server';

// This route uses dynamic features, so it must be server-rendered
export const dynamic = 'force-dynamic';

import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/prisma';
import { formatDateForAnalytics, getDefaultStartDate } from '@/lib/dateUtils';

// Environment variables for analytics service
const ANALYTICS_API_URL = process.env.ANALYTICS_API_URL || 'http://localhost:8001';
const ANALYTICS_API_KEY = process.env.ANALYTICS_API_KEY || 'your_api_key_for_standard_access';
// Environment variable to control analytics API version (default: v1)
const ANALYTICS_API_VERSION = process.env.ANALYTICS_API_VERSION || 'v1';

export async function GET(request: Request) {
  try {
    // Get the authenticated user
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get URL parameters
    const url = new URL(request.url);

    // Format dates to match the expected format (YYYY-MM-DDThh:mm:ss)
    const rawStartDate = url.searchParams.get('start_date') || getDefaultStartDate();
    const rawEndDate = url.searchParams.get('end_date') || new Date().toISOString();

    // Parse and format dates to remove milliseconds
    const startDate = formatDateForAnalytics(rawStartDate, true); // Start of day
    const endDate = formatDateForAnalytics(rawEndDate, false);   // End of day

    // Get the customer ID from the user's onboarding data
    const onboarding = await prisma.userOnboarding.findUnique({
      where: { userId },
      include: {
        partner: true
      }
    });

    if (!onboarding) {
      return NextResponse.json({ error: 'User onboarding data not found' }, { status: 404 });
    }

    // Check if advanced analytics is enabled for this customer
    const userHasAnalytics = onboarding.enableAdvancedAnalytics === true;

    console.log('Advanced Analytics Access Check:', {
      customerId: onboarding.id,
      userId: onboarding.userId,
      userHasAnalytics,
      userSettings: {
        enableAdvancedAnalytics: onboarding.enableAdvancedAnalytics
      }
    });

    if (!userHasAnalytics) {
      return NextResponse.json({
        error: 'Advanced analytics not enabled',
        message: 'Advanced analytics is not enabled for your account. Please contact your partner for access.'
      }, { status: 403 });
    }

    // Fetch analytics data from the analytics service
    const customerId = onboarding.id;
    // V2 and V3 use the same URL pattern /{version}/analytics/customer/{id}
    const endpoint = (ANALYTICS_API_VERSION === 'v2' || ANALYTICS_API_VERSION === 'v3')
      ? `${ANALYTICS_API_URL}/${ANALYTICS_API_VERSION}/analytics/customer/${customerId}?period=month&v1_compatible=true`
      : `${ANALYTICS_API_URL}/api/v1/app/customer/${customerId}/analytics?period=month`;

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
      return NextResponse.json({
        error: 'Failed to fetch analytics data',
        message: 'There was an error fetching your analytics data. Please try again later.'
      }, { status: 500 });
    }

    const analyticsData = await response.json();

    return NextResponse.json(analyticsData);
  } catch (error) {
    console.error('Error in advanced analytics API:', error);
    return NextResponse.json({
      error: 'Internal server error',
      message: 'An unexpected error occurred. Please try again later.'
    }, { status: 500 });
  }
}


