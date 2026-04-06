/**
 * Agent Migration Library
 * Handles migration of agents from partner-level to agent-level API keys and webhook enablement
 */

import { encrypt, decrypt } from '@/lib/encryption';
import { verifyApiKey } from '@/lib/api-key-resolver';
import { logger } from '@/lib/logger';
import { registerAgentInAnalytics, generateWebhookUrl, updateWebhookConfig, manageUltravoxPartnerWebhook } from '@/lib/analytics';
import { addTrackingToSystemPrompt, hasTrackingIdentifier } from '@/lib/ultravox-tracking';
import { prisma } from '@/lib/prisma';

export interface MigrationStats {
  totalPartners: number;
  totalAgents: number;
  apiKeyMigration: {
    vapi: { migrated: number; failed: number; skipped: number };
    retell: { migrated: number; failed: number; skipped: number };
    ultravox: { migrated: number; failed: number; skipped: number };
  };
  webhookMigration: {
    vapi: { enabled: number; failed: number; skipped: number };
    retell: { enabled: number; failed: number; skipped: number };
    ultravox: { enabled: number; failed: number; skipped: number };
  };
  errors: string[];
}

export interface PartnerMigrationData {
  id: string;
  businessName: string;
  vapiApiKey: string | null;
  retellApiKey: string | null;
  ultravoxApiKey: string | null;
  vapiAgents: Array<{
    id: string;
    name: string;
    customerId: string | null;
    apiKeyStatus: string;
    webhookEnabled: boolean;
    analyticsAgentId: string | null;
    apiKey: string | null;
  }>;
  retellAgents: Array<{
    id: string;
    name: string;
    customerId: string | null;
    apiKeyStatus: string;
    webhookEnabled: boolean;
    analyticsAgentId: string | null;
    apiKey: string | null;
  }>;
  ultravoxAgents: Array<{
    id: string;
    name: string;
    customerId: string | null;
    apiKeyStatus: string;
    webhookEnabled: boolean;
    analyticsAgentId: string | null;
    apiKey: string | null;
  }>;
}

/**
 * Fetch all partners and their agents that need migration
 */
export async function fetchPartnersForMigration(): Promise<PartnerMigrationData[]> {
  logger.info('Fetching partners and agents for migration', {
    operation: 'migration_fetch_partners'
  });

  const partners = await prisma.partner.findMany({
    select: {
      id: true,
      businessName: true,
      vapiApiKey: true,
      retellApiKey: true,
      ultravoxApiKey: true,
      vapiAgents: {
        select: {
          id: true,
          name: true,
          customerId: true,
          apiKeyStatus: true,
          webhookEnabled: true,
          analyticsAgentId: true,
          apiKey: true,
        },
      },
      retellAgents: {
        select: {
          id: true,
          name: true,
          customerId: true,
          apiKeyStatus: true,
          webhookEnabled: true,
          analyticsAgentId: true,
          apiKey: true,
        },
      },
      ultravoxAgents: {
        select: {
          id: true,
          name: true,
          customerId: true,
          apiKeyStatus: true,
          webhookEnabled: true,
          analyticsAgentId: true,
          apiKey: true,
        },
      },
    },
  });

  logger.info('Found partners to process', {
    operation: 'migration_fetch_partners',
    partnerCount: partners.length
  });
  return partners;
}

/**
 * Get migration statistics for a partner
 */
export function getPartnerMigrationStats(partner: PartnerMigrationData): {
  apiKeyMigrationNeeded: { vapi: number; retell: number; ultravox: number };
  webhookMigrationNeeded: { vapi: number; retell: number; ultravox: number };
} {
  return {
    apiKeyMigrationNeeded: {
      vapi: partner.vapiAgents.filter(agent => agent.apiKeyStatus === 'not_set').length,
      retell: partner.retellAgents.filter(agent => agent.apiKeyStatus === 'not_set').length,
      ultravox: partner.ultravoxAgents.filter(agent => agent.apiKeyStatus === 'not_set').length,
    },
    webhookMigrationNeeded: {
      vapi: partner.vapiAgents.filter(agent => !agent.webhookEnabled).length,
      retell: partner.retellAgents.filter(agent => !agent.webhookEnabled).length,
      ultravox: partner.ultravoxAgents.filter(agent => !agent.webhookEnabled).length,
    },
  };
}

/**
 * Migrate API keys for VAPI agents
 */
