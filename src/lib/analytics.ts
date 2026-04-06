/**
 * Utilities for interacting with the Analytics service API
 */
import { logger } from './logger';

/**
 * Register or update an agent in the analytics service
 * @returns The analytics agent ID if successful, null otherwise
 */
export async function registerAgentInAnalytics(params: {
  agentId: string;
  provider: 'vapi' | 'retell' | 'retell_chat' | 'ultravox' | 'elevenlabs' | 'ghl' | 'knova';
  partnerId: string;
  agentName: string;
  customerId?: string;
  profitMultiplier?: number;
  forceUpdate?: boolean;
}): Promise<{ success: boolean; analyticsAgentId: string | null; data?: any }> {
  try {
    const analyticsApiUrl = process.env.ANALYTICS_API_URL || 'http://localhost:8001';
    const analyticsApiKey = process.env.ANALYTICS_STANDARD_API_KEY;

    // Add more detailed logging
    logger.info('Attempting to register agent with analytics service', {
      operation: 'analytics_agent_registration',
      provider: params.provider,
      analyticsApiUrl,
      hasApiKey: !!analyticsApiKey,
      apiKeyLength: analyticsApiKey?.length
    });

    if (!analyticsApiKey) {
      logger.error('Missing ANALYTICS_STANDARD_API_KEY environment variable', new Error('Missing API key'), {
        operation: 'analytics_agent_registration'
      });
      return { success: false, analyticsAgentId: null };
    }

    const { agentId, provider, partnerId, agentName, customerId, profitMultiplier = 1.2, forceUpdate = false } = params;

    // Log the agent ID and type for debugging
    logger.info('Agent ID format for analytics registration', {
      operation: 'analytics_agent_registration',
      provider,
      agentId,
      idLength: agentId.length,
      hasHyphens: agentId.includes('-'),
      format: (provider === 'retell' || provider === 'retell_chat') ? 'Should start with "agent_"' : 'Should be a UUID'
    });

    logger.info('Analytics registration parameter types', {
      operation: 'analytics_agent_registration',
      agentIdType: typeof agentId,
      agentId,
      providerType: typeof provider,
      provider,
      partnerIdType: typeof partnerId,
      partnerId
    });

    const requestBody: any = {
      agent_id: agentId,
      provider,
      partner_id: partnerId,
      agent_name: agentName,
      config: {
        profit_multiplier: profitMultiplier
      },
      force_update: forceUpdate
    };

    // Add customer_id if provided
    if (customerId) {
      requestBody.customer_id = customerId;
    }

    logger.info('Registering agent with analytics service', {
      operation: 'analytics_agent_registration',
      provider,
      agentId,
      partnerId,
      customerId,
      requestBody: JSON.stringify(requestBody),
      endpoint: `${analyticsApiUrl}/agents/register`,
      hasApiKey: !!analyticsApiKey
    });

    const response = await fetch(`${analyticsApiUrl}/agents/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': analyticsApiKey
      },
      body: JSON.stringify(requestBody)
    });

    logger.info('Analytics registration response received', {
      operation: 'analytics_agent_registration',
      responseStatus: response.status
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
      logger.error('Failed to register agent with analytics service', new Error('Registration failed'), {
        operation: 'analytics_agent_registration',
        provider,
        agentId,
        errorData
      });
      return { success: false, analyticsAgentId: null };
    }

    const result = await response.json();
    const analyticsAgentId = result.data?.id || null;
    logger.info('Successfully registered agent with analytics service', {
      operation: 'analytics_agent_registration',
      provider,
      agentId,
      analyticsAgentId
    });

    return {
      success: true,
      analyticsAgentId,
      data: result.data
    };
  } catch (error) {
    logger.error('Error registering agent with analytics service', error as Error, {
      operation: 'analytics_agent_registration',
      agentId: params.agentId,
      provider: params.provider
    });
    return { success: false, analyticsAgentId: null };
  }
}

/**
 * Get the analytics agent ID for an existing agent
 * @returns The analytics agent ID if found, null otherwise
 */
export async function getAgentAnalyticsId(params: {
  agentId: string;
  provider: 'vapi' | 'retell' | 'retell_chat' | 'ultravox' | 'elevenlabs' | 'ghl' | 'knova';
}): Promise<string | null> {
  try {
    const analyticsApiUrl = process.env.ANALYTICS_API_URL || 'http://localhost:8001';
    const analyticsApiKey = process.env.ANALYTICS_STANDARD_API_KEY;

    if (!analyticsApiKey) {
      logger.error('Missing ANALYTICS_STANDARD_API_KEY environment variable', new Error('Missing API key'), {
        operation: 'analytics_get_agent_id'
      });
      return null;
    }

    const { agentId, provider } = params;

    logger.info('Getting analytics agent ID', {
      operation: 'analytics_get_agent_id',
      provider,
      agentId
    });

    // Get the agent by provider agent ID
    const response = await fetch(`${analyticsApiUrl}/agents/${agentId}?provider=${provider}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': analyticsApiKey
      }
    });

    logger.info('Analytics get agent ID response received', {
      operation: 'analytics_get_agent_id',
      responseStatus: response.status
    });

    if (!response.ok) {
      logger.error('Failed to get analytics agent ID', new Error('Get agent ID failed'), {
        operation: 'analytics_get_agent_id',
        provider,
        agentId
      });
      return null;
    }

    const result = await response.json();
    const analyticsAgentId = result.agent?.id || null;

    logger.info('Found analytics agent ID', {
      operation: 'analytics_get_agent_id',
      provider,
      agentId,
      analyticsAgentId
    });

    return analyticsAgentId;
  } catch (error) {
    logger.error('Error getting analytics agent ID', error as Error, {
      operation: 'analytics_get_agent_id',
      provider: params.provider,
      agentId: params.agentId
    });
    return null;
  }
}

