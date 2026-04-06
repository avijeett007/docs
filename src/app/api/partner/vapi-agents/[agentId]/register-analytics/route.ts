import { NextRequest, NextResponse } from 'next/server';
import { verifyPartnerJWT } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { registerAgentInAnalytics, generateWebhookUrl } from '@/lib/analytics';

export const dynamic = 'force-dynamic';

export async function POST(
  req: NextRequest,
  { params }: { params: { agentId: string } }
) {
  try {
    // Verify the partner JWT token
    const decoded = await verifyPartnerJWT(req);
    if (!decoded || !decoded.payload || !decoded.isValid) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const partnerId = decoded.payload.partnerId;
    const agentId = params.agentId;

    // Get the agent
    const agent = await prisma.vapiAgent.findUnique({
      where: {
        id: agentId,
        partnerId,
      },
      include: {
        customer: {
          select: {
            id: true,
          },
        },
      },
    });

    if (!agent) {
      return NextResponse.json({ error: 'Agent not found' }, { status: 404 });
    }

    // Check if the agent already has an analytics agent ID
    if (agent.analyticsAgentId) {
      return NextResponse.json({
        message: 'Agent already registered with analytics service',
        analyticsAgentId: agent.analyticsAgentId,
        webhookUrl: agent.webhookUrl,
      });
    }

    // Register the agent with the analytics service
    const result = await registerAgentInAnalytics({
      agentId: agent.id,
      provider: 'vapi',
      partnerId,
      agentName: agent.name,
      customerId: agent.customerId || undefined,
      profitMultiplier: agent.profitMultiplier,
    });

    if (!result.success || !result.analyticsAgentId) {
      return NextResponse.json(
        { error: 'Failed to register agent with analytics service' },
        { status: 500 }
      );
    }

    // Generate the webhook URL
    const webhookUrl = generateWebhookUrl({
      provider: 'vapi',
      analyticsAgentId: result.analyticsAgentId,
    });

    // Update the agent in the database
    await prisma.vapiAgent.update({
      where: { id: agentId },
      data: {
        analyticsAgentId: result.analyticsAgentId,
        webhookUrl,
      },
    });

    return NextResponse.json({
      success: true,
      message: 'Successfully registered agent with analytics service',
      analyticsAgentId: result.analyticsAgentId,
      webhookUrl,
    });
  } catch (error) {
    console.error('[register-analytics/route] Error registering agent:', error);
    return NextResponse.json(
      { error: 'Failed to register agent with analytics service' },
      { status: 500 }
    );
  }
}
