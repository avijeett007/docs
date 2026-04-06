/**
 * Experience Access Control
 *
 * Tier-based access control for the One-Click Experiences system.
 * Determines what partners can do based on their subscription tier.
 *
 * Access Rules:
 * - ENTERPRISE: Full access — create, enable, configure, and manage all experiences
 * - LIFETIME: Can use/view experiences but cannot create new ones
 * - PRO/STARTER: See upgrade message, cannot create or use experiences
 * - FREE_FOREVER: Blocked unless they have a manual entitlement for a specific experience
 * - manualSaasModeEnabled: Grants same access as ENTERPRISE for experience creation
 * - experienceEntitlements: Per-experience JSONB overrides (e.g. { "OPENCLAW_SETUP_SERVICE": true })
 *   that allow granular "invite-only" access for non-enterprise partners
 */

import { PartnerTier } from '@/lib/portalModes';
import { ExperienceType, ExperienceStatus } from '@/types/experience';
import { EXPERIENCE_CONFIGS } from './experienceTypes';

/**
 * Check whether a partner has been manually granted access to a specific experience
 * via the `experienceEntitlements` JSONB field.
 *
 * @param entitlements - The raw JSON value from partner.experienceEntitlements
 * @param experienceType - The experience type to check
 */
export function hasExperienceEntitlement(
  entitlements: unknown,
  experienceType: ExperienceType
): boolean {
  if (!entitlements || typeof entitlements !== 'object' || Array.isArray(entitlements)) {
    return false;
  }
  const map = entitlements as Record<string, unknown>;
  return map[experienceType] === true;
}

export interface ExperienceAccessResult {
  allowed: boolean;
  reason?: string;
  upgradeRequired?: boolean;
  requiredTier?: PartnerTier;
}

/**
 * Check if a partner can create new experiences (catalog-level access).
 * ENTERPRISE tier or manualSaasModeEnabled = full access to all experiences.
 * FREE_FOREVER partners always return false here — even with manual entitlements.
 * Their per-experience access is gated individually via canEnableExperience + entitlements,
 * and the UI uses (isFreeForever && hasEntitlement[type]) directly.
 */
export function canCreateExperiences(
  tier: PartnerTier,
  manualSaasModeEnabled: boolean = false,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _entitlements: unknown = {}
): ExperienceAccessResult {
  if (tier === PartnerTier.ENTERPRISE || manualSaasModeEnabled) {
    return { allowed: true };
  }

  // FREE_FOREVER: always false at the catalog level so canCreate never unlocks
  // all experiences at once. Individual access is checked via canEnableExperience.
  if (tier === PartnerTier.FREE_FOREVER) {
    return {
      allowed: false,
      reason: 'One-Click Experiences are available on the Enterprise plan. Schedule a meeting with our team to learn more.',
      upgradeRequired: true,
      requiredTier: PartnerTier.ENTERPRISE,
    };
  }

  if (tier === PartnerTier.LIFETIME) {
    return {
      allowed: false,
      reason: 'Lifetime plan includes access to existing experiences but cannot create new ones. Upgrade to Enterprise for full access.',
      upgradeRequired: true,
      requiredTier: PartnerTier.ENTERPRISE,
    };
  }

  return {
    allowed: false,
    reason: 'Upgrade to Enterprise plan to unlock One-Click Experiences and create productized AI offerings for your customers.',
    upgradeRequired: true,
    requiredTier: PartnerTier.ENTERPRISE,
  };
}

/**
 * Check if a partner can view/use the experiences catalog.
 * All tiers can see the catalog — access is gated at enable time.
 */
export function canViewExperiences(
  tier: PartnerTier,
  manualSaasModeEnabled: boolean = false
): ExperienceAccessResult {
  // Everyone can view — the gate is at enable/create time
  if (
    tier === PartnerTier.ENTERPRISE ||
    tier === PartnerTier.LIFETIME ||
    manualSaasModeEnabled
  ) {
    return { allowed: true };
  }

  return {
    allowed: false,
    reason: 'Upgrade to Enterprise plan to access One-Click Experiences — launch productized AI solutions for your customers in minutes.',
    upgradeRequired: true,
    requiredTier: PartnerTier.ENTERPRISE,
  };
}

