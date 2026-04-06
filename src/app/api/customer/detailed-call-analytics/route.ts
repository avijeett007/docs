import { NextResponse } from 'next/server';

// This route uses dynamic features, so it must be server-rendered
export const dynamic = 'force-dynamic';

import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/prisma';
import { formatDateForAnalytics, getDefaultStartDate } from '@/lib/dateUtils';

// Environment variables for analytics service
const ANALYTICS_API_URL = process.env.ANALYTICS_API_URL || 'http://localhost:8001';
const ANALYTICS_API_KEY = process.env.ANALYTICS_API_KEY || 'your_api_key_for_standard_access';

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
    const agentId = url.searchParams.get('agent_id');
    const page = parseInt(url.searchParams.get('page') || '1');
    const pageSize = parseInt(url.searchParams.get('page_size') || '10');

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

    // Check if detailed call analysis is enabled for this customer
    const userHasDetailedCallAnalysis = onboarding.enableDetailedCallAnalysis === true;

    console.log('Detailed Call Analysis Access Check:', {
      customerId: onboarding.id,
      userId: onboarding.userId,
      userHasDetailedCallAnalysis,
      userSettings: {
        enableDetailedCallAnalysis: onboarding.enableDetailedCallAnalysis
      }
    });

    if (!userHasDetailedCallAnalysis) {
      return NextResponse.json({
        error: 'Detailed call analysis not enabled',
        message: 'Detailed call analysis is not enabled for your account. Please contact your partner for access.'
      }, { status: 403 });
    }

    // Construct the API URL
    let apiUrl;

    // If agent ID is provided, get calls for that specific agent
    if (agentId) {
      apiUrl = `${ANALYTICS_API_URL}/api/v1/analytics/agent/${agentId}/calls`;
    } else {
      // If no agent ID is provided, get the first agent associated with this customer
      // We need to fetch the agent ID first

      // Get the customer record for the authenticated user
      const customer = await prisma.customer.findUnique({
        where: { userId },
        include: {
          vapiAgents: {
            select: {
              id: true,
              name: true
            },
            take: 1
          },
          retellAgents: {
            where: { isActive: true },
            select: {
              id: true,
              name: true
            },
            take: 1
          }
        }
      });

      if (!customer) {
        return NextResponse.json({ error: 'Customer not found' }, { status: 404 });
      }

      // Check if the customer has any agents
      if (customer.vapiAgents.length > 0) {
        apiUrl = `${ANALYTICS_API_URL}/api/v1/analytics/agent/${customer.vapiAgents[0].id}/calls`;
      } else if (customer.retellAgents.length > 0) {
        apiUrl = `${ANALYTICS_API_URL}/api/v1/analytics/agent/${customer.retellAgents[0].id}/calls`;
      } else {
        return NextResponse.json({
          error: 'No agents found',
          message: 'No agents are associated with your account. Please contact your partner for assistance.'
        }, { status: 404 });
      }
    }

    // Add query parameters
    apiUrl += `?start_date=${encodeURIComponent(startDate)}&end_date=${encodeURIComponent(endDate)}&page=${page}&page_size=${pageSize}`;

    console.log('Calling analytics API with URL:', apiUrl);

    // Fetch detailed call analytics data from the analytics service
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'accept': 'application/json',
        'x-api-key': ANALYTICS_API_KEY
      }
    });

    if (!response.ok) {
      console.error('Analytics API error:', response.status, response.statusText);

      // Try to get more detailed error information
      try {
        const errorData = await response.text();
        console.error('Analytics API error details:', errorData);
      } catch (err) {
        console.error('Could not parse error response:', err);
      }

      return NextResponse.json({
        error: 'Failed to fetch detailed call analytics data',
        message: 'There was an error fetching your detailed call analytics data. Please try again later.'
      }, { status: 500 });
    }

    const detailedCallAnalyticsData = await response.json();

    return NextResponse.json(detailedCallAnalyticsData);
  } catch (error) {
    console.error('Error in detailed call analytics API:', error);
    return NextResponse.json({
      error: 'Internal server error',
      message: 'An unexpected error occurred. Please try again later.'
    }, { status: 500 });
  }
}
