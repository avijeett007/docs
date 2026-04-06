/**
 * Feature Flags Configuration
 *
 * This file defines feature flags that can be toggled to enable/disable
 * specific features in the application. Useful for testing new features
 * in production without exposing them to all users.
 *
 * Note: Whitelabel features were introduced on 2025-04-18 and are now
 * enabled by default. Set environment variables to 'false' to disable.
 */

// Feature flags object
export const featureFlags = {
  // White-label settings features
  whitelabel: {
    // Master toggle for all white-label features - default to true, can be disabled via env var
    enabled: process.env.NEXT_PUBLIC_FEATURE_WHITELABEL !== 'false',

    // Sub-features within white-label - default to true, can be disabled via env var
    themeSelector: process.env.NEXT_PUBLIC_FEATURE_WHITELABEL_THEMES !== 'false',
    customization: process.env.NEXT_PUBLIC_FEATURE_WHITELABEL_CUSTOMIZATION !== 'false',
    subdomains: process.env.NEXT_PUBLIC_FEATURE_WHITELABEL_SUBDOMAINS !== 'false',

    // Always enable in development for easier testing
    enabledInDevelopment: true,
  },

  // Live stats and notifications features
  liveStats: {
    // Enable live member join notifications popup
    memberNotifications: process.env.NEXT_PUBLIC_FEATURE_LIVE_MEMBER_NOTIFICATIONS === 'true',

    // Disable in development by default for performance testing
    enabledInDevelopment: false,
  },

  // Mission Control MFA features
  missionControlMFA: {
    // Enable MFA setup for admin users (client-side feature flag)
    enabled: process.env.NEXT_PUBLIC_FEATURE_ADMIN_MFA === 'true',

    // Enforce MFA for all admin logins (SERVER-ONLY security flag)
    // Note: This uses a server-only env var for security - not exposed to browser
    enforced: process.env.FEATURE_ADMIN_MFA_ENFORCED === 'true',

    // Enable in development for testing
    enabledInDevelopment: true,
  },

  // Provider Phone Import features (Retell, VAPI, ElevenLabs provider-purchased numbers)
  providerPhoneImport: {
    // Enable importing phone numbers purchased directly from agent providers (e.g., Retell)
    // These numbers are provider-locked and can only be used with agents from the same provider account
    enabled: process.env.NEXT_PUBLIC_FEATURE_PROVIDER_PHONE_IMPORT === 'true',

    // Enable in development for testing
    enabledInDevelopment: true,
  }
};

/**
 * Check if a specific feature is enabled
 */
export function isFeatureEnabled(featurePath: string): boolean {
  // Navigate the featureFlags object based on the provided path
  const segments = featurePath.split('.');
  let current: any = featureFlags;

  for (const segment of segments) {
    if (!current || typeof current !== 'object') {
      return false;
    }
    current = current[segment];
  }

  const result = !!current;

  // Special handling for development - but only for the 'enabled' flag, not 'enforced'
  if (process.env.NODE_ENV === 'development' && featurePath.endsWith('.enabled')) {
    const rootSegment = segments[0];
    const rootFeature = featureFlags[rootSegment as keyof typeof featureFlags];
    if (rootFeature && 'enabledInDevelopment' in rootFeature && rootFeature.enabledInDevelopment === true) {
      return true;
    }
  }

  return result;
}