/**
 * Check if a partner can enable a specific experience type.
 * Accepts the raw experienceEntitlements JSONB so that FREE_FOREVER
 * partners with manual invite access are also permitted.
 */
export function canEnableExperience(
  tier: PartnerTier,
  experienceType: ExperienceType,
  manualSaasModeEnabled: boolean = false,
  entitlements: unknown = {}
): ExperienceAccessResult {
  // ENTERPRISE / manual-saas always allowed
  if (tier === PartnerTier.ENTERPRISE || manualSaasModeEnabled) {
    // fall through to availability check below
  } else if (tier === PartnerTier.FREE_FOREVER) {
    // FREE_FOREVER: only allowed if a specific entitlement exists for this experience
    if (!hasExperienceEntitlement(entitlements, experienceType)) {
      return {
        allowed: false,
        reason: 'One-Click Experiences are available on the Enterprise plan. Schedule a meeting with our team to find out how to get early access.',
        upgradeRequired: true,
        requiredTier: PartnerTier.ENTERPRISE,
      };
    }
  } else {
    // All other non-enterprise tiers: check catalog-level access
    const createAccess = canCreateExperiences(tier, manualSaasModeEnabled, entitlements);
    if (!createAccess.allowed) {
      return createAccess;
    }
  }

  // Check if the experience type is available
  const config = EXPERIENCE_CONFIGS[experienceType];
  if (!config) {
    return {
      allowed: false,
      reason: 'Unknown experience type.',
    };
  }

  if (config.status === ExperienceStatus.COMING_SOON) {
    return {
      allowed: false,
      reason: `${config.name} is coming soon! We'll notify you when it's available.`,
    };
  }

  if (config.status === ExperienceStatus.BETA) {
    return {
      allowed: true,
      reason: `${config.name} is in beta. Some features may be limited.`,
    };
  }

  return { allowed: true };
}

/**
 * Check if a partner can configure an existing experience
 * Same as create access — only ENTERPRISE or manualSaasModeEnabled
 */
export function canConfigureExperience(
  tier: PartnerTier,
  manualSaasModeEnabled: boolean = false,
  entitlements: unknown = {}
): ExperienceAccessResult {
  return canCreateExperiences(tier, manualSaasModeEnabled, entitlements);
}

/**
 * Get the list of experience types a partner can enable
 */
export function getEnableableExperienceTypes(
  tier: PartnerTier,
  manualSaasModeEnabled: boolean = false,
  entitlements: unknown = {}
): ExperienceType[] {
  return Object.values(EXPERIENCE_CONFIGS)
    .filter((config) =>
      config.status === ExperienceStatus.AVAILABLE || config.status === ExperienceStatus.BETA
    )
    .filter((config) =>
      canEnableExperience(tier, config.type, manualSaasModeEnabled, entitlements).allowed
    )
    .map((config) => config.type);
}

/**
 * Get a human-readable upgrade message for the partner's current tier
 */
export function getUpgradeMessage(tier: PartnerTier): string {
  switch (tier) {
    case PartnerTier.FREE_FOREVER:
      return 'Upgrade to Enterprise to unlock One-Click Experiences and start selling AI solutions to your customers.';
    case PartnerTier.STARTER:
      return 'Upgrade to Enterprise to unlock One-Click Experiences — create and manage productized AI offerings.';
    case PartnerTier.PRO:
      return 'Upgrade to Enterprise to unlock One-Click Experiences — the fastest way to launch AI products for your customers.';
    case PartnerTier.LIFETIME:
      return 'Your Lifetime plan includes access to existing experiences. Upgrade to Enterprise for full creation and management capabilities.';
    case PartnerTier.ENTERPRISE:
      return ''; // No upgrade needed
    default:
      return 'Upgrade your plan to access One-Click Experiences.';
  }
}

