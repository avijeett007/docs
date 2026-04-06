/**
 * Portal URL Utilities
 *
 * Centralises the logic for choosing between a partner's custom landing page URL
 * and the default whitelabel portal login URL.
 *
 * IMPORTANT: This helper is ONLY for "root/login" destination URLs.
 * Never use it for token-bearing action URLs (verify-email, reset-password,
 * magic-login, accept-invite) — those must always point to the real portal path.
 */

import { getPartnerTier, PartnerTier } from '@/lib/portalModes';

export interface PortalUrlPartner {
  customLandingPageUrl?: string | null;
  planId?: string | null;
  approvalStatus?: string | null;
  customDomain?: string | null;
  customDomainVerified?: boolean | null;
  subdomain?: string | null;
}

/**
 * Returns the effective "portal login / home" URL for a partner.
 *
 * - If the partner is on Starter, Lifetime, or Enterprise AND has set a `customLandingPageUrl`,
 *   that URL is returned as-is.
 * - Otherwise, the standard portal login URL is computed from the partner's
 *   custom domain or subdomain.
 *
 * Use this only when the email destination is the portal home / login page.
 * Do NOT use for URLs that carry a security token in the path.
 */
export function getEffectivePortalLoginUrl(partner: PortalUrlPartner): string {
  // Check tier eligibility (treat missing approvalStatus as active for server-side callers
  // that have already verified the partner exists and is in good standing).
  const approvalStatus = partner.approvalStatus ?? 'active';
  const tier = getPartnerTier(partner.planId ?? null, approvalStatus);

  const isEligible =
    tier === PartnerTier.STARTER ||
    tier === PartnerTier.LIFETIME ||
    tier === PartnerTier.ENTERPRISE;

  if (isEligible && partner.customLandingPageUrl) {
    return partner.customLandingPageUrl;
  }

  // Fall back to standard portal login URL.
  // Fallback order: verified custom domain → subdomain (always set for active partners)
  const baseUrl = (partner.customDomainVerified && partner.customDomain)
    ? `https://${partner.customDomain}`
    : `https://${partner.subdomain}.knotie-ai.pro`;

  const enablePlatformUrls = process.env.ENABLE_PLATFORM_URLS !== 'false';
  const urlPrefix = enablePlatformUrls ? '/platform' : '/whitelabel';

  return `${baseUrl}${urlPrefix}/login`;
}

/**
 * Returns just the base URL (no path) for a partner — used for portal-invite
 * emails that only link to the portal root, not a specific page.
 *
 * Applies the same custom landing page logic as getEffectivePortalLoginUrl.
 */
export function getEffectivePortalBaseUrl(partner: PortalUrlPartner): string {
  const approvalStatus = partner.approvalStatus ?? 'active';
  const tier = getPartnerTier(partner.planId ?? null, approvalStatus);

  const isEligible =
    tier === PartnerTier.STARTER ||
    tier === PartnerTier.LIFETIME ||
    tier === PartnerTier.ENTERPRISE;

  if (isEligible && partner.customLandingPageUrl) {
    return partner.customLandingPageUrl;
  }

  // Fallback order: verified custom domain → subdomain (always set for active partners)
  return (partner.customDomainVerified && partner.customDomain)
    ? `https://${partner.customDomain}`
    : `https://${partner.subdomain}.knotie-ai.pro`;
}

