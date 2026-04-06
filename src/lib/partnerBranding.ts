/**
 * Partner Branding Utilities
 *
 * This file contains utilities for fetching and applying partner branding
 * consistently across the application.
 */

import React from 'react';
import { hexToRgba } from './utils';
import { PortalTheme } from './portalThemes';
import { PartnerBranding as PartnerBrandingType } from '@/types/partner';
import { logger } from './logger';

// Cache configuration
const CACHE_KEY = 'partner_branding_cache';
const CACHE_DURATION = 30 * 60 * 1000; // 30 minutes in milliseconds

// In-memory cache for the current session
let memoryCache: {
  data: PartnerBranding | null;
  timestamp: number;
  subdomain?: string;
} | null = null;

export interface PartnerBranding {
  id?: string;
  businessName: string;
  logo: string | null;
  logoSize?: string;
  favicon?: string | null;
  primaryColor: string | null;
  secondaryColor: string | null;
  fontFamily: string | null;
  portalTitle: string | null;
  portalSlogan: string | null;
  email?: string;
  contactName?: string;
  themePreference?: PortalTheme;
  customerPortalEnabled?: boolean;
  enableCustomerSignup?: boolean;
  voiceAiAgentEnabled?: boolean;
  voiceAiAgentPricingNote?: string;
  voiceAiAgentSpecialOffer?: string;
  voiceAiAgentName?: string;
  voiceAiAgentVoiceType?: string;
  voiceAiAgentLanguage?: string;
  voiceAiAgentVoiceConfig?: any;

  // SaaS Portal Configuration
  portalMode?: string; // Portal mode: BASIC, PROFESSIONAL, SAAS
  characterName?: string; // Optional character name for SaaS branding
  freeTrialEnabled?: boolean; // Enable free trial button on landing page
  saasOnboardingEnabled?: boolean; // Enable SaaS onboarding flow
  autoDeployEnabled?: boolean; // Enable auto-deployment for AI Receptionist SaaS
  freeAiCredits?: number; // Free AI credits for new customers
  pricingModel?: string; // 'subscription' or 'payasyougo'
  payAsYouGoRate?: number; // Rate per minute for pay-as-you-go model

  // Enhanced Landing Page Configuration
  supportEmail?: string;
  companyAddress?: string;
  companyPhone?: string;
  privacyPolicyUrl?: string;
  termsOfServiceUrl?: string;
  statusPageUrl?: string;

  // Social Media Links
  twitterUrl?: string;
  linkedinUrl?: string;
  facebookUrl?: string;
  instagramUrl?: string;

  // Landing Page Content
  testimonials?: string; // JSON string of testimonials array
  faqs?: string; // JSON string of FAQs array
  features?: string; // JSON string of enhanced features array
  trustIndicators?: string; // JSON string of trust indicators array
  moreTestimonialsUrl?: string; // URL for "More Testimonials" link

  // Footer Section Controls
  showQuickLinks?: boolean;
  showResources?: boolean;
  showNewsletter?: boolean;
  showLegal?: boolean;
  showSocialMedia?: boolean;
  showContactInfo?: boolean;

  // AI Translation System
  translatedTexts?: Record<string, any>; // JSON object storing translations for all languages
  translationEnabled?: boolean;
}

// Default branding values when partner branding is not available
export const defaultBranding = {
  primaryColor: '#6366f1', // Indigo
  secondaryColor: '#8b5cf6', // Violet
  fontFamily: 'Inter',
  portalTitle: 'Knotie AI Pro',
  portalSlogan: 'Experience the future of AI-powered voice conversations',
  themePreference: PortalTheme.MODERN,
  customerPortalEnabled: true,
  enableCustomerSignup: false,
  portalMode: 'BASIC'
};

/**
 * Cache utility functions
 */
const getCacheKey = (subdomain?: string) => {
  return subdomain ? `${CACHE_KEY}_${subdomain}` : CACHE_KEY;
};

