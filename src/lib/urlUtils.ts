/**
 * Utility functions for URL construction that respect environment variables
 */

/**
 * Get the correct URL prefix based on ENABLE_PLATFORM_URLS environment variable
 * @returns '/platform' if ENABLE_PLATFORM_URLS is true (default), '/whitelabel' if false
 */
export function getPortalUrlPrefix(): string {
  const enablePlatformUrls = process.env.ENABLE_PLATFORM_URLS !== 'false';
  return enablePlatformUrls ? '/platform' : '/whitelabel';
}

/**
 * Construct a portal URL with the correct prefix based on environment settings
 * @param baseUrl - The base URL (e.g., https://joe.knotie-ai.pro)
 * @param path - The path without prefix (e.g., 'verify-email', 'login', 'reset-password')
 * @param queryParams - Optional query parameters as an object
 * @returns Complete URL with correct prefix
 */
export function buildPortalUrl(baseUrl: string, path: string, queryParams?: Record<string, string>): string {
  const prefix = getPortalUrlPrefix();
  const cleanPath = path.startsWith('/') ? path.slice(1) : path;
  
  let url = `${baseUrl}${prefix}/${cleanPath}`;
  
  if (queryParams) {
    const searchParams = new URLSearchParams(queryParams);
    url += `?${searchParams.toString()}`;
  }
  
  return url;
}

/**
 * Get the base URL for a partner based on their domain settings
 * @param partner - Partner object with domain settings
 * @returns Base URL for the partner
 */
export function getPartnerBaseUrl(partner: {
  customDomain?: string | null;
  customDomainVerified?: boolean | null;
  subdomain?: string | null;
}): string {
  const isDevelopment = process.env.NODE_ENV === 'development';
  const isPreviewMode = process.env.NEXT_PUBLIC_PREVIEW_MODE === 'development';

  if (isDevelopment || isPreviewMode) {
    // Development mode: use lvh.me with subdomain for local testing
    const devPort = process.env.PORT || '3000';
    if (partner.customDomainVerified && partner.customDomain) {
      // Even in development, if custom domain is verified, use it
      return `https://${partner.customDomain}`;
    } else if (partner.subdomain) {
      return `http://${partner.subdomain}.lvh.me:${devPort}`;
    } else {
      // Fallback to main lvh.me domain
      return `http://lvh.me:${devPort}`;
    }
  } else {
    // Production mode: use actual domains
    if (partner.customDomainVerified && partner.customDomain) {
      return `https://${partner.customDomain}`;
    } else if (partner.subdomain) {
      return `https://${partner.subdomain}.knotie-ai.pro`;
    } else {
      // Fallback to main domain
      return `https://knotie-ai.pro`;
    }
  }
}
