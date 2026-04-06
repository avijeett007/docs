import { NextRequest, NextResponse } from 'next/server';
import { verifyPartnerJWT } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { registerAgentInAnalytics, generateWebhookUrl } from '@/lib/analytics';
import { decrypt } from '@/lib/encryption';

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

    // Get the agent with API key and partner info
    const agent = await prisma.retellAgent.findUnique({
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
        partner: {
          select: {
            retellApiKey: true,
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
      provider: 'retell',
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
      provider: 'retell',
      analyticsAgentId: result.analyticsAgentId,
    });

    // Get API key (agent-level first, then partner-level)
    let apiKey = agent.apiKey;
    if (!apiKey && agent.partner?.retellApiKey) {
      apiKey = agent.partner.retellApiKey;
    }

    // Update Retell API with webhook URL if we have an API key
    let retellUpdateSuccess = false;
    if (apiKey) {
      try {
        const decryptedApiKey = decrypt(apiKey);
        const updateResponse = await fetch(`https://api.retellai.com/update-agent/${agentId}`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${decryptedApiKey}`,
          },
          body: JSON.stringify({
            webhook_url: webhookUrl,
            webhook_events: ['call_started', 'call_ended', 'call_analyzed'],
          }),
        });

        if (updateResponse.ok) {
          console.log('[register-analytics/route] Successfully updated webhook URL in Retell API');
          retellUpdateSuccess = true;
        } else {
          console.error('[register-analytics/route] Failed to update Retell API:', await updateResponse.text());
        }
      } catch (retellError) {
        console.error('[register-analytics/route] Error updating Retell API:', retellError);
        // Non-blocking - continue even if Retell update fails
      }
    }

    // Update the agent in the database
    await prisma.retellAgent.update({
      where: { id: agentId },
      data: {
        analyticsAgentId: result.analyticsAgentId,
        webhookUrl,
        webhookEnabled: retellUpdateSuccess,
        webhookMode: retellUpdateSuccess ? 'automatic' : 'manual',
        forwardToPreExisting: true,
      },
    });

    return NextResponse.json({
      success: true,
      message: retellUpdateSuccess
        ? 'Successfully registered agent and enabled webhook in Retell'
        : 'Registered with analytics. Please configure webhook manually in Retell dashboard.',
      analyticsAgentId: result.analyticsAgentId,
      webhookUrl,
      webhookEnabled: retellUpdateSuccess,
      webhookMode: retellUpdateSuccess ? 'automatic' : 'manual',
    });
  } catch (error) {
    console.error('[register-analytics/route] Error registering agent:', error);
    return NextResponse.json(
      { error: 'Failed to register agent with analytics service' },
      { status: 500 }
    );
  }
}