export async function migrateVapiApiKeys(partnerId: string, partnerApiKey: string): Promise<{
  migrated: number;
  failed: number;
  skipped: number;
  errors: string[];
}> {
  const result = { migrated: 0, failed: 0, skipped: 0, errors: [] as string[] };

  try {
    // Get agents that need migration
    const agents = await prisma.vapiAgent.findMany({
      where: {
        partnerId: partnerId,
        apiKeyStatus: 'not_set'
      }
    });

    if (agents.length === 0) {
      logger.info('No VAPI agents need API key migration for partner', {
        operation: 'migration_vapi_agents',
        partnerId
      });
      return result;
    }

    logger.info('Migrating API keys for VAPI agents', {
      operation: 'migration_vapi_agents',
      agentCount: agents.length,
      partnerId
    });
    const decryptedPartnerKey = await decrypt(partnerApiKey);

    for (const agent of agents) {
      try {
        let keyStatus = 'migrated_from_partner';
        let errorMessage: string | null = null;

        // Verify the API key
        const isValid = await verifyApiKey(decryptedPartnerKey, agent.id, 'vapi');
        keyStatus = isValid ? 'valid' : 'invalid';
        if (!isValid) {
          errorMessage = 'Partner API key verification failed';
        }

        // Encrypt the API key for the agent
        const encryptedKey = await encrypt(decryptedPartnerKey);

        // Calculate historical data date range (30 days back from now)
        const now = new Date();
        const thirtyDaysAgo = new Date(now.getTime() - (30 * 24 * 60 * 60 * 1000));

        // Update the agent with API key and historical processing initialization
        await prisma.vapiAgent.update({
          where: { id: agent.id },
          data: {
            apiKey: encryptedKey,
            apiKeyStatus: keyStatus,
            apiKeyLastVerified: new Date(),
            apiKeyErrorMessage: errorMessage,
            // Initialize historical processing fields for migrated agents
            historicalAnalyticsProcessed: false,
            historicalProcessingStatus: 'pending',
            historicalDataStartDate: thirtyDaysAgo,
            historicalDataEndDate: now,
            historicalCallsProcessed: 0,
            historicalCallsTotal: 0,
          }
        });

        if (keyStatus === 'valid' || keyStatus === 'migrated_from_partner') {
          result.migrated++;
          logger.info('Successfully migrated VAPI agent', {
            operation: 'migration_vapi_agents',
            agentId: agent.id,
            partnerId
          });
        } else {
          result.failed++;
          result.errors.push(`VAPI Agent ${agent.id}: ${errorMessage}`);
          logger.error('Failed to migrate VAPI agent', new Error(errorMessage || 'Unknown error'), {
            operation: 'migration_vapi_agents',
            agentId: agent.id,
            partnerId,
            errorMessage
          });
        }

      } catch (error) {
        result.failed++;
        const errorMsg = error instanceof Error ? error.message : 'Unknown error';
        result.errors.push(`VAPI Agent ${agent.id}: ${errorMsg}`);
        logger.error('Error migrating VAPI agent', error as Error, {
          operation: 'migration_vapi_agents',
          agentId: agent.id,
          partnerId
        });
      }
    }

  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    result.errors.push(`VAPI migration error: ${errorMsg}`);
    logger.error('Error in VAPI API key migration', error as Error, {
      operation: 'migration_vapi_agents',
      partnerId
    });
  }

  return result;
}

/**
 * Migrate API keys for Retell agents
 */
