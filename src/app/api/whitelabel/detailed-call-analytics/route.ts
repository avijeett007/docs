import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyCustomerJWT } from '@/lib/customerJwt';
import { prisma } from '@/lib/prisma';
import { formatDateForAnalytics, getDefaultStartDate } from '@/lib/dateUtils';

// Environment variables for analytics service
const ANALYTICS_API_URL = process.env.ANALYTICS_API_URL;
const ANALYTICS_API_KEY = process.env.ANALYTICS_STANDARD_API_KEY;
// Note: This endpoint only uses V1 analytics as V2 doesn't support conversations endpoints

// Helper function to calculate duration in seconds
function calculateDurationInSeconds(startTime: string | number, endTime: string | number): number {
  if (!startTime || !endTime) return 0;

  const start = typeof startTime === 'string' ? new Date(startTime).getTime() : startTime;
  const end = typeof endTime === 'string' ? new Date(endTime).getTime() : endTime;

  return Math.floor((end - start) / 1000);
}

// Helper function to extract key moments from messages
function extractKeyMoments(messages: any[]): any[] {
  if (!Array.isArray(messages)) return [];

  return messages.slice(0, 3).map((message, index) => ({
    timestamp: message.time || index * 30, // Use message time or estimate
    text: message.message || '',
    type: message.role === 'user' ? 'question' : 'answer'
  }));
}

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
        error: 'Detailed call analysis not enabled',
        message: 'Detailed call analysis is not enabled for your account. Please contact your partner for access.'
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
        enableDetailedCallAnalysis: true
      }
    });

    if (!userOnboarding) {
      console.log(`No user onboarding record found for customer ${customerId} and partner ${partnerId}`);
      return NextResponse.json({
        error: 'Detailed call analysis not enabled',
        message: 'Detailed call analysis is not enabled for your account. Please contact your partner for access.'
      }, { status: 403 });
    }

    // Check if detailed call analysis is enabled
    if (!userOnboarding.enableDetailedCallAnalysis) {
      return NextResponse.json({
        error: 'Detailed call analysis not enabled',
        message: 'Detailed call analysis is not enabled for your account. Please contact your partner for access.'
      }, { status: 403 });
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

    // Construct the API URL
    let apiUrl;

    // If agent ID is provided, get conversations for that specific agent
    if (agentId) {
      // Note: V2 doesn't have conversations endpoint, so always use V1
      apiUrl = `${ANALYTICS_API_URL}/api/v1/app/agent/${agentId}/conversations`;
    } else {
      // If no agent ID is provided, get the first agent associated with this customer
      // We need to fetch the agent ID first

      // Get the customer record with all agent types
      const customerWithAgents = await prisma.customer.findUnique({
        where: { id: customerId },
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
          },
          ultravoxAgents: {
            where: { isActive: true },
            select: {
              id: true,
              name: true
            },
            take: 1
          },
          ghlAgents: {
            select: {
              id: true,
              name: true
            },
            take: 1
          }
        }
      });

      if (!customerWithAgents) {
        return NextResponse.json({ error: 'Customer not found' }, { status: 404 });
      }

      // Check if the customer has any agents (try all agent types)
      let firstAgentId = null;

      if (customerWithAgents.vapiAgents.length > 0) {
        firstAgentId = customerWithAgents.vapiAgents[0].id;
      } else if (customerWithAgents.retellAgents.length > 0) {
        firstAgentId = customerWithAgents.retellAgents[0].id;
      } else if (customerWithAgents.ultravoxAgents.length > 0) {
        firstAgentId = customerWithAgents.ultravoxAgents[0].id;
      } else if (customerWithAgents.ghlAgents.length > 0) {
        firstAgentId = customerWithAgents.ghlAgents[0].id;
      }

      if (firstAgentId) {
        // Note: V2 doesn't have conversations endpoint, so always use V1
        apiUrl = `${ANALYTICS_API_URL}/api/v1/app/agent/${firstAgentId}/conversations`;
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

    // Validate required environment variables
    if (!ANALYTICS_API_URL || !ANALYTICS_API_KEY) {
      console.error('Missing required environment variables for analytics service');
      return NextResponse.json({
        error: 'Service configuration error',
        message: 'Analytics service is not properly configured. Please contact support.'
      }, { status: 500 });
    }

    // Fetch detailed call analytics data from the analytics service
    const response = await fetch(apiUrl, {
      method: 'GET',
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

      // Handle 404 errors gracefully by returning an empty array
      if (response.status === 404) {
        console.log('No detailed call analytics data found, returning empty array');
        return NextResponse.json([]);
      }

      // For other errors, still return an error message but with a 500 status
      return NextResponse.json({
        error: 'Failed to fetch detailed call analytics data',
        message: 'There was an error fetching your detailed call analytics data. Please try again later.'
      }, { status: 500 });
    }

    const detailedCallAnalyticsData = await response.json();
    console.log('Successfully fetched detailed call analytics data');

    // Transform the data to match the component expectations
    const transformedData = detailedCallAnalyticsData.data?.map((call: any) => ({
      id: call.id,
      agent_name: call.agentName || 'Unknown Agent',
      timestamp: call.startedAt || call.createdAt,
      duration: calculateDurationInSeconds(call.startedAt, call.endedAt),
      sentiment_score: 0.5, // Default neutral sentiment, could be enhanced with actual sentiment analysis
      transcript: call.transcript || '',
      recording_url: call.recordingUrl,
      summary: call.summary || 'No summary available',
      key_moments: extractKeyMoments(call.messages || [])
    })) || [];

    return NextResponse.json(transformedData);
  } catch (error) {
    console.error('Error fetching detailed call analytics:', error);
    return NextResponse.json({
      error: 'Internal server error',
      message: 'An unexpected error occurred. Please try again later.'
    }, { status: 500 });
  }
}