const isValidCache = (timestamp: number): boolean => {
  return Date.now() - timestamp < CACHE_DURATION;
};

const getFromLocalStorage = (subdomain?: string): PartnerBranding | null => {
  try {
    const cacheKey = getCacheKey(subdomain);
    const cached = localStorage.getItem(cacheKey);
    if (cached) {
      const { data, timestamp } = JSON.parse(cached);
      if (isValidCache(timestamp)) {
        return data;
      } else {
        // Remove expired cache
        localStorage.removeItem(cacheKey);
      }
    }
  } catch (error) {
    logger.warn('Failed to read from localStorage cache', {
      operation: 'partner_branding_cache_read',
      error: error instanceof Error ? error.message : String(error)
    });
  }
  return null;
};

const saveToLocalStorage = (data: PartnerBranding, subdomain?: string): void => {
  try {
    const cacheKey = getCacheKey(subdomain);
    const cacheData = {
      data,
      timestamp: Date.now()
    };
    localStorage.setItem(cacheKey, JSON.stringify(cacheData));
  } catch (error) {
    logger.warn('Failed to save to localStorage cache', {
      operation: 'partner_branding_cache_save',
      error: error instanceof Error ? error.message : String(error)
    });
  }
};

const getFromMemoryCache = (subdomain?: string): PartnerBranding | null => {
  if (memoryCache &&
      isValidCache(memoryCache.timestamp) &&
      memoryCache.subdomain === subdomain) {
    return memoryCache.data;
  }
  return null;
};

const saveToMemoryCache = (data: PartnerBranding, subdomain?: string): void => {
  memoryCache = {
    data,
    timestamp: Date.now(),
    subdomain
  };
};

/**
 * Clear all cached branding data
 */
export const clearBrandingCache = (subdomain?: string): void => {
  // Clear memory cache
  if (!subdomain || (memoryCache && memoryCache.subdomain === subdomain)) {
    memoryCache = null;
    logger.info('Cleared memory cache', {
      operation: 'partner_branding_cache_clear'
    });
  }

  // Clear localStorage cache
  try {
    if (subdomain) {
      const cacheKey = getCacheKey(subdomain);
      localStorage.removeItem(cacheKey);
      logger.info('Cleared localStorage cache for subdomain', {
        operation: 'partner_branding_cache_clear',
        subdomain
      });
    } else {
      // Clear all branding caches
      const keys = Object.keys(localStorage);
      keys.forEach(key => {
        if (key.startsWith(CACHE_KEY)) {
          localStorage.removeItem(key);
        }
      });
      logger.info('Cleared all localStorage branding caches', {
        operation: 'partner_branding_cache_clear'
      });
    }
  } catch (error) {
    logger.warn('Failed to clear localStorage cache', {
      operation: 'partner_branding_cache_clear',
      error: error instanceof Error ? error.message : String(error)
    });
  }
};

/**
 * Force refresh branding data by clearing cache and fetching fresh data
 * This should be called after branding updates
 */
export const refreshBrandingData = async (subdomain?: string): Promise<PartnerBranding | null> => {
  logger.info('Force refreshing branding data', {
    operation: 'partner_branding_refresh',
    subdomain
  });
  clearBrandingCache(subdomain);
  return await fetchPartnerBranding();
};

/**
 * Fetches partner branding details from the API
 * @returns Promise<PartnerBranding | null>
 */