export async function migrateRetellApiKeys(partnerId: string, partnerApiKey: string): Promise<{
  migrated: number;
  failed: number;
  skipped: number;
  errors: string[];
}> {
  const result = { migrated: 0, failed: 0, skipped: 0, errors: [] as string[] };

  try {
    // Get agents that need migration
    const agents = await prisma.retellAgent.findMany({
      where: {
        partnerId: partnerId,
        apiKeyStatus: 'not_set'
      }
    });

    if (agents.length === 0) {
      logger.info('No Retell agents need API key migration for partner', {
        operation: 'migration_retell_agents',
        partnerId
      });
      return result;
    }

    logger.info('Migrating API keys for Retell agents', {
      operation: 'migration_retell_agents',
      agentCount: agents.length,
      partnerId
    });
    const decryptedPartnerKey = await decrypt(partnerApiKey);

    for (const agent of agents) {
      try {
        let keyStatus = 'migrated_from_partner';
        let errorMessage: string | null = null;

        // Verify the API key
        const isValid = await verifyApiKey(decryptedPartnerKey, agent.id, 'retell');
        keyStatus = isValid ? 'valid' : 'invalid';
        if (!isValid) {
          errorMessage = 'Partner API key verification failed';
        }

        // Encrypt the API key for the agent
        const encryptedKey = await encrypt(decryptedPartnerKey);

        // Calculate historical data date range (30 days back from now)
        const now = new Date();
        const thirtyDaysAgo = new Date(now.getTime() - (30 * 24 * 60 * 60 * 1000));

        // Update the agent with API key and historical processing initialization
        await prisma.retellAgent.update({
          where: { id: agent.id },
          data: {
            apiKey: encryptedKey,
            apiKeyStatus: keyStatus,
            apiKeyLastVerified: new Date(),
            apiKeyErrorMessage: errorMessage,
            // Initialize historical processing fields for migrated agents
            historicalAnalyticsProcessed: false,
            historicalProcessingStatus: 'pending',
            historicalDataStartDate: thirtyDaysAgo,
            historicalDataEndDate: now,
            historicalCallsProcessed: 0,
            historicalCallsTotal: 0,
          }
        });

        if (keyStatus === 'valid' || keyStatus === 'migrated_from_partner') {
          result.migrated++;
          logger.info('Successfully migrated Retell agent', {
            operation: 'migration_retell_agents',
            agentId: agent.id,
            partnerId
          });
        } else {
          result.failed++;
          result.errors.push(`Retell Agent ${agent.id}: ${errorMessage}`);
          logger.error('Failed to migrate Retell agent', new Error(errorMessage || 'Unknown error'), {
            operation: 'migration_retell_agents',
            agentId: agent.id,
            partnerId,
            errorMessage
          });
        }

      } catch (error) {
        result.failed++;
        const errorMsg = error instanceof Error ? error.message : 'Unknown error';
        result.errors.push(`Retell Agent ${agent.id}: ${errorMsg}`);
        logger.error('Error migrating Retell agent', error as Error, {
          operation: 'migration_retell_agents',
          agentId: agent.id,
          partnerId
        });
      }
    }

  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    result.errors.push(`Retell migration error: ${errorMsg}`);
    logger.error('Error in Retell API key migration', error as Error, {
      operation: 'migration_retell_agents',
      partnerId
    });
  }

  return result;
}

/**
 * Migrate API keys for Ultravox agents
 */
export async function migrateUltravoxApiKeys(partnerId: string, partnerApiKey: string): Promise<{
  migrated: number;
  failed: number;
  skipped: number;
  errors: string[];
}> {
  const result = { migrated: 0, failed: 0, skipped: 0, errors: [] as string[] };

  try {
    // Get agents that need migration
    const agents = await prisma.ultravoxAgent.findMany({
      where: {
        partnerId: partnerId,
        apiKeyStatus: 'not_set'
      }
    });

    if (agents.length === 0) {
      logger.info('No Ultravox agents need API key migration for partner', {
        operation: 'migration_ultravox_agents',
        partnerId
      });
      return result;
    }

    logger.info('Migrating API keys for Ultravox agents', {
      operation: 'migration_ultravox_agents',
      agentCount: agents.length,
      partnerId
    });
    const decryptedPartnerKey = await decrypt(partnerApiKey);

    for (const agent of agents) {
      try {
        let keyStatus = 'migrated_from_partner';
        const errorMessage: string | null = null;

        // Skip API key verification for Ultravox as it's not yet implemented
        // TODO: Implement Ultravox API key verification
        logger.info('Skipping API key verification for Ultravox agent - verification not yet implemented', {
          operation: 'migration_ultravox_agents',
          agentId: agent.id,
          partnerId
        });
        keyStatus = 'migrated_from_partner'; // Set as migrated without verification

        // Encrypt the API key for the agent
        const encryptedKey = await encrypt(decryptedPartnerKey);

        // Calculate historical data date range (30 days back from now)
        const now = new Date();
        const thirtyDaysAgo = new Date(now.getTime() - (30 * 24 * 60 * 60 * 1000));

        // Update the agent with API key and historical processing initialization
        await prisma.ultravoxAgent.update({
          where: { id: agent.id },
          data: {
            apiKey: encryptedKey,
            apiKeyStatus: keyStatus,
            apiKeyLastVerified: new Date(),
            apiKeyErrorMessage: errorMessage,
            // Initialize historical processing fields for migrated agents
            historicalAnalyticsProcessed: false,
            historicalProcessingStatus: 'pending',
            historicalDataStartDate: thirtyDaysAgo,
            historicalDataEndDate: now,
            historicalCallsProcessed: 0,
            historicalCallsTotal: 0,
          }
        });

        if (keyStatus === 'valid' || keyStatus === 'migrated_from_partner') {
          result.migrated++;
          logger.info('Successfully migrated Ultravox agent', {
            operation: 'migration_ultravox_agents',
            agentId: agent.id,
            partnerId
          });
        } else {
          result.failed++;
          result.errors.push(`Ultravox Agent ${agent.id}: ${errorMessage}`);
          logger.error('Failed to migrate Ultravox agent', new Error(errorMessage || 'Unknown error'), {
            operation: 'migration_ultravox_agents',
            agentId: agent.id,
            partnerId,
            errorMessage
          });
        }

      } catch (error) {
        result.failed++;
        const errorMsg = error instanceof Error ? error.message : 'Unknown error';
        result.errors.push(`Ultravox Agent ${agent.id}: ${errorMsg}`);
        logger.error('Error migrating Ultravox agent', error as Error, {
          operation: 'migration_ultravox_agents',
          agentId: agent.id,
          partnerId
        });
      }
    }

  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    result.errors.push(`Ultravox migration error: ${errorMsg}`);
    logger.error('Error in Ultravox API key migration', error as Error, {
      operation: 'migration_ultravox_agents',
      partnerId
    });
  }

  return result;
}

