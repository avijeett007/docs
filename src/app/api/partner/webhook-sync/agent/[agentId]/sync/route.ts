import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function POST(
  request: NextRequest,
  { params }: { params: { agentId: string } }
) {
  try {
    // Authentication is handled by middleware for /api/partner/ routes

    const { agentId } = params;
    const { searchParams } = new URL(request.url);
    const daysBack = searchParams.get('days_back') || '1';

    // Get analytics service URL
    const analyticsApiUrl = process.env.ANALYTICS_API_URL || 'http://localhost:8001';
    const analyticsApiKey = process.env.ANALYTICS_STANDARD_API_KEY;

    if (!analyticsApiKey) {
      return NextResponse.json({ error: 'Analytics API key not configured' }, { status: 500 });
    }

    // Forward request to analytics service
    const response = await fetch(`${analyticsApiUrl}/webhook-sync/agent/${agentId}/sync?days_back=${daysBack}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': analyticsApiKey
      }
    });

    const data = await response.json();

    if (!response.ok) {
      return NextResponse.json(
        { error: data.detail || 'Failed to request sync' },
        { status: response.status }
      );
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error('Error in webhook sync API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
