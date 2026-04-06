import { prisma } from '@/lib/prisma';
import { tierConfigurationCache } from './tierConfigurationCache';
import { logger } from '@/lib/logger';

export type MarketingTier = 'marketing_offer' | 'free_forever' | 'free_forever_trial' | 'starter' | 'starter_special' | 'starter_tier_trial' | 'pro' | 'ultimate' | 'unlimited';
export type AgentProvider = 'vapi' | 'retell' | 'ultravox' | 'elevenlabs' | 'ghl' | 'knova' | 'byo';

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

export interface TierValidationResult {
  allowed: boolean;
  currentCount: number;
  limit: number | null;
  remaining: number | null;
  message?: string;
}

export interface UpgradePrompt {
  show: boolean;
  title: string;
  message: string;
  currentTier: MarketingTier;
  suggestedTier: MarketingTier;
  feature: string;
}

// Default tier configurations
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
    maxKnovaAgents: null, // unlimited
    maxNumberPools: 0,
    maxByoAgents: 0,
    saasMode: false,
  },
  free_forever_trial: {
    maxCustomers: 2, // Limited to encourage upgrade
    maxVapiAgents: 0, // Premium agents not allowed
    maxRetellAgents: 2, // Limited to encourage upgrade
    maxUltravoxAgents: 0, // Premium agents not allowed
    maxElevenlabsAgents: 0, // Premium agents not allowed
    maxGhlAgents: 0, // Premium agents not allowed
    maxKnovaAgents: 0, // Premium agents not allowed
    maxNumberPools: 0,
    maxByoAgents: 0, // Premium agents not allowed
    saasMode: false, // Limited features during trial
  },
  starter_tier_trial: {
    maxCustomers: null, // unlimited during trial
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
  // All non-marketing tiers have unlimited access for now
  // Limits can be configured later through admin UI if needed
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
  starter_special: {
    maxCustomers: null, // unlimited (same as regular starter)
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
    maxCustomers: null,
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

export class TierValidationService {
  /**
   * Get partner's current tier and limits
   */
  static async getPartnerTierLimits(partnerId: string): Promise<TierLimits | null> {
    try {
      // Try cache first
      const cached = await tierConfigurationCache.getPartnerTierLimits(partnerId);
      if (cached) {
        return cached;
      }

      // Cache miss - fetch from database
      const partner = await (prisma as any).partner.findUnique({
        where: { id: partnerId },
        select: {
          marketingTier: true,
          partnershipType: true, // Include partnership type for one-time offer protection
          planId: true, // Include planId to check for FREE Forever users
          subscriptionStatus: true, // Include subscription status
          maxCustomers: true,
          maxVapiAgents: true,
          maxRetellAgents: true,
          maxUltravoxAgents: true,
          maxElevenlabsAgents: true,
          maxGhlAgents: true,
          maxKnovaAgents: true,
          maxNumberPools: true,
          maxByoAgents: true,
          saasMode: true,
        },
      });

      if (!partner) {
        return null;
      }

      // PROTECTION FOR ONE-TIME UNLIMITED OFFER CUSTOMERS
      // Early supporters with "Founding" partnership type should have unlimited access
      if (partner.partnershipType === 'Founding') {
        const unlimitedLimits: TierLimits = {
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
        };

        // Cache the unlimited limits for founding partners
        tierConfigurationCache.setPartnerTierLimits(partnerId, unlimitedLimits);
        return unlimitedLimits;
      }

      // Determine tier - check planId first to override incorrect marketingTier
      const freeForeverPriceId = process.env.STRIPE_FREE_FOREVER_PRICE_ID;
      const starterMonthlyPriceId = process.env.STRIPE_STARTER_MONTHLY_PRICE_ID;
      const starterYearlyPriceId = process.env.STRIPE_STARTER_YEARLY_PRICE_ID;
      const starterTrialPriceId = process.env.STRIPE_STARTER_TRIAL_PRICE_ID;
      const starterSpecialMonthlyPriceId = process.env.STRIPE_STARTER_SPECIAL_MONTHLY_PRICE_ID;
      const starterSpecialYearlyPriceId = process.env.STRIPE_STARTER_SPECIAL_YEARLY_PRICE_ID;
      const proMonthlyPriceId = process.env.STRIPE_PRO_MONTHLY_PRICE_ID;
      const proYearlyPriceId = process.env.STRIPE_PRO_YEARLY_PRICE_ID;
      const enterpriseMonthlyPriceId = process.env.STRIPE_ENTERPRISE_MONTHLY_PRICE_ID;
      const enterpriseYearlyPriceId = process.env.STRIPE_ENTERPRISE_YEARLY_PRICE_ID;
      let tier = partner.marketingTier as MarketingTier;

      // First, check if planId indicates FREE Forever user (overrides marketingTier)
      if (partner.planId === 'free_forever' ||
          partner.planId === 'free_forever_trial' ||
          (freeForeverPriceId && partner.planId === freeForeverPriceId)) {
        tier = 'free_forever';
      } else if (partner.planId === 'enterprise' ||
                 (enterpriseMonthlyPriceId && partner.planId === enterpriseMonthlyPriceId) ||
                 (enterpriseYearlyPriceId && partner.planId === enterpriseYearlyPriceId)) {
        // Enterprise gets unlimited tier behavior
        tier = 'unlimited';
      } else if (partner.planId === 'pro' ||
                 (proMonthlyPriceId && partner.planId === proMonthlyPriceId) ||
                 (proYearlyPriceId && partner.planId === proYearlyPriceId)) {
        tier = 'pro';
      } else if (partner.planId === 'starter' ||
                 (starterMonthlyPriceId && partner.planId === starterMonthlyPriceId) ||
                 (starterYearlyPriceId && partner.planId === starterYearlyPriceId) ||
                 (starterTrialPriceId && partner.planId === starterTrialPriceId)) {
        tier = 'starter';
      } else if (partner.planId === 'starter_special' ||
                 (starterSpecialMonthlyPriceId && partner.planId === starterSpecialMonthlyPriceId) ||
                 (starterSpecialYearlyPriceId && partner.planId === starterSpecialYearlyPriceId)) {
        tier = 'starter_special';
      } else if (!tier) {
        // For partners without a marketingTier and not FREE Forever, determine based on status
        if (partner.subscriptionStatus === 'INACTIVE' && !partner.planId) {
          // Likely a FREE Forever user who hasn't completed setup
          tier = 'free_forever';
        } else {
          // Default to marketing_offer for other cases (better than unlimited)
          tier = 'marketing_offer';
        }
      }
      const defaultLimits = TIER_CONFIGURATIONS[tier];

      // Build effective limits
      const effectiveLimits: TierLimits = {
        maxCustomers: partner.maxCustomers ?? defaultLimits.maxCustomers,
        maxVapiAgents: partner.maxVapiAgents ?? defaultLimits.maxVapiAgents,
        maxRetellAgents: partner.maxRetellAgents ?? defaultLimits.maxRetellAgents,
        maxUltravoxAgents: partner.maxUltravoxAgents ?? defaultLimits.maxUltravoxAgents,
        maxElevenlabsAgents: partner.maxElevenlabsAgents ?? defaultLimits.maxElevenlabsAgents,
        maxGhlAgents: partner.maxGhlAgents ?? defaultLimits.maxGhlAgents,
        maxKnovaAgents: partner.maxKnovaAgents ?? defaultLimits.maxKnovaAgents,
        maxNumberPools: partner.maxNumberPools ?? defaultLimits.maxNumberPools,
        maxByoAgents: partner.maxByoAgents ?? defaultLimits.maxByoAgents,
        saasMode: partner.saasMode,
      };

      // Cache the result
      tierConfigurationCache.setPartnerTierLimits(partnerId, effectiveLimits);

      return effectiveLimits;
    } catch (error) {
      logger.error('Error getting partner tier limits', error as Error, {
        operation: 'tier_validation',
        partnerId
      });
      return null;
    }
  }

  /**
   * Validate if partner can create a new customer
   */
  static async validateCustomerCreation(partnerId: string): Promise<TierValidationResult> {
    try {
      const limits = await this.getPartnerTierLimits(partnerId);
      if (!limits) {
        return { allowed: false, currentCount: 0, limit: null, remaining: null, message: 'Partner not found' };
      }

      // If unlimited customers allowed
      if (limits.maxCustomers === null) {
        return { allowed: true, currentCount: 0, limit: null, remaining: null };
      }

      // Count current customers
      const currentCount = await prisma.customer.count({
        where: {
          userOnboarding: {
            some: {
              partnerId: partnerId,
            },
          },
        },
      });

      const remaining = limits.maxCustomers - currentCount;
      const allowed = remaining > 0;

      return {
        allowed,
        currentCount,
        limit: limits.maxCustomers,
        remaining: Math.max(0, remaining),
        message: allowed ? undefined : `Customer limit reached (${currentCount}/${limits.maxCustomers})`,
      };
    } catch (error) {
      logger.error('Error validating customer creation', error as Error, {
        operation: 'tier_validation',
        partnerId
      });
      return { allowed: false, currentCount: 0, limit: null, remaining: null, message: 'Validation error' };
    }
  }

  /**
   * Validate if partner can create a new agent of specific type
   */
  static async validateAgentCreation(
    partnerId: string,
    provider: AgentProvider
  ): Promise<TierValidationResult> {
    try {
      const limits = await this.getPartnerTierLimits(partnerId);
      if (!limits) {
        return { allowed: false, currentCount: 0, limit: null, remaining: null, message: 'Partner not found' };
      }

      const limitField = `max${provider.charAt(0).toUpperCase() + provider.slice(1)}Agents` as keyof TierLimits;
      const limit = limits[limitField] as number | null;

      // If unlimited agents allowed
      if (limit === null) {
        return { allowed: true, currentCount: 0, limit: null, remaining: null };
      }

      // Count current agents of this type
      let currentCount = 0;
      switch (provider) {
        case 'vapi':
          currentCount = await prisma.vapiAgent.count({ where: { partnerId } });
          break;
        case 'retell':
          currentCount = await prisma.retellAgent.count({ where: { partnerId } });
          break;
        case 'ultravox':
          currentCount = await prisma.ultravoxAgent.count({ where: { partnerId } });
          break;
        case 'elevenlabs':
          currentCount = await prisma.elevenLabsAgent.count({ where: { partnerId } });
          break;
        case 'ghl':
          currentCount = await prisma.ghlAgent.count({ where: { partnerId } });
          break;
        case 'knova':
          currentCount = await prisma.knovaAgent.count({ where: { partnerId } });
          break;
        case 'byo':
          currentCount = await prisma.byoAgent.count({ where: { partnerId } });
          break;
      }

      const remaining = limit - currentCount;
      const allowed = remaining > 0;

      return {
        allowed,
        currentCount,
        limit,
        remaining: Math.max(0, remaining),
        message: allowed ? undefined : `${provider.toUpperCase()} agent limit reached (${currentCount}/${limit})`,
      };
    } catch (error) {
      logger.error('Error validating agent creation', error as Error, {
        operation: 'tier_validation',
        partnerId,
        provider
      });
      return { allowed: false, currentCount: 0, limit: null, remaining: null, message: 'Validation error' };
    }
  }

  /**
   * Validate if partner can import/purchase a phone number (free tier check)
   * For free_forever tier: 1 free import allowed, additional imports cost $10 each
   */
  static async validatePhoneNumberImport(partnerId: string): Promise<TierValidationResult> {
    try {
      const limits = await this.getPartnerTierLimits(partnerId);
      if (!limits) {
        return { allowed: false, currentCount: 0, limit: null, remaining: null, message: 'Partner not found' };
      }

      // Get partner to check tier
      const partner = await prisma.partner.findUnique({
        where: { id: partnerId },
        select: {
          marketingTier: true,
          planId: true,
          subscriptionStatus: true,
          partnershipType: true,
        },
      });

      if (!partner) {
        return { allowed: false, currentCount: 0, limit: null, remaining: null, message: 'Partner not found' };
      }

      // Founding partners have unlimited access
      if (partner.partnershipType === 'Founding') {
        return { allowed: true, currentCount: 0, limit: null, remaining: null };
      }

      // Determine if user is on free_forever tier
      const freeForeverPriceId = process.env.STRIPE_FREE_FOREVER_PRICE_ID;
      const isFreeForever =
        partner.marketingTier === 'free_forever' ||
        partner.planId === 'free_forever' ||
        partner.planId === 'free_forever_trial' ||
        (freeForeverPriceId && partner.planId === freeForeverPriceId) ||
        (partner.subscriptionStatus === 'INACTIVE' && !partner.planId);

      // Paid tiers have unlimited phone number imports
      if (!isFreeForever) {
        return { allowed: true, currentCount: 0, limit: null, remaining: null };
      }

      // For free_forever tier: 1 free import allowed
      const FREE_PHONE_NUMBER_LIMIT = 1;

      // Count imported phone numbers (partner-level)
      const importedCount = await prisma.phoneNumber.count({
        where: {
          partnerId: partnerId,
          isImported: true,
          customerId: null, // Partner-level imports
        },
      });

      const remaining = FREE_PHONE_NUMBER_LIMIT - importedCount;
      const allowed = remaining > 0;

      return {
        allowed,
        currentCount: importedCount,
        limit: FREE_PHONE_NUMBER_LIMIT,
        remaining: Math.max(0, remaining),
        message: allowed
          ? undefined
          : `Free phone number limit reached (${importedCount}/${FREE_PHONE_NUMBER_LIMIT}). Additional imports cost $10 each.`,
      };
    } catch (error) {
      logger.error('Error validating phone number import', error as Error, {
        operation: 'tier_validation',
        partnerId
      });
      return { allowed: false, currentCount: 0, limit: null, remaining: null, message: 'Validation error' };
    }
  }

  /**
   * Validate if partner can create a new number pool
   */
  static async validateNumberPoolCreation(partnerId: string): Promise<TierValidationResult> {
    try {
      const limits = await this.getPartnerTierLimits(partnerId);
      if (!limits) {
        return { allowed: false, currentCount: 0, limit: null, remaining: null, message: 'Partner not found' };
      }

      if (limits.maxNumberPools === null) {
        return { allowed: true, currentCount: 0, limit: null, remaining: null };
      }

      const currentCount = await (prisma as any).numberPool.count({
        where: { partnerId },
      });

      const remaining = limits.maxNumberPools - currentCount;
      const allowed = remaining > 0;

      return {
        allowed,
        currentCount,
        limit: limits.maxNumberPools,
        remaining: Math.max(0, remaining),
        message: allowed ? undefined : `Number pool limit reached (${currentCount}/${limits.maxNumberPools})`,
      };
    } catch (error) {
      logger.error('Error validating number pool creation', error as Error, {
        operation: 'tier_validation',
        partnerId,
      });
      return { allowed: false, currentCount: 0, limit: null, remaining: null, message: 'Validation error' };
    }
  }

  /**
   * Validate if partner can access SaaS mode features
   */
  static async validateSaaSModeAccess(partnerId: string): Promise<TierValidationResult> {
    try {
      const limits = await this.getPartnerTierLimits(partnerId);
      if (!limits) {
        return { allowed: false, currentCount: 0, limit: null, remaining: null, message: 'Partner not found' };
      }

      return {
        allowed: limits.saasMode,
        currentCount: 0,
        limit: null,
        remaining: null,
        message: limits.saasMode ? undefined : 'SaaS mode not available in your current plan',
      };
    } catch (error) {
      logger.error('Error validating SaaS mode access', error as Error, {
        operation: 'tier_validation',
        partnerId
      });
      return { allowed: false, currentCount: 0, limit: null, remaining: null, message: 'Validation error' };
    }
  }

  /**
   * Generate upgrade prompt based on current tier and requested feature
   */
  static async generateUpgradePrompt(
    partnerId: string,
    feature: 'customers' | 'agents' | 'saas_mode' | 'number_pools',
    provider?: AgentProvider
  ): Promise<UpgradePrompt> {
    try {
      const partner = await prisma.partner.findUnique({
        where: { id: partnerId },
        select: {
          marketingTier: true,
          planId: true, // Include planId to check for FREE Forever users
          subscriptionStatus: true, // Include subscription status
        },
      });

      // Determine current tier - check planId first to override incorrect marketingTier
      let currentTier = partner?.marketingTier as MarketingTier;
      if (partner) {
        const freeForeverPriceId = process.env.STRIPE_FREE_FOREVER_PRICE_ID;

        // First, check if planId indicates FREE Forever user (overrides marketingTier)
        if (partner.planId === 'free_forever' ||
            partner.planId === 'free_forever_trial' ||
            (freeForeverPriceId && partner.planId === freeForeverPriceId)) {
          currentTier = 'free_forever';
        } else if (!currentTier) {
          // For partners without a marketingTier and not FREE Forever, determine based on status
          if (partner.subscriptionStatus === 'INACTIVE' && !partner.planId) {
            // Likely a FREE Forever user who hasn't completed setup
            currentTier = 'free_forever';
          } else {
            // Default to marketing_offer for other cases (better than unlimited)
            currentTier = 'marketing_offer';
          }
        }
      } else if (!currentTier) {
        // Fallback if partner is null
        currentTier = 'marketing_offer';
      }
      
      // Determine suggested tier based on current tier
      let suggestedTier: MarketingTier = 'starter';
      if (currentTier === 'marketing_offer') {
        suggestedTier = 'starter';
      } else if (currentTier === 'starter') {
        suggestedTier = 'pro';
      } else if (currentTier === 'pro') {
        suggestedTier = 'ultimate';
      }

      let title = 'Upgrade Your Plan';
      let message = 'Unlock more features with a higher tier plan.';

      switch (feature) {
        case 'customers':
          title = 'Customer Limit Reached';
          message = `You've reached your customer limit. Upgrade to ${suggestedTier} plan to add more customers.`;
          break;
        case 'agents':
          title = `${provider?.toUpperCase()} Agent Limit Reached`;
          message = `You've reached your ${provider} agent limit. Upgrade to ${suggestedTier} plan to create more agents.`;
          break;
        case 'saas_mode':
          title = 'SaaS Mode Not Available';
          message = `SaaS mode and subscription plans are not available in your current plan. Upgrade to ${suggestedTier} to enable these features.`;
          break;
        case 'number_pools':
          title = 'Number Pool Limit Reached';
          message = `Upgrade to ${suggestedTier} to create and manage more number pools.`;
          break;
      }

      return {
        show: currentTier !== 'unlimited',
        title,
        message,
        currentTier,
        suggestedTier,
        feature: provider ? `${feature}_${provider}` : feature,
      };
    } catch (error) {
      logger.error('Error generating upgrade prompt', error as Error, {
        operation: 'tier_validation',
        partnerId,
        feature
      });
      return {
        show: false,
        title: 'Upgrade Required',
        message: 'Please upgrade your plan to access this feature.',
        currentTier: 'marketing_offer',
        suggestedTier: 'starter',
        feature,
      };
    }
  }

  /**
   * Set partner tier and limits (used by marketing webhook)
   */
  static async setPartnerTier(
    partnerId: string,
    tier: MarketingTier,
    customLimits?: Partial<TierLimits>
  ): Promise<boolean> {
    try {
      const defaultLimits = TIER_CONFIGURATIONS[tier];
      
      await (prisma as any).partner.update({
        where: { id: partnerId },
        data: {
          marketingTier: tier,
          maxCustomers: customLimits?.maxCustomers ?? defaultLimits.maxCustomers,
          maxVapiAgents: customLimits?.maxVapiAgents ?? defaultLimits.maxVapiAgents,
          maxRetellAgents: customLimits?.maxRetellAgents ?? defaultLimits.maxRetellAgents,
          maxUltravoxAgents: customLimits?.maxUltravoxAgents ?? defaultLimits.maxUltravoxAgents,
          maxElevenlabsAgents: customLimits?.maxElevenlabsAgents ?? defaultLimits.maxElevenlabsAgents,
          maxGhlAgents: customLimits?.maxGhlAgents ?? defaultLimits.maxGhlAgents,
          maxKnovaAgents: customLimits?.maxKnovaAgents ?? defaultLimits.maxKnovaAgents,
          maxNumberPools: customLimits?.maxNumberPools ?? defaultLimits.maxNumberPools,
          maxByoAgents: customLimits?.maxByoAgents ?? defaultLimits.maxByoAgents,
          saasMode: customLimits?.saasMode ?? defaultLimits.saasMode,
        },
      });

      return true;
    } catch (error) {
      logger.error('Error setting partner tier', error as Error, {
        operation: 'tier_validation',
        partnerId,
        tier
      });
      return false;
    }
  }
}
