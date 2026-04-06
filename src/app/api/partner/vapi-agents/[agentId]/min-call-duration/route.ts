import { NextRequest, NextResponse } from 'next/server';
import { verifyPartnerJWT } from '@/lib/auth';
import prisma from '@/lib/prisma';

export async function PATCH(
  req: NextRequest,
  { params }: { params: { agentId: string } }
) {
  try {
    const decoded = await verifyPartnerJWT(req);
    if (!decoded || !decoded.payload || !decoded.isValid) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const partnerId = decoded.payload.partnerId;
    const agentId = params.agentId;
    const { min_call_duration } = await req.json();

    if (min_call_duration === undefined || min_call_duration === null) {
      return NextResponse.json({ error: 'min_call_duration is required' }, { status: 400 });
    }

    const duration = Number(min_call_duration);
    if (isNaN(duration) || duration < 0 || duration > 3600) {
      return NextResponse.json({ error: 'min_call_duration must be between 0 and 3600 seconds' }, { status: 400 });
    }

    const agent = await prisma.vapiAgent.findUnique({
      where: {
        id: agentId,
        partnerId: partnerId,
      },
      select: {
        id: true,
        analyticsAgentId: true,
      },
    });

    if (!agent) {
      return NextResponse.json({ error: 'Agent not found' }, { status: 404 });
    }

    if (!agent.analyticsAgentId) {
      return NextResponse.json({ error: 'Agent is not registered with analytics service' }, { status: 400 });
    }

    const analyticsApiUrl = process.env.ANALYTICS_API_URL || 'https://analytics.knotie-ai.pro';
    const analyticsApiKey = process.env.ANALYTICS_STANDARD_API_KEY || 'test-api-key';

    const analyticsResponse = await fetch(
      `${analyticsApiUrl}/api/agents/${agentId}?provider=vapi`,
      {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': analyticsApiKey,
        },
        body: JSON.stringify({
          config: {
            min_call_duration: duration,
          },
        }),
      }
    );

    if (!analyticsResponse.ok) {
      const errorText = await analyticsResponse.text();
      console.error('[min-call-duration] Analytics update failed:', errorText);
      return NextResponse.json(
        { error: 'Failed to update min call duration in analytics' },
        { status: 500 }
      );
    }

    const result = await analyticsResponse.json();

    return NextResponse.json({
      success: true,
      message: `Min call duration set to ${duration} seconds`,
      min_call_duration: duration,
      agent: result.agent,
    });
  } catch (error: any) {
    console.error('[min-call-duration] Error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function GET(
  req: NextRequest,
  { params }: { params: { agentId: string } }
) {
  try {
    const decoded = await verifyPartnerJWT(req);
    if (!decoded || !decoded.payload || !decoded.isValid) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const partnerId = decoded.payload.partnerId;
    const agentId = params.agentId;

    const agent = await prisma.vapiAgent.findUnique({
      where: {
        id: agentId,
        partnerId: partnerId,
      },
      select: {
        id: true,
        analyticsAgentId: true,
      },
    });

    if (!agent) {
      return NextResponse.json({ error: 'Agent not found' }, { status: 404 });
    }

    if (!agent.analyticsAgentId) {
      return NextResponse.json({ min_call_duration: 1 });
    }

    const analyticsApiUrl = process.env.ANALYTICS_API_URL || 'https://analytics.knotie-ai.pro';
    const analyticsApiKey = process.env.ANALYTICS_STANDARD_API_KEY || 'test-api-key';

    const analyticsResponse = await fetch(
      `${analyticsApiUrl}/api/agents/${agentId}?provider=vapi`,
      {
        headers: {
          'x-api-key': analyticsApiKey,
        },
      }
    );

    if (!analyticsResponse.ok) {
      return NextResponse.json({ min_call_duration: 1 });
    }

    const agentData = await analyticsResponse.json();
    const config = agentData?.agent?.config || agentData?.config || {};
    const minCallDuration = config.min_call_duration ?? 1;

    return NextResponse.json({ min_call_duration: minCallDuration });
  } catch (error: any) {
    console.error('[min-call-duration] GET Error:', error);
    return NextResponse.json({ min_call_duration: 1 });
  }
}

