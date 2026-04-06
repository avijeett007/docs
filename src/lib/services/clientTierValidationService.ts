/**
 * Client-side tier validation service
 * This service makes API calls instead of direct database access
 * Replaces direct TierValidationService usage in frontend components
 */

import { logger } from '@/lib/logger';

export type AgentProvider = 'vapi' | 'retell' | 'ultravox' | 'elevenlabs' | 'ghl' | 'knova' | 'byo';
export type MarketingTier = 'marketing_offer' | 'free_forever' | 'starter' | 'pro' | 'ultimate' | 'unlimited';

// Default tier configurations for display purposes
export const TIER_CONFIGURATIONS: Record<MarketingTier, TierLimits> = {
  marketing_offer: {
    maxCustomers: 5,
    maxVapiAgents: 2,
    maxRetellAgents: 2,
    maxUltravoxAgents: 1,
    maxElevenlabsAgents: 1,
    maxGhlAgents: 2,
    maxKnovaAgents: 1,
    maxNumberPools: 5,
    maxByoAgents: 1,
    saasMode: false,
  },
  free_forever: {
    maxCustomers: 2,
    maxVapiAgents: 0,
    maxRetellAgents: 2,
    maxUltravoxAgents: 0,
    maxElevenlabsAgents: 0,
    maxGhlAgents: 0,
    maxKnovaAgents: 0,
    maxNumberPools: 0,
    maxByoAgents: 0,
    saasMode: false,
  },
  starter: {
    maxCustomers: null, // unlimited
    maxVapiAgents: null,
    maxRetellAgents: null,
    maxUltravoxAgents: null,
    maxElevenlabsAgents: null,
    maxGhlAgents: null,
    maxKnovaAgents: null,
    maxNumberPools: 5,
    maxByoAgents: null,
    saasMode: true,
  },
  pro: {
    maxCustomers: null, // unlimited
    maxVapiAgents: null,
    maxRetellAgents: null,
    maxUltravoxAgents: null,
    maxElevenlabsAgents: null,
    maxGhlAgents: null,
    maxKnovaAgents: null,
    maxNumberPools: 5,
    maxByoAgents: null,
    saasMode: true,
  },
  ultimate: {
    maxCustomers: null, // unlimited
    maxVapiAgents: null,
    maxRetellAgents: null,
    maxUltravoxAgents: null,
    maxElevenlabsAgents: null,
    maxGhlAgents: null,
    maxKnovaAgents: null,
    maxNumberPools: null,
    maxByoAgents: null,
    saasMode: true,
  },
  unlimited: {
    maxCustomers: null, // unlimited
    maxVapiAgents: null,
    maxRetellAgents: null,
    maxUltravoxAgents: null,
    maxElevenlabsAgents: null,
    maxGhlAgents: null,
    maxKnovaAgents: null,
    maxNumberPools: null,
    maxByoAgents: null,
    saasMode: true,
  },
};

export interface ValidationResult {
  allowed: boolean;
  currentCount: number;
  limit: number | null;
  remaining: number | null;
}

export interface UpgradePrompt {
  show: boolean;
  title: string;
  message: string;
  currentTier: MarketingTier;
  suggestedTier: MarketingTier;
  feature: string;
}

export interface TierLimits {
  maxCustomers: number | null;
  maxVapiAgents: number | null;
  maxRetellAgents: number | null;
  maxUltravoxAgents: number | null;
  maxElevenlabsAgents: number | null;
  maxGhlAgents: number | null;
  maxKnovaAgents: number | null;
  maxNumberPools: number | null;
  maxByoAgents: number | null;
  saasMode: boolean;
}

export class ClientTierValidationService {
  private static async makeRequest(action: string, data: any = {}) {
    const token = localStorage.getItem('partner_token');
    if (!token) {
      throw new Error('Authentication token not found. Please log in again.');
    }

    const response = await fetch('/api/partner/tier-validation', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({ action, ...data }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `HTTP ${response.status}`);
    }

    return response.json();
  }

  /**
   * Validate if partner can create a new customer
   */
  static async validateCustomerCreation(): Promise<ValidationResult> {
    try {
      const result = await this.makeRequest('validate_customer_creation');
      logger.info('Customer validation result', {
        operation: 'client_tier_validation',
        validation: result.validation
      });
      return result.validation;
    } catch (error) {
      logger.error('Error validating customer creation', error as Error, {
        operation: 'client_tier_validation'
      });
      throw error;
    }
  }

  /**
   * Validate if partner can create a new number pool
   */
  static async validateNumberPoolCreation(): Promise<ValidationResult> {
    try {
      const result = await this.makeRequest('validate_number_pool_creation');
      return result.validation;
    } catch (error) {
      logger.error('Error validating number pool creation', error as Error, {
        operation: 'client_tier_validation'
      });
      throw error;
    }
  }

