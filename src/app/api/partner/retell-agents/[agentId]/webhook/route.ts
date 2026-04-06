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
    // Verify the partner JWT token
    const decoded = await verifyPartnerJWT(req);
    if (!decoded || !decoded.payload || !decoded.isValid) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const partnerId = decoded.payload.partnerId;
    const agentId = params.agentId;

    // Get the agent with API key
    const agent = await prisma.retellAgent.findUnique({
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
        provider: 'retell',
        analyticsAgentId: agent.analyticsAgentId,
      });
    }

    return NextResponse.json({
      webhookEnabled: agent.webhookEnabled || false,
      webhookUrl,
      webhookMode: agent.webhookMode || 'manual',
      preExistingWebhookUrl: agent.preExistingWebhookUrl || null,
      forwardToPreExisting: agent.forwardToPreExisting || true,
      analyticsAgentId: agent.analyticsAgentId,
    });
  } catch (error) {
    console.error('[retell-webhook/route] Error getting webhook config:', error);
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
    // Verify the partner JWT token
    const decoded = await verifyPartnerJWT(req);
    if (!decoded || !decoded.payload || !decoded.isValid) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const partnerId = decoded.payload.partnerId;
    const agentId = params.agentId;

    // Get the request body
    const body = await req.json();
    const {
      webhookEnabled,
      webhookMode,
      preExistingWebhookUrl,
      forwardToPreExisting = true,
    } = body;

    // Get the agent with API key
    const agent = await prisma.retellAgent.findUnique({
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

    // Generate the webhook URL
    let webhookUrl = null;
    if (agent.analyticsAgentId) {
      webhookUrl = generateWebhookUrl({
        provider: 'retell',
        analyticsAgentId: agent.analyticsAgentId,
      });
    } else {
      return NextResponse.json(
        { error: 'Agent not registered with analytics service' },
        { status: 400 }
      );
    }

    // If automatic mode, update the webhook URL in Retell
    if (webhookMode === 'automatic') {
      // Get the partner's Retell API key for fallback
      const partner = await prisma.partner.findUnique({
        where: { id: partnerId },
        select: {
          retellApiKey: true,
        },
      });

      // Determine which API key to use: agent's key first, then partner's key
      let decryptedApiKey: string;

      if (agent.apiKey) {
        // Use agent's individual API key
        decryptedApiKey = await decrypt(agent.apiKey);
        console.log('[retell-webhook/route] Using agent-specific API key for webhook update');
      } else if (partner?.retellApiKey) {
        // Fallback to partner's API key
        decryptedApiKey = await decrypt(partner.retellApiKey);
        console.log('[retell-webhook/route] Using partner API key for webhook update (agent has no individual key)');
      } else {
        return NextResponse.json({
          error: 'No API key available',
          message: 'Neither agent-specific nor partner API key found'
        }, { status: 400 });
      }

      // Get the current webhook URL from Retell
      const response = await fetch(`https://api.retellai.com/get-agent/${agentId}`, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'Authorization': `Bearer ${decryptedApiKey}`,
        },
      });

      if (!response.ok) {
        return NextResponse.json(
          { error: 'Failed to get agent from Retell API' },
          { status: response.status }
        );
      }

      const agentDetail = await response.json();
      const currentWebhookUrl = agentDetail.webhook_url;

      // Save the current webhook URL if it's not already saved
      if (currentWebhookUrl && !preExistingWebhookUrl) {
        body.preExistingWebhookUrl = currentWebhookUrl;
      }

      // Update the webhook URL in Retell
      if (webhookEnabled) {
        // Use PATCH method as per the API documentation
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

        if (!updateResponse.ok) {
          return NextResponse.json(
            { error: 'Failed to update webhook URL in Retell API' },
            { status: updateResponse.status }
          );
        }

        // Verify the update was successful by parsing the response
        const updateResult = await updateResponse.json();
        if (updateResult.webhook_url !== webhookUrl) {
          console.error('[retell-webhook/route] Webhook URL not updated correctly in Retell API', {
            expected: webhookUrl,
            actual: updateResult.webhook_url
          });
          return NextResponse.json(
            { error: 'Webhook URL not updated correctly in Retell API' },
            { status: 500 }
          );
        }

        console.log('[retell-webhook/route] Successfully updated webhook URL in Retell API', {
          agentId,
          webhookUrl
        });
      } else if (preExistingWebhookUrl) {
        // If disabling webhook and there's a pre-existing URL, restore it
        const updateResponse = await fetch(`https://api.retellai.com/update-agent/${agentId}`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${decryptedApiKey}`,
          },
          body: JSON.stringify({
            webhook_url: preExistingWebhookUrl,
          }),
        });

        if (!updateResponse.ok) {
          return NextResponse.json(
            { error: 'Failed to restore pre-existing webhook URL in Retell API' },
            { status: updateResponse.status }
          );
        }

        // Verify the update was successful by parsing the response
        const updateResult = await updateResponse.json();
        if (updateResult.webhook_url !== preExistingWebhookUrl) {
          console.error('[retell-webhook/route] Pre-existing webhook URL not restored correctly in Retell API', {
            expected: preExistingWebhookUrl,
            actual: updateResult.webhook_url
          });
          return NextResponse.json(
            { error: 'Pre-existing webhook URL not restored correctly in Retell API' },
            { status: 500 }
          );
        }

        console.log('[retell-webhook/route] Successfully restored pre-existing webhook URL in Retell API', {
          agentId,
          preExistingWebhookUrl
        });
      }
    }

    // Update the webhook configuration in the database
    await prisma.retellAgent.update({
      where: {
        id: agentId,
      },
      data: {
        webhookEnabled,
        webhookMode,
        preExistingWebhookUrl,
        forwardToPreExisting,
        webhookUrl,
      },
    });

    // Update the webhook configuration in the analytics service
    let analyticsUpdateResult = await updateWebhookConfig({
      analyticsAgentId: agent.analyticsAgentId!,
      providerAgentId: agentId,
      provider: 'retell',
      webhookEnabled,
      preExistingWebhookUrl,
      forwardToPreExisting,
    });

    // If analytics update failed and agent doesn't have historical processing flags set,
    // try to register the agent with analytics as a fallback
    if (!analyticsUpdateResult && (!agent.historicalAnalyticsProcessed && !agent.historicalProcessingStatus)) {
      console.warn('[retell-webhook/route] Analytics update failed, attempting to register agent as fallback');

      const registrationResult = await registerAgentInAnalytics({
        agentId: agentId,
        provider: 'retell',
        partnerId: agent.partnerId,
        agentName: agent.name,
        customerId: agent.customerId || undefined,
      });

      if (registrationResult.success && registrationResult.analyticsAgentId) {
        console.log('[retell-webhook/route] Successfully registered agent with analytics, updating database');

        // Update the agent with the analytics ID and enable historical processing
        const now = new Date();
        const thirtyDaysAgo = new Date(now.getTime() - (30 * 24 * 60 * 60 * 1000));

        await prisma.retellAgent.update({
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
          provider: 'retell',
          webhookEnabled,
          preExistingWebhookUrl,
          forwardToPreExisting,
        });

        if (analyticsUpdateResult) {
          console.log('[retell-webhook/route] Successfully updated webhook config after registration');
        }
      } else {
        console.error('[retell-webhook/route] Failed to register agent with analytics as fallback');
      }
    }

    if (!analyticsUpdateResult) {
      console.error('[retell-webhook/route] Failed to update webhook config in analytics service');
      console.error('[retell-webhook/route] This may indicate that the agent is not properly registered with the analytics service');
      console.error('[retell-webhook/route] Agent ID:', agentId, 'Analytics Agent ID:', agent.analyticsAgentId);

      // The webhook configuration in the database will still be updated
      // The user should try re-registering the agent with analytics if needed
    }

    // Verify the update in the analytics service if in automatic mode
    if (webhookMode === 'automatic' && analyticsUpdateResult) {
      try {
        // Fetch agent details from analytics service to verify the update
        const analyticsApiUrl = process.env.ANALYTICS_API_URL || 'http://localhost:8001';
        const analyticsApiKey = process.env.ANALYTICS_STANDARD_API_KEY;

        if (analyticsApiKey) {
          const verifyResponse = await fetch(`${analyticsApiUrl}/agents/${agentId}?provider=retell`, {
            method: 'GET',
            headers: {
              'Content-Type': 'application/json',
              'x-api-key': analyticsApiKey
            }
          });

          if (verifyResponse.ok) {
            const verifyResult = await verifyResponse.json();

            if (verifyResult.success && verifyResult.agent) {
              const analyticsAgent = verifyResult.agent;

              // Verify pre-existing webhook URL was properly saved
              if (preExistingWebhookUrl && analyticsAgent.pre_existing_webhook_url !== preExistingWebhookUrl) {
                console.warn('[retell-webhook/route] Pre-existing webhook URL not properly saved in analytics service', {
                  expected: preExistingWebhookUrl,
                  actual: analyticsAgent.pre_existing_webhook_url
                });
              } else {
                console.log('[retell-webhook/route] Pre-existing webhook URL properly saved in analytics service', {
                  preExistingWebhookUrl
                });
              }

              // Note: forward_to_pre_existing is not currently supported in the analytics service
              // We'll keep this commented out for future use
              // if (analyticsAgent.forward_to_pre_existing !== forwardToPreExisting) {
              //   console.warn('[retell-webhook/route] Forward to pre-existing flag not properly saved in analytics service', {
              //     expected: forwardToPreExisting,
              //     actual: analyticsAgent.forward_to_pre_existing
              //   });
              // }
            }
          } else {
            console.error('[retell-webhook/route] Failed to verify webhook config in analytics service');
          }
        }
      } catch (verifyError) {
        console.error('[retell-webhook/route] Error verifying webhook config in analytics service:', verifyError);
        // Continue anyway, this is just verification
      }
    }

    return NextResponse.json({
      success: true,
      webhookEnabled,
      webhookUrl,
      webhookMode,
      preExistingWebhookUrl,
      forwardToPreExisting,
      analyticsAgentId: agent.analyticsAgentId,
    });
  } catch (error) {
    console.error('[retell-webhook/route] Error updating webhook config:', error);
    return NextResponse.json(
      { error: 'Failed to update webhook configuration' },
      { status: 500 }
    );
  }
}