/**
 * Helper function to update provider APIs with webhook URLs
 */
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
      select: { id: true, vapiApiKey: true }
    });

    // Determine which API key to use: agent's key first, then partner's key
    let decryptedApiKey: string;

    if (agent.apiKey) {
      // Use agent's individual API key
      decryptedApiKey = await decrypt(agent.apiKey);
      logger.info('Using agent-specific API key for VAPI webhook update', {
        operation: 'migration_vapi_webhook',
        agentId: agent.id
      });
    } else if (partner?.vapiApiKey) {
      // Fallback to partner's API key
      decryptedApiKey = await decrypt(partner.vapiApiKey);
      logger.info('Using partner API key for VAPI webhook update (agent has no individual key)', {
        operation: 'migration_vapi_webhook',
        agentId: agent.id,
        partnerId: partner.id
      });
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
      select: { id: true, retellApiKey: true }
    });

    // Determine which API key to use: agent's key first, then partner's key
    let decryptedApiKey: string;

    if (agent.apiKey) {
      // Use agent's individual API key
      decryptedApiKey = await decrypt(agent.apiKey);
      logger.info('Using agent-specific API key for Retell webhook update', {
        operation: 'migration_retell_webhook',
        agentId: agent.id
      });
    } else if (partner?.retellApiKey) {
      // Fallback to partner's API key
      decryptedApiKey = await decrypt(partner.retellApiKey);
      logger.info('Using partner API key for Retell webhook update (agent has no individual key)', {
        operation: 'migration_retell_webhook',
        agentId: agent.id,
        partnerId: partner.id
      });
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
      select: { id: true, ultravoxApiKey: true }
    });

    // Determine which API key to use: agent's key first, then partner's key
    let decryptedApiKey: string;

    if (agent.apiKey) {
      // Use agent's individual API key
      decryptedApiKey = await decrypt(agent.apiKey);
      logger.info('Using agent-specific API key for Ultravox webhook update', {
        operation: 'migration_ultravox_webhook',
        agentId: agent.id
      });
    } else if (partner?.ultravoxApiKey) {
      // Fallback to partner's API key
      decryptedApiKey = await decrypt(partner.ultravoxApiKey);
      logger.info('Using partner API key for Ultravox webhook update (agent has no individual key)', {
        operation: 'migration_ultravox_webhook',
        agentId: agent.id,
        partnerId: partner.id
      });
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

/**
 * Ensure Ultravox agent has tracking identifier in system prompt
 */
async function ensureUltravoxTrackingIdentifier(agentId: string, partnerId: string, agent: any): Promise<void> {
  try {
    // Get partner's Ultravox API key for fallback
    const partner = await prisma.partner.findUnique({
      where: { id: partnerId },
      select: { id: true, ultravoxApiKey: true }
    });

    // Determine which API key to use: agent's key first, then partner's key
    let decryptedApiKey: string;

    if (agent.apiKey) {
      decryptedApiKey = await decrypt(agent.apiKey);
      logger.info('Using agent-specific API key for Ultravox tracking update', {
        operation: 'migration_ultravox_tracking',
        agentId
      });
    } else if (partner?.ultravoxApiKey) {
      decryptedApiKey = await decrypt(partner.ultravoxApiKey);
      logger.info('Using partner API key for Ultravox tracking update', {
        operation: 'migration_ultravox_tracking',
        agentId,
        partnerId: partner.id
      });
    } else {
      throw new Error('No Ultravox API key available for tracking update');
    }

    // Get current agent details from Ultravox API
    const response = await fetch(`https://api.ultravox.ai/api/agents/${agentId}`, {
      headers: {
        'X-API-Key': decryptedApiKey,
        'Accept': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch Ultravox agent ${agentId}: ${response.status}`);
    }

    const agentData = await response.json();
    const currentSystemPrompt = agentData.callTemplate?.systemPrompt || 'You are a helpful AI assistant.';

    // Check if tracking identifier already exists
    if (hasTrackingIdentifier(currentSystemPrompt)) {
      logger.info('Ultravox agent already has tracking identifier', {
        operation: 'migration_ultravox_tracking',
        agentId
      });
      return;
    }

    // Add tracking identifier to system prompt
    const updatedSystemPrompt = addTrackingToSystemPrompt(currentSystemPrompt, agentId);

    // Update agent with tracking identifier
    const updateResponse = await fetch(`https://api.ultravox.ai/api/agents/${agentId}`, {
      method: 'PATCH',
      headers: {
        'X-API-Key': decryptedApiKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        callTemplate: {
          ...agentData.callTemplate,
          systemPrompt: updatedSystemPrompt
        }
      })
    });

    if (!updateResponse.ok) {
      throw new Error(`Failed to update Ultravox agent ${agentId} with tracking: ${updateResponse.status}`);
    }

    logger.info('Successfully added tracking identifier to Ultravox agent', {
      operation: 'migration_ultravox_tracking',
      agentId
    });

    // Update our database record with the new system prompt
    await prisma.ultravoxAgent.update({
      where: { id: agentId },
      data: { systemPrompt: updatedSystemPrompt }
    });

  } catch (error) {
    logger.error('Error adding tracking to Ultravox agent', error as Error, {
      operation: 'migration_ultravox_tracking',
      agentId
    });
    throw error; // Re-throw to be handled by the calling function
  }
}

/**
 * Enable webhooks for VAPI agents
 */
export async function enableVapiWebhooks(partnerId: string): Promise<{
  enabled: number;
  failed: number;
  skipped: number;
  errors: string[];
}> {
  const result = { enabled: 0, failed: 0, skipped: 0, errors: [] as string[] };

  try {
    // Get agents that need webhook enablement
    const agents = await prisma.vapiAgent.findMany({
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
        apiKey: true,
      },
    });

    if (agents.length === 0) {
      logger.info('No VAPI agents need webhook enablement for partner', {
        operation: 'migration_vapi_webhooks',
        partnerId
      });
      return result;
    }

    logger.info('Enabling webhooks for VAPI agents', {
      operation: 'migration_vapi_webhooks',
      agentCount: agents.length,
      partnerId
    });

    for (const agent of agents) {
      try {
        // Skip if webhook is already enabled
        if (agent.webhookEnabled) {
          result.skipped++;
          continue;
        }

        // Ensure agent is registered in analytics
        let analyticsAgentId = agent.analyticsAgentId;
        if (!analyticsAgentId) {
          const registrationResult = await registerAgentInAnalytics({
            agentId: agent.id,
            provider: 'vapi',
            partnerId,
            agentName: agent.name,
            customerId: agent.customerId || undefined,
          });

          if (!registrationResult.success) {
            result.failed++;
            result.errors.push(`VAPI Agent ${agent.id}: Failed to register in analytics`);
            continue;
          }

          // Update the analyticsAgentId with the newly registered ID
          analyticsAgentId = registrationResult.analyticsAgentId;
        }

        // Generate webhook URL
        const webhookUrl = generateWebhookUrl({
          provider: 'vapi',
          analyticsAgentId: analyticsAgentId!,
        });

        // Update the provider's API with the webhook URL
        await updateProviderWebhook('vapi', agent.id, webhookUrl, partnerId, agent);

        // Update database with webhook configuration
        await prisma.vapiAgent.update({
          where: { id: agent.id },
          data: {
            webhookEnabled: true,
            webhookMode: 'automatic',
            webhookUrl,
            preExistingWebhookUrl: undefined,
            forwardToPreExisting: true,
            analyticsAgentId: analyticsAgentId,
          },
        });

        // Update analytics service
        if (analyticsAgentId) {
          await updateWebhookConfig({
            analyticsAgentId: analyticsAgentId,
            providerAgentId: agent.id,
            provider: 'vapi',
            webhookEnabled: true,
            preExistingWebhookUrl: undefined,
            forwardToPreExisting: true,
          });
        }

        result.enabled++;
        logger.info('Successfully enabled webhook for VAPI agent', {
          operation: 'migration_vapi_webhooks',
          agentId: agent.id,
          partnerId
        });

      } catch (error) {
        result.failed++;
        const errorMsg = error instanceof Error ? error.message : 'Unknown error';
        result.errors.push(`VAPI Agent ${agent.id}: ${errorMsg}`);
        logger.error('Error enabling webhook for VAPI agent', error as Error, {
          operation: 'migration_vapi_webhooks',
          agentId: agent.id,
          partnerId
        });
      }
    }

  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    result.errors.push(`VAPI webhook migration error: ${errorMsg}`);
    logger.error('Error in VAPI webhook migration', error as Error, {
      operation: 'migration_vapi_webhooks',
      partnerId
    });
  }

  return result;
}