export const fetchPartnerBranding = async (): Promise<PartnerBranding | null> => {
  try {
    // First extract subdomain if available
    let subdomain = null;
    let isCustomDomain = false;

    // Check if we're on a white-label domain
    const hostname = window.location.hostname;

    // Try to extract subdomain from hostname
    if (hostname.includes('.knotie-ai.pro') && !hostname.startsWith('www.')) {
      subdomain = hostname.split('.')[0];
    } else if (hostname.includes('.lvh.me')) {
      subdomain = hostname.split('.')[0];
    } else if (hostname !== 'localhost' && hostname !== '127.0.0.1' && !hostname.startsWith('www.')) {
      // This is likely a custom domain
      isCustomDomain = true;
      subdomain = hostname; // Use full hostname for custom domains
    }

    // Also check URL parameters
    if (!subdomain && typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search);
      const paramSubdomain = urlParams.get('subdomain');
      if (paramSubdomain) {
        subdomain = paramSubdomain;
      }
    }

    // Check memory cache first
    const cachedFromMemory = getFromMemoryCache(subdomain || undefined);
    if (cachedFromMemory) {
      return cachedFromMemory;
    }

    // Check localStorage cache
    const cachedFromStorage = getFromLocalStorage(subdomain || undefined);
    if (cachedFromStorage) {
      // Also save to memory cache for faster access
      saveToMemoryCache(cachedFromStorage, subdomain || undefined);
      return cachedFromStorage;
    }

    logger.info('No cache found, fetching from API', {
      operation: 'partner_branding_fetch'
    });

    // If we have a subdomain, try the appropriate API endpoint
    if (subdomain) {
      logger.info('Trying API for subdomain', {
        operation: 'partner_branding_fetch',
        subdomain,
        isCustomDomain
      });
      try {
        // Use different API endpoints for subdomains vs custom domains
        const apiEndpoint = isCustomDomain
          ? `/api/whitelabel/branding/domain/${subdomain}`
          : `/api/whitelabel/branding/${subdomain}`;

        logger.info('Using API endpoint', {
          operation: 'partner_branding_fetch',
          apiEndpoint
        });
        const response = await fetch(apiEndpoint, {
          // Add cache busting to prevent stale responses
          headers: { 'Cache-Control': 'no-cache' }
        });

        if (response.ok) {
          const data = await response.json();
          logger.info('Successfully fetched branding from subdomain API', {
            operation: 'partner_branding_fetch',
            hasData: !!data,
            showQuickLinks: data.showQuickLinks,
            showSocialMedia: data.showSocialMedia,
            hasTwitterUrl: !!data.twitterUrl,
            hasLinkedinUrl: !!data.linkedinUrl
          });

          // Handle both response formats (nested under 'partner' or direct)
          const partnerData = data.partner || data;
          logger.info('Footer controls in processed partnerData', {
            operation: 'partner_branding_fetch',
            showQuickLinks: partnerData.showQuickLinks,
            showSocialMedia: partnerData.showSocialMedia,
            hasTwitterUrl: !!partnerData.twitterUrl,
            hasLinkedinUrl: !!partnerData.linkedinUrl
          });

          if (partnerData && partnerData.businessName) {
            logger.info('Returning partner data with businessName', {
              operation: 'partner_branding_fetch',
              businessName: partnerData.businessName
            });
            // Cache the successful response
            saveToMemoryCache(partnerData, subdomain || undefined);
            saveToLocalStorage(partnerData, subdomain || undefined);
            return partnerData;
          } else {
            logger.warn('Partner data missing businessName', {
              operation: 'partner_branding_fetch',
              hasPartnerData: !!partnerData
            });
          }
        } else {
          logger.warn('Response not ok from subdomain API', {
            operation: 'partner_branding_fetch',
            status: response.status,
            statusText: response.statusText
          });
        }
      } catch (error) {
        logger.error('Error fetching from subdomain API', error as Error, {
          operation: 'partner_branding_fetch'
        });
      }
    }

    // Fallback: try the generic API which should work for both subdomains and custom domains
    // This relies on the middleware setting the correct x-partner-id header
    if (process.env.ENABLE_TRACE_LOGS === 'true') {
      logger.info('Trying generic whitelabel branding API as fallback', {
        operation: 'partner_branding_fetch'
      });
    }
    try {
      const response = await fetch('/api/whitelabel/branding', {
        // Add cache busting to prevent stale responses
        headers: { 'Cache-Control': 'no-cache' }
      });

      if (response.ok) {
        const data = await response.json();
        logger.info('Successfully fetched branding from generic API', {
          operation: 'partner_branding_fetch',
          hasData: !!data
        });

        // Handle both response formats (nested under 'partner' or direct)
        const partnerData = data.partner || data;

        if (partnerData && partnerData.businessName) {
          // Cache the successful response
          saveToMemoryCache(partnerData, subdomain || undefined);
          saveToLocalStorage(partnerData, subdomain || undefined);
          return partnerData;
        }
      }
    } catch (error) {
      logger.error('Error fetching from generic API', error as Error, {
        operation: 'partner_branding_fetch'
      });
    }

    // If generic API failed and we have a subdomain, try the appropriate API
    if (subdomain) {
      logger.info('Falling back to API for subdomain', {
        operation: 'partner_branding_fetch',
        subdomain,
        isCustomDomain
      });
      try {
        // Use different API endpoints for subdomains vs custom domains
        const apiEndpoint = isCustomDomain
          ? `/api/whitelabel/branding/domain/${subdomain}`
          : `/api/whitelabel/branding/${subdomain}`;

        logger.info('Using fallback API endpoint', {
          operation: 'partner_branding_fetch',
          apiEndpoint
        });
        const response = await fetch(apiEndpoint, {
          headers: { 'Cache-Control': 'no-cache' }
        });

        if (response.ok) {
          const data = await response.json();
          logger.info('Fetched partner branding from subdomain API', {
            operation: 'partner_branding_fetch',
            hasData: !!data
          });
          // Cache the successful response
          if (data && data.businessName) {
            saveToMemoryCache(data, subdomain || undefined);
            saveToLocalStorage(data, subdomain || undefined);
          }
          return data;
        }
        logger.error('Failed to fetch branding for subdomain', new Error('Fetch failed'), {
          operation: 'partner_branding_fetch',
          subdomain
        });
      } catch (error) {
        logger.error('Error fetching from subdomain API', error as Error, {
          operation: 'partner_branding_fetch'
        });
      }
    }

    // Fallback to the regular customer partner-details endpoint
    const response = await fetch('/api/customer/partner-details');
    if (!response.ok) {
      logger.error('Failed to fetch partner details', new Error('Fetch failed'), {
        operation: 'partner_branding_fetch',
        status: response.status
      });
      return null;
    }
    const data = await response.json();
    return data;
  } catch (error) {
    logger.error('Error fetching partner details', error as Error, {
      operation: 'partner_branding_fetch'
    });
    return null;
  }
};

