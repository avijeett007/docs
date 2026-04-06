import { NextRequest, NextResponse } from 'next/server';
import { verifyPartnerJWT } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { generateWebhookUrl, updateWebhookConfig, registerAgentInAnalytics, manageUltravoxPartnerWebhook } from '@/lib/analytics';
import { decrypt } from '@/lib/encryption';

export const dynamic = 'force-dynamic';

interface BulkEnableResult {
  success: boolean;
  agentId: string;
  provider: string;
  error?: string;
}

// Helper function to update provider APIs with webhook URLs
async function updateProviderWebhook(
  provider: 'vapi' | 'retell' | 'ultravox',
  agentId: string,
  webhookUrl: string,
  partnerId: string,
  agent: any
): Promise<void> {
  if (provider === 'vapi') {
    // Get partner's VAPI API key for fallback
    const partner = await prisma.partner.findUnique({
      where: { id: partnerId },
      select: { vapiApiKey: true }
    });

    // Determine which API key to use: agent's key first, then partner's key
    let decryptedApiKey: string;

    if (agent.apiKey) {
      // Use agent's individual API key
      decryptedApiKey = await decrypt(agent.apiKey);
      console.log('[webhook-bulk-enable] Using agent-specific API key for VAPI webhook update');
    } else if (partner?.vapiApiKey) {
      // Fallback to partner's API key
      decryptedApiKey = await decrypt(partner.vapiApiKey);
      console.log('[webhook-bulk-enable] Using partner API key for VAPI webhook update (agent has no individual key)');
    } else {
      throw new Error('No VAPI API key available - neither agent-specific nor partner API key found');
    }

    // Update VAPI agent webhook
    const response = await fetch(`https://api.vapi.ai/assistant/${agentId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${decryptedApiKey}`,
      },
      body: JSON.stringify({
        serverUrl: webhookUrl,
      }),
    });

    if (!response.ok) {
      throw new Error(`Failed to update VAPI webhook: ${response.status}`);
    }
  } else if (provider === 'retell') {
    // Get partner's Retell API key for fallback
    const partner = await prisma.partner.findUnique({
      where: { id: partnerId },
      select: { retellApiKey: true }
    });

    // Determine which API key to use: agent's key first, then partner's key
    let decryptedApiKey: string;

    if (agent.apiKey) {
      // Use agent's individual API key
      decryptedApiKey = await decrypt(agent.apiKey);
      console.log('[webhook-bulk-enable] Using agent-specific API key for Retell webhook update');
    } else if (partner?.retellApiKey) {
      // Fallback to partner's API key
      decryptedApiKey = await decrypt(partner.retellApiKey);
      console.log('[webhook-bulk-enable] Using partner API key for Retell webhook update (agent has no individual key)');
    } else {
      throw new Error('No Retell API key available - neither agent-specific nor partner API key found');
    }

    // Update Retell agent webhook
    const response = await fetch(`https://api.retellai.com/update-agent/${agentId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${decryptedApiKey}`,
      },
      body: JSON.stringify({
        webhook_url: webhookUrl,
      }),
    });

    if (!response.ok) {
      throw new Error(`Failed to update Retell webhook: ${response.status}`);
    }
  } else if (provider === 'ultravox') {
    // For Ultravox, we use partner-level webhooks but need agent's API key
    // Get partner's Ultravox API key for fallback
    const partner = await prisma.partner.findUnique({
      where: { id: partnerId },
      select: { ultravoxApiKey: true }
    });

    // Determine which API key to use: agent's key first, then partner's key
    let decryptedApiKey: string;

    if (agent.apiKey) {
      // Use agent's individual API key
      decryptedApiKey = await decrypt(agent.apiKey);
      console.log('[webhook-bulk-enable] Using agent-specific API key for Ultravox webhook update');
    } else if (partner?.ultravoxApiKey) {
      // Fallback to partner's API key
      decryptedApiKey = await decrypt(partner.ultravoxApiKey);
      console.log('[webhook-bulk-enable] Using partner API key for Ultravox webhook update (agent has no individual key)');
    } else {
      throw new Error('No Ultravox API key available - neither agent-specific nor partner API key found');
    }

    // Use the proper Ultravox webhook management function
    const webhookResult = await manageUltravoxPartnerWebhook({
      partnerId: partnerId,
      ultravoxApiKey: decryptedApiKey,
      webhookEnabled: true,
    });

    if (!webhookResult.success) {
      throw new Error(`Failed to manage Ultravox webhook: ${webhookResult.error}`);
    }
  }
}