  /**
   * Validate if partner can create a new agent of specified type
   */
  static async validateAgentCreation(provider: AgentProvider): Promise<ValidationResult> {
    try {
      const result = await this.makeRequest('validate_agent_creation', { provider });
      return result.validation;
    } catch (error) {
      logger.error('Error validating agent creation', error as Error, {
        operation: 'client_tier_validation',
        provider
      });
      throw error;
    }
  }

  /**
   * Validate if partner can import/purchase a new phone number
   * For free_forever tier: 1 free import allowed, then $10 per additional number
   */
  static async validatePhoneNumberImport(): Promise<ValidationResult> {
    try {
      const result = await this.makeRequest('validate_phone_number_import');
      return result.validation;
    } catch (error) {
      logger.error('Error validating phone number import', error as Error, {
        operation: 'client_tier_validation'
      });
      throw error;
    }
  }

  /**
   * Validate if partner has access to SaaS mode features
   */
  static async validateSaaSModeAccess(): Promise<ValidationResult> {
    try {
      const result = await this.makeRequest('validate_saas_mode');
      return result.validation;
    } catch (error) {
      logger.error('Error validating SaaS mode access', error as Error, {
        operation: 'client_tier_validation'
      });
      throw error;
    }
  }

  /**
   * Get partner's current tier limits
   */
  static async getPartnerTierLimits(): Promise<TierLimits | null> {
    try {
      const result = await this.makeRequest('get_tier_limits');
      return result.limits;
    } catch (error) {
      logger.error('Error getting partner tier limits', error as Error, {
        operation: 'client_tier_validation'
      });
      throw error;
    }
  }

  /**
   * Generate upgrade prompt for partner
   */
  static async generateUpgradePrompt(
    feature: 'customers' | 'agents' | 'saas_mode' | 'number_pools',
    provider?: AgentProvider
  ): Promise<UpgradePrompt> {
    try {
      const result = await this.makeRequest('generate_upgrade_prompt', { feature, provider });
      return result.prompt;
    } catch (error) {
      logger.error('Error generating upgrade prompt', error as Error, {
        operation: 'client_tier_validation'
      });
      throw error;
    }
  }

  /**
   * Check if partner can perform a specific action
   * This is a convenience method that combines validation and returns a simple boolean
   */
  static async canPerformAction(
    action: 'create_customer' | 'create_agent' | 'access_saas_mode' | 'create_number_pool',
    provider?: AgentProvider
  ): Promise<boolean> {
    try {
      let validation: ValidationResult;
      
      switch (action) {
        case 'create_customer':
          validation = await this.validateCustomerCreation();
          break;
        case 'create_agent':
          if (!provider) throw new Error('Provider is required for agent creation validation');
          validation = await this.validateAgentCreation(provider);
          break;
        case 'access_saas_mode':
          validation = await this.validateSaaSModeAccess();
          break;
        case 'create_number_pool':
          validation = await this.validateNumberPoolCreation();
          break;
        default:
          throw new Error(`Unknown action: ${action}`);
      }

      return validation.allowed;
    } catch (error) {
      logger.error('Error checking if can perform action', error as Error, {
        operation: 'client_tier_validation',
        action
      });
      return false; // Fail safe - deny access on error
    }
  }

  /**
   * Get formatted limit information for display
   */
  static async getLimitInfo(provider?: AgentProvider): Promise<{
    customers: { current: number; limit: number | null; remaining: number | null };
    agents?: { current: number; limit: number | null; remaining: number | null };
    numberPools: { current: number; limit: number | null; remaining: number | null };
    saasMode: boolean;
  }> {
    try {
      const [customerValidation, agentValidation, numberPoolValidation, limits] = await Promise.all([
        this.validateCustomerCreation(),
        provider ? this.validateAgentCreation(provider) : null,
        this.validateNumberPoolCreation(),
        this.getPartnerTierLimits()
      ]);

      return {
        customers: {
          current: customerValidation.currentCount,
          limit: customerValidation.limit,
          remaining: customerValidation.remaining
        },
        ...(agentValidation && {
          agents: {
            current: agentValidation.currentCount,
            limit: agentValidation.limit,
            remaining: agentValidation.remaining
          }
        }),
        numberPools: {
          current: numberPoolValidation.currentCount,
          limit: numberPoolValidation.limit,
          remaining: numberPoolValidation.remaining
        },
        saasMode: limits?.saasMode || false
      };
    } catch (error) {
      logger.error('Error getting limit info', error as Error, {
        operation: 'client_tier_validation'
      });
      throw error;
    }
  }
}