/**
 * Enable webhooks for Retell agents
 */
export async function enableRetellWebhooks(partnerId: string): Promise<{
  enabled: number;
  failed: number;
  skipped: number;
  errors: string[];
}> {
  const result = { enabled: 0, failed: 0, skipped: 0, errors: [] as string[] };

  try {
    // Get agents that need webhook enablement
    const agents = await prisma.retellAgent.findMany({
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
        apiKey: true,
      },
    });

    if (agents.length === 0) {
      logger.info('No Retell agents need webhook enablement for partner', {
        operation: 'migration_retell_webhooks',
        partnerId
      });
      return result;
    }

    logger.info('Enabling webhooks for Retell agents', {
      operation: 'migration_retell_webhooks',
      agentCount: agents.length,
      partnerId
    });

    for (const agent of agents) {
      try {
        // Skip if webhook is already enabled
        if (agent.webhookEnabled) {
          result.skipped++;
          continue;
        }

        // Ensure agent is registered in analytics
        let analyticsAgentId = agent.analyticsAgentId;
        if (!analyticsAgentId) {
          const registrationResult = await registerAgentInAnalytics({
            agentId: agent.id,
            provider: 'retell',
            partnerId,
            agentName: agent.name,
            customerId: agent.customerId || undefined,
          });

          if (!registrationResult.success) {
            result.failed++;
            result.errors.push(`Retell Agent ${agent.id}: Failed to register in analytics`);
            continue;
          }

          // Update the analyticsAgentId with the newly registered ID
          analyticsAgentId = registrationResult.analyticsAgentId;
        }

        // Generate webhook URL
        const webhookUrl = generateWebhookUrl({
          provider: 'retell',
          analyticsAgentId: analyticsAgentId!,
        });

        // Update the provider's API with the webhook URL
        await updateProviderWebhook('retell', agent.id, webhookUrl, partnerId, agent);

        // Update database with webhook configuration
        await prisma.retellAgent.update({
          where: { id: agent.id },
          data: {
            webhookEnabled: true,
            webhookMode: 'automatic',
            webhookUrl,
            preExistingWebhookUrl: undefined,
            forwardToPreExisting: true,
            analyticsAgentId: analyticsAgentId,
          },
        });

        // Update analytics service
        if (analyticsAgentId) {
          await updateWebhookConfig({
            analyticsAgentId: analyticsAgentId,
            providerAgentId: agent.id,
            provider: 'retell',
            webhookEnabled: true,
            preExistingWebhookUrl: undefined,
            forwardToPreExisting: true,
          });
        }

        result.enabled++;
        logger.info('Successfully enabled webhook for Retell agent', {
          operation: 'migration_retell_webhooks',
          agentId: agent.id,
          partnerId
        });

      } catch (error) {
        result.failed++;
        const errorMsg = error instanceof Error ? error.message : 'Unknown error';
        result.errors.push(`Retell Agent ${agent.id}: ${errorMsg}`);
        logger.error('Error enabling webhook for Retell agent', error as Error, {
          operation: 'migration_retell_webhooks',
          agentId: agent.id,
          partnerId
        });
      }
    }

  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    result.errors.push(`Retell webhook migration error: ${errorMsg}`);
    logger.error('Error in Retell webhook migration', error as Error, {
      operation: 'migration_retell_webhooks',
      partnerId
    });
  }

  return result;
}

