// Middleware for handling white-label portal domains
import { NextRequest, NextResponse } from 'next/server';
// import { prisma } from '@/lib/prisma'; // Commented out as it's not used in this file
import { PartnerBranding } from '@/types/partner';
import { getExperienceTypeFromDefaultAlias, EXPERIENCE_CONFIGS } from '@/lib/experiences/experienceTypes';
import { ExperienceType } from '@/types/experience';

/**
 * Edge-compatible structured logger for middleware.
 * The main @/lib/logger uses @opentelemetry/api which is not available in Edge Runtime.
 * This lightweight wrapper outputs structured JSON to console (same format as the main logger)
 * so logs remain consistent and parseable in Signoz / any log aggregator.
 */
const mwLogger = {
  _log(level: 'info' | 'warn' | 'error', message: string, context?: Record<string, unknown>) {
    const entry = JSON.stringify({ level, message, context, timestamp: new Date().toISOString(), service: 'middleware-whitelabel' });
    if (level === 'error') console.error(entry);
    else if (level === 'warn') console.warn(entry);
    else console.log(entry);
  },
  info(message: string, context?: Record<string, unknown>) { this._log('info', message, context); },
  warn(message: string, context?: Record<string, unknown>) { this._log('warn', message, context); },
  error(message: string, context?: Record<string, unknown>) { this._log('error', message, context); },
};

/**
 * Represents domain information extracted from a request
 */
interface DomainInfo {
  hostname: string;
  isSubdomain: boolean;
  subdomain: string | null;
  isCustomDomain: boolean;
  customDomain?: string | null;
}

/**
 * Represents partner information retrieved from a domain
 */
interface PartnerDomainInfo {
  type: 'subdomain' | 'customDomain' | 'mainDomain';
  partnerId?: string;
  partner?: PartnerBranding;
  subdomain?: string | null;
  customDomain?: string | null;
}

/**
 * Check if a domain should be excluded from whitelabel processing
 */
function isExcludedDomain(hostname: string): boolean {
  // Exclude widget-specific domains
  if (hostname === 'widgets.knotie-ai.pro' || hostname.includes('widgets.knotie-ai.pro')) {
    return true;
  }

  // Exclude ngrok domains (for testing)
  if (hostname.includes('.ngrok-free.app') || hostname.includes('.ngrok.io') || hostname.includes('.ngrok.app')) {
    return true;
  }

  // Exclude other development/testing domains
  if (hostname.includes('vercel.app') || hostname.includes('netlify.app')) {
    return true;
  }

  return false;
}

/**
 * Extract domain information from the request
 */
export function extractDomainInfo(request: NextRequest): DomainInfo {
  // CRITICAL: Always prioritize the x-forwarded-host header when available
  // This is set by Cloudflare and proxies and is more reliable than the host header in production
  let hostname = request.headers.get('x-forwarded-host') || request.headers.get('host') || '';
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'knotie-ai.pro';
  const isLocalhost = hostname.includes('localhost') || hostname.includes('127.0.0.1');
  const isLvhMe = hostname.includes('.lvh.me');

  // Check if this domain should be excluded from whitelabel processing
  if (isExcludedDomain(hostname)) {
    mwLogger.info('Domain excluded from whitelabel processing', { hostname, fn: 'extractDomainInfo' });
    return {
      hostname,
      isSubdomain: false,
      subdomain: null,
      isCustomDomain: false,
      customDomain: null
    };
  }

  // Check for custom domain headers from Cloudflare or our middleware
  const originalDomain = request.headers.get('x-original-domain') ||
                         request.headers.get('cf-connecting-domain') || '';

  // If this is a request to custom.knotie-ai.pro with an original domain header,
  // use the original domain instead of custom.knotie-ai.pro
  if (hostname.includes('custom.knotie-ai.pro') && originalDomain && originalDomain !== 'custom.knotie-ai.pro') {
    mwLogger.info('Overriding hostname from custom.knotie-ai.pro to original domain', { hostname, originalDomain, fn: 'extractDomainInfo' });
    hostname = originalDomain;

    // Mark this as a custom domain explicitly
    return {
      hostname,
      isSubdomain: false,
      subdomain: null,
      isCustomDomain: true,
      customDomain: hostname
    };
  }

  mwLogger.info('Using hostname', { hostname, baseUrl, fn: 'extractDomainInfo' });

  // Handle lvh.me local domain testing (e.g., partner1.lvh.me:3000)
  if (isLvhMe) {
    // Extract the subdomain from lvh.me
    const subdomain = hostname.split('.lvh.me')[0];
    return {
      hostname,
      isSubdomain: true,
      subdomain,
      isCustomDomain: false,
      customDomain: null
    };
  }



  // Handle standard local development
  if (isLocalhost) {
    // For local testing, check if subdomain or custom domain is simulated via query params
    const url = new URL(request.url);
    const simulatedSubdomain = url.searchParams.get('subdomain');
    const simulatedCustomDomain = url.searchParams.get('customDomain');

    if (simulatedCustomDomain) {
      return {
        hostname,
        isSubdomain: false,
        subdomain: null,
        isCustomDomain: true,
        customDomain: simulatedCustomDomain
      };
    }

    if (simulatedSubdomain) {
      return {
        hostname,
        isSubdomain: true,
        subdomain: simulatedSubdomain,
        isCustomDomain: false,
        customDomain: null
      };
    }

    return {
      hostname,
      isSubdomain: false,
      subdomain: null,
      isCustomDomain: false,
      customDomain: null
    };
  }

  // Production domain handling
  // Make sure we handle both formats: subdomain.knotie-ai.pro and subdomain.knotie-ai.pro:port
  const domainPattern = new RegExp(`^(.+)\.${baseUrl.replace(/\./g, '\\.')}(?::\d+)?$`);
  const isSubdomain = domainPattern.test(hostname) && !hostname.startsWith('www.');

  if (isSubdomain) {
    // Extract subdomain using regex to handle potential port numbers
    const match = hostname.match(domainPattern);
    const subdomain = match ? match[1] : null;

    // IMPORTANT: Exclude 'custom' subdomain as it's used for custom domain routing
    if (subdomain === 'custom') {
      mwLogger.info("Excluding 'custom' subdomain from partner lookup", { hostname, fn: 'extractDomainInfo' });
      return {
        hostname,
        isSubdomain: false,
        subdomain: null,
        isCustomDomain: false,
        customDomain: null
      };
    }

    mwLogger.info('Production subdomain detected', { subdomain, hostname, fn: 'extractDomainInfo' });

    if (!subdomain) {
      mwLogger.error('Failed to extract subdomain from hostname', { hostname, fn: 'extractDomainInfo' });
      return {
        hostname,
        isSubdomain: false,
        subdomain: null,
        isCustomDomain: false,
        customDomain: null
      };
    }
    return {
      hostname,
      isSubdomain: true,
      subdomain,
      isCustomDomain: false,
      customDomain: null
    };
  }

  // Check if it's a custom domain (not the main domain)
  const isMainDomain = hostname === baseUrl || hostname === `www.${baseUrl}`;

  return {
    hostname,
    isSubdomain: false,
    subdomain: null,
    isCustomDomain: !isMainDomain,
    customDomain: isMainDomain ? null : hostname // If not main domain, treat as potential custom domain
  };
}