export async function POST(req: NextRequest) {
  try {
    // Verify the partner JWT token
    const decoded = await verifyPartnerJWT(req);
    if (!decoded || !decoded.payload || !decoded.isValid) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const partnerId = decoded.payload.partnerId;
    const body = await req.json();
    const { provider } = body; // 'vapi', 'retell', 'ultravox', or 'all'

    if (!provider || !['vapi', 'retell', 'ultravox', 'all'].includes(provider)) {
      return NextResponse.json(
        { error: 'Invalid provider. Must be vapi, retell, ultravox, or all' },
        { status: 400 }
      );
    }

    const results: BulkEnableResult[] = [];
    let totalProcessed = 0;
    let totalSuccessful = 0;

    // Helper function to enable webhook for a single agent
    const enableWebhookForAgent = async (
      agentId: string,
      agentProvider: 'vapi' | 'retell' | 'ultravox',
      agent: any
    ): Promise<BulkEnableResult> => {
      try {
        // Skip if webhook is already enabled
        if (agent.webhookEnabled) {
          return {
            success: true,
            agentId,
            provider: agentProvider,
            error: 'Already enabled'
          };
        }

        // Ensure agent is registered in analytics
        let analyticsAgentId = agent.analyticsAgentId;
        if (!analyticsAgentId) {
          const registrationResult = await registerAgentInAnalytics({
            agentId,
            provider: agentProvider,
            partnerId,
            agentName: agent.name,
            customerId: agent.customerId,
          });

          if (!registrationResult.success) {
            return {
              success: false,
              agentId,
              provider: agentProvider,
              error: 'Failed to register in analytics'
            };
          }

          // Update the analyticsAgentId with the newly registered ID
          analyticsAgentId = registrationResult.analyticsAgentId;
        }

        // Generate webhook URL
        const webhookUrl = generateWebhookUrl({
          provider: agentProvider,
          analyticsAgentId: analyticsAgentId,
          partnerId: agentProvider === 'ultravox' ? partnerId : undefined,
        });

        // Update the provider's API with the webhook URL
        await updateProviderWebhook(agentProvider, agentId, webhookUrl, partnerId, agent);

        // Update database with webhook configuration
        const updateData = {
          webhookEnabled: true,
          webhookMode: 'automatic' as const,
          webhookUrl,
          preExistingWebhookUrl: undefined,
          forwardToPreExisting: true,
        };

        if (agentProvider === 'vapi') {
          await prisma.vapiAgent.update({
            where: { id: agentId },
            data: updateData,
          });
        } else if (agentProvider === 'retell') {
          await prisma.retellAgent.update({
            where: { id: agentId },
            data: updateData,
          });
        } else if (agentProvider === 'ultravox') {
          await prisma.ultravoxAgent.update({
            where: { id: agentId },
            data: updateData,
          });
        }

        // Update analytics service
        if (analyticsAgentId) {
          await updateWebhookConfig({
            analyticsAgentId: analyticsAgentId,
            providerAgentId: agentId,
            provider: agentProvider,
            webhookEnabled: true,
            preExistingWebhookUrl: undefined,
            forwardToPreExisting: true,
          });
        }

        return {
          success: true,
          agentId,
          provider: agentProvider,
        };
      } catch (error) {
        console.error(`Error enabling webhook for ${agentProvider} agent ${agentId}:`, error);
        return {
          success: false,
          agentId,
          provider: agentProvider,
          error: error instanceof Error ? error.message : 'Unknown error'
        };
      }
    };

    // Process VAPI agents
    if (provider === 'vapi' || provider === 'all') {
      const vapiAgents = await prisma.vapiAgent.findMany({
        where: {
          partnerId,
          webhookEnabled: { not: true },
        },
        select: {
          id: true,
          name: true,
          customerId: true,
          analyticsAgentId: true,
          webhookEnabled: true,
          apiKey: true, // Include agent-level API key
        },
      });

      for (const agent of vapiAgents) {
        const result = await enableWebhookForAgent(agent.id, 'vapi', agent);
        results.push(result);
        totalProcessed++;
        if (result.success && result.error !== 'Already enabled') {
          totalSuccessful++;
        }
      }
    }

    // Process Retell agents
    if (provider === 'retell' || provider === 'all') {
      const retellAgents = await prisma.retellAgent.findMany({
        where: {
          partnerId,
          webhookEnabled: { not: true },
        },
        select: {
          id: true,
          name: true,
          customerId: true,
          analyticsAgentId: true,
          webhookEnabled: true,
          apiKey: true, // Include agent-level API key
        },
      });

      for (const agent of retellAgents) {
        const result = await enableWebhookForAgent(agent.id, 'retell', agent);
        results.push(result);
        totalProcessed++;
        if (result.success && result.error !== 'Already enabled') {
          totalSuccessful++;
        }
      }
    }

    // Process Ultravox agents
    if (provider === 'ultravox' || provider === 'all') {
      const ultravoxAgents = await prisma.ultravoxAgent.findMany({
        where: {
          partnerId,
          webhookEnabled: { not: true },
        },
        select: {
          id: true,
          name: true,
          customerId: true,
          analyticsAgentId: true,
          webhookEnabled: true,
          apiKey: true, // Include agent-level API key
        },
      });

      for (const agent of ultravoxAgents) {
        const result = await enableWebhookForAgent(agent.id, 'ultravox', agent);
        results.push(result);
        totalProcessed++;
        if (result.success && result.error !== 'Already enabled') {
          totalSuccessful++;
        }
      }
    }

    return NextResponse.json({
      success: true,
      summary: {
        totalProcessed,
        totalSuccessful,
        totalFailed: totalProcessed - totalSuccessful,
      },
      results,
    });
  } catch (error) {
    console.error('[webhook-bulk-enable/route] Error in bulk webhook enable:', error);
    return NextResponse.json(
      { error: 'Failed to enable webhooks' },
      { status: 500 }
    );
  }
}