/**
 * Enable webhooks for Ultravox agents
 */
export async function enableUltravoxWebhooks(partnerId: string): Promise<{
  enabled: number;
  failed: number;
  skipped: number;
  errors: string[];
}> {
  const result = { enabled: 0, failed: 0, skipped: 0, errors: [] as string[] };

  try {
    // Get agents that need webhook enablement
    const agents = await prisma.ultravoxAgent.findMany({
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
        apiKey: true,
      },
    });

    if (agents.length === 0) {
      logger.info('No Ultravox agents need webhook enablement for partner', {
        operation: 'migration_ultravox_webhooks',
        partnerId
      });
      return result;
    }

    logger.info('Enabling webhooks for Ultravox agents', {
      operation: 'migration_ultravox_webhooks',
      agentCount: agents.length,
      partnerId
    });

    for (const agent of agents) {
      try {
        // Skip if webhook is already enabled
        if (agent.webhookEnabled) {
          result.skipped++;
          continue;
        }

        // Ensure agent is registered in analytics
        let analyticsAgentId = agent.analyticsAgentId;
        if (!analyticsAgentId) {
          const registrationResult = await registerAgentInAnalytics({
            agentId: agent.id,
            provider: 'ultravox',
            partnerId,
            agentName: agent.name,
            customerId: agent.customerId || undefined,
          });

          if (!registrationResult.success) {
            result.failed++;
            result.errors.push(`Ultravox Agent ${agent.id}: Failed to register in analytics`);
            continue;
          }

          // Update the analyticsAgentId with the newly registered ID
          analyticsAgentId = registrationResult.analyticsAgentId;
        }

        // Generate webhook URL (partner-level for Ultravox)
        const webhookUrl = generateWebhookUrl({
          provider: 'ultravox',
          partnerId: partnerId,
        });

        // Update the provider's API with the webhook URL
        await updateProviderWebhook('ultravox', agent.id, webhookUrl, partnerId, agent);

        // Ensure Ultravox agent has tracking identifier in system prompt
        await ensureUltravoxTrackingIdentifier(agent.id, partnerId, agent);

        // Update database with webhook configuration
        await prisma.ultravoxAgent.update({
          where: { id: agent.id },
          data: {
            webhookEnabled: true,
            webhookMode: 'automatic',
            webhookUrl,
            preExistingWebhookUrl: undefined,
            forwardToPreExisting: true,
            analyticsAgentId: analyticsAgentId,
          },
        });

        // Update analytics service
        if (analyticsAgentId) {
          await updateWebhookConfig({
            analyticsAgentId: analyticsAgentId,
            providerAgentId: agent.id,
            provider: 'ultravox',
            webhookEnabled: true,
            preExistingWebhookUrl: undefined,
            forwardToPreExisting: true,
          });
        }

        result.enabled++;
        logger.info('Successfully enabled webhook for Ultravox agent', {
          operation: 'migration_ultravox_webhooks',
          agentId: agent.id,
          partnerId
        });

      } catch (error) {
        result.failed++;
        const errorMsg = error instanceof Error ? error.message : 'Unknown error';
        result.errors.push(`Ultravox Agent ${agent.id}: ${errorMsg}`);
        logger.error('Error enabling webhook for Ultravox agent', error as Error, {
          operation: 'migration_ultravox_webhooks',
          agentId: agent.id,
          partnerId
        });
      }
    }

  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    result.errors.push(`Ultravox webhook migration error: ${errorMsg}`);
    logger.error('Error in Ultravox webhook migration', error as Error, {
      operation: 'migration_ultravox_webhooks',
      partnerId
    });
  }

  return result;
}

