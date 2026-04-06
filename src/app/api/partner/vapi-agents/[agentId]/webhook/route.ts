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
    const agent = await prisma.vapiAgent.findUnique({
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
        provider: 'vapi',
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
    console.error('[vapi-webhook/route] Error getting webhook config:', error);
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
    const agent = await prisma.vapiAgent.findUnique({
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
        provider: 'vapi',
        analyticsAgentId: agent.analyticsAgentId,
      });
    } else {
      return NextResponse.json(
        { error: 'Agent not registered with analytics service' },
        { status: 400 }
      );
    }

    // If automatic mode, update the webhook URL in VAPI
    if (webhookMode === 'automatic') {
      // Get the partner's VAPI API key for fallback
      const partner = await prisma.partner.findUnique({
        where: { id: partnerId },
        select: {
          vapiApiKey: true,
        },
      });

      // Determine which API key to use: agent's key first, then partner's key
      let decryptedApiKey: string;

      if (agent.apiKey) {
        // Use agent's individual API key
        decryptedApiKey = await decrypt(agent.apiKey);
        console.log('[vapi-webhook/route] Using agent-specific API key for webhook update');
      } else if (partner?.vapiApiKey) {
        // Fallback to partner's API key
        decryptedApiKey = await decrypt(partner.vapiApiKey);
        console.log('[vapi-webhook/route] Using partner API key for webhook update (agent has no individual key)');
      } else {
        return NextResponse.json({
          error: 'No API key available',
          message: 'Neither agent-specific nor partner API key found'
        }, { status: 400 });
      }

      // Get the current webhook URL from VAPI
      const response = await fetch(`https://api.vapi.ai/assistant/${agentId}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${decryptedApiKey}`,
          'Accept': 'application/json',
        },
      });

      if (!response.ok) {
        console.error('[vapi-webhook/route] Failed to get agent from VAPI API', {
          status: response.status,
          statusText: response.statusText
        });

        // Try to get more detailed error information
        try {
          const errorData = await response.text();
          console.error('[vapi-webhook/route] VAPI API error response:', errorData);
        } catch (e) {
          console.error('[vapi-webhook/route] Could not parse error response:', e);
        }

        return NextResponse.json(
          { error: 'Failed to get agent from VAPI API' },
          { status: response.status }
        );
      }

      const agentDetail = await response.json();

      // Extract the webhook URL from the server.url property
      const currentWebhookUrl = agentDetail.server?.url;

      console.log('[vapi-webhook/route] Current webhook URL from VAPI:', currentWebhookUrl);

      // Save the current webhook URL if it's not already saved
      if (currentWebhookUrl && !preExistingWebhookUrl) {
        // Check if the current webhook URL is for the correct provider (vapi)
        if (currentWebhookUrl.includes('/webhooks/retell/')) {
          console.warn('[vapi-webhook/route] Current webhook URL is for Retell, not VAPI. Not saving as pre-existing URL.');
          // Don't save Retell webhook URLs for VAPI agents
        } else {
          body.preExistingWebhookUrl = currentWebhookUrl;
          console.log('[vapi-webhook/route] Saving pre-existing webhook URL:', currentWebhookUrl);
        }
      }

      // Update the webhook URL in VAPI
      if (webhookEnabled) {
        // Use the correct endpoint and payload format for VAPI
        // Ensure the webhook URL uses HTTPS for VAPI
        let finalWebhookUrl = webhookUrl;
        if (finalWebhookUrl.startsWith('http://')) {
          // Special case for localhost - use ngrok or a similar service in development
          if (finalWebhookUrl.includes('localhost')) {
            console.warn('[vapi-webhook/route] VAPI requires HTTPS URLs. Using localhost will not work in production.');
            console.warn('[vapi-webhook/route] Consider using ngrok or a similar service for local development.');
          }

          // Replace http:// with https:// for VAPI webhooks
          finalWebhookUrl = finalWebhookUrl.replace('http://', 'https://');
          console.log(`[vapi-webhook/route] Converted webhook URL to HTTPS: ${finalWebhookUrl}`);
        }

        const requestPayload = {
          server: {
            url: finalWebhookUrl,
            timeoutSeconds: 20 // Default timeout
          }
        };

        console.log('[vapi-webhook/route] Updating VAPI webhook URL with payload:', JSON.stringify(requestPayload));
        console.log('[vapi-webhook/route] VAPI API endpoint:', `https://api.vapi.ai/assistant/${agentId}`);

        const updateResponse = await fetch(`https://api.vapi.ai/assistant/${agentId}`, {
          method: 'PATCH',
          headers: {
            'Authorization': `Bearer ${decryptedApiKey}`,
            'Content-Type': 'application/json',
            'Accept': 'application/json',
          },
          body: JSON.stringify(requestPayload),
        });

        if (!updateResponse.ok) {
          console.error('[vapi-webhook/route] Failed to update webhook URL in VAPI API', {
            status: updateResponse.status,
            statusText: updateResponse.statusText
          });

          // Try to get more detailed error information
          try {
            const errorData = await updateResponse.text();
            console.error('[vapi-webhook/route] VAPI API error response:', errorData);
          } catch (e) {
            console.error('[vapi-webhook/route] Could not parse error response:', e);
          }

          return NextResponse.json(
            { error: 'Failed to update webhook URL in VAPI API' },
            { status: updateResponse.status }
          );
        }

        // Verify the update was successful by parsing the response
        const updateResult = await updateResponse.json();
        console.log('[vapi-webhook/route] VAPI update response:', JSON.stringify(updateResult));

        // Check if the server object exists and has a URL property
        if (!updateResult.server) {
          console.error('[vapi-webhook/route] Server object missing in VAPI response');
          return NextResponse.json(
            { error: 'Server object missing in VAPI response' },
            { status: 500 }
          );
        }

        if (updateResult.server?.url !== finalWebhookUrl) {
          console.error('[vapi-webhook/route] Webhook URL not updated correctly in VAPI API', {
            expected: finalWebhookUrl,
            actual: updateResult.server?.url
          });
          return NextResponse.json(
            { error: 'Webhook URL not updated correctly in VAPI API' },
            { status: 500 }
          );
        }

        console.log('[vapi-webhook/route] Successfully updated webhook URL in VAPI API', {
          agentId,
          webhookUrl: finalWebhookUrl
        });
      } else if (preExistingWebhookUrl) {
        // If disabling webhook and there's a pre-existing URL, restore it
        // Ensure the pre-existing webhook URL uses HTTPS for VAPI
        let finalPreExistingWebhookUrl = preExistingWebhookUrl;
        if (finalPreExistingWebhookUrl.startsWith('http://')) {
          // Replace http:// with https:// for VAPI webhooks
          finalPreExistingWebhookUrl = finalPreExistingWebhookUrl.replace('http://', 'https://');
          console.log(`[vapi-webhook/route] Converted pre-existing webhook URL to HTTPS: ${finalPreExistingWebhookUrl}`);
        }

        const updateResponse = await fetch(`https://api.vapi.ai/assistant/${agentId}`, {
          method: 'PATCH',
          headers: {
            'Authorization': `Bearer ${decryptedApiKey}`,
            'Content-Type': 'application/json',
            'Accept': 'application/json',
          },
          body: JSON.stringify({
            server: {
              url: finalPreExistingWebhookUrl,
              timeoutSeconds: 20 // Default timeout
            }
          }),
        });

        if (!updateResponse.ok) {
          return NextResponse.json(
            { error: 'Failed to restore pre-existing webhook URL in VAPI API' },
            { status: updateResponse.status }
          );
        }

        // Verify the update was successful by parsing the response
        const updateResult = await updateResponse.json();
        if (updateResult.server?.url !== finalPreExistingWebhookUrl) {
          console.error('[vapi-webhook/route] Pre-existing webhook URL not restored correctly in VAPI API', {
            expected: finalPreExistingWebhookUrl,
            actual: updateResult.server?.url
          });
          return NextResponse.json(
            { error: 'Pre-existing webhook URL not restored correctly in VAPI API' },
            { status: 500 }
          );
        }

        console.log('[vapi-webhook/route] Successfully restored pre-existing webhook URL in VAPI API', {
          agentId,
          preExistingWebhookUrl: finalPreExistingWebhookUrl
        });
      }
    }

    // Update the webhook configuration in the database
    await prisma.vapiAgent.update({
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
      provider: 'vapi',
      webhookEnabled,
      preExistingWebhookUrl,
      forwardToPreExisting,
    });

    // If analytics update failed and agent doesn't have historical processing flags set,
    // try to register the agent with analytics as a fallback
    if (!analyticsUpdateResult && (!agent.historicalAnalyticsProcessed && !agent.historicalProcessingStatus)) {
      console.warn('[vapi-webhook/route] Analytics update failed, attempting to register agent as fallback');

      const registrationResult = await registerAgentInAnalytics({
        agentId: agentId,
        provider: 'vapi',
        partnerId: agent.partnerId,
        agentName: agent.name,
        customerId: agent.customerId || undefined,
      });

      if (registrationResult.success && registrationResult.analyticsAgentId) {
        console.log('[vapi-webhook/route] Successfully registered agent with analytics, updating database');

        // Update the agent with the analytics ID and enable historical processing
        const now = new Date();
        const thirtyDaysAgo = new Date(now.getTime() - (30 * 24 * 60 * 60 * 1000));

        await prisma.vapiAgent.update({
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
          provider: 'vapi',
          webhookEnabled,
          preExistingWebhookUrl,
          forwardToPreExisting,
        });

        if (analyticsUpdateResult) {
          console.log('[vapi-webhook/route] Successfully updated webhook config after registration');
        }
      } else {
        console.error('[vapi-webhook/route] Failed to register agent with analytics as fallback');
      }
    }

    if (!analyticsUpdateResult) {
      console.error('[vapi-webhook/route] Failed to update webhook config in analytics service');
      console.error('[vapi-webhook/route] This may indicate that the agent is not properly registered with the analytics service');
      console.error('[vapi-webhook/route] Agent ID:', agentId, 'Analytics Agent ID:', agent.analyticsAgentId);

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
          const verifyResponse = await fetch(`${analyticsApiUrl}/agents/${agentId}?provider=vapi`, {
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
                console.warn('[vapi-webhook/route] Pre-existing webhook URL not properly saved in analytics service', {
                  expected: preExistingWebhookUrl,
                  actual: analyticsAgent.pre_existing_webhook_url
                });
              } else {
                console.log('[vapi-webhook/route] Pre-existing webhook URL properly saved in analytics service', {
                  preExistingWebhookUrl
                });
              }

              // Note: forward_to_pre_existing is not currently supported in the analytics service
              // We'll keep this commented out for future use
              // if (analyticsAgent.forward_to_pre_existing !== forwardToPreExisting) {
              //   console.warn('[vapi-webhook/route] Forward to pre-existing flag not properly saved in analytics service', {
              //     expected: forwardToPreExisting,
              //     actual: analyticsAgent.forward_to_pre_existing
              //   });
              // }
            }
          } else {
            console.error('[vapi-webhook/route] Failed to verify webhook config in analytics service');
          }
        }
      } catch (verifyError) {
        console.error('[vapi-webhook/route] Error verifying webhook config in analytics service:', verifyError);
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
    console.error('[vapi-webhook/route] Error updating webhook config:', error);
    return NextResponse.json(
      { error: 'Failed to update webhook configuration' },
      { status: 500 }
    );
  }
}
