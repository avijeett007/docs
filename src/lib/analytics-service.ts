/**
 * Utilities for interacting with the analytics service
 */

import { Partner } from '@prisma/client';
import { logger } from './logger';

const ANALYTICS_API_URL = process.env.ANALYTICS_API_URL || 'http://localhost:8001';

/**
 * Partner update data interface
 */
interface PartnerUpdateData {
  business_name?: string;
  contact_name?: string;
  email?: string;
  phone?: string;
  profit_multiplier?: number;
  vapi_api_key?: string | null;
  retell_api_key?: string | null;
  elevenlabs_api_key?: string | null;
}

/**
 * Provision a partner in the analytics service
 * @param partner Partner data
 * @param vapiApiKey VAPI API key (unencrypted)
 * @param retellApiKey Retell API key (unencrypted)
 * @param elevenLabsApiKey ElevenLabs API key (unencrypted)
 * @returns Response from the analytics service
 */
export async function provisionPartnerInAnalytics(
  partner: Partner,
  vapiApiKey?: string | null,
  retellApiKey?: string | null,
  elevenLabsApiKey?: string | null
) {
  try {
    // Cast partner to any to access potential properties not in the type definition
    const partnerAny = partner as any;
    
    const response = await fetch(`${ANALYTICS_API_URL}/partners/provision`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANALYTICS_ADMIN_API_KEY || '',
      },
      body: JSON.stringify({
        partner_id: partner.id,
        partner_name: partner.contactName || partner.businessName, // Required field - use contactName or fallback to businessName
        business_name: partner.businessName,
        contact_name: partner.contactName,
        email: partner.emailAddress,
        phone: partner.phoneNumber,
        profit_multiplier: partnerAny.profitMultiplier || 1.2,
        vapi_api_key: vapiApiKey,
        retell_api_key: retellApiKey,
        elevenlabs_api_key: elevenLabsApiKey,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      logger.error('Error provisioning partner in analytics', new Error('API Error'), {
        operation: 'analytics_provisioning',
        errorData
      });
      return {
        success: false,
        error: `Failed to provision partner: ${response.status} ${response.statusText}`,
      };
    }

    const data = await response.json();
    return {
      success: true,
      data,
    };
  } catch (error: unknown) {
    logger.error('Error provisioning partner in analytics', error as Error, {
      operation: 'analytics_provisioning'
    });
    return {
      success: false,
      error: `Error provisioning partner: ${error instanceof Error ? error.message : 'Unknown error'}`,
    };
  }
}

/**
 * Update a partner in the analytics service
 * @param partnerId Partner ID
 * @param updates Partner updates
 * @param vapiApiKey VAPI API key (unencrypted)
 * @param retellApiKey Retell API key (unencrypted)
 * @param elevenLabsApiKey ElevenLabs API key (unencrypted)
 * @returns Response from the analytics service
 */
export async function updatePartnerInAnalytics(
  partnerId: string,
  updates: PartnerUpdateData,
  vapiApiKey?: string | null,
  retellApiKey?: string | null,
  elevenLabsApiKey?: string | null
) {
  try {
    // Prepare update data
    const updateData: PartnerUpdateData = {
      ...updates,
    };

    // Only include API keys if they are explicitly provided (not undefined)
    if (vapiApiKey !== undefined) {
      updateData.vapi_api_key = vapiApiKey;
    }

    if (retellApiKey !== undefined) {
      updateData.retell_api_key = retellApiKey;
    }

    if (elevenLabsApiKey !== undefined) {
      updateData.elevenlabs_api_key = elevenLabsApiKey;
    }

    const response = await fetch(`${ANALYTICS_API_URL}/partners/${partnerId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(updateData),
    });

    if (!response.ok) {
      const errorData = await response.json();
      logger.error('Error updating partner in analytics', new Error('API Error'), {
        operation: 'analytics_update',
        errorData
      });
      return {
        success: false,
        error: `Failed to update partner: ${response.status} ${response.statusText}`,
      };
    }

    const data = await response.json();
    return {
      success: true,
      data,
    };
  } catch (error: unknown) {
    logger.error('Error updating partner in analytics', error as Error, {
      operation: 'analytics_update'
    });
    return {
      success: false,
      error: `Error updating partner: ${error instanceof Error ? error.message : 'Unknown error'}`,
    };
  }
}

/**
 * Register a new agent in the analytics service
 * @param agentData Agent data
 * @returns Response from the analytics service
 */
export async function registerAgentInAnalytics(agentData: {
  agent_id: string;
  provider: string;
  partner_id: string;
  customer_id?: string;
  agent_name: string;
  config?: any;
}) {
  try {
    const response = await fetch(`${ANALYTICS_API_URL}/agents/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(agentData),
    });

    if (!response.ok) {
      const errorData = await response.json();
      logger.error('Error registering agent in analytics', new Error('API Error'), {
        operation: 'analytics_agent_registration',
        errorData
      });
      return {
        success: false,
        error: `Failed to register agent: ${response.status} ${response.statusText}`,
      };
    }

    const data = await response.json();
    return {
      success: true,
      data,
    };
  } catch (error: unknown) {
    logger.error('Error registering agent in analytics', error as Error, {
      operation: 'analytics_agent_registration'
    });
    return {
      success: false,
      error: `Error registering agent: ${error instanceof Error ? error.message : 'Unknown error'}`,
    };
  }
}

/**
 * Trigger analytics fetching for an agent
 * @param agent_id Agent ID
 * @param provider Provider name (vapi, retell, elevenlabs)
 * @param start_date Start date (YYYY-MM-DD)
 * @param end_date End date (YYYY-MM-DD)
 * @returns Response from the analytics service
 */
export async function triggerAnalyticsFetch(
  agent_id: string,
  provider: string,
  start_date?: string,
  end_date?: string
) {
  try {
    const response = await fetch(`${ANALYTICS_API_URL}/analytics/fetch-calls`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        agent_id,
        provider,
        start_date,
        end_date,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      logger.error('Error triggering analytics fetch', new Error('API Error'), {
        operation: 'analytics_fetch',
        errorData
      });
      return {
        success: false,
        error: `Failed to trigger analytics fetch: ${response.status} ${response.statusText}`,
      };
    }

    const data = await response.json();
    return {
      success: true,
      data,
    };
  } catch (error: unknown) {
    logger.error('Error triggering analytics fetch', error as Error, {
      operation: 'analytics_fetch'
    });
    return {
      success: false,
      error: `Error triggering analytics fetch: ${error instanceof Error ? error.message : 'Unknown error'}`,
    };
  }
}
