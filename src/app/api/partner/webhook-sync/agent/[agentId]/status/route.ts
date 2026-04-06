import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(
  _request: NextRequest,
  { params }: { params: { agentId: string } }
) {
  try {
    // Authentication is handled by middleware for /api/partner/ routes

    const { agentId } = params;

    // Get analytics service URL
    const analyticsApiUrl = process.env.ANALYTICS_API_URL || 'http://localhost:8001';
    const analyticsApiKey = process.env.ANALYTICS_STANDARD_API_KEY;

    if (!analyticsApiKey) {
      return NextResponse.json({ error: 'Analytics API key not configured' }, { status: 500 });
    }

    // Forward request to analytics service
    const response = await fetch(`${analyticsApiUrl}/webhook-sync/agent/${agentId}/status`, {
      method: 'GET',
      headers: {
        'x-api-key': analyticsApiKey
      }
    });

    const data = await response.json();

    if (!response.ok) {
      return NextResponse.json(
        { error: data.detail || 'Failed to get sync status' },
        { status: response.status }
      );
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error('Error in webhook sync status API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