/**
 * Look up partner information by subdomain
 */
export async function getPartnerBySubdomain(subdomain: string, request?: NextRequest): Promise<PartnerBranding | null> {
  try {
    // In middleware, we can't use Prisma directly because of Edge Runtime limitations
    // So we'll use a fetch to a server-side API endpoint instead
    let apiUrl;

    // Middleware always needs a fully qualified URL, even in development
    // This is because middleware runs in an edge runtime context where relative URLs may not resolve
    try {
      // IMPORTANT: For internal API calls, we must NEVER use the incoming request's host
      // as that would cause infinite redirect loops (the fetch goes back through this middleware)
      // Instead, use localhost (dev/container) or the main app domain (production)
      if (process.env.NODE_ENV === 'development') {
        // Use localhost URL for development - get port from request URL if available
        const port = request?.nextUrl.port || '3000';
        apiUrl = `http://localhost:${port}/api/whitelabel/branding/${subdomain}`;
      } else if (process.env.INTERNAL_API_URL) {
        // For Docker/container environments, use the configured internal URL
        // This prevents external network calls that could loop back through the middleware
        apiUrl = `${process.env.INTERNAL_API_URL}/api/whitelabel/branding/${subdomain}`;
      } else {
        // Production: Use the main app domain (never use custom domains for self-calls)
        // All custom domains/subdomains CNAME to this, so the API is always available here
        const mainDomain = process.env.NEXT_PUBLIC_APP_URL || 'https://knotie-ai.pro';
        apiUrl = `${mainDomain}/api/whitelabel/branding/${subdomain}`;
      }

      mwLogger.info('Constructed API URL', { apiUrl, fn: 'getPartnerBySubdomain' });
    } catch (error) {
      mwLogger.error('Error in URL construction', { subdomain, error: String(error), fn: 'getPartnerBySubdomain' });
      throw new Error(`Failed to construct URL for subdomain: ${subdomain}`);
    }

    mwLogger.info('Fetching partner branding data', { apiUrl, fn: 'getPartnerBySubdomain' });

    // We need to catch any fetch errors here to provide better debugging
    try {
      const response = await fetch(apiUrl, {
        method: 'GET',
        headers: {
          'Accept': 'application/json'
        }
      });

      if (!response.ok) {
        mwLogger.error('Error fetching partner branding', { status: response.status, statusText: response.statusText, fn: 'getPartnerBySubdomain' });
        return null;
      }

      const data = await response.json();
      mwLogger.info('API response received for subdomain', { subdomain, fn: 'getPartnerBySubdomain' });

      // Handle both response structures: direct object or nested partner property
      const partnerData = data.partner || data;

      if (!partnerData || !partnerData.id) {
        mwLogger.warn('No valid partner data found in response', { subdomain, fn: 'getPartnerBySubdomain' });
        return null;
      }

      mwLogger.info('Successfully extracted partner data', { subdomain, partnerId: partnerData.id, fn: 'getPartnerBySubdomain' });

      // Create a properly typed response object
      const brandingData: PartnerBranding = {
        id: partnerData.id,
        businessName: partnerData.businessName,
        logo: partnerData.logo || undefined,
        logoSize: partnerData.logoSize || 'medium',
        favicon: partnerData.favicon || undefined,
        primaryColor: partnerData.primaryColor || '#3B82F6',
        secondaryColor: partnerData.secondaryColor || '#10B981',
        fontFamily: partnerData.fontFamily || 'Inter',
        portalTitle: partnerData.portalTitle || undefined,
        portalSlogan: partnerData.portalSlogan || undefined,
        customerPortalEnabled: partnerData.customerPortalEnabled || false,
        enableCustomerSignup: partnerData.enableCustomerSignup || false,
        themePreference: partnerData.themePreference || 'MODERN',
        portalMode: partnerData.portalMode || 'BASIC',
        // Enhanced Landing Page Configuration
        supportEmail: partnerData.supportEmail || undefined,
        companyAddress: partnerData.companyAddress || undefined,
        companyPhone: partnerData.companyPhone || undefined,
        privacyPolicyUrl: partnerData.privacyPolicyUrl || undefined,
        termsOfServiceUrl: partnerData.termsOfServiceUrl || undefined,
        statusPageUrl: partnerData.statusPageUrl || undefined,
        // Social Media Links
        twitterUrl: partnerData.twitterUrl || undefined,
        linkedinUrl: partnerData.linkedinUrl || undefined,
        facebookUrl: partnerData.facebookUrl || undefined,
        instagramUrl: partnerData.instagramUrl || undefined,
        // Landing Page Content
        testimonials: partnerData.testimonials || undefined,
        faqs: partnerData.faqs || undefined,
        features: partnerData.features || undefined,
        trustIndicators: partnerData.trustIndicators || undefined
      };

      return brandingData;
    } catch (error) {
      mwLogger.error('Fetch/parse error', { error: String(error), subdomain, fn: 'getPartnerBySubdomain' });
      return null;
    }
  } catch (error) {
    mwLogger.error('Error looking up partner by subdomain', { error: String(error), subdomain, fn: 'getPartnerBySubdomain' });
    return null;
  }
}

