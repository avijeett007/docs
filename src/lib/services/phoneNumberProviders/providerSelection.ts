import { logger } from '@/lib/logger';

export type SupportedProvider = 'twilio' | 'telnyx';

export interface ProviderConfig {
  provider: SupportedProvider;
  priority: number;
  countries?: string[]; // ISO 2-letter country codes
  regions?: string[]; // Regions like 'US', 'EU', 'APAC'
  numberTypes?: ('local' | 'mobile' | 'tollfree')[];
}

/**
 * Default provider configurations
 * Can be overridden by environment variables
 */
const DEFAULT_PROVIDER_CONFIGS: ProviderConfig[] = [
  {
    provider: 'twilio',
    priority: 1,
    countries: ['US', 'CA', 'GB', 'AU'], // Primary Twilio markets
    numberTypes: ['local', 'mobile', 'tollfree']
  },
  {
    provider: 'telnyx',
    priority: 2,
    countries: ['DE', 'FR', 'IT', 'ES', 'NL'], // European markets for Telnyx
    numberTypes: ['local', 'mobile', 'tollfree']
  }
];

/**
 * Parse provider configuration from environment variables
 * Supports two formats:
 * 1. JSON format: PHONE_PROVIDER_CONFIG={"US":"twilio","GB":"telnyx","DE":"telnyx"}
 * 2. Legacy format: PHONE_PROVIDER_CONFIG=twilio:US,CA,GB:1;telnyx:DE,FR,IT:2
 */
function parseProviderConfigFromEnv(): ProviderConfig[] {
  const configString = process.env.PHONE_PROVIDER_CONFIG;

  if (!configString) {
    logger.info('No PHONE_PROVIDER_CONFIG found, using default configuration');
    return DEFAULT_PROVIDER_CONFIGS;
  }

  try {
    // Try to parse as JSON first (new format)
    if (configString.trim().startsWith('{')) {
      const countryToProvider = JSON.parse(configString);
      const configs: ProviderConfig[] = [];

      // Group countries by provider
      const providerToCountries: { [key: string]: string[] } = {};

      for (const [country, provider] of Object.entries(countryToProvider)) {
        if (!['twilio', 'telnyx'].includes(provider as string)) {
          logger.warn(`Invalid provider in JSON config: ${provider} for country ${country}`);
          continue;
        }

        if (!providerToCountries[provider as string]) {
          providerToCountries[provider as string] = [];
        }
        providerToCountries[provider as string].push(country.toUpperCase());
      }

      // Create provider configs
      let priority = 1;
      for (const [provider, countries] of Object.entries(providerToCountries)) {
        configs.push({
          provider: provider as SupportedProvider,
          priority: priority++,
          countries: countries,
          numberTypes: ['local', 'mobile', 'tollfree']
        });
      }

      if (configs.length === 0) {
        logger.warn('No valid provider configs found in JSON format, using defaults');
        return DEFAULT_PROVIDER_CONFIGS;
      }

      logger.info(`Loaded ${configs.length} provider configurations from JSON format`, {
        operation: 'provider_config_parse',
        providers: configs.map(c => ({ provider: c.provider, countries: c.countries }))
      });
      return configs;
    }

    // Fall back to legacy format parsing
    const configs: ProviderConfig[] = [];
    const providerStrings = configString.split(';');

    for (const providerString of providerStrings) {
      const [provider, countries, priority] = providerString.split(':');

      if (!provider || !['twilio', 'telnyx'].includes(provider)) {
        logger.warn(`Invalid provider in legacy config: ${provider}`);
        continue;
      }

      configs.push({
        provider: provider as SupportedProvider,
        priority: parseInt(priority) || 1,
        countries: countries ? countries.split(',').map(c => c.trim().toUpperCase()) : undefined,
        numberTypes: ['local', 'mobile', 'tollfree'] // Default to all types
      });
    }

    if (configs.length === 0) {
      logger.warn('No valid provider configs found in legacy format, using defaults');
      return DEFAULT_PROVIDER_CONFIGS;
    }

    logger.info(`Loaded ${configs.length} provider configurations from legacy format`);
    return configs;
  } catch (error) {
    logger.error('Failed to parse provider configuration from environment', error as Error);
    return DEFAULT_PROVIDER_CONFIGS;
  }
}

/**
 * Get the preferred provider for a specific country and number type
 */
export function getPreferredProvider(
  countryCode: string,
  numberType: 'local' | 'mobile' | 'tollfree' = 'local'
): SupportedProvider {
  const configs = parseProviderConfigFromEnv();
  const upperCountryCode = countryCode.toUpperCase();

  // Find providers that support this country and number type
  const supportedProviders = configs.filter(config => {
    const supportsCountry = !config.countries || config.countries.includes(upperCountryCode);
    const supportsNumberType = !config.numberTypes || config.numberTypes.includes(numberType);
    return supportsCountry && supportsNumberType;
  });

  if (supportedProviders.length === 0) {
    logger.warn(`No providers configured for country ${countryCode} and type ${numberType}, defaulting to Twilio`);
    return 'twilio';
  }

  // Sort by priority (lower number = higher priority)
  supportedProviders.sort((a, b) => a.priority - b.priority);
  
  const selectedProvider = supportedProviders[0].provider;
  logger.info(`Selected provider ${selectedProvider} for ${countryCode} ${numberType} numbers`);
  
  return selectedProvider;
}

/**
 * Get all supported providers for a country
 */
export function getSupportedProviders(countryCode: string): SupportedProvider[] {
  const configs = parseProviderConfigFromEnv();
  const upperCountryCode = countryCode.toUpperCase();

  return configs
    .filter(config => !config.countries || config.countries.includes(upperCountryCode))
    .sort((a, b) => a.priority - b.priority)
    .map(config => config.provider);
}

/**
 * Check if a provider supports a specific country and number type
 */
export function isProviderSupported(
  provider: SupportedProvider,
  countryCode: string,
  numberType: 'local' | 'mobile' | 'tollfree' = 'local'
): boolean {
  const configs = parseProviderConfigFromEnv();
  const upperCountryCode = countryCode.toUpperCase();

  return configs.some(config => {
    if (config.provider !== provider) return false;
    
    const supportsCountry = !config.countries || config.countries.includes(upperCountryCode);
    const supportsNumberType = !config.numberTypes || config.numberTypes.includes(numberType);
    
    return supportsCountry && supportsNumberType;
  });
}

/**
 * Get provider configuration for debugging/admin purposes
 */
export function getProviderConfiguration(): ProviderConfig[] {
  return parseProviderConfigFromEnv();
}
