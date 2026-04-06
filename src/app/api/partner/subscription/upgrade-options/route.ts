import { NextRequest, NextResponse } from 'next/server';
import { verifyPartnerToken } from '@/lib/auth';
import pricingConfig from '@/config/dashboard/pricing.json';

export const dynamic = 'force-dynamic';

interface UpgradeOption {
  planId: string;
  name: string;
  description: string;
  priceMonthly: number;
  priceYearly: number;
  features: string[];
  popular?: boolean;
  icon: string;
  stripePriceIdMonthly: string;
  stripePriceIdYearly: string;
  savingsYearly?: string;
}

// Map tier names to plan IDs
function getTierPlanId(tierName: string): string {
  const mapping: Record<string, string> = {
    'Free Forever': 'free_forever',
    'Solo Agency Owner': 'starter',
    'Ultimate Scaleup Agency': 'enterprise',
  };
  return mapping[tierName] || tierName.toLowerCase().replace(/\s+/g, '_');
}

// Map Stripe price IDs to tier names
function getTierFromStripePriceId(priceId: string | null | undefined): string | null {
  if (!priceId) return null;

  // Check against known price IDs from environment
  const priceToTierMap: Record<string, string> = {};

  // Free Forever
  if (process.env.STRIPE_FREE_FOREVER_PRICE_ID) {
    priceToTierMap[process.env.STRIPE_FREE_FOREVER_PRICE_ID] = 'free_forever';
  }

  // Starter
  if (process.env.STRIPE_STARTER_MONTHLY_PRICE_ID) {
    priceToTierMap[process.env.STRIPE_STARTER_MONTHLY_PRICE_ID] = 'starter';
  }
  if (process.env.STRIPE_STARTER_YEARLY_PRICE_ID) {
    priceToTierMap[process.env.STRIPE_STARTER_YEARLY_PRICE_ID] = 'starter';
  }
  if (process.env.STRIPE_STARTER_TRIAL_PRICE_ID) {
    priceToTierMap[process.env.STRIPE_STARTER_TRIAL_PRICE_ID] = 'starter';
  }
  if (process.env.STRIPE_STARTER_SPECIAL_MONTHLY_PRICE_ID) {
    priceToTierMap[process.env.STRIPE_STARTER_SPECIAL_MONTHLY_PRICE_ID] = 'starter';
  }
  if (process.env.STRIPE_STARTER_SPECIAL_YEARLY_PRICE_ID) {
    priceToTierMap[process.env.STRIPE_STARTER_SPECIAL_YEARLY_PRICE_ID] = 'starter';
  }

  // Enterprise
  if (process.env.STRIPE_ENTERPRISE_MONTHLY_PRICE_ID) {
    priceToTierMap[process.env.STRIPE_ENTERPRISE_MONTHLY_PRICE_ID] = 'enterprise';
  }
  if (process.env.STRIPE_ENTERPRISE_YEARLY_PRICE_ID) {
    priceToTierMap[process.env.STRIPE_ENTERPRISE_YEARLY_PRICE_ID] = 'enterprise';
  }

  // Lifetime Pro
  if (process.env.STRIPE_LIFETIME_PRO_PRICE_ID) {
    priceToTierMap[process.env.STRIPE_LIFETIME_PRO_PRICE_ID] = 'lifetime_pro';
  }

  return priceToTierMap[priceId] || null;
}

// Normalize tier name to base tier (handle trial suffix, Stripe price IDs, etc.)
// IMPORTANT: planId is the authoritative field for subscription tier
// marketingTier is for marketing campaign limits, not subscription tier
function normalizeCurrentTier(tier: string | null | undefined, planId: string | null | undefined): string {
  // PRIORITY 1: Check planId first - it's the authoritative subscription tier field

  // If planId is a Stripe price ID, map it to a tier
  if (planId && planId.startsWith('price_')) {
    const tierFromPrice = getTierFromStripePriceId(planId);
    if (tierFromPrice) return tierFromPrice;
  }

  // If planId is a tier string, normalize it
  if (planId) {
    const lowerPlanId = planId.toLowerCase();
    if (lowerPlanId.includes('free_forever') || lowerPlanId === 'free_forever_trial' || lowerPlanId === 'free') {
      return 'free_forever';
    }
    if (lowerPlanId.includes('starter') || lowerPlanId === 'starter_tier_trial' || lowerPlanId === 'starter_special') {
      return 'starter';
    }
    if (lowerPlanId.includes('pro') && !lowerPlanId.includes('lifetime')) {
      return 'pro';
    }
    if (lowerPlanId.includes('enterprise') || lowerPlanId.includes('ultimate')) {
      return 'enterprise';
    }
    if (lowerPlanId.includes('lifetime')) {
      return 'lifetime_pro';
    }
  }

  // PRIORITY 2: Fall back to marketingTier only if planId is not set
  // (marketingTier is for marketing limits, not subscription tier, but can be used as fallback)
  if (tier) {
    const lowerTier = tier.toLowerCase();

    if (lowerTier.includes('free_forever') || lowerTier === 'free_forever_trial' || lowerTier === 'free') {
      return 'free_forever';
    }
    if (lowerTier.includes('starter') || lowerTier === 'starter_tier_trial' || lowerTier === 'starter_special') {
      return 'starter';
    }
    if (lowerTier.includes('pro') && !lowerTier.includes('lifetime')) {
      return 'pro';
    }
    if (lowerTier.includes('enterprise') || lowerTier.includes('ultimate')) {
      return 'enterprise';
    }
    if (lowerTier.includes('lifetime')) {
      return 'lifetime_pro';
    }
    if (lowerTier === 'unlimited') {
      return 'enterprise'; // Treat unlimited as enterprise for upgrade purposes
    }
  }

  // Default to free_forever if no tier information available
  return 'free_forever';
}