/**
 * Main migration function - migrates all partners and their agents
 */
export async function migrateAllAgents(dryRun: boolean = false): Promise<MigrationStats> {
  logger.info('Starting migration of all agents', {
    operation: 'migration_all_agents',
    mode: dryRun ? 'DRY_RUN' : 'FULL'
  });

  const stats: MigrationStats = {
    totalPartners: 0,
    totalAgents: 0,
    apiKeyMigration: {
      vapi: { migrated: 0, failed: 0, skipped: 0 },
      retell: { migrated: 0, failed: 0, skipped: 0 },
      ultravox: { migrated: 0, failed: 0, skipped: 0 },
    },
    webhookMigration: {
      vapi: { enabled: 0, failed: 0, skipped: 0 },
      retell: { enabled: 0, failed: 0, skipped: 0 },
      ultravox: { enabled: 0, failed: 0, skipped: 0 },
    },
    errors: [],
  };

  try {
    // Fetch all partners and their agents
    const partners = await fetchPartnersForMigration();
    stats.totalPartners = partners.length;

    logger.info('Found partners to process', {
      operation: 'migration_all_agents',
      partnerCount: partners.length
    });

    for (const partner of partners) {
      logger.info('Processing partner', {
        operation: 'migration_all_agents',
        partnerId: partner.id,
        businessName: partner.businessName
      });

      // Count total agents for this partner
      const partnerAgentCount = partner.vapiAgents.length + partner.retellAgents.length + partner.ultravoxAgents.length;
      stats.totalAgents += partnerAgentCount;

      // Get migration statistics for this partner
      const partnerStats = getPartnerMigrationStats(partner);
      logger.info('Partner migration needs assessment', {
        operation: 'migration_all_agents',
        partnerId: partner.id,
        businessName: partner.businessName,
        stats: partnerStats
      });

      if (dryRun) {
        logger.info('DRY RUN - Would migrate agents for partner', {
          operation: 'migration_all_agents',
          mode: 'DRY_RUN',
          partnerId: partner.id,
          businessName: partner.businessName,
          agentCount: partnerAgentCount
        });
        continue;
      }

      try {
        // Migrate API keys for each provider
        if (partner.vapiApiKey && partnerStats.apiKeyMigrationNeeded.vapi > 0) {
          logger.info('Migrating VAPI API keys for partner', {
            operation: 'migration_all_agents',
            partnerId: partner.id
          });
          const vapiResult = await migrateVapiApiKeys(partner.id, partner.vapiApiKey);
          stats.apiKeyMigration.vapi.migrated += vapiResult.migrated;
          stats.apiKeyMigration.vapi.failed += vapiResult.failed;
          stats.apiKeyMigration.vapi.skipped += vapiResult.skipped;
          stats.errors.push(...vapiResult.errors);
        }

        if (partner.retellApiKey && partnerStats.apiKeyMigrationNeeded.retell > 0) {
          logger.info('Migrating Retell API keys for partner', {
            operation: 'migration_all_agents',
            partnerId: partner.id
          });
          const retellResult = await migrateRetellApiKeys(partner.id, partner.retellApiKey);
          stats.apiKeyMigration.retell.migrated += retellResult.migrated;
          stats.apiKeyMigration.retell.failed += retellResult.failed;
          stats.apiKeyMigration.retell.skipped += retellResult.skipped;
          stats.errors.push(...retellResult.errors);
        }

        if (partner.ultravoxApiKey && partnerStats.apiKeyMigrationNeeded.ultravox > 0) {
          logger.info('Migrating Ultravox API keys for partner', {
            operation: 'migration_all_agents',
            partnerId: partner.id
          });
          const ultravoxResult = await migrateUltravoxApiKeys(partner.id, partner.ultravoxApiKey);
          stats.apiKeyMigration.ultravox.migrated += ultravoxResult.migrated;
          stats.apiKeyMigration.ultravox.failed += ultravoxResult.failed;
          stats.apiKeyMigration.ultravox.skipped += ultravoxResult.skipped;
          stats.errors.push(...ultravoxResult.errors);
        }

        // Enable webhooks for each provider
        if (partnerStats.webhookMigrationNeeded.vapi > 0) {
          logger.info('Enabling VAPI webhooks for partner', {
            operation: 'migration_all_agents',
            partnerId: partner.id
          });
          const vapiWebhookResult = await enableVapiWebhooks(partner.id);
          stats.webhookMigration.vapi.enabled += vapiWebhookResult.enabled;
          stats.webhookMigration.vapi.failed += vapiWebhookResult.failed;
          stats.webhookMigration.vapi.skipped += vapiWebhookResult.skipped;
          stats.errors.push(...vapiWebhookResult.errors);
        }

        if (partnerStats.webhookMigrationNeeded.retell > 0) {
          logger.info('Enabling Retell webhooks for partner', {
            operation: 'migration_all_agents',
            partnerId: partner.id
          });
          const retellWebhookResult = await enableRetellWebhooks(partner.id);
          stats.webhookMigration.retell.enabled += retellWebhookResult.enabled;
          stats.webhookMigration.retell.failed += retellWebhookResult.failed;
          stats.webhookMigration.retell.skipped += retellWebhookResult.skipped;
          stats.errors.push(...retellWebhookResult.errors);
        }

        if (partnerStats.webhookMigrationNeeded.ultravox > 0) {
          logger.info('Enabling Ultravox webhooks for partner', {
            operation: 'migration_all_agents',
            partnerId: partner.id
          });
          const ultravoxWebhookResult = await enableUltravoxWebhooks(partner.id);
          stats.webhookMigration.ultravox.enabled += ultravoxWebhookResult.enabled;
          stats.webhookMigration.ultravox.failed += ultravoxWebhookResult.failed;
          stats.webhookMigration.ultravox.skipped += ultravoxWebhookResult.skipped;
          stats.errors.push(...ultravoxWebhookResult.errors);
        }

        logger.info('Completed migration for partner', {
          operation: 'migration_all_agents',
          partnerId: partner.id,
          businessName: partner.businessName
        });

      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Unknown error';
        stats.errors.push(`Partner ${partner.businessName} (${partner.id}): ${errorMsg}`);
        logger.error('Error processing partner', error as Error, {
          operation: 'migration_all_agents',
          partnerId: partner.id,
          businessName: partner.businessName
        });
      }
    }

    logger.info('Migration completed successfully', {
      operation: 'migration_all_agents',
      stats
    });

  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    stats.errors.push(`Migration error: ${errorMsg}`);
    logger.error('Error in migration process', error as Error, {
      operation: 'migration_all_agents'
    });
  }

  return stats;
}