/**
 * Delete an agent from the analytics service
 */
export async function deleteAgentFromAnalytics(agentId: string) {
  try {
    const analyticsApiUrl = process.env.ANALYTICS_API_URL || 'http://localhost:8001';
    const analyticsApiKey = process.env.ANALYTICS_ADMIN_API_KEY;

    if (!analyticsApiKey) {
      logger.error('Missing ANALYTICS_ADMIN_API_KEY environment variable', new Error('Missing admin API key'), {
        operation: 'analytics_delete_agent'
      });
      return false;
    }

    logger.info('Deleting agent from analytics service', {
      operation: 'analytics_delete_agent',
      agentId
    });

    const response = await fetch(`${analyticsApiUrl}/agents/${agentId}`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': analyticsApiKey
      }
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
      logger.error('Failed to delete agent from analytics service', new Error('Delete agent failed'), {
        operation: 'analytics_delete_agent',
        agentId,
        errorData
      });
      return false;
    }

    logger.info('Successfully deleted agent from analytics service', {
      operation: 'analytics_delete_agent',
      agentId
    });
    return true;
  } catch (error) {
    logger.error('Error deleting agent from analytics service', error as Error, {
      operation: 'analytics_delete_agent',
      agentId
    });
    return false;
  }
}

/**
 * Generate a webhook URL for an agent
 */
export function generateWebhookUrl(params: {
  provider: 'vapi' | 'retell' | 'retell_chat' | 'ultravox' | 'elevenlabs' | 'ghl' | 'knova';
  analyticsAgentId?: string;
  partnerId?: string;
}): string {
  let analyticsApiUrl = process.env.ANALYTICS_API_URL || 'http://localhost:8001';
  const { provider, analyticsAgentId, partnerId } = params;

  // For VAPI, ensure we're using HTTPS as they require it
  if (provider === 'vapi' && analyticsApiUrl.startsWith('http://')) {
    // Replace http:// with https:// for VAPI webhooks
    analyticsApiUrl = analyticsApiUrl.replace('http://', 'https://');
    logger.info('Using HTTPS URL for VAPI webhook', {
      operation: 'analytics_webhook_url_conversion',
      analyticsApiUrl
    });
  }

  let webhookUrl: string;

  // Different providers use different webhook URL patterns
  if (provider === 'ultravox') {
    // Ultravox uses partner-level webhooks
    if (!partnerId) {
      throw new Error('Partner ID is required for Ultravox webhook URLs');
    }
    webhookUrl = `${analyticsApiUrl}/webhooks/${provider}/${partnerId}`;
  } else if (provider === 'elevenlabs') {
    // ElevenLabs uses partner-level webhooks (manual setup)
    if (!partnerId) {
      throw new Error('Partner ID is required for ElevenLabs webhook URLs');
    }
    webhookUrl = `${analyticsApiUrl}/webhooks/${provider}/${partnerId}`;
  } else if (provider === 'ghl') {
    // GHL uses a specific endpoint format
    webhookUrl = `${analyticsApiUrl}/webhooks/ghl/webhook_data`;
  } else {
    // VAPI, Retell, Retell Chat, and Knova use agent-level webhooks
    if (!analyticsAgentId) {
      throw new Error('Analytics Agent ID is required for VAPI/Retell/Retell Chat/Knova webhook URLs');
    }
    webhookUrl = `${analyticsApiUrl}/webhooks/${provider}/${analyticsAgentId}`;
  }

  logger.info('Generated webhook URL for analytics', {
    operation: 'analytics_webhook_url_generation',
    provider,
    webhookUrl
  });
  return webhookUrl;
}

/**
 * Check if an agent exists in the analytics service
 */
