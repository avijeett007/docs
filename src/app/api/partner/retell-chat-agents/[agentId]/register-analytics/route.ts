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
    const decoded = await verifyPartnerJWT(req);
    if (!decoded || !decoded.payload || !decoded.isValid) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const partnerId = decoded.payload.partnerId;
    const agentId = params.agentId;

    const agent = await prisma.retellChatAgent.findUnique({
      where: { id: agentId, partnerId },
      include: {
        customer: { select: { id: true } },
      },
    });

    if (!agent) {
      return NextResponse.json({ error: 'Agent not found' }, { status: 404 });
    }

    // Check if already registered
    if (agent.analyticsAgentId) {
      return NextResponse.json({
        message: 'Agent already registered with analytics service',
        analyticsAgentId: agent.analyticsAgentId,
        webhookUrl: agent.webhookUrl,
      });
    }

    // Register with analytics service
    const result = await registerAgentInAnalytics({
      agentId: agent.id,
      provider: 'retell_chat',
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
      provider: 'retell_chat',
      analyticsAgentId: result.analyticsAgentId,
    });

    // Try to update Retell API with webhook URL
    let retellUpdateSuccess = false;
    if (agent.apiKey) {
      try {
        const decryptedApiKey = decrypt(agent.apiKey);
        const updateResponse = await fetch(`https://api.retellai.com/update-chat-agent/${agentId}`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${decryptedApiKey}`,
          },
          body: JSON.stringify({ webhook_url: webhookUrl }),
        });

        if (updateResponse.ok) {
          console.log('[retell-chat-register-analytics] Successfully updated webhook URL in Retell API');
          retellUpdateSuccess = true;
        } else {
          console.error('[retell-chat-register-analytics] Failed to update Retell API:', await updateResponse.text());
        }
      } catch (retellError) {
        console.error('[retell-chat-register-analytics] Error updating Retell API:', retellError);
      }
    }

    // Update the agent in the database
    await prisma.retellChatAgent.update({
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
    console.error('[retell-chat-register-analytics] Error:', error);
    return NextResponse.json(
      { error: 'Failed to register agent with analytics service' },
      { status: 500 }
    );
  }
}