/**
 * Gets partner branding with fallbacks to default values
 * @param partner The partner branding object (can be null)
 * @returns An object with all branding values, using defaults where partner values are not available
 */
export const getPartnerBranding = (partner: PartnerBranding | null): PartnerBrandingType => {
  // Log the partner data for debugging (only once to avoid spam)
  // Debug logging removed for production

  const branding: PartnerBrandingType = {
    id: partner?.id || 'default',
    businessName: partner?.businessName || 'Knotie AI',
    logo: partner?.logo || undefined,
    logoSize: partner?.logoSize || 'medium',
    favicon: partner?.favicon || undefined,
    primaryColor: partner?.primaryColor || defaultBranding.primaryColor,
    secondaryColor: partner?.secondaryColor || defaultBranding.secondaryColor,
    fontFamily: partner?.fontFamily || defaultBranding.fontFamily,
    portalTitle: partner?.portalTitle || (partner ? `${partner.businessName} AI Portal` : defaultBranding.portalTitle),
    portalSlogan: partner?.portalSlogan || defaultBranding.portalSlogan,
    email: partner?.email,
    customerPortalEnabled: partner?.customerPortalEnabled !== undefined ? partner.customerPortalEnabled : defaultBranding.customerPortalEnabled,
    enableCustomerSignup: partner?.enableCustomerSignup === true,
    themePreference: (partner?.themePreference as PortalTheme) || defaultBranding.themePreference,
    voiceAiAgentEnabled: partner?.voiceAiAgentEnabled === true,
    voiceAiAgentPricingNote: partner?.voiceAiAgentPricingNote || '',
    voiceAiAgentSpecialOffer: partner?.voiceAiAgentSpecialOffer || '',
    voiceAiAgentName: partner?.voiceAiAgentName || 'Knotie',
    voiceAiAgentVoiceType: partner?.voiceAiAgentVoiceType || 'female',

    // SaaS Portal Configuration
    portalMode: partner?.portalMode || 'BASIC',
    characterName: partner?.characterName,
    freeTrialEnabled: partner?.freeTrialEnabled === true,
    saasOnboardingEnabled: partner?.saasOnboardingEnabled === true,
    freeAiCredits: partner?.freeAiCredits || 50,
    pricingModel: partner?.pricingModel || 'subscription',
    payAsYouGoRate: partner?.payAsYouGoRate || 0.10,

    // Enhanced Landing Page Configuration
    supportEmail: partner?.supportEmail,
    companyAddress: partner?.companyAddress,
    companyPhone: partner?.companyPhone,
    privacyPolicyUrl: partner?.privacyPolicyUrl,
    termsOfServiceUrl: partner?.termsOfServiceUrl,
    statusPageUrl: partner?.statusPageUrl,

    // Social Media Links
    twitterUrl: partner?.twitterUrl,
    linkedinUrl: partner?.linkedinUrl,
    facebookUrl: partner?.facebookUrl,
    instagramUrl: partner?.instagramUrl,

    // Landing Page Content
    testimonials: partner?.testimonials,
    moreTestimonialsUrl: partner?.moreTestimonialsUrl,
    faqs: partner?.faqs,
    features: partner?.features,
    trustIndicators: partner?.trustIndicators,

    // Footer Section Controls
    showQuickLinks: partner?.showQuickLinks,
    showResources: partner?.showResources,
    showNewsletter: partner?.showNewsletter,
    showLegal: partner?.showLegal,
    showSocialMedia: partner?.showSocialMedia,
    showContactInfo: partner?.showContactInfo,

    // AI Translation System
    translatedTexts: (partner as any)?.translatedTexts,
    translationEnabled: (partner as any)?.translationEnabled
  } as PartnerBrandingType & { translatedTexts?: Record<string, any>; translationEnabled?: boolean };

  // Debug logging removed for production

  return branding;
};