export async function checkAgentExistsInAnalytics(params: {
  providerAgentId: string;
  provider: 'vapi' | 'retell' | 'retell_chat' | 'ultravox' | 'elevenlabs' | 'ghl' | 'knova';
}): Promise<boolean> {
  try {
    const analyticsApiUrl = process.env.ANALYTICS_API_URL || 'http://localhost:8001';
    const analyticsApiKey = process.env.ANALYTICS_STANDARD_API_KEY;

    if (!analyticsApiKey) {
      logger.error('Missing ANALYTICS_STANDARD_API_KEY environment variable', new Error('Missing API key'), {
        operation: 'analytics_agent_exists_check'
      });
      return false;
    }

    const { providerAgentId, provider } = params;
    logger.info('Checking if agent exists in analytics service', {
      operation: 'analytics_agent_exists_check',
      provider,
      providerAgentId
    });

    // Use the agent management endpoint which expects provider agent ID
    const response = await fetch(`${analyticsApiUrl}/agents/${providerAgentId}?provider=${provider}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': analyticsApiKey
      }
    });

    const exists = response.ok;
    logger.info('Agent existence check result', {
      operation: 'analytics_agent_exists_check',
      providerAgentId,
      exists
    });

    if (!exists) {
      const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
      logger.info('Agent existence check failed', {
        operation: 'analytics_agent_exists_check',
        errorData
      });
    }

    return exists;
  } catch (error) {
    logger.error('Error checking if agent exists in analytics service', error as Error, {
      operation: 'analytics_agent_exists_check',
      providerAgentId: params.providerAgentId
    });
    return false;
  }
}

/**
 * Manage Ultravox webhooks at partner level
 */
export async function manageUltravoxPartnerWebhook(params: {
  partnerId: string;
  ultravoxApiKey: string;
  webhookEnabled: boolean;
}): Promise<{
  success: boolean;
  webhookId?: string;
  webhookUrl?: string;
  action?: 'created' | 'exists' | 'disabled';
  error?: string;
}> {
  try {
    const { partnerId, ultravoxApiKey, webhookEnabled } = params;

    // Generate the partner-level webhook URL
    const webhookUrl = generateWebhookUrl({
      provider: 'ultravox',
      partnerId: partnerId
    });

    logger.info('Managing Ultravox webhook for analytics', {
      operation: 'analytics_ultravox_webhook_management',
      partnerId,
      webhookEnabled
    });

    // First, list existing webhooks to check if our URL already exists
    const listResponse = await fetch('https://api.ultravox.ai/api/webhooks', {
      method: 'GET',
      headers: {
        'X-API-Key': ultravoxApiKey,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
    });

    if (!listResponse.ok) {
      const errorData = await listResponse.json().catch(() => ({ error: 'Unknown error' }));
      logger.error('Failed to list Ultravox webhooks', new Error('List webhooks failed'), {
        operation: 'analytics_ultravox_webhook_management',
        errorData
      });
      return {
        success: false,
        error: `Failed to list webhooks: ${errorData.error || 'Unknown error'}`
      };
    }

    const webhooksData = await listResponse.json();
    const existingWebhooks = webhooksData.results || [];

    // Check if our webhook URL already exists
    const existingWebhook = existingWebhooks.find((webhook: any) =>
      webhook.url === webhookUrl
    );

    if (webhookEnabled) {
      if (existingWebhook) {
        logger.info('Webhook URL already exists for partner', {
          operation: 'analytics_ultravox_webhook_management',
          partnerId
        });
        return {
          success: true,
          webhookId: existingWebhook.webhookId,
          webhookUrl: webhookUrl,
          action: 'exists'
        };
      } else {
        // Create new webhook
        const createResponse = await fetch('https://api.ultravox.ai/api/webhooks', {
          method: 'POST',
          headers: {
            'X-API-Key': ultravoxApiKey,
            'Content-Type': 'application/json',
            'Accept': 'application/json',
          },
          body: JSON.stringify({
            url: webhookUrl,
            events: ['call.started', 'call.ended', 'call.joined']
          }),
        });

        if (!createResponse.ok) {
          const errorData = await createResponse.json().catch(() => ({ error: 'Unknown error' }));
          logger.error('Failed to create Ultravox webhook', new Error('Create webhook failed'), {
            operation: 'analytics_ultravox_webhook_management',
            errorData
          });
          return {
            success: false,
            error: `Failed to create webhook: ${errorData.error || 'Unknown error'}`
          };
        }

        const newWebhook = await createResponse.json();
        logger.info('Created new webhook for partner', {
          operation: 'analytics_ultravox_webhook_management',
          partnerId,
          webhookId: newWebhook.webhookId
        });

        return {
          success: true,
          webhookId: newWebhook.webhookId,
          webhookUrl: webhookUrl,
          action: 'created'
        };
      }
    } else {
      // Webhook disabled - we don't delete the webhook as other agents might be using it
      logger.info('Webhook disabled for partner - keeping existing webhook for other agents', {
        operation: 'analytics_ultravox_webhook_management',
        partnerId
      });
      return {
        success: true,
        action: 'disabled'
      };
    }
  } catch (error) {
    logger.error('Error managing Ultravox webhook for partner', error as Error, {
      operation: 'analytics_ultravox_webhook_management',
      partnerId: params.partnerId
    });
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Update webhook configuration in the analytics service
 */
export async function updateWebhookConfig(params: {
  analyticsAgentId: string;
  providerAgentId: string;
  provider: 'vapi' | 'retell' | 'retell_chat' | 'ultravox' | 'elevenlabs' | 'ghl' | 'knova';
  webhookEnabled: boolean;
  preExistingWebhookUrl?: string;
  forwardToPreExisting?: boolean;
}): Promise<boolean> {
  try {
    const analyticsApiUrl = process.env.ANALYTICS_API_URL || 'http://localhost:8001';
    const analyticsApiKey = process.env.ANALYTICS_STANDARD_API_KEY;

    if (!analyticsApiKey) {
      logger.error('Missing ANALYTICS_STANDARD_API_KEY environment variable', new Error('Missing API key'), {
        operation: 'analytics_update_webhook_config'
      });
      return false;
    }

    const { analyticsAgentId, providerAgentId, provider, webhookEnabled, preExistingWebhookUrl } = params;

    logger.info('Updating webhook config for agent', {
      operation: 'analytics_update_webhook_config',
      provider,
      providerAgentId,
      analyticsAgentId
    });

    // First, check if the agent exists in the analytics service
    const agentExists = await checkAgentExistsInAnalytics({
      providerAgentId,
      provider
    });

    if (!agentExists) {
      logger.warn('Skipping webhook config update for non-existent agent', {
        operation: 'analytics_update_webhook_config',
        providerAgentId
      });
      return false;
    }

    logger.info('Agent exists in analytics service, proceeding with webhook config update', {
      operation: 'analytics_update_webhook_config',
      providerAgentId
    });

    // First, update the webhook configuration using the PATCH endpoint
    const requestBody: any = {};

    // Only include pre-existing webhook URL in the PATCH request
    if (preExistingWebhookUrl !== undefined) {
      requestBody.pre_existing_webhook_url = preExistingWebhookUrl;
    }

    // Note: forward_to_pre_existing is not currently supported in the analytics service
    // We'll keep this in the app database for future use
    // if (forwardToPreExisting !== undefined) {
    //   requestBody.forward_to_pre_existing = forwardToPreExisting;
    // }

    // Only make the PATCH request if we have data to update
    if (Object.keys(requestBody).length > 0) {
      logger.info('Updating agent properties with PATCH', {
        operation: 'analytics_update_webhook_config',
        requestBody
      });

      // Use provider agent ID for agent management endpoints
      const patchResponse = await fetch(`${analyticsApiUrl}/agents/${providerAgentId}?provider=${provider}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': analyticsApiKey
        },
        body: JSON.stringify(requestBody)
      });

      if (!patchResponse.ok) {
        const errorData = await patchResponse.json().catch(() => ({ error: 'Unknown error' }));
        logger.error('Failed to update agent properties', new Error('Update agent properties failed'), {
          operation: 'analytics_update_webhook_config',
          providerAgentId,
          errorData
        });
        // Continue with webhook config update even if this fails
      } else {
        logger.info('Successfully updated agent properties', {
          operation: 'analytics_update_webhook_config',
          providerAgentId
        });
      }
    }

    // Now update the webhook enabled status using the webhook-config endpoint
    // This endpoint uses the analytics internal ID (analyticsAgentId)
    const webhookConfigBody = {
      webhook_enabled: webhookEnabled
    };

    const webhookConfigResponse = await fetch(`${analyticsApiUrl}/agents/${analyticsAgentId}/webhook-config`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': analyticsApiKey
      },
      body: JSON.stringify(webhookConfigBody)
    });

    if (!webhookConfigResponse.ok) {
      const errorData = await webhookConfigResponse.json().catch(() => ({ error: 'Unknown error' }));
      logger.error('Failed to update webhook config for agent', new Error('Update webhook config failed'), {
        operation: 'analytics_update_webhook_config',
        analyticsAgentId,
        errorData
      });
      return false;
    }

    logger.info('Successfully updated webhook configuration for agent', {
      operation: 'analytics_update_webhook_config',
      provider,
      providerAgentId,
      analyticsAgentId
    });
    return true;
  } catch (error) {
    logger.error('Error updating webhook config for agent', error as Error, {
      operation: 'analytics_update_webhook_config',
      providerAgentId: params.providerAgentId
    });
    return false;
  }
}