/**
 * Get partner information based on domain
 */
export async function getPartnerFromDomain(request: NextRequest): Promise<PartnerDomainInfo> {
  const domainInfo = extractDomainInfo(request);

  // For development/demo purposes, allow simulating a partner for any subdomain
  // In production, we would look up the partner in the database
  if (domainInfo.isSubdomain && domainInfo.subdomain) {
    try {
      // Check if we're in local development
      const isLocalDev = domainInfo.hostname.includes('localhost') ||
                         domainInfo.hostname.includes('127.0.0.1') ||
                         domainInfo.hostname.includes('.lvh.me');

      // Try to find real partner first
      const partner = await getPartnerBySubdomain(domainInfo.subdomain, request);

      if (partner) {
        mwLogger.info('Using real partner data', { subdomain: domainInfo.subdomain, partnerId: partner.id, fn: 'getPartnerFromDomain' });
        return {
          type: 'subdomain',
          partnerId: partner.id,
          partner,
          subdomain: domainInfo.subdomain
        };
      }

      // Only use simulated partners when no real partner exists and we're in development
      if (isLocalDev) {
        // Simulate a partner for local development
        const subdomain = domainInfo.subdomain;

        // Use the API to get real partner details instead of direct Prisma in middleware
        try {
          mwLogger.info('Looking up actual partner data for subdomain', { subdomain, fn: 'getPartnerFromDomain' });
          const branding = await getPartnerBySubdomain(subdomain, request);

          if (branding && branding.id) {
            mwLogger.info('Found actual partner for subdomain', { subdomain, partnerId: branding.id, businessName: branding.businessName, fn: 'getPartnerFromDomain' });
            return {
              type: 'subdomain',
              partnerId: branding.id,
              subdomain: subdomain,
              partner: branding
            };
          } else {
            mwLogger.warn('No partner found for subdomain in database, using fallback branding', { subdomain, fn: 'getPartnerFromDomain' });
            // Fall back to generic branding if no partner is found
            return {
              type: 'subdomain',
              partnerId: undefined,
              subdomain: subdomain,
              partner: {
                id: "",
                businessName: subdomain.charAt(0).toUpperCase() + subdomain.slice(1),
                primaryColor: '#3B82F6',
                secondaryColor: '#10B981',
                fontFamily: 'Inter',
                portalTitle: `${subdomain.charAt(0).toUpperCase() + subdomain.slice(1)} AI Portal`,
                portalSlogan: 'Powered by advanced voice AI technology',
                customerPortalEnabled: true,
                enableCustomerSignup: false
              }
            };
          }
        } catch (error) {
          mwLogger.error('Error looking up partner by subdomain', { subdomain, error: String(error), fn: 'getPartnerFromDomain' });
          // On error, fall back to default styling
          return {
            type: 'subdomain',
            partnerId: undefined,
            subdomain: subdomain,
            partner: {
              id: "",
              businessName: subdomain.charAt(0).toUpperCase() + subdomain.slice(1),
              primaryColor: '#3B82F6',
              secondaryColor: '#10B981',
              fontFamily: 'Inter',
              portalTitle: `${subdomain.charAt(0).toUpperCase() + subdomain.slice(1)} AI Portal`,
              portalSlogan: 'Powered by advanced voice AI technology',
              customerPortalEnabled: true,
              enableCustomerSignup: false
            }
          };
        }
      }
    } catch (error) {
      mwLogger.error('Unexpected error in subdomain partner lookup', { error: String(error), fn: 'getPartnerFromDomain' });
    }
  }

  // Check for custom domain
  if (domainInfo.isCustomDomain && domainInfo.customDomain) {
    try {
      // For local development with simulated custom domain
      const isLocalDev = domainInfo.hostname.includes('localhost') ||
                         domainInfo.hostname.includes('127.0.0.1');

      if (isLocalDev && request.nextUrl.searchParams.get('customDomain')) {
        const customDomain = request.nextUrl.searchParams.get('customDomain');
        const partnerId = request.nextUrl.searchParams.get('partnerId');

        if (customDomain && partnerId) {
          // Simulate a partner with custom domain for local testing
          mwLogger.info('Using simulated partner data for custom domain', { customDomain, partnerId, fn: 'getPartnerFromDomain' });
          return {
            type: 'customDomain',
            partnerId,
            customDomain,
            partner: {
              id: partnerId,
              businessName: 'Test Partner',
              primaryColor: '#3B82F6',
              secondaryColor: '#10B981',
              fontFamily: 'Inter',
              portalTitle: 'Test Partner Portal',
              portalSlogan: 'Powered by advanced voice AI technology',
              customerPortalEnabled: true,
              enableCustomerSignup: false
            }
          };
        }
      }

      // In production, look up partner by custom domain
      // IMPORTANT: For internal API calls, we must NEVER use the incoming request's host (custom domain)
      // as that would cause infinite redirect loops (the fetch goes back through this middleware)
      // Instead, use localhost (dev/container) or the main app domain (production)
      let apiUrl;

      if (process.env.NODE_ENV === 'development') {
        // Use localhost URL for development - get port from request URL
        const port = request.nextUrl.port || '3000';
        apiUrl = `http://localhost:${port}/api/whitelabel/branding/domain/${encodeURIComponent(domainInfo.customDomain)}`;
      } else if (process.env.INTERNAL_API_URL) {
        // For Docker/container environments, use the configured internal URL
        // This prevents external network calls that could loop back through the middleware
        apiUrl = `${process.env.INTERNAL_API_URL}/api/whitelabel/branding/domain/${encodeURIComponent(domainInfo.customDomain)}`;
      } else {
        // Production: Use the main app domain (never use custom domains for self-calls)
        // All custom domains CNAME to this, so the API is always available here
        const mainDomain = process.env.NEXT_PUBLIC_APP_URL || 'https://knotie-ai.pro';
        apiUrl = `${mainDomain}/api/whitelabel/branding/domain/${encodeURIComponent(domainInfo.customDomain)}`;
      }

      mwLogger.info('Looking up partner by custom domain', { apiUrl, customDomain: domainInfo.customDomain, fn: 'getPartnerFromDomain' });

      const response = await fetch(apiUrl, {
        method: 'GET',
        headers: {
          'Accept': 'application/json'
        }
      });

      if (!response.ok) {
        mwLogger.error('Error fetching partner by custom domain', { status: response.status, statusText: response.statusText, customDomain: domainInfo.customDomain, fn: 'getPartnerFromDomain' });
        return { type: 'mainDomain' };
      }

      const data = await response.json();

      // Handle both response formats (nested under 'partner' or direct)
      const partnerData = data.partner || data;

      if (!partnerData || !partnerData.id) {
        mwLogger.warn('No valid partner data found for custom domain', { customDomain: domainInfo.customDomain, fn: 'getPartnerFromDomain' });
        return { type: 'mainDomain' };
      }

      mwLogger.info('Found partner for custom domain', { customDomain: domainInfo.customDomain, partnerId: partnerData.id, fn: 'getPartnerFromDomain' });

      // Create a properly typed response object with defaults for all required fields
      const brandingData: PartnerBranding = {
        id: partnerData.id,
        businessName: partnerData.businessName,
        logo: partnerData.logo || null,
        logoSize: partnerData.logoSize || 'medium',
        favicon: partnerData.favicon || null,
        primaryColor: partnerData.primaryColor || '#3B82F6',
        secondaryColor: partnerData.secondaryColor || '#10B981',
        fontFamily: partnerData.fontFamily || 'Inter',
        portalTitle: partnerData.portalTitle || `${partnerData.businessName} AI Portal`,
        portalSlogan: partnerData.portalSlogan || 'Powered by advanced voice AI technology',
        customerPortalEnabled: partnerData.customerPortalEnabled !== undefined ? partnerData.customerPortalEnabled : true,
        enableCustomerSignup: partnerData.enableCustomerSignup === true,
        themePreference: partnerData.themePreference || 'MODERN',
        // Portal Mode - Critical for SAAS vs BASIC routing
        portalMode: partnerData.portalMode || 'BASIC',
        // SaaS Portal Configuration
        saasOnboardingEnabled: partnerData.saasOnboardingEnabled || false,
        autoDeployEnabled: partnerData.autoDeployEnabled || false,
        saasAgentTier: partnerData.saasAgentTier || 'ESSENTIALS',
        characterName: partnerData.characterName || undefined,
        freeTrialEnabled: partnerData.freeTrialEnabled || false,
        freeAiCredits: partnerData.freeAiCredits || 50,
        pricingModel: partnerData.pricingModel || 'subscription',
        payAsYouGoRate: partnerData.payAsYouGoRate || 0.10,
        // Enhanced Landing Page Configuration
        supportEmail: partnerData.supportEmail || undefined,
        companyAddress: partnerData.companyAddress || undefined,
        companyPhone: partnerData.companyPhone || undefined,
        privacyPolicyUrl: partnerData.privacyPolicyUrl || undefined,
        termsOfServiceUrl: partnerData.termsOfServiceUrl || undefined,
        statusPageUrl: partnerData.statusPageUrl || undefined,
        // Social Media Links
        twitterUrl: partnerData.twitterUrl || undefined,
        linkedinUrl: partnerData.linkedinUrl || undefined,
        facebookUrl: partnerData.facebookUrl || undefined,
        instagramUrl: partnerData.instagramUrl || undefined,
        // Landing Page Content
        testimonials: partnerData.testimonials || undefined,
        faqs: partnerData.faqs || undefined,
        features: partnerData.features || undefined,
        trustIndicators: partnerData.trustIndicators || undefined,
        // Multi-language support
        basicPortalLanguage: partnerData.basicPortalLanguage || 'en',
        saasPortalLanguage: partnerData.saasPortalLanguage || 'en',
        // AI Translation System
        translatedTexts: partnerData.translatedTexts || undefined,
        translationEnabled: partnerData.translationEnabled || false
      };

      return {
        type: 'customDomain',
        partnerId: partnerData.id,
        customDomain: domainInfo.customDomain,
        partner: brandingData
      };
    } catch (error) {
      mwLogger.error('Error looking up partner by custom domain', { error: String(error), customDomain: domainInfo.customDomain, fn: 'getPartnerFromDomain' });
    }
  }

  // Default to main domain or unknown domain
  return {
    type: 'mainDomain'
  };
}

