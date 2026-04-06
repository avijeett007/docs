export enum PortalMode {
  BASIC = 'BASIC',
  PROFESSIONAL = 'PROFESSIONAL',
  SAAS = 'SAAS',
}

export interface PortalModeConfig {
  id: PortalMode;
  name: string;
  description: string;
  previewImage: string;
  isUpcoming: boolean;
  isPremium: boolean;
  requiredTier: string[];
}

export const portalModes: Record<PortalMode, PortalModeConfig> = {
  [PortalMode.BASIC]: {
    id: PortalMode.BASIC,
    name: 'Basic Portal',
    description: 'Clean and professional portal with customizable themes',
    previewImage: '/portals/basic.png',
    isUpcoming: false,
    isPremium: false,
    requiredTier: ['free_forever', 'starter', 'pro', 'enterprise', 'lifetime'],
  },
  [PortalMode.PROFESSIONAL]: {
    id: PortalMode.PROFESSIONAL,
    name: 'Professional Portal',
    description: 'Advanced professional layout with enhanced features',
    previewImage: '/portals/professional.png',
    isUpcoming: true,
    isPremium: true,
    requiredTier: ['starter', 'pro', 'enterprise', 'lifetime'],
  },
  [PortalMode.SAAS]: {
    id: PortalMode.SAAS,
    name: 'SaaS Portal',
    description: 'Enterprise funnel experience with advanced conversion features',
    previewImage: '/portals/SaaS.png',
    isUpcoming: false,
    isPremium: true,
    requiredTier: ['enterprise'],
  },
};

export enum PartnerTier {
  FREE_FOREVER = 'free_forever',
  STARTER = 'starter',
  PRO = 'pro',
  ENTERPRISE = 'enterprise',
  LIFETIME = 'lifetime',
}

export interface TierAccess {
  portalModes: PortalMode[];
  themeRestrictions?: {
    [key in PortalMode]?: string[]; // Specific themes allowed for each mode
  };
}

export const tierAccess: Record<PartnerTier, TierAccess> = {
  [PartnerTier.FREE_FOREVER]: {
    portalModes: [PortalMode.BASIC],
    themeRestrictions: {
      [PortalMode.BASIC]: ['MODERN'], // Only Azure theme
    },
  },
  [PartnerTier.STARTER]: {
    portalModes: [PortalMode.BASIC, PortalMode.PROFESSIONAL],
  },
  [PartnerTier.PRO]: {
    portalModes: [PortalMode.BASIC, PortalMode.PROFESSIONAL],
  },
  [PartnerTier.LIFETIME]: {
    portalModes: [PortalMode.BASIC, PortalMode.PROFESSIONAL],
  },
  [PartnerTier.ENTERPRISE]: {
    portalModes: [PortalMode.BASIC, PortalMode.PROFESSIONAL, PortalMode.SAAS],
  },
};

/**
 * Determines partner tier based on planId and approval status
 *
 * Supports both hardcoded text values and Stripe price IDs from environment variables.
 * This function must run server-side to access the STRIPE_* env vars.
 */
