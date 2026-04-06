import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyPartnerJWT } from '@/lib/auth';
import { generateWebhookUrl, updateWebhookConfig, registerAgentInAnalytics } from '@/lib/analytics';
import crypto from 'crypto';

/**
 * POST /api/partner/elevenlabs-agents/[agentId]/webhook
 * Configure webhook settings for a specific ElevenLabs agent
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { agentId: string } }
) {
  try {
    const authResult = await verifyPartnerJWT(request);
    if (!authResult.isValid || !authResult.payload) {
      return authResult.error || NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const partnerId = authResult.payload.partnerId;
    const { agentId } = params;
    const body = await request.json();
    
    const {
      webhookEnabled,
      webhookSecret,
      forwardToPreExisting,
      preExistingWebhookUrl,
      preExistingWebhookKey,
      webhookMode
    } = body;

    // Check if agent exists and belongs to partner
    const existingAgent = await prisma.elevenLabsAgent.findFirst({
      where: {
        id: agentId,
        partnerId
      }
    });

    if (!existingAgent) {
      return NextResponse.json({ error: 'Agent not found' }, { status: 404 });
    }

    // Generate webhook secret if not provided and webhook is enabled
    let finalWebhookSecret = webhookSecret;
    if (webhookEnabled && !finalWebhookSecret) {
      finalWebhookSecret = crypto.randomBytes(32).toString('hex');
    }

    // Generate webhook URL for this partner (ElevenLabs uses partner-level webhooks)
    let webhookUrl = null;
    if (webhookEnabled) {
      try {
        webhookUrl = generateWebhookUrl({
          provider: 'elevenlabs',
          partnerId
        });
      } catch (error) {
        console.error('Error generating webhook URL:', error);
        return NextResponse.json(
          { error: 'Failed to generate webhook URL' },
          { status: 500 }
        );
      }
    }

    // Update the agent with webhook configuration
    const updatedAgent = await prisma.elevenLabsAgent.update({
      where: { id: agentId },
      data: {
        webhookEnabled: webhookEnabled || false,
        webhookSecret: finalWebhookSecret || null,
        webhookSecretConfirmed: !!finalWebhookSecret,
        forwardToPreExisting: forwardToPreExisting || true,
        preExistingWebhookUrl: preExistingWebhookUrl || null,
        preExistingWebhookKey: preExistingWebhookKey || null,
        webhookMode: webhookMode || null,
        webhookUrl,
        updatedAt: new Date()
      },
      include: {
        customer: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true
          }
        }
      }
    });

    // Update webhook configuration in analytics service
    let analyticsUpdateResult = false;
    if (updatedAgent.analyticsAgentId && updatedAgent.id) {
      try {
        await updateWebhookConfig({
          analyticsAgentId: updatedAgent.analyticsAgentId,
          providerAgentId: updatedAgent.id,
          provider: 'elevenlabs',
          webhookEnabled: webhookEnabled || false,
          preExistingWebhookUrl: preExistingWebhookUrl || undefined,
          forwardToPreExisting: forwardToPreExisting || false
        });
        analyticsUpdateResult = true;
      } catch (analyticsError) {
        console.error('Failed to update webhook config in analytics:', analyticsError);
        // Continue - don't fail the webhook configuration
      }
    }

    // If analytics update failed or agent not registered, register agent for historical processing
    if (!analyticsUpdateResult && webhookEnabled) {
      console.warn('[elevenlabs-webhook/route] Analytics update failed, attempting to register agent as fallback');

      const registrationResult = await registerAgentInAnalytics({
        agentId: updatedAgent.id || '',
        provider: 'elevenlabs',
        partnerId: updatedAgent.partnerId,
        agentName: updatedAgent.name || 'ElevenLabs Agent',
        customerId: updatedAgent.customerId || undefined,
      });

      if (registrationResult.success && registrationResult.analyticsAgentId) {
        console.log('[elevenlabs-webhook/route] Successfully registered agent with analytics, updating database');

        // Update the agent with the analytics ID and enable historical processing
        const now = new Date();
        const thirtyDaysAgo = new Date(now.getTime() - (30 * 24 * 60 * 60 * 1000));

        await prisma.elevenLabsAgent.update({
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
        try {
          await updateWebhookConfig({
            analyticsAgentId: registrationResult.analyticsAgentId,
            providerAgentId: updatedAgent.id || '',
            provider: 'elevenlabs',
            webhookEnabled: webhookEnabled || false,
            preExistingWebhookUrl: preExistingWebhookUrl || undefined,
            forwardToPreExisting: forwardToPreExisting || false
          });
          console.log('[elevenlabs-webhook/route] Successfully updated webhook config after registration');
        } catch (retryError) {
          console.error('[elevenlabs-webhook/route] Failed to update webhook config after registration:', retryError);
        }
      } else {
        console.error('[elevenlabs-webhook/route] Failed to register agent in analytics');
      }
    }

    return NextResponse.json({ 
      agent: updatedAgent,
      webhookUrl,
      webhookSecret: finalWebhookSecret,
      message: webhookEnabled ? 'Webhook configured successfully' : 'Webhook disabled'
    });
  } catch (error) {
    console.error('Error configuring ElevenLabs agent webhook:', error);
    return NextResponse.json(
      { error: 'Failed to configure webhook' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/partner/elevenlabs-agents/[agentId]/webhook
 * Get webhook configuration for a specific ElevenLabs agent
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { agentId: string } }
) {
  try {
    const authResult = await verifyPartnerJWT(request);
    if (!authResult.isValid || !authResult.payload) {
      return authResult.error || NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const partnerId = authResult.payload.partnerId;
    const { agentId } = params;

    // Check if agent exists and belongs to partner
    const agent = await prisma.elevenLabsAgent.findFirst({
      where: {
        id: agentId,
        partnerId
      },
      select: {
        id: true,
        name: true,
        webhookEnabled: true,
        webhookSecretConfirmed: true,
        forwardToPreExisting: true,
        preExistingWebhookUrl: true,
        webhookMode: true,
        webhookUrl: true
      }
    });

    if (!agent) {
      return NextResponse.json({ error: 'Agent not found' }, { status: 404 });
    }

    // Generate webhook URL if not stored
    let webhookUrl = agent.webhookUrl;
    if (!webhookUrl && agent.webhookEnabled) {
      try {
        webhookUrl = generateWebhookUrl({
          provider: 'elevenlabs',
          partnerId
        });
      } catch (error) {
        console.error('Error generating webhook URL:', error);
      }
    }

    return NextResponse.json({
      webhookConfig: {
        webhookEnabled: agent.webhookEnabled,
        webhookSecretConfirmed: agent.webhookSecretConfirmed,
        forwardToPreExisting: agent.forwardToPreExisting,
        preExistingWebhookUrl: agent.preExistingWebhookUrl,
        webhookMode: agent.webhookMode,
        webhookUrl
      }
    });
  } catch (error) {
    console.error('Error fetching ElevenLabs agent webhook config:', error);
    return NextResponse.json(
      { error: 'Failed to fetch webhook configuration' },
      { status: 500 }
    );
  }
}