/**
 * Generates CSS styles for gradient text based on partner colors
 * @param primaryColor Primary color
 * @param secondaryColor Secondary color
 * @returns CSS style object for gradient text
 */
export const getPartnerGradientTextStyles = (primaryColor: string, secondaryColor: string) => {
  return {
    backgroundImage: `linear-gradient(to right, ${primaryColor}, ${secondaryColor})`,
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
    backgroundClip: 'text',
    color: 'transparent'
  };
};

/**
 * Generates CSS styles for gradient backgrounds based on partner colors
 * @param primaryColor Primary color
 * @param secondaryColor Secondary color
 * @returns CSS style object for gradient background
 */
export const getPartnerGradientBackgroundStyles = (primaryColor: string, secondaryColor: string) => {
  return {
    background: `linear-gradient(to right, ${primaryColor}, ${secondaryColor})`,
    boxShadow: `0 4px 14px ${hexToRgba(primaryColor, 0.25)}`
  };
};

/**
 * Generates CSS styles for buttons with partner branding
 * @param primaryColor Primary color
 * @param secondaryColor Secondary color
 * @returns CSS style object for buttons
 */
export const getPartnerButtonStyles = (primaryColor: string, secondaryColor: string) => {
  return {
    background: `linear-gradient(to right, ${primaryColor}, ${secondaryColor})`,
    boxShadow: `0 4px 14px ${hexToRgba(primaryColor, 0.25)}`,
    color: 'white'
  };
};