// Get upgrade-eligible tiers for a given current tier
function getUpgradeEligibleTiers(normalizedTier: string): string[] {
  const upgradeMatrix: Record<string, string[]> = {
    'free_forever': ['starter', 'enterprise'],
    'starter': ['enterprise'],
    'pro': ['enterprise'],
    'enterprise': [],
    'lifetime_pro': [],
  };
  return upgradeMatrix[normalizedTier] || ['starter', 'enterprise']; // Default to allow upgrades for unknown tiers
}

export async function GET(request: NextRequest) {
  try {
    const authResult = await verifyPartnerToken(request);
    if (authResult.error) {
      return authResult.error;
    }
    const partner = authResult.partner;

    // Determine current tier: use marketingTier first, then try to derive from planId (which may be a Stripe price ID)
    const currentTier = normalizeCurrentTier(partner.marketingTier, partner.planId);
    const eligibleTiers = getUpgradeEligibleTiers(currentTier);

    console.log('[Upgrade Options] Partner tier:', {
      marketingTier: partner.marketingTier,
      planId: partner.planId,
      normalizedTier: currentTier,
      eligibleTiers,
      partnerId: partner.id
    });

    // Build upgrade options from pricing.json
    const upgradeOptions: UpgradeOption[] = pricingConfig.tiers
      .filter(tier => tier.name !== 'Free Forever') // Exclude free tier from upgrades
      .map(tier => {
        const planId = getTierPlanId(tier.name);

        // Calculate yearly savings
        const monthlyTotal = tier.price.amount * 12;
        const yearlyPrice = tier.price.yearly || monthlyTotal;
        const savings = monthlyTotal - yearlyPrice;

        // Get Stripe price IDs from environment
        const envPlanId = planId.toUpperCase();
        const stripePriceIdMonthly = planId === 'starter'
          ? process.env.STRIPE_STARTER_MONTHLY_PRICE_ID || ''
          : process.env[`STRIPE_${envPlanId}_MONTHLY_PRICE_ID`] || '';
        const stripePriceIdYearly = planId === 'starter'
          ? process.env.STRIPE_STARTER_YEARLY_PRICE_ID || ''
          : process.env[`STRIPE_${envPlanId}_YEARLY_PRICE_ID`] || '';

        return {
          planId,
          name: tier.name,
          description: tier.description,
          priceMonthly: tier.price.amount * 100, // Convert to cents
          priceYearly: (tier.price.yearly || tier.price.amount * 12) * 100, // Convert to cents
          features: tier.features.slice(0, 8), // Limit features for display
          popular: tier.isPopular,
          icon: planId === 'starter' ? 'Zap' : planId === 'enterprise' ? 'Crown' : 'Building2',
          stripePriceIdMonthly,
          stripePriceIdYearly,
          savingsYearly: savings > 0 ? `Save $${savings.toLocaleString()}/year` : undefined,
        };
      })
      .filter(option => eligibleTiers.includes(option.planId));

    // Log before Stripe filter
    console.log('[Upgrade Options] Before Stripe filter:', upgradeOptions.map(o => ({ planId: o.planId, hasMonthly: !!o.stripePriceIdMonthly, hasYearly: !!o.stripePriceIdYearly })));

    // Filter options that have at least one valid Stripe price ID
    const validOptions = upgradeOptions.filter(option => option.stripePriceIdMonthly || option.stripePriceIdYearly);

    return NextResponse.json({
      success: true,
      upgradeOptions: validOptions,
      currentPlan: {
        tier: currentTier,
        marketingTier: partner.marketingTier,
        stripePlanId: partner.planId,
        type: partner.subscriptionStatus === 'ACTIVE' ? (partner.billingInterval || 'monthly') : 'none',
        planId: partner.planId || null
      },
      debug: {
        eligibleTiers,
        optionsBeforeStripeFilter: upgradeOptions.length,
        optionsAfterStripeFilter: validOptions.length,
      }
    });

  } catch (error) {
    console.error('Error fetching upgrade options:', error);
    return NextResponse.json(
      { error: 'Failed to fetch upgrade options' },
      { status: 500 }
    );
  }
}