export function getPartnerTier(planId: string | null, approvalStatus: string | null): PartnerTier {
  // Check if approval status is active (required for all tiers)
  if (approvalStatus !== 'active' && approvalStatus !== 'ACTIVE') {
    return PartnerTier.FREE_FOREVER; // Default to free tier if not active
  }

  // Get all Stripe price IDs from environment (server-only)
  // FREE FOREVER / TRIAL
  const freeForeverPriceId = process.env.STRIPE_FREE_FOREVER_PRICE_ID;
  const freeTrialPriceId = process.env.STRIPE_FREE_TRIAL_PRICE_ID;

  // STARTER tier price IDs
  const starterMonthlyPriceId = process.env.STRIPE_STARTER_MONTHLY_PRICE_ID;
  const starterYearlyPriceId = process.env.STRIPE_STARTER_YEARLY_PRICE_ID;
  const starterTrialPriceId = process.env.STRIPE_STARTER_TRIAL_PRICE_ID;
  const starterSpecialMonthlyPriceId = process.env.STRIPE_STARTER_SPECIAL_MONTHLY_PRICE_ID;
  const starterSpecialYearlyPriceId = process.env.STRIPE_STARTER_SPECIAL_YEARLY_PRICE_ID;

  // PRO tier price IDs
  const proMonthlyPriceId = process.env.STRIPE_PRO_MONTHLY_PRICE_ID;
  const proYearlyPriceId = process.env.STRIPE_PRO_YEARLY_PRICE_ID;

  // ENTERPRISE tier price IDs
  const enterpriseMonthlyPriceId = process.env.STRIPE_ENTERPRISE_MONTHLY_PRICE_ID;
  const enterpriseYearlyPriceId = process.env.STRIPE_ENTERPRISE_YEARLY_PRICE_ID;

  // LIFETIME tier price ID
  const lifetimeProPriceId = process.env.STRIPE_LIFETIME_PRO_PRICE_ID;

  // Check for FREE FOREVER tier (including trial)
  if (planId === 'free_forever_trial' ||
      planId === 'free_forever' ||
      planId === 'free_trial' ||
      (freeForeverPriceId && planId === freeForeverPriceId) ||
      (freeTrialPriceId && planId === freeTrialPriceId)) {
    return PartnerTier.FREE_FOREVER;
  }

  // Check for ENTERPRISE tier (including Stripe price IDs)
  if (planId === 'enterprise' ||
      (enterpriseMonthlyPriceId && planId === enterpriseMonthlyPriceId) ||
      (enterpriseYearlyPriceId && planId === enterpriseYearlyPriceId)) {
    return PartnerTier.ENTERPRISE;
  }

  // Check for PRO tier (including Stripe price IDs)
  if (planId === 'pro' ||
      (proMonthlyPriceId && planId === proMonthlyPriceId) ||
      (proYearlyPriceId && planId === proYearlyPriceId)) {
    return PartnerTier.PRO;
  }

  // Check for STARTER tier (including Stripe price IDs and special offers)
  if (planId === 'starter' ||
      (starterMonthlyPriceId && planId === starterMonthlyPriceId) ||
      (starterYearlyPriceId && planId === starterYearlyPriceId) ||
      (starterTrialPriceId && planId === starterTrialPriceId) ||
      (starterSpecialMonthlyPriceId && planId === starterSpecialMonthlyPriceId) ||
      (starterSpecialYearlyPriceId && planId === starterSpecialYearlyPriceId)) {
    return PartnerTier.STARTER;
  }

  // Check for LIFETIME tier (including Stripe price ID)
  if (planId === 'lifetime' ||
      planId === 'lifetime_pro' ||
      (lifetimeProPriceId && planId === lifetimeProPriceId)) {
    return PartnerTier.LIFETIME;
  }

  // Default fallback
  return PartnerTier.FREE_FOREVER;
}

/**
 * Get available portal modes for a partner tier
 */
export function getAvailablePortalModes(tier: PartnerTier): PortalMode[] {
  return tierAccess[tier]?.portalModes || [PortalMode.BASIC];
}

/**
 * Check if a partner can access a specific portal mode
 */
export function canAccessPortalMode(tier: PartnerTier, mode: PortalMode): boolean {
  return getAvailablePortalModes(tier).includes(mode);
}

/**
 * Check if a partner can access a specific portal mode with manual SaaS mode consideration
 */
export function canAccessPortalModeWithManualSaaS(
  tier: PartnerTier,
  mode: PortalMode,
  manualSaasModeEnabled: boolean = false
): boolean {
  // For SAAS mode, check both tier access and manual enablement
  if (mode === PortalMode.SAAS) {
    return getAvailablePortalModes(tier).includes(mode) || manualSaasModeEnabled;
  }

  // For other modes, use standard tier-based access
  return getAvailablePortalModes(tier).includes(mode);
}

/**
 * Get theme restrictions for a specific tier and portal mode
 */
export function getThemeRestrictions(tier: PartnerTier, mode: PortalMode): string[] | null {
  return tierAccess[tier]?.themeRestrictions?.[mode] || null;
}

/**
 * Check if a partner can access a specific theme in a portal mode
 */
export function canAccessTheme(tier: PartnerTier, mode: PortalMode, theme: string): boolean {
  const restrictions = getThemeRestrictions(tier, mode);
  if (!restrictions) return true; // No restrictions means all themes allowed
  return restrictions.includes(theme);
}

/**
 * Check if a partner is an enterprise customer based on their planId
 * Enterprise customers have access to BYOA (Bring Your Own Agent) tier
 *
 * ✅ CLIENT-SAFE: Uses NEXT_PUBLIC_ environment variables
 */
export function isEnterprisePartner(planId: string | null | undefined): boolean {
  if (!planId) return false;

  // Check for explicit enterprise planId
  if (planId === 'enterprise') return true;

  // Check for Stripe enterprise price IDs using NEXT_PUBLIC_ env vars for client safety
  const enterpriseMonthlyPriceId = process.env.NEXT_PUBLIC_STRIPE_ENTERPRISE_MONTHLY_PRICE_ID;
  const enterpriseYearlyPriceId = process.env.NEXT_PUBLIC_STRIPE_ENTERPRISE_YEARLY_PRICE_ID;

  if (enterpriseMonthlyPriceId && planId === enterpriseMonthlyPriceId) return true;
  if (enterpriseYearlyPriceId && planId === enterpriseYearlyPriceId) return true;

  return false;
}

/**
 * Check if a partner tier is enterprise
 */
export function isEnterpriseTier(tier: PartnerTier): boolean {
  return tier === PartnerTier.ENTERPRISE;
}