/**
 * Handle requests to white-label domains
 */
export async function handleWhiteLabelRequest(request: NextRequest): Promise<NextResponse | null> {
  const host = request.headers.get('host') || '';

  const forwardedHost = request.headers.get('x-forwarded-host');
  const forwardedProto = request.headers.get('x-forwarded-proto');
  const realIp = request.headers.get('x-real-ip');
  mwLogger.info('Incoming request', { host, url: request.url, forwardedHost: forwardedHost ?? undefined, forwardedProto: forwardedProto ?? undefined, realIp: realIp ?? undefined, fn: 'handleWhiteLabelRequest' });

  // SPECIAL PRODUCTION HANDLING: Override host detection if needed
  // In production with Cloudflare, the request URL might be localhost:3001 but the host is the actual subdomain
  const effectiveHost = forwardedHost || host;

  // Early exit: Skip white-label processing for excluded domains (widgets, ngrok, etc.)
  if (isExcludedDomain(effectiveHost)) {
    mwLogger.info('Skipping white-label processing for excluded domain', { effectiveHost, fn: 'handleWhiteLabelRequest' });
    return null;
  }

  // Early exit: Skip white-label processing for mission-control and admin routes
  // This ensures admin functionality works properly regardless of subdomain
  const url = new URL(request.url);
  const path = url.pathname;
  if (path.startsWith('/mission-control') ||
      path.startsWith('/api/admin') ||
      path.startsWith('/api/public/widget') ||
      path.startsWith('/widget/')) {
    mwLogger.info('Skipping white-label processing for excluded route', { path, fn: 'handleWhiteLabelRequest' });
    return null;
  }

  // Check for Cloudflare custom domain headers (try multiple variations for iframe requests)
  const cfConnectingDomain = request.headers.get('cf-connecting-domain') || '';
  const cfOriginalHost = request.headers.get('x-original-host') || '';
  const xCustomDomain = request.headers.get('x-custom-domain') || '';
  const xIframeOriginalDomain = request.headers.get('x-iframe-original-domain') || '';
  const xCrossSiteDomain = request.headers.get('x-cross-site-domain') || '';

  const originalDomain = cfConnectingDomain || cfOriginalHost || xCustomDomain || xIframeOriginalDomain || xCrossSiteDomain;

  mwLogger.info('Header inspection', { cfConnectingDomain: cfConnectingDomain || undefined, cfOriginalHost: cfOriginalHost || undefined, xIframeOriginalDomain: xIframeOriginalDomain || undefined, originalDomain: originalDomain || undefined, fn: 'handleWhiteLabelRequest' });

  // Special handling for custom.knotie-ai.pro which is our dedicated subdomain for custom domains
  if (effectiveHost === 'custom.knotie-ai.pro' || effectiveHost.includes('custom.knotie-ai.pro')) {
    mwLogger.info('Detected request to custom.knotie-ai.pro', { originalDomain: originalDomain || undefined, fn: 'handleWhiteLabelRequest' });

    // If we have an original domain from Cloudflare, look up the partner by that domain
    if (originalDomain && originalDomain !== 'custom.knotie-ai.pro') {
      // Create request headers with the original domain for partner lookup
      const requestHeaders = new Headers(request.headers);
      requestHeaders.set('x-is-custom-domain', 'true');
      requestHeaders.set('x-original-domain', originalDomain);

      // We'll let the normal partner lookup process handle this
      // by passing through to the getPartnerFromDomain function
      // Just add these headers to the request
      request.headers.set('x-original-domain', originalDomain);
    }
  }

  // Direct subdomain detection from the host header for reliability
  // This bypasses any issues with Next.js URL transformation in production
  if (effectiveHost && effectiveHost.includes('.knotie-ai.pro') && !effectiveHost.startsWith('www.')) {
    const subdomain = effectiveHost.split('.')[0];
    mwLogger.info('Direct subdomain detection', { subdomain, effectiveHost, fn: 'handleWhiteLabelRequest' });

    // Skip the full partner lookup process in very specific circumstances
    // When we detect a clear subdomain.knotie-ai.pro pattern
    if (subdomain && !['www', 'app', 'api', 'custom'].includes(subdomain)) {
      // Create request headers with partner info
      const requestHeaders = new Headers(request.headers);
      requestHeaders.set('x-is-whitelabel', 'true');
      requestHeaders.set('x-detected-subdomain', subdomain);

      // For root path, redirect to welcome page
      const path = request.nextUrl.pathname;
      if (path === '/') {
        mwLogger.info('Direct subdomain redirect to welcome', { subdomain, fn: 'handleWhiteLabelRequest' });
        const welcomeUrl = new URL('/welcome', request.url);
        welcomeUrl.searchParams.set('subdomain', subdomain);
        welcomeUrl.searchParams.set('direct', '1');
        return NextResponse.redirect(welcomeUrl, {
          headers: requestHeaders,
        });
      }
    }
  }

  // Special handling for embed routes - these should work on any domain
  if (url.pathname.startsWith('/whitelabel/embed/')) {
    mwLogger.info('Embed route detected', { path: url.pathname, originalDomain: originalDomain || undefined, fn: 'handleWhiteLabelRequest' });

    // For embed routes, preserve the original domain headers for security validation
    const requestHeaders = new Headers(request.headers);
    if (originalDomain && originalDomain !== 'custom.knotie-ai.pro') {
      requestHeaders.set('x-embed-original-domain', originalDomain);
      requestHeaders.set('x-original-domain', originalDomain);
      mwLogger.info('Setting embed original domain header', { originalDomain, fn: 'handleWhiteLabelRequest' });
    }

    return NextResponse.next({
      headers: requestHeaders,
    });
  }

  // Special handling for embed auth API routes
  if (url.pathname.startsWith('/api/whitelabel/embed/')) {
    mwLogger.info('Embed API route detected', { path: url.pathname, originalDomain: originalDomain || undefined, fn: 'handleWhiteLabelRequest' });

    // For embed API routes, preserve the original domain headers for security validation
    const requestHeaders = new Headers(request.headers);
    if (originalDomain && originalDomain !== 'custom.knotie-ai.pro') {
      requestHeaders.set('x-embed-original-domain', originalDomain);
      requestHeaders.set('x-original-domain', originalDomain);
      mwLogger.info('Setting embed API original domain header', { originalDomain, fn: 'handleWhiteLabelRequest' });
    }

    return NextResponse.next({
      headers: requestHeaders,
    });
  }

  // Proceed with normal processing as fallback
  const domainInfo = await getPartnerFromDomain(request);
  mwLogger.info('Processing white-label request', { url: request.url, partnerId: domainInfo.partnerId, domainType: domainInfo.type, path: url.pathname, fn: 'handleWhiteLabelRequest' });


  // If this is a partner subdomain or custom domain
  if ((domainInfo.type === 'subdomain' || domainInfo.type === 'customDomain') && domainInfo.partnerId) {
    // Set partnerId in a header that can be accessed from within the app
    const requestHeaders = new Headers(request.headers);
    requestHeaders.set('x-partner-id', domainInfo.partnerId);

    // Store minimal partner details in headers to keep header size small
    if (domainInfo.partner) {
      // Only pass ID and essential information, not the entire object
      requestHeaders.set('x-partner-id', domainInfo.partnerId || '');
      requestHeaders.set('x-partner-subdomain', domainInfo.subdomain || '');
      // Do not pass the full partner object in headers to avoid ERR_RESPONSE_HEADERS_TOO_BIG
    }

    // For all paths on partner domains, rewrite to the whitelabel paths
    const path = request.nextUrl.pathname;

    mwLogger.info('Partner domain matched', { url: request.url, partnerId: domainInfo.partnerId, domainType: domainInfo.type, path, fn: 'handleWhiteLabelRequest' });

    // Store partner info in request headers for the application
    const originalHost = request.headers.get('host') || '';
    requestHeaders.set('x-original-host', originalHost);

    if (domainInfo.partner) {
      // Store partner details as JSON for easy access in routes
      requestHeaders.set('x-partner-branding', JSON.stringify({
        id: domainInfo.partnerId,
        businessName: domainInfo.partner.businessName,
        themePreference: domainInfo.partner.themePreference || 'MODERN',
        enableCustomerSignup: domainInfo.partner.enableCustomerSignup || false
      }));
    }

    mwLogger.info('White-label request for host', { originalHost, fn: 'handleWhiteLabelRequest' });

    // Feature flag for platform URLs (default: true)
    // Set ENABLE_PLATFORM_URLS=false to revert to whitelabel URLs
    const enablePlatformUrls = process.env.ENABLE_PLATFORM_URLS !== 'false';
    mwLogger.info('Platform URLs flag', { enablePlatformUrls, fn: 'handleWhiteLabelRequest' });

    if (enablePlatformUrls) {
      // NEW PLATFORM URL LOGIC
      // Handle root path - redirect to platform
    if (path === '/') {
      const portalMode = domainInfo.partner?.portalMode || 'BASIC';
      let targetPath = '/platform';
      mwLogger.info('Redirecting root path to platform', { partnerId: domainInfo.partnerId, portalMode, targetPath, fn: 'handleWhiteLabelRequest' });

      const newUrl = new URL(targetPath, request.url);
      // Preserve query parameters from the original request
      newUrl.search = request.nextUrl.search;
      return NextResponse.redirect(newUrl, {
        status: 307,
        headers: requestHeaders,
      });
    }

    // Handle platform URLs - rewrite to internal whitelabel routes
    if (path.startsWith('/platform')) {
      mwLogger.info('Processing platform URL', { path, fn: 'handleWhiteLabelRequest' });

      const portalMode = domainInfo.partner?.portalMode || 'BASIC';

      // Map platform URLs to internal whitelabel routes
      if (path === '/platform') {
        // Platform root maps to appropriate portal mode
        let targetPath = '/whitelabel';
        if (portalMode === 'SAAS') {
          targetPath = '/whitelabel/saas';
        }
        mwLogger.info('Rewriting platform root', { from: path, to: targetPath, fn: 'handleWhiteLabelRequest' });
        const newUrl = new URL(targetPath, request.url);
        return NextResponse.rewrite(newUrl, {
          headers: requestHeaders,
        });
      } else {
        // Check if the path after /platform is an experience alias (e.g., /platform/assistant)
        const platformSubPath = path.replace('/platform', ''); // e.g., '/assistant' or '/assistant/onboarding/1'
        const platformSegments = platformSubPath.split('/').filter(Boolean);
        if (platformSegments.length > 0) {
          const firstPlatformSegment = `/${platformSegments[0]}`;
          const platformExperienceType = getExperienceTypeFromDefaultAlias(firstPlatformSegment);
          if (platformExperienceType) {
            // Experience alias detected — rewrite to internal experience route
            requestHeaders.set('x-experience-type', platformExperienceType);
            requestHeaders.set('x-experience-alias', firstPlatformSegment);
            const remainingPlatformPath = platformSegments.slice(1).join('/');
            const targetPath = remainingPlatformPath
              ? `/whitelabel/experience/${platformExperienceType}/${remainingPlatformPath}`
              : `/whitelabel/experience/${platformExperienceType}`;
            mwLogger.info('Rewriting platform experience alias', { from: path, to: targetPath, fn: 'handleWhiteLabelRequest' });
            const newUrl = new URL(targetPath, request.url);
            newUrl.search = request.nextUrl.search;
            return NextResponse.rewrite(newUrl, { headers: requestHeaders });
          }
        }

        // Other platform paths: /platform/login → /whitelabel/login
        const whitelabelPath = path.replace('/platform', '/whitelabel');
        mwLogger.info('Rewriting platform path', { from: path, to: whitelabelPath, fn: 'handleWhiteLabelRequest' });
        const newUrl = new URL(whitelabelPath, request.url);
        return NextResponse.rewrite(newUrl, {
          headers: requestHeaders,
        });
      }
    }

    // Handle experience alias routing (e.g., /assistant, /openclaw-setup, /assistant/onboarding/1)
    // This detects known experience aliases and rewrites to internal experience routes.
    // AI Receptionist has no alias (null) so it is never matched here.
    // Experience landing pages work for ALL portal modes (BASIC and SAAS) because
    // experiences like OpenClaw Setup Service are sold by agencies regardless of their
    // own portal mode. The alias itself (e.g. /openclaw-setup) uniquely identifies
    // the experience and does not conflict with AI Receptionist portals.
    if (domainInfo.partner) {
      const pathSegments = path.split('/').filter(Boolean); // e.g., ['assistant', 'onboarding', '1']
      if (pathSegments.length > 0) {
        const firstSegment = `/${pathSegments[0]}`; // e.g., '/assistant'
        const experienceType = getExperienceTypeFromDefaultAlias(firstSegment);

        if (experienceType) {
          // This is an experience alias URL — rewrite to internal experience route
          requestHeaders.set('x-experience-type', experienceType);
          requestHeaders.set('x-experience-alias', firstSegment);

          const remainingPath = pathSegments.slice(1).join('/'); // e.g., 'onboarding/1'

          if (!remainingPath) {
            // Landing page: /assistant → /whitelabel/experience/AI_PERSONAL_ASSISTANT
            const targetPath = `/whitelabel/experience/${experienceType}`;
            mwLogger.info('Rewriting experience alias', { from: path, to: targetPath, fn: 'handleWhiteLabelRequest' });
            const newUrl = new URL(targetPath, request.url);
            newUrl.search = request.nextUrl.search;
            return NextResponse.rewrite(newUrl, { headers: requestHeaders });
          } else if (remainingPath.startsWith('onboarding')) {
            // Onboarding: /assistant/onboarding/1 → /whitelabel/experience/AI_PERSONAL_ASSISTANT/onboarding/1
            const targetPath = `/whitelabel/experience/${experienceType}/${remainingPath}`;
            mwLogger.info('Rewriting experience onboarding', { from: path, to: targetPath, fn: 'handleWhiteLabelRequest' });
            const newUrl = new URL(targetPath, request.url);
            newUrl.search = request.nextUrl.search;
            return NextResponse.rewrite(newUrl, { headers: requestHeaders });
          } else {
            // Other sub-paths under the experience alias
            const targetPath = `/whitelabel/experience/${experienceType}/${remainingPath}`;
            mwLogger.info('Rewriting experience sub-path', { from: path, to: targetPath, fn: 'handleWhiteLabelRequest' });
            const newUrl = new URL(targetPath, request.url);
            newUrl.search = request.nextUrl.search;
            return NextResponse.rewrite(newUrl, { headers: requestHeaders });
          }
        }
      }
    }

    // Handle SaaS onboarding URLs for clean customer experience (AI Receptionist — root domain)
    const portalMode = domainInfo.partner?.portalMode || 'BASIC';
    if (portalMode === 'SAAS') {
      // Map clean onboarding URLs to SaaS whitelabel routes
      if (path.startsWith('/onboarding')) {
        const targetPath = `/whitelabel/saas${path}`;
        mwLogger.info('Rewriting SaaS onboarding URL', { from: path, to: targetPath, fn: 'handleWhiteLabelRequest' });
        const newUrl = new URL(targetPath, request.url);
        return NextResponse.rewrite(newUrl, {
          headers: requestHeaders,
        });
      }

      // Map other clean SaaS URLs if needed
      if (path === '/complete') {
        const targetPath = '/whitelabel/saas/complete';
        mwLogger.info('Rewriting SaaS completion URL', { from: path, to: targetPath, fn: 'handleWhiteLabelRequest' });
        const newUrl = new URL(targetPath, request.url);
        return NextResponse.rewrite(newUrl, {
          headers: requestHeaders,
        });
      }
    }

    // Handle clean auth URLs (both SAAS and BASIC modes)
    if (path === '/login') {
      const targetPath = '/whitelabel/login';
      mwLogger.info('Rewriting clean login URL', { from: path, to: targetPath, fn: 'handleWhiteLabelRequest' });
      const newUrl = new URL(targetPath, request.url);
      // Preserve query parameters (e.g. ?from=/assistant&redirect=/assistant)
      newUrl.search = request.nextUrl.search;
      return NextResponse.rewrite(newUrl, {
        headers: requestHeaders,
      });
    }

    if (path === '/register') {
      const targetPath = '/whitelabel/register';
      mwLogger.info('Rewriting clean register URL', { from: path, to: targetPath, fn: 'handleWhiteLabelRequest' });
      const newUrl = new URL(targetPath, request.url);
      // Preserve query parameters
      newUrl.search = request.nextUrl.search;
      return NextResponse.rewrite(newUrl, {
        headers: requestHeaders,
      });
    }

    // Redirect whitelabel URLs to platform URLs for consistent customer experience
    if (path.startsWith('/whitelabel/') && path !== '/whitelabel') {
      // Convert /whitelabel/login → /platform/login
      const platformPath = path.replace('/whitelabel', '/platform');
      mwLogger.info('Redirecting whitelabel URL to platform', { from: path, to: platformPath, fn: 'handleWhiteLabelRequest' });
      const newUrl = new URL(platformPath, request.url);
      // Preserve query parameters from the original request
      newUrl.search = request.nextUrl.search;
      return NextResponse.redirect(newUrl, {
        status: 307,
        headers: requestHeaders,
      });
    }

    // For API requests and root whitelabel path, just add partner headers
    if (path.startsWith('/api/') || path === '/whitelabel' || path === '/welcome') {
      mwLogger.info('Adding partner headers', { path, fn: 'handleWhiteLabelRequest' });

      // Special handling for welcome page on custom domains
      // We'll let the client-side code handle the redirection now
      if (path === '/welcome' && domainInfo.type === 'customDomain') {
        mwLogger.info('Custom domain detected on welcome page, adding special header', { fn: 'handleWhiteLabelRequest' });
        requestHeaders.set('x-custom-domain', 'true');
      }

      return NextResponse.next({
        headers: requestHeaders,
      });
    }

      // For all other paths on partner domains, redirect to the platform path
      mwLogger.info('Redirecting to platform path', { from: path, to: `/platform${path}`, fn: 'handleWhiteLabelRequest' });
      const url = new URL(`/platform${path}`, request.url);
      // Preserve query parameters from the original request
      url.search = request.nextUrl.search;
      return NextResponse.redirect(url, {
        status: 307,
        headers: requestHeaders,
      });
    } else {
      // FALLBACK TO ORIGINAL WHITELABEL LOGIC
      mwLogger.info('Platform URLs disabled, using original whitelabel logic', { fn: 'handleWhiteLabelRequest' });

      // For API requests and existing whitelabel paths, just add partner headers
      if (path.startsWith('/api/') || path.startsWith('/whitelabel/') || path === '/whitelabel' || path === '/welcome') {
        mwLogger.info('Adding partner headers', { path, fn: 'handleWhiteLabelRequest' });

        // Special handling for welcome page on custom domains
        if (path === '/welcome' && domainInfo.type === 'customDomain') {
          mwLogger.info('Custom domain detected on welcome page, adding special header', { fn: 'handleWhiteLabelRequest' });
          requestHeaders.set('x-custom-domain', 'true');
        }

        return NextResponse.next({
          headers: requestHeaders,
        });
      }

      // For root path, redirect to appropriate whitelabel route based on portal mode
      if (path === '/') {
        const portalMode = domainInfo.partner?.portalMode || 'BASIC';
        let targetPath = '/whitelabel';
        if (portalMode === 'SAAS') {
          targetPath = '/whitelabel/saas';
        }
        mwLogger.info('Redirecting root to whitelabel', { portalMode, targetPath, fn: 'handleWhiteLabelRequest' });

        const newUrl = new URL(targetPath, request.url);
        // Preserve query parameters from the original request
        newUrl.search = request.nextUrl.search;
        return NextResponse.redirect(newUrl, {
          status: 307,
          headers: requestHeaders,
        });
      }

      // For all other paths, redirect to whitelabel path (original behavior)
      mwLogger.info('Redirecting to whitelabel path', { from: path, to: `/whitelabel${path}`, fn: 'handleWhiteLabelRequest' });
      const url = new URL(`/whitelabel${path}`, request.url);
      // Preserve query parameters from the original request
      url.search = request.nextUrl.search;
      return NextResponse.redirect(url, {
        status: 307,
        headers: requestHeaders,
      });
    }
  }

  // For regular domains, just pass through
  return null;
}
