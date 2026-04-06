import { NextRequest, NextResponse } from 'next/server';
import { verifyPartnerJWT } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { decrypt } from '@/lib/encryption';
import { generateWebhookUrl, updateWebhookConfig, registerAgentInAnalytics } from '@/lib/analytics';

export const dynamic = 'force-dynamic';

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

    const agent = await prisma.retellChatAgent.findUnique({
      where: { id: agentId, partnerId },
      select: {
        id: true,
        partnerId: true,
        analyticsAgentId: true,
        webhookEnabled: true,
        webhookMode: true,
        preExistingWebhookUrl: true,
        forwardToPreExisting: true,
        webhookUrl: true,
      },
    });

    if (!agent) {
      return NextResponse.json({ error: 'Agent not found' }, { status: 404 });
    }

    let webhookUrl = null;
    if (agent.analyticsAgentId) {
      webhookUrl = generateWebhookUrl({
        provider: 'retell_chat',
        analyticsAgentId: agent.analyticsAgentId,
      });
    }

    return NextResponse.json({
      webhookEnabled: agent.webhookEnabled || false,
      webhookUrl,
      webhookMode: agent.webhookMode || 'manual',
      preExistingWebhookUrl: agent.preExistingWebhookUrl || null,
      forwardToPreExisting: agent.forwardToPreExisting ?? true,
      analyticsAgentId: agent.analyticsAgentId,
    });
  } catch (error) {
    console.error('[retell-chat-webhook/route] Error getting webhook config:', error);
    return NextResponse.json(
      { error: 'Failed to get webhook configuration' },
      { status: 500 }
    );
  }
}

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
    const body = await req.json();
    const {
      webhookEnabled,
      webhookMode,
      preExistingWebhookUrl,
      forwardToPreExisting = true,
    } = body;

    const agent = await prisma.retellChatAgent.findUnique({
      where: { id: agentId, partnerId },
      select: {
        id: true,
        partnerId: true,
        analyticsAgentId: true,
        webhookEnabled: true,
        webhookMode: true,
        preExistingWebhookUrl: true,
        forwardToPreExisting: true,
        webhookUrl: true,
        apiKey: true,
        name: true,
        customerId: true,
      },
    });

    if (!agent) {
      return NextResponse.json({ error: 'Agent not found' }, { status: 404 });
    }

    // Generate the webhook URL
    let webhookUrl: string | null = null;
    if (agent.analyticsAgentId) {
      webhookUrl = generateWebhookUrl({
        provider: 'retell_chat',
        analyticsAgentId: agent.analyticsAgentId,
      });
    } else {
      return NextResponse.json(
        { error: 'Agent not registered with analytics service' },
        { status: 400 }
      );
    }

    // If automatic mode, update the webhook URL on Retell
    if (webhookMode === 'automatic') {
      if (!agent.apiKey) {
        return NextResponse.json({
          error: 'No API key available for this agent',
        }, { status: 400 });
      }

      const decryptedApiKey = await decrypt(agent.apiKey);

      // Get current webhook URL from Retell to preserve it
      const getResponse = await fetch(
        `https://api.retellai.com/get-chat-agent/${agent.id}`,
        {
          method: 'GET',
          headers: {
            'Accept': 'application/json',
            'Authorization': `Bearer ${decryptedApiKey}`,
          },
        }
      );

      if (!getResponse.ok) {
        return NextResponse.json(
          { error: 'Failed to get agent from Retell API' },
          { status: getResponse.status }
        );
      }

      const agentDetail = await getResponse.json();
      const currentWebhookUrl = agentDetail.webhook_url;

      // Save pre-existing webhook URL if not already provided
      const resolvedPreExisting = preExistingWebhookUrl || currentWebhookUrl || null;

      if (webhookEnabled) {
        // Set our proxy webhook URL on Retell
        const updateResponse = await fetch(
          `https://api.retellai.com/update-chat-agent/${agent.id}`,
          {
            method: 'PATCH',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${decryptedApiKey}`,
            },
            body: JSON.stringify({ webhook_url: webhookUrl }),
          }
        );

        if (!updateResponse.ok) {
          return NextResponse.json(
            { error: 'Failed to update webhook URL in Retell API' },
            { status: updateResponse.status }
          );
        }

        const updateResult = await updateResponse.json();
        if (updateResult.webhook_url !== webhookUrl) {
          return NextResponse.json(
            { error: 'Webhook URL not updated correctly in Retell API' },
            { status: 500 }
          );
        }

        console.log('[retell-chat-webhook/route] Successfully updated webhook URL in Retell API', {
          agentId, webhookUrl
        });
      } else if (resolvedPreExisting) {
        // Restore pre-existing webhook URL when disabling
        const updateResponse = await fetch(
          `https://api.retellai.com/update-chat-agent/${agent.id}`,
          {
            method: 'PATCH',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${decryptedApiKey}`,
            },
            body: JSON.stringify({ webhook_url: resolvedPreExisting }),
          }
        );

        if (!updateResponse.ok) {
          return NextResponse.json(
            { error: 'Failed to restore pre-existing webhook URL in Retell API' },
            { status: updateResponse.status }
          );
        }
      }

      // Use the resolved pre-existing URL for DB storage
      body.preExistingWebhookUrl = resolvedPreExisting;
    }

    // Update the webhook configuration in the database
    await prisma.retellChatAgent.update({
      where: { id: agentId },
      data: {
        webhookEnabled,
        webhookMode,
        preExistingWebhookUrl: body.preExistingWebhookUrl || preExistingWebhookUrl,
        forwardToPreExisting,
        webhookUrl,
      },
    });

    // Update the webhook configuration in the analytics service
    let analyticsUpdateResult = await updateWebhookConfig({
      analyticsAgentId: agent.analyticsAgentId!,
      providerAgentId: agent.id,
      provider: 'retell_chat',
      webhookEnabled,
      preExistingWebhookUrl: body.preExistingWebhookUrl || preExistingWebhookUrl,
      forwardToPreExisting,
    });

    // If analytics update failed, try registering the agent as a fallback
    if (!analyticsUpdateResult) {
      console.warn('[retell-chat-webhook/route] Analytics update failed, attempting registration fallback');

      const registrationResult = await registerAgentInAnalytics({
        agentId: agent.id,
        provider: 'retell_chat',
        partnerId: agent.partnerId,
        agentName: agent.name,
        customerId: agent.customerId || undefined,
      });

      if (registrationResult.success && registrationResult.analyticsAgentId) {
        await prisma.retellChatAgent.update({
          where: { id: agentId },
          data: { analyticsAgentId: registrationResult.analyticsAgentId },
        });

        analyticsUpdateResult = await updateWebhookConfig({
          analyticsAgentId: registrationResult.analyticsAgentId,
          providerAgentId: agent.id,
          provider: 'retell_chat',
          webhookEnabled,
          preExistingWebhookUrl: body.preExistingWebhookUrl || preExistingWebhookUrl,
          forwardToPreExisting,
        });
      }
    }

    if (!analyticsUpdateResult) {
      console.error('[retell-chat-webhook/route] Failed to update webhook config in analytics service');
    }

    return NextResponse.json({
      success: true,
      webhookEnabled,
      webhookUrl,
      webhookMode,
      preExistingWebhookUrl: body.preExistingWebhookUrl || preExistingWebhookUrl,
      forwardToPreExisting,
      analyticsAgentId: agent.analyticsAgentId,
    });
  } catch (error) {
    console.error('[retell-chat-webhook/route] Error updating webhook config:', error);
    return NextResponse.json(
      { error: 'Failed to update webhook configuration' },
      { status: 500 }
    );
  }
}

