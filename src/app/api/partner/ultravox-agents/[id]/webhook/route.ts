import { NextRequest, NextResponse } from 'next/server';
import { verifyPartnerJWT } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { decrypt } from '@/lib/encryption';
import { generateWebhookUrl, updateWebhookConfig, registerAgentInAnalytics, manageUltravoxPartnerWebhook } from '@/lib/analytics';

export const dynamic = 'force-dynamic';

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Verify the partner JWT token
    const decoded = await verifyPartnerJWT(req);
    if (!decoded || !decoded.payload || !decoded.isValid) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const partnerId = decoded.payload.partnerId;
    const agentId = params.id;

    // Get the agent with API key
    const agent = await prisma.ultravoxAgent.findUnique({
      where: {
        id: agentId,
        partnerId,
      },
      select: {
        id: true,
        partnerId: true,
        analyticsAgentId: true,
        webhookEnabled: true,
        webhookMode: true,
        preExistingWebhookUrl: true,
        forwardToPreExisting: true,
        webhookUrl: true,
        webhookId: true,
        apiKey: true,
        name: true,
        customerId: true,
        historicalAnalyticsProcessed: true,
        historicalProcessingStatus: true,
      },
    });

    if (!agent) {
      return NextResponse.json({ error: 'Agent not found' }, { status: 404 });
    }

    // Generate the webhook URL if the agent has an analytics agent ID
    let webhookUrl = null;
    if (agent.analyticsAgentId) {
      webhookUrl = generateWebhookUrl({
        provider: 'ultravox',
        partnerId: partnerId,
      });
    }

    return NextResponse.json({
      webhookEnabled: agent.webhookEnabled || false,
      webhookUrl,
      webhookMode: agent.webhookMode || 'manual',
      preExistingWebhookUrl: agent.preExistingWebhookUrl || null,
      forwardToPreExisting: agent.forwardToPreExisting || true,
      analyticsAgentId: agent.analyticsAgentId,
      webhookId: agent.webhookId || null,
    });
  } catch (error) {
    console.error('[ultravox-webhook/route] Error getting webhook config:', error);
    return NextResponse.json(
      { error: 'Failed to get webhook configuration' },
      { status: 500 }
    );
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Verify the partner JWT token
    const decoded = await verifyPartnerJWT(req);
    if (!decoded || !decoded.payload || !decoded.isValid) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const partnerId = decoded.payload.partnerId;
    const agentId = params.id;

    // Get the request body
    const body = await req.json();
    const {
      webhookEnabled,
      webhookMode,
      preExistingWebhookUrl,
      forwardToPreExisting = true,
    } = body;

    // Get the agent with API key
    const agent = await prisma.ultravoxAgent.findUnique({
      where: {
        id: agentId,
        partnerId,
      },
      select: {
        id: true,
        partnerId: true,
        analyticsAgentId: true,
        webhookEnabled: true,
        webhookMode: true,
        preExistingWebhookUrl: true,
        forwardToPreExisting: true,
        webhookUrl: true,
        webhookId: true,
        apiKey: true,
        name: true,
        customerId: true,
        historicalAnalyticsProcessed: true,
        historicalProcessingStatus: true,
      },
    });

    if (!agent) {
      return NextResponse.json({ error: 'Agent not found' }, { status: 404 });
    }

    // Generate the partner-level webhook URL for Ultravox
    let webhookUrl = null;
    if (agent.analyticsAgentId) {
      webhookUrl = generateWebhookUrl({
        provider: 'ultravox',
        partnerId: partnerId,
      });
    } else {
      return NextResponse.json(
        { error: 'Agent not registered with analytics service' },
        { status: 400 }
      );
    }

    // If automatic mode, manage the partner-level webhook in Ultravox
    if (webhookMode === 'automatic') {
      // Get the partner's Ultravox API key for fallback
      const partner = await prisma.partner.findUnique({
        where: { id: partnerId },
        select: {
          ultravoxApiKey: true,
        },
      });

      // Determine which API key to use: agent's key first, then partner's key
      let decryptedApiKey: string;

      if (agent.apiKey) {
        // Use agent's individual API key
        decryptedApiKey = await decrypt(agent.apiKey);
        console.log('[ultravox-webhook/route] Using agent-specific API key for webhook management');
      } else if (partner?.ultravoxApiKey) {
        // Fallback to partner's API key
        decryptedApiKey = await decrypt(partner.ultravoxApiKey);
        console.log('[ultravox-webhook/route] Using partner API key for webhook management (agent has no individual key)');
      } else {
        return NextResponse.json({
          error: 'No API key available',
          message: 'Neither agent-specific nor partner API key found'
        }, { status: 400 });
      }

      // Manage the partner-level webhook using the new function
      const webhookResult = await manageUltravoxPartnerWebhook({
        partnerId: partnerId,
        ultravoxApiKey: decryptedApiKey,
        webhookEnabled: webhookEnabled,
      });

      if (!webhookResult.success) {
        console.error('[ultravox-webhook/route] Failed to manage Ultravox partner webhook:', webhookResult.error);
        return NextResponse.json(
          { error: `Failed to manage webhook: ${webhookResult.error}` },
          { status: 500 }
        );
      }

      console.log(`[ultravox-webhook/route] Successfully managed Ultravox webhook - Action: ${webhookResult.action}`);

      // Store the webhook ID if we created or found one
      if (webhookResult.webhookId) {
        // We can store this in the agent record for future reference
        await prisma.ultravoxAgent.update({
          where: { id: agentId },
          data: {
            webhookId: webhookResult.webhookId,
          },
        });
      }

    }

    // Get the webhook ID from the previous webhook management result
    let webhookIdToStore = null;
    if (webhookMode === 'automatic') {
      // The webhook ID should have been stored in the previous step
      const updatedAgent = await prisma.ultravoxAgent.findUnique({
        where: { id: agentId },
        select: { webhookId: true },
      });
      webhookIdToStore = updatedAgent?.webhookId || null;
    }

    // Update the webhook configuration in the database
    await prisma.ultravoxAgent.update({
      where: {
        id: agentId,
      },
      data: {
        webhookEnabled,
        webhookMode,
        preExistingWebhookUrl,
        forwardToPreExisting,
        webhookUrl,
        webhookId: webhookIdToStore,
      },
    });

    // Update the webhook configuration in the analytics service
    let analyticsUpdateResult = await updateWebhookConfig({
      analyticsAgentId: agent.analyticsAgentId!,
      providerAgentId: agentId,
      provider: 'ultravox',
      webhookEnabled,
      preExistingWebhookUrl,
      forwardToPreExisting,
    });

    // If analytics update failed and agent doesn't have historical processing flags set,
    // try to register the agent with analytics as a fallback
    if (!analyticsUpdateResult && (!agent.historicalAnalyticsProcessed && !agent.historicalProcessingStatus)) {
      console.warn('[ultravox-webhook/route] Analytics update failed, attempting to register agent as fallback');

      const registrationResult = await registerAgentInAnalytics({
        agentId: agentId,
        provider: 'ultravox',
        partnerId: agent.partnerId,
        agentName: agent.name,
        customerId: agent.customerId || undefined,
      });

      if (registrationResult.success && registrationResult.analyticsAgentId) {
        console.log('[ultravox-webhook/route] Successfully registered agent with analytics, updating database');

        // Update the agent with the analytics ID and enable historical processing
        const now = new Date();
        const thirtyDaysAgo = new Date(now.getTime() - (30 * 24 * 60 * 60 * 1000));

        await prisma.ultravoxAgent.update({
          where: { id: agentId },
          data: {
            analyticsAgentId: registrationResult.analyticsAgentId,
            historicalAnalyticsProcessed: false,
            historicalProcessingStatus: 'pending',
            historicalDataStartDate: thirtyDaysAgo,
            historicalDataEndDate: now,
          },
        });

        // Retry the webhook config update with the new analytics agent ID
        analyticsUpdateResult = await updateWebhookConfig({
          analyticsAgentId: registrationResult.analyticsAgentId,
          providerAgentId: agentId,
          provider: 'ultravox',
          webhookEnabled,
          preExistingWebhookUrl,
          forwardToPreExisting,
        });

        if (analyticsUpdateResult) {
          console.log('[ultravox-webhook/route] Successfully updated webhook config after registration');
        }
      } else {
        console.error('[ultravox-webhook/route] Failed to register agent with analytics as fallback');
      }
    }

    if (!analyticsUpdateResult) {
      console.error('[ultravox-webhook/route] Failed to update webhook config in analytics service');
      console.error('[ultravox-webhook/route] This may indicate that the agent is not properly registered with the analytics service');
      console.error('[ultravox-webhook/route] Agent ID:', agentId, 'Analytics Agent ID:', agent.analyticsAgentId);

      // The webhook configuration in the database will still be updated
      // The user should try re-registering the agent with analytics if needed
    }

    return NextResponse.json({
      success: true,
      webhookEnabled,
      webhookUrl,
      webhookMode,
      preExistingWebhookUrl,
      forwardToPreExisting,
      analyticsAgentId: agent.analyticsAgentId,
      webhookId: webhookIdToStore,
    });
  } catch (error) {
    console.error('[ultravox-webhook/route] Error updating webhook config:', error);
    return NextResponse.json(
      { error: 'Failed to update webhook configuration' },
      { status: 500 }
    );
  }
}