/**
 * Generates CSS styles for borders with partner branding
 * @param primaryColor Primary color
 * @param opacity Opacity of the border (default: 0.3)
 * @returns CSS style object for borders
 */
export const getPartnerBorderStyles = (primaryColor: string, opacity = 0.3) => {
  return {
    borderColor: hexToRgba(primaryColor, opacity),
    borderWidth: '1px'
  };
};

/**
 * React hook to fetch and use partner branding
 * @returns An object containing partner branding state and utility functions
 */
export const usePartnerBranding = () => {
  const [partner, setPartner] = React.useState<PartnerBranding | null>(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    let isMounted = true;
    let timeoutId: NodeJS.Timeout;

    const getPartnerDetails = async () => {
      try {
        logger.info('Starting to fetch partner branding', {
          operation: 'use_partner_branding_hook'
        });
        const data = await fetchPartnerBranding();

        if (isMounted) {
          if (data) {
            logger.info('Successfully received partner data', {
              operation: 'use_partner_branding_hook',
              businessName: data.businessName,
              portalMode: data.portalMode,
              saasOnboardingEnabled: data.saasOnboardingEnabled
            });
            setPartner(data);
            setLoading(false);
            // Clear timeout since we got valid data
            clearTimeout(timeoutId);
          } else {
            logger.warn('No partner branding data received, using defaults', {
              operation: 'use_partner_branding_hook'
            });
            setPartner({
              id: 'default',
              businessName: 'Knotie AI',
              primaryColor: '#3B82F6',
              secondaryColor: '#10B981',
              fontFamily: 'Inter',
              portalTitle: 'Voice AI Portal',
              portalSlogan: 'Powered by advanced voice AI technology',
              customerPortalEnabled: true,
              enableCustomerSignup: false,
              themePreference: PortalTheme.MODERN,
              logo: null,
              logoSize: 'medium',
              favicon: null,
              voiceAiAgentEnabled: false,
              voiceAiAgentPricingNote: '',
              voiceAiAgentSpecialOffer: '',
              voiceAiAgentName: 'Knotie',
              voiceAiAgentVoiceType: 'female',
              voiceAiAgentLanguage: 'en',
              voiceAiAgentVoiceConfig: null,
              translatedTexts: undefined,
              translationEnabled: false,
              portalMode: 'BASIC',
              characterName: undefined,
              freeTrialEnabled: false,
              saasOnboardingEnabled: false,
              freeAiCredits: 50,
              pricingModel: 'subscription',
              payAsYouGoRate: 0.10,
              supportEmail: undefined,
              companyAddress: undefined,
              companyPhone: undefined,
              privacyPolicyUrl: undefined,
              termsOfServiceUrl: undefined,
              statusPageUrl: undefined,
              twitterUrl: undefined,
              linkedinUrl: undefined,
              facebookUrl: undefined,
              instagramUrl: undefined,
              testimonials: undefined,
              faqs: undefined,
              features: undefined,
              trustIndicators: undefined
            });
            setLoading(false);
          }
        }
      } catch (error) {
        logger.error('Error fetching partner branding', error as Error, {
          operation: 'use_partner_branding_hook'
        });

        if (isMounted) {
          // Set default partner data to ensure we have something to display
          logger.info('Setting fallback defaults due to error', {
            operation: 'use_partner_branding_hook'
          });
          setPartner({
            businessName: 'Knotie AI',
            primaryColor: '#3B82F6',
            secondaryColor: '#10B981',
            fontFamily: 'Inter',
            portalTitle: 'Voice AI Portal',
            portalSlogan: 'Powered by advanced voice AI technology',
            customerPortalEnabled: true,
            enableCustomerSignup: false,
            themePreference: PortalTheme.MODERN,
            logo: null,
            logoSize: 'medium',
            favicon: null,
            voiceAiAgentEnabled: false,
            voiceAiAgentPricingNote: '',
            voiceAiAgentSpecialOffer: '',
            voiceAiAgentLanguage: 'en',
            voiceAiAgentVoiceConfig: null,
            portalMode: 'BASIC',
            characterName: undefined,
            freeTrialEnabled: false,
            saasOnboardingEnabled: false,
            freeAiCredits: 50,
            pricingModel: 'subscription',
            payAsYouGoRate: 0.10,
            translatedTexts: undefined,
            translationEnabled: false
          });
          setLoading(false);
        }
      }
    };

    getPartnerDetails();

    // Force exit loading state after a maximum timeout (increased to 10 seconds for better reliability)
    timeoutId = setTimeout(() => {
      if (isMounted) {
        logger.warn('usePartnerBranding loading timed out after 10 seconds', {
          operation: 'use_partner_branding_hook'
        });
        setLoading(false);

        // Only set default data if we don't have any partner data at all
        // This prevents overriding valid data that may have been loaded
        setPartner(prev => {
          if (prev && prev.businessName) {
            logger.info('Timeout reached but we have valid partner data, keeping it', {
              operation: 'use_partner_branding_hook',
              businessName: prev.businessName
            });
            return prev; // Keep existing valid data
          }

          logger.warn('Timeout reached and no valid partner data, using defaults', {
            operation: 'use_partner_branding_hook'
          });
          return {
            businessName: 'Knotie AI',
            primaryColor: '#3B82F6',
            secondaryColor: '#10B981',
            fontFamily: 'Inter',
            portalTitle: 'Voice AI Portal',
            portalSlogan: 'Powered by advanced voice AI technology',
            customerPortalEnabled: true,
            enableCustomerSignup: false,
            themePreference: PortalTheme.MODERN,
            logo: null,
            logoSize: 'medium',
            favicon: null,
            voiceAiAgentEnabled: false,
            voiceAiAgentPricingNote: '',
            voiceAiAgentSpecialOffer: '',
            voiceAiAgentLanguage: 'en',
            voiceAiAgentVoiceConfig: null,
            portalMode: 'BASIC',
            characterName: undefined,
            freeTrialEnabled: false,
            saasOnboardingEnabled: false,
            freeAiCredits: 50,
            pricingModel: 'subscription',
            payAsYouGoRate: 0.10,
            translatedTexts: undefined,
            translationEnabled: false
          };
        });
      }
    }, 10000);

    return () => {
      isMounted = false;
      clearTimeout(timeoutId);
    };
  }, []); // Empty dependency array - only run once on mount

  // Memoize the branding object to prevent unnecessary re-renders
  const branding = React.useMemo(() => getPartnerBranding(partner), [partner]);

  // Memoize the utility functions to prevent recreation on every render
  const getGradientTextStyles = React.useCallback(() =>
    getPartnerGradientTextStyles(branding.primaryColor || '#3B82F6', branding.secondaryColor || '#10B981'),
    [branding.primaryColor, branding.secondaryColor]
  );

  const getGradientBackgroundStyles = React.useCallback(() =>
    getPartnerGradientBackgroundStyles(branding.primaryColor || '#3B82F6', branding.secondaryColor || '#10B981'),
    [branding.primaryColor, branding.secondaryColor]
  );

  const getButtonStyles = React.useCallback(() =>
    getPartnerButtonStyles(branding.primaryColor || '#3B82F6', branding.secondaryColor || '#10B981'),
    [branding.primaryColor, branding.secondaryColor]
  );

  const getBorderStyles = React.useCallback((opacity?: number) =>
    getPartnerBorderStyles(branding.primaryColor || '#3B82F6', opacity),
    [branding.primaryColor]
  );

  // Memoize the return object to prevent unnecessary re-renders
  return React.useMemo(() => ({
    partner,
    loading,
    branding,
    getGradientTextStyles,
    getGradientBackgroundStyles,
    getButtonStyles,
    getBorderStyles
  }), [partner, loading, branding, getGradientTextStyles, getGradientBackgroundStyles, getButtonStyles, getBorderStyles]);
};
