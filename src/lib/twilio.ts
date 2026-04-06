import { logger } from './logger';
// Note: obfuscatePhoneNumber available for future phone number logging needs
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { obfuscatePhoneNumber } from './pii-obfuscation';

// Twilio configuration interface
export interface TwilioConfig {
  accountSid: string;
  authToken: string;
  applicationSid?: string;
}

// Phone number search parameters
export interface PhoneNumberSearchParams {
  countryCode: string;
  areaCode?: string;
  contains?: string;
  smsEnabled?: boolean;
  voiceEnabled?: boolean;
  mmsEnabled?: boolean;
  faxEnabled?: boolean;
  beta?: boolean;
  nearNumber?: string;
  nearLatLong?: string;
  distance?: number;
  inPostalCode?: string;
  inRegion?: string;
  inRateCenter?: string;
  inLata?: string;
  inLocality?: string;
  limit?: number;
  excludeAllAddressRequired?: boolean;
  excludeLocalAddressRequired?: boolean;
  excludeForeignAddressRequired?: boolean;
}

// Phone number search result
export interface AvailablePhoneNumber {
  friendlyName: string;
  phoneNumber: string;
  lata?: string;
  locality?: string;
  rateCenter?: string;
  latitude?: number;
  longitude?: number;
  region?: string;
  postalCode?: string;
  isoCountry: string;
  addressRequirements: string;
  beta: boolean;
  capabilities: {
    voice: boolean;
    SMS: boolean;
    MMS: boolean;
    fax: boolean;
  };
}

// Phone number purchase options
export interface PhoneNumberPurchaseOptions {
  phoneNumber: string;
  friendlyName?: string;
  voiceUrl?: string;
  voiceMethod?: 'GET' | 'POST';
  voiceFallbackUrl?: string;
  voiceFallbackMethod?: 'GET' | 'POST';
  statusCallback?: string;
  statusCallbackMethod?: 'GET' | 'POST';
  voiceCallerIdLookup?: boolean;
  smsUrl?: string;
  smsMethod?: 'GET' | 'POST';
  smsFallbackUrl?: string;
  smsFallbackMethod?: 'GET' | 'POST';
  addressSid?: string;
  emergencyStatus?: 'Active' | 'Inactive';
  emergencyAddressSid?: string;
  trunkSid?: string;
  voiceReceiveMode?: 'voice' | 'fax';
  identitySid?: string;
  bundleSid?: string;
}

// Since we're not using the Twilio SDK directly, we'll use their REST API
export class TwilioClient {
  private accountSid: string;
  private authToken: string;
  private baseUrl: string;

  constructor(config: TwilioConfig) {
    this.accountSid = config.accountSid;
    this.authToken = config.authToken;
    this.baseUrl = `https://api.twilio.com/2010-04-01/Accounts/${this.accountSid}`;
  }

  private async makeRequest(
    endpoint: string,
    method: 'GET' | 'POST' | 'PUT' | 'DELETE' = 'GET',
    data?: any,
    accountSid?: string,
    apiDomain: 'api' | 'numbers' = 'api'
  ) {
    // Use provided accountSid or default to main account
    const targetAccountSid = accountSid || this.accountSid;

    // Choose the correct base URL based on API domain
    let baseUrl: string;
    if (apiDomain === 'numbers') {
      baseUrl = `https://numbers.twilio.com`;
    } else {
      baseUrl = `https://api.twilio.com/2010-04-01/Accounts/${targetAccountSid}`;
    }

    const url = `${baseUrl}${endpoint}`;

    const headers = {
      'Authorization': 'Basic ' + Buffer.from(`${this.accountSid}:${this.authToken}`).toString('base64'),
      'Content-Type': 'application/x-www-form-urlencoded',
    };

    const options: RequestInit = {
      method,
      headers,
    };

    if (data && method !== 'GET') {
      options.body = new URLSearchParams(data).toString();
    }

    const response = await fetch(url, options);

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Twilio API Error: ${error.message || response.statusText}`);
    }

    return response.json();
  }

  // Get all supported countries from Twilio
  async getSupportedCountries(): Promise<any[]> {
    try {
      const result = await this.makeRequest('/AvailablePhoneNumbers.json');
      return result.countries || [];
    } catch (error: any) {
      logger.error('Failed to get supported countries', error as Error, {
        operation: 'twilio_countries'
      });
      return [];
    }
  }

  // Check if a country is supported by Twilio
  async isCountrySupported(countryCode: string): Promise<boolean> {
    try {
      const result = await this.makeRequest(`/AvailablePhoneNumbers/${countryCode}.json`);
      return result && result.subresource_uris && Object.keys(result.subresource_uris).length > 0;
    } catch (error: any) {
      // Log the specific error for debugging
      logger.info('Country not supported', {
        operation: 'twilio_country_support',
        countryCode,
        error: error.message
      });

      // Check if it's a 404 (not found) which means country is not supported
      if (error.message && (error.message.includes('404') || error.message.includes('not found'))) {
        return false;
      }

      // For other errors (network, auth, etc.), we should throw to handle them properly
      throw new Error(`Unable to verify country support for ${countryCode}: ${error.message}`);
    }
  }

  // Search for available phone numbers
  async searchAvailablePhoneNumbers(
    countryCode: string,
    type: 'local' | 'mobile' | 'tollfree',
    params: Partial<PhoneNumberSearchParams> = {}
  ): Promise<AvailablePhoneNumber[]> {
    // First check if the country is supported
    try {
      const isSupported = await this.isCountrySupported(countryCode);
      if (!isSupported) {
        throw new Error(`Phone numbers are not available for country code: ${countryCode}. Please select a different country.`);
      }
    } catch (error: any) {
      // If country support check fails due to network/auth issues, continue with the search
      // The actual search will provide a more specific error
      logger.warn('Country support check failed, proceeding with search', {
        operation: 'twilio_country_support',
        countryCode,
        error: error.message
      });
    }

    const queryParams = new URLSearchParams();
    
    if (params.areaCode) queryParams.append('AreaCode', params.areaCode);
    if (params.contains) queryParams.append('Contains', params.contains);
    if (params.smsEnabled !== undefined) queryParams.append('SmsEnabled', params.smsEnabled.toString());
    if (params.voiceEnabled !== undefined) queryParams.append('VoiceEnabled', params.voiceEnabled.toString());
    if (params.mmsEnabled !== undefined) queryParams.append('MmsEnabled', params.mmsEnabled.toString());
    if (params.faxEnabled !== undefined) queryParams.append('FaxEnabled', params.faxEnabled.toString());
    if (params.nearNumber) queryParams.append('NearNumber', params.nearNumber);
    if (params.nearLatLong) queryParams.append('NearLatLong', params.nearLatLong);
    if (params.distance) queryParams.append('Distance', params.distance.toString());
    if (params.inPostalCode) queryParams.append('InPostalCode', params.inPostalCode);
    if (params.inRegion) queryParams.append('InRegion', params.inRegion);
    if (params.inRateCenter) queryParams.append('InRateCenter', params.inRateCenter);
    if (params.inLata) queryParams.append('InLata', params.inLata);
    if (params.inLocality) queryParams.append('InLocality', params.inLocality);
    if (params.excludeAllAddressRequired !== undefined) {
      queryParams.append('ExcludeAllAddressRequired', params.excludeAllAddressRequired.toString());
    }
    if (params.excludeLocalAddressRequired !== undefined) {
      queryParams.append('ExcludeLocalAddressRequired', params.excludeLocalAddressRequired.toString());
    }
    if (params.excludeForeignAddressRequired !== undefined) {
      queryParams.append('ExcludeForeignAddressRequired', params.excludeForeignAddressRequired.toString());
    }

    // Country-specific type mapping and availability based on Twilio documentation
    const getAvailableTypes = (country: string) => {
      const countryConfig: Record<string, { types: string[], fallbacks: Record<string, string> }> = {
        // North America
        'US': { types: ['Local', 'TollFree'], fallbacks: { 'Mobile': 'Local' } },
        'CA': { types: ['Local', 'TollFree'], fallbacks: { 'Mobile': 'Local' } },

        // Europe - Major markets with Mobile support
        'GB': { types: ['Local', 'Mobile', 'TollFree'], fallbacks: {} },
        'AU': { types: ['Local', 'Mobile', 'TollFree'], fallbacks: {} },
        'NL': { types: ['Local', 'Mobile'], fallbacks: { 'TollFree': 'Local' } },
        'SE': { types: ['Local', 'Mobile'], fallbacks: { 'TollFree': 'Local' } },
        'NO': { types: ['Local', 'Mobile'], fallbacks: { 'TollFree': 'Local' } },
        'DK': { types: ['Local', 'Mobile'], fallbacks: { 'TollFree': 'Local' } },
        'FI': { types: ['Local', 'Mobile'], fallbacks: { 'TollFree': 'Local' } },
        'BE': { types: ['Local', 'Mobile'], fallbacks: { 'TollFree': 'Local' } },
        'CH': { types: ['Local', 'Mobile'], fallbacks: { 'TollFree': 'Local' } },
        'AT': { types: ['Local', 'Mobile'], fallbacks: { 'TollFree': 'Local' } },
        'IE': { types: ['Local', 'Mobile'], fallbacks: { 'TollFree': 'Local' } },

        // Europe - Local only markets
        'DE': { types: ['Local'], fallbacks: { 'Mobile': 'Local', 'TollFree': 'Local' } },
        'FR': { types: ['Local'], fallbacks: { 'Mobile': 'Local', 'TollFree': 'Local' } },
        'ES': { types: ['Local'], fallbacks: { 'Mobile': 'Local', 'TollFree': 'Local' } },
        'IT': { types: ['Local'], fallbacks: { 'Mobile': 'Local', 'TollFree': 'Local' } },
        'PL': { types: ['Local'], fallbacks: { 'Mobile': 'Local', 'TollFree': 'Local' } },
        'CZ': { types: ['Local'], fallbacks: { 'Mobile': 'Local', 'TollFree': 'Local' } },
        'HU': { types: ['Local'], fallbacks: { 'Mobile': 'Local', 'TollFree': 'Local' } },
        'PT': { types: ['Local'], fallbacks: { 'Mobile': 'Local', 'TollFree': 'Local' } },
        'GR': { types: ['Local'], fallbacks: { 'Mobile': 'Local', 'TollFree': 'Local' } },

        // Americas
        'MX': { types: ['Local'], fallbacks: { 'Mobile': 'Local', 'TollFree': 'Local' } },
        'BR': { types: ['Local'], fallbacks: { 'Mobile': 'Local', 'TollFree': 'Local' } },
        'AR': { types: ['Local'], fallbacks: { 'Mobile': 'Local', 'TollFree': 'Local' } },
        'CL': { types: ['Local'], fallbacks: { 'Mobile': 'Local', 'TollFree': 'Local' } },
        'CO': { types: ['Local'], fallbacks: { 'Mobile': 'Local', 'TollFree': 'Local' } },
        'PE': { types: ['Local'], fallbacks: { 'Mobile': 'Local', 'TollFree': 'Local' } },

        // Middle East & Africa
        'AE': { types: ['Local'], fallbacks: { 'Mobile': 'Local', 'TollFree': 'Local' } },
        'SA': { types: ['Local'], fallbacks: { 'Mobile': 'Local', 'TollFree': 'Local' } },
        'IL': { types: ['Local'], fallbacks: { 'Mobile': 'Local', 'TollFree': 'Local' } },
        'ZA': { types: ['Local'], fallbacks: { 'Mobile': 'Local', 'TollFree': 'Local' } },

        // Asia Pacific
        'SG': { types: ['Local'], fallbacks: { 'Mobile': 'Local', 'TollFree': 'Local' } },
        'HK': { types: ['Local'], fallbacks: { 'Mobile': 'Local', 'TollFree': 'Local' } },
        'JP': { types: ['Local'], fallbacks: { 'Mobile': 'Local', 'TollFree': 'Local' } },
        'KR': { types: ['Local'], fallbacks: { 'Mobile': 'Local', 'TollFree': 'Local' } },
        'IN': { types: ['Local'], fallbacks: { 'Mobile': 'Local', 'TollFree': 'Local' } },
        'NZ': { types: ['Local'], fallbacks: { 'Mobile': 'Local', 'TollFree': 'Local' } },
      };

      return countryConfig[country] || { types: ['Local'], fallbacks: { 'Mobile': 'Local', 'TollFree': 'Local' } };
    };

    const typeMap = {
      local: 'Local',
      mobile: 'Mobile',
      tollfree: 'TollFree'
    };

    const countryConfig = getAvailableTypes(countryCode);
    let requestedType = typeMap[type];

    // Check if the requested type is supported, use fallback if not
    if (!countryConfig.types.includes(requestedType)) {
      const fallbackType = countryConfig.fallbacks[requestedType];
      if (fallbackType) {
        logger.info('Using fallback phone number type', {
          operation: 'twilio_phone_search',
          countryCode,
          requestedType,
          fallbackType
        });
        requestedType = fallbackType;
      }
    }

    const endpoint = `/AvailablePhoneNumbers/${countryCode}/${requestedType}.json?${queryParams.toString()}`;
    logger.info('Searching phone numbers', {
      operation: 'twilio_phone_search',
      endpoint,
      accountSid: this.accountSid
    });

    try {
      logger.info('Making request to Twilio API', { operation: 'twilio_phone_search' });
      let result;

      // Special handling for US Local numbers - they often have internal server errors
      if (countryCode === 'US' && requestedType === 'Local') {
        try {
          result = await this.makeRequest(endpoint);
        } catch (error: any) {
          if (error.message?.includes('internal server error')) {
            logger.warn('US Local search failed with internal server error', {
              operation: 'twilio_phone_search',
              countryCode: 'US',
              numberType: 'local'
            });

            // If we had an area code, try without it
            if (params.areaCode) {
              logger.info('Trying without area code', {
                operation: 'twilio_phone_search',
                countryCode: 'US',
                fallbackAttempt: true
              });
              try {
                const fallbackParams = new URLSearchParams();
                if (params.contains) fallbackParams.append('Contains', params.contains);
                if (params.smsEnabled !== undefined) fallbackParams.append('SmsEnabled', params.smsEnabled.toString());
                if (params.voiceEnabled !== undefined) fallbackParams.append('VoiceEnabled', params.voiceEnabled.toString());
                if (params.mmsEnabled !== undefined) fallbackParams.append('MmsEnabled', params.mmsEnabled.toString());
                if (params.faxEnabled !== undefined) fallbackParams.append('FaxEnabled', params.faxEnabled.toString());

                const fallbackEndpoint = `/AvailablePhoneNumbers/${countryCode}/${requestedType}.json?${fallbackParams.toString()}`;
                logger.info('Trying fallback endpoint', {
                  operation: 'twilio_phone_search',
                  fallbackEndpoint
                });
                result = await this.makeRequest(fallbackEndpoint);
              } catch (fallbackError: any) {
                logger.error('Fallback also failed', fallbackError as Error, {
                  operation: 'twilio_phone_search',
                  countryCode: 'US',
                  fallbackAttempt: true
                });
                throw new Error(`TWILIO_US_LOCAL_ERROR: Something went wrong with US Local number search. This has been reported internally. Please try again later or select a different number type from the dropdown.`);
              }
            } else {
              // No area code to remove, this is a known Twilio issue
              logger.error('US Local search failed without area code - known Twilio issue', new Error('Twilio US Local Issue'), {
                operation: 'twilio_phone_search',
                countryCode: 'US',
                numberType: 'local',
                knownIssue: true
              });
              throw new Error(`TWILIO_US_LOCAL_ERROR: Something went wrong with US Local number search. This has been reported internally. Please try again later or select a different number type from the dropdown.`);
            }
          } else {
            throw error;
          }
        }
      } else {
        result = await this.makeRequest(endpoint);
      }
      logger.info('Phone number search successful', {
        operation: 'twilio_phone_search',
        numbersFound: result.available_phone_numbers?.length || 0,
        hasResult: !!result
      });

      if (!result.available_phone_numbers || result.available_phone_numbers.length === 0) {
        logger.info('No phone numbers found for the given criteria', {
          operation: 'twilio_phone_search',
          countryCode,
          requestedType
        });
        return [];
      }

      return result.available_phone_numbers.map((num: any) => ({
        phoneNumber: num.phone_number,
        friendlyName: num.friendly_name,
        locality: num.locality,
        region: num.region,
        postalCode: num.postal_code,
        isoCountry: num.iso_country,
        capabilities: formatCapabilities(num.capabilities),
      }));
    } catch (error: any) {
      logger.error('Phone number search failed', error as Error, {
        operation: 'twilio_phone_search',
        endpoint,
        accountSid: this.accountSid,
        countryCode,
        requestedType,
        error: error.message || error
      });

      // Provide more helpful error messages
      if (error.message?.includes('not found') || error.message?.includes('404')) {
        throw new Error(`Phone number type '${type}' is not available for ${countryCode}. Try a different number type or country.`);
      } else if (error.message?.includes('internal server error') || error.message?.includes('500')) {
        // Special handling for US Local numbers with tracking link
        if (countryCode === 'US' && requestedType === 'Local') {
          throw new Error(`TWILIO_US_LOCAL_ERROR: Something went wrong with US Local number search. This has been reported internally. Please try again later or select a different number type from the dropdown.`);
        } else {
          throw new Error(`Twilio service temporarily unavailable for ${countryCode}. Please try again later or contact support.`);
        }
      } else if (error.message?.includes('403') || error.message?.includes('Forbidden')) {
        throw new Error(`Access denied for ${countryCode} phone numbers. Please check your Twilio account permissions or try a different country.`);
      } else if (error.message?.includes('country code')) {
        // This is our custom error from the country support check
        throw error;
      }

      throw error;
    }
  }

  // Create or get existing subaccount for customer
  async createOrGetSubaccount(customerId: string, customerEmail: string, isDevMode: boolean = false): Promise<{ accountSid: string; authToken: string }> {
    const suffix = isDevMode ? '-dev' : '';
    const friendlyName = `Customer-${customerId}${suffix}`;

    try {
      // First, try to find existing subaccount
      const existingSubaccounts = await this.makeRequest('/Accounts.json');
      const existingSubaccount = existingSubaccounts.accounts?.find((acc: any) =>
        acc.friendly_name === friendlyName
      );

      if (existingSubaccount) {
        logger.info('Found existing subaccount', {
          operation: 'twilio_subaccount',
          subaccountSid: existingSubaccount.sid,
          customerId
        });
        return {
          accountSid: existingSubaccount.sid,
          authToken: existingSubaccount.auth_token
        };
      }

      // Create new subaccount
      logger.info('Creating new Twilio subaccount for customer', {
        operation: 'twilio_subaccount',
        customerId
      });
      const subaccountData = {
        FriendlyName: friendlyName,
      };

      const subaccount = await this.makeRequest('/Accounts.json', 'POST', subaccountData);
      logger.info('Subaccount created successfully', {
        operation: 'twilio_subaccount',
        subaccountSid: subaccount.sid,
        customerId
      });

      return {
        accountSid: subaccount.sid,
        authToken: subaccount.auth_token
      };
    } catch (error) {
      logger.error('Failed to create/get subaccount', error as Error, {
        operation: 'twilio_subaccount',
        customerId
      });
      throw new Error('Failed to create customer phone account. Please try again.');
    }
  }

  // Create SIP trunk
  async createSipTrunk(friendlyName: string, accountSid?: string): Promise<any> {
    try {
      const endpoint = '/Trunks.json';
      const data = {
        FriendlyName: friendlyName,
        DomainName: `${friendlyName.toLowerCase().replace(/[^a-z0-9]/g, '-')}.pstn.twilio.com`,
      };

      logger.info('Creating SIP trunk', {
        operation: 'twilio_sip_trunk',
        friendlyName,
        accountSid
      });
      const result = await this.makeRequest(endpoint, 'POST', data, accountSid);
      logger.info('SIP trunk created successfully', {
        operation: 'twilio_sip_trunk',
        trunkSid: result.sid,
        friendlyName
      });
      return result;
    } catch (error) {
      logger.error('Failed to create SIP trunk', error as Error, {
        operation: 'twilio_sip_trunk',
        friendlyName,
        accountSid
      });
      throw error;
    }
  }

  // Assign phone number to SIP trunk
  async assignPhoneNumberToTrunk(phoneNumberSid: string, trunkSid: string, accountSid?: string): Promise<any> {
    try {
      const endpoint = `/Trunks/${trunkSid}/PhoneNumbers.json`;
      const data = {
        PhoneNumberSid: phoneNumberSid,
      };

      logger.info('Assigning phone number to SIP trunk', {
        operation: 'twilio_sip_assignment',
        phoneNumberSid,
        trunkSid,
        accountSid
      });
      const result = await this.makeRequest(endpoint, 'POST', data, accountSid);
      logger.info('Phone number assigned to SIP trunk successfully', {
        operation: 'twilio_sip_assignment',
        phoneNumberSid,
        trunkSid
      });
      return result;
    } catch (error) {
      logger.error('Failed to assign phone number to SIP trunk', error as Error, {
        operation: 'twilio_sip_assignment',
        phoneNumberSid,
        trunkSid,
        accountSid
      });
      throw error;
    }
  }

  // Delete SIP trunk
  async deleteSipTrunk(trunkSid: string, accountSid?: string): Promise<void> {
    try {
      const endpoint = `/Trunks/${trunkSid}.json`;
      logger.info('Deleting SIP trunk', {
        operation: 'twilio_sip_trunk_delete',
        trunkSid,
        accountSid
      });
      await this.makeRequest(endpoint, 'DELETE', undefined, accountSid);
      logger.info('SIP trunk deleted successfully', {
        operation: 'twilio_sip_trunk_delete',
        trunkSid
      });
    } catch (error) {
      logger.error('Failed to delete SIP trunk', error as Error, {
        operation: 'twilio_sip_trunk_delete',
        trunkSid,
        accountSid
      });
      throw error;
    }
  }

  // Get approved regulatory bundles intelligently ordered by country preference
  async getApprovedBundles(countryCode: string): Promise<any[]> {
    try {
      // US and Canada don't need regulatory bundles for inbound use cases
      if (countryCode === 'US' || countryCode === 'CA') {
        logger.info('Country does not require regulatory bundles for inbound use', {
          operation: 'twilio_regulatory_bundles',
          countryCode
        });
        return [];
      }

      const endpoint = '/v2/RegulatoryCompliance/Bundles';
      const result = await this.makeRequest(endpoint, 'GET', undefined, undefined, 'numbers');

      // Filter bundles for approved status
      const approvedBundles = result.results?.filter((bundle: any) => {
        const isApproved = bundle.status === 'twilio-approved' || bundle.status === 'approved';
        return isApproved;
      }) || [];

      logger.info('Found approved bundles', {
        operation: 'twilio_regulatory_bundles',
        bundleCount: approvedBundles.length,
        countryCode
      });

      if (approvedBundles.length === 0) {
        return [];
      }

      // Intelligent ordering: country-specific bundles first, then general ones
      const countryKeywords = {
        'GB': ['uk', 'united kingdom', 'britain'],
        'DE': ['germany', 'deutschland', 'german'],
        'FR': ['france', 'french'],
        'AU': ['australia', 'australian'],
        'NZ': ['new zealand', 'zealand'],
        // Add more countries as needed
      };

      const keywords = countryKeywords[countryCode as keyof typeof countryKeywords] || [];

      // Separate country-specific and general bundles
      const countrySpecific: any[] = [];
      const general: any[] = [];

      approvedBundles.forEach((bundle: any) => {
        const name = bundle.friendly_name?.toLowerCase() || '';
        const isCountrySpecific = keywords.some(keyword => name.includes(keyword));

        if (isCountrySpecific) {
          countrySpecific.push(bundle);
        } else {
          general.push(bundle);
        }
      });

      // Return country-specific bundles first, then general ones
      const orderedBundles = [...countrySpecific, ...general];
      logger.info('Ordered bundles for country', {
        operation: 'twilio_regulatory_bundles',
        countryCode,
        countrySpecificCount: countrySpecific.length,
        generalCount: general.length
      });

      return orderedBundles;
    } catch (error) {
      logger.error('Error fetching approved bundles', error as Error, {
        operation: 'twilio_regulatory_bundles',
        countryCode
      });
      return [];
    }
  }

  // Purchase phone number with intelligent bundle retry logic
  async purchasePhoneNumberWithBundleRetry(options: PhoneNumberPurchaseOptions & { countryCode?: string; numberType?: string }): Promise<any> {
    const { countryCode, numberType, ...purchaseOptions } = options;

    // For countries that don't need bundles, purchase directly
    if (!countryCode || countryCode === 'US' || countryCode === 'CA') {
      logger.info('Purchasing without bundle (US/CA or no country specified)', {
        operation: 'twilio_phone_purchase',
        countryCode
      });
      return this.purchasePhoneNumber(purchaseOptions);
    }

    // For mobile numbers in countries that require bundles, try with bundles
    if (numberType === 'mobile') {
      logger.info('Attempting to purchase mobile number with regulatory bundles', {
        operation: 'twilio_phone_purchase',
        countryCode,
        numberType: 'mobile'
      });

      const approvedBundles = await this.getApprovedBundles(countryCode);

      if (approvedBundles.length === 0) {
        logger.info('No approved bundles found, attempting purchase without bundle', {
          operation: 'twilio_phone_purchase',
          countryCode,
          fallbackAttempt: true
        });
        return this.purchasePhoneNumber(purchaseOptions);
      }

      // Try each bundle in order until one works
      for (let i = 0; i < approvedBundles.length; i++) {
        const bundle = approvedBundles[i];
        logger.info('Trying bundle for phone purchase', {
          operation: 'twilio_phone_purchase',
          bundleAttempt: i + 1,
          totalBundles: approvedBundles.length,
          bundleName: bundle.friendly_name,
          bundleSid: bundle.sid
        });

        try {
          const result = await this.purchasePhoneNumber({
            ...purchaseOptions,
            bundleSid: bundle.sid
          });

          logger.info('Successfully purchased number using bundle', {
            operation: 'twilio_phone_purchase',
            bundleName: bundle.friendly_name,
            bundleSid: bundle.sid,
            success: true
          });
          return result;
        } catch (error: any) {
          logger.warn('Bundle failed for phone purchase', {
            operation: 'twilio_phone_purchase',
            bundleName: bundle.friendly_name,
            bundleSid: bundle.sid,
            error: error.message
          });

          // If this is the last bundle, throw the error
          if (i === approvedBundles.length - 1) {
            throw error;
          }

          // Otherwise, continue to next bundle
          logger.info('Trying next bundle', {
            operation: 'twilio_phone_purchase',
            nextAttempt: true
          });
        }
      }
    }

    // For local numbers or fallback, try without bundle
    logger.info('Purchasing without bundle (local number or fallback)', {
      operation: 'twilio_phone_purchase',
      fallbackPurchase: true
    });
    return this.purchasePhoneNumber(purchaseOptions);
  }

  // Purchase a phone number
  async purchasePhoneNumber(options: PhoneNumberPurchaseOptions): Promise<any> {
    const data: any = {
      PhoneNumber: options.phoneNumber,
    };

    if (options.friendlyName) data.FriendlyName = options.friendlyName;
    if (options.voiceUrl) data.VoiceUrl = options.voiceUrl;
    if (options.voiceMethod) data.VoiceMethod = options.voiceMethod;
    if (options.voiceFallbackUrl) data.VoiceFallbackUrl = options.voiceFallbackUrl;
    if (options.voiceFallbackMethod) data.VoiceFallbackMethod = options.voiceFallbackMethod;
    if (options.statusCallback) data.StatusCallback = options.statusCallback;
    if (options.statusCallbackMethod) data.StatusCallbackMethod = options.statusCallbackMethod;
    if (options.voiceCallerIdLookup !== undefined) data.VoiceCallerIdLookup = options.voiceCallerIdLookup;
    if (options.smsUrl) data.SmsUrl = options.smsUrl;
    if (options.smsMethod) data.SmsMethod = options.smsMethod;
    if (options.smsFallbackUrl) data.SmsFallbackUrl = options.smsFallbackUrl;
    if (options.smsFallbackMethod) data.SmsFallbackMethod = options.smsFallbackMethod;
    if (options.addressSid) data.AddressSid = options.addressSid;
    if (options.emergencyStatus) data.EmergencyStatus = options.emergencyStatus;
    if (options.emergencyAddressSid) data.EmergencyAddressSid = options.emergencyAddressSid;
    if (options.trunkSid) data.TrunkSid = options.trunkSid;
    if (options.voiceReceiveMode) data.VoiceReceiveMode = options.voiceReceiveMode;
    if (options.identitySid) data.IdentitySid = options.identitySid;
    if (options.bundleSid) data.BundleSid = options.bundleSid;

    const result = await this.makeRequest('/IncomingPhoneNumbers.json', 'POST', data);
    
    return {
      sid: result.sid,
      accountSid: result.account_sid,
      friendlyName: result.friendly_name,
      phoneNumber: result.phone_number,
      voiceUrl: result.voice_url,
      voiceMethod: result.voice_method,
      voiceFallbackUrl: result.voice_fallback_url,
      voiceFallbackMethod: result.voice_fallback_method,
      statusCallback: result.status_callback,
      statusCallbackMethod: result.status_callback_method,
      voiceCallerIdLookup: result.voice_caller_id_lookup,
      dateCreated: result.date_created,
      dateUpdated: result.date_updated,
      smsUrl: result.sms_url,
      smsMethod: result.sms_method,
      smsFallbackUrl: result.sms_fallback_url,
      smsFallbackMethod: result.sms_fallback_method,
      addressRequirements: result.address_requirements,
      capabilities: {
        voice: result.capabilities.voice,
        SMS: result.capabilities.SMS,
        MMS: result.capabilities.MMS,
        fax: result.capabilities.fax,
      },
      status: result.status,
      apiVersion: result.api_version,
      uri: result.uri,
    };
  }

  // Get phone number details
  async getPhoneNumber(sid: string): Promise<any> {
    const result = await this.makeRequest(`/IncomingPhoneNumbers/${sid}.json`);
    return result;
  }

  // Release a phone number
  async releasePhoneNumber(sid: string): Promise<void> {
    await this.makeRequest(`/IncomingPhoneNumbers/${sid}.json`, 'DELETE');
  }

  // Update phone number configuration
  async updatePhoneNumber(sid: string, options: Partial<PhoneNumberPurchaseOptions>): Promise<any> {
    const data: any = {};
    
    if (options.friendlyName) data.FriendlyName = options.friendlyName;
    if (options.voiceUrl !== undefined) data.VoiceUrl = options.voiceUrl;
    if (options.voiceMethod) data.VoiceMethod = options.voiceMethod;
    if (options.voiceFallbackUrl) data.VoiceFallbackUrl = options.voiceFallbackUrl;
    if (options.voiceFallbackMethod) data.VoiceFallbackMethod = options.voiceFallbackMethod;
    if (options.statusCallback) data.StatusCallback = options.statusCallback;
    if (options.statusCallbackMethod) data.StatusCallbackMethod = options.statusCallbackMethod;
    if (options.voiceCallerIdLookup !== undefined) data.VoiceCallerIdLookup = options.voiceCallerIdLookup;
    if (options.smsUrl !== undefined) data.SmsUrl = options.smsUrl;
    if (options.smsMethod) data.SmsMethod = options.smsMethod;
    if (options.smsFallbackUrl) data.SmsFallbackUrl = options.smsFallbackUrl;
    if (options.smsFallbackMethod) data.SmsFallbackMethod = options.smsFallbackMethod;
    if (options.addressSid) data.AddressSid = options.addressSid;
    if (options.emergencyStatus) data.EmergencyStatus = options.emergencyStatus;
    if (options.emergencyAddressSid) data.EmergencyAddressSid = options.emergencyAddressSid;
    if (options.trunkSid !== undefined) data.TrunkSid = options.trunkSid; // Allow explicit removal with empty string
    if (options.voiceReceiveMode) data.VoiceReceiveMode = options.voiceReceiveMode;
    if (options.identitySid) data.IdentitySid = options.identitySid;
    if (options.bundleSid) data.BundleSid = options.bundleSid;

    const result = await this.makeRequest(`/IncomingPhoneNumbers/${sid}.json`, 'POST', data);
    return result;
  }

  // Create a subaccount
  async createSubaccount(friendlyName: string): Promise<any> {
    // For creating subaccounts, we need to use the base API URL without account SID
    const baseApiUrl = 'https://api.twilio.com/2010-04-01';
    const url = `${baseApiUrl}/Accounts.json`;

    const auth = Buffer.from(`${this.accountSid}:${this.authToken}`).toString('base64');

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        FriendlyName: friendlyName,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      logger.error('Twilio subaccount creation failed', new Error(`HTTP ${response.status}: ${response.statusText}`), {
        operation: 'twilio_subaccount_creation',
        status: response.status,
        statusText: response.statusText,
        url: url,
        error: errorText
      });
      throw new Error(`Twilio API Error: ${response.status} ${response.statusText} - ${errorText}`);
    }

    const result = await response.json();
    return result;
  }

  // Get subaccount details
  async getSubaccount(sid: string): Promise<any> {
    // For getting subaccount details, we use the base API URL
    const baseApiUrl = 'https://api.twilio.com/2010-04-01';
    const url = `${baseApiUrl}/Accounts/${sid}.json`;

    const auth = Buffer.from(`${this.accountSid}:${this.authToken}`).toString('base64');

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Basic ${auth}`,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Twilio API Error: ${errorText}`);
    }

    const result = await response.json();
    return result;
  }

  // Create an address for regulatory compliance
  async createAddress(addressData: any): Promise<any> {
    return await this.makeRequest('/Addresses.json', 'POST', addressData);
  }

  // Create a regulatory bundle
  async createRegulatoryBundle(bundleData: any): Promise<any> {
    return await this.makeRequest('/Regulatory/Bundles.json', 'POST', bundleData);
  }

  // Assign an item to a regulatory bundle
  async assignItemToBundle(bundleSid: string, itemData: any): Promise<any> {
    return await this.makeRequest(`/Regulatory/Bundles/${bundleSid}/ItemAssignments.json`, 'POST', itemData);
  }

  // Get regulatory bundle status
  async getRegulatoryBundle(bundleSid: string): Promise<any> {
    return await this.makeRequest(`/Regulatory/Bundles/${bundleSid}.json`);
  }

  // Get phone number pricing for a country
  async getPhoneNumberPricing(countryCode: string): Promise<any> {
    try {
      // Use Twilio's pricing API - this returns pricing in the account's default currency
      const pricingUrl = `https://pricing.twilio.com/v1/PhoneNumbers/Countries/${countryCode}`;
      const auth = Buffer.from(`${this.accountSid}:${this.authToken}`).toString('base64');

      const response = await fetch(pricingUrl, {
        headers: {
          'Authorization': `Basic ${auth}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Pricing API error: ${response.statusText}`);
      }

      const pricingData = await response.json();

      // Log the currency for debugging
      logger.info('Pricing retrieved for country', {
        operation: 'twilio_pricing',
        countryCode,
        currency: pricingData.price_unit || 'unknown currency'
      });

      return pricingData;
    } catch (error) {
      logger.error('Failed to get pricing for country', error as Error, {
        operation: 'twilio_pricing',
        countryCode
      });
      throw error;
    }
  }

  // Validate credentials by making a simple API call
  async validateCredentials(): Promise<void> {
    try {
      // Make a simple API call to validate credentials
      const result = await this.makeRequest('.json');
      logger.info('Twilio credentials validated successfully', {
        operation: 'twilio_credentials_validation',
        accountSid: result.sid,
        friendlyName: result.friendly_name,
        status: result.status
      });
    } catch (error) {
      logger.error('Twilio credentials validation failed', error as Error, {
        operation: 'twilio_credentials_validation'
      });
      throw new Error(`Twilio credentials validation failed: ${error}`);
    }
  }
}

// Helper function to format phone number capabilities for database storage
export function formatCapabilities(capabilities: any): any {
  return {
    sms: capabilities.SMS || false,
    mms: capabilities.MMS || false,
    voice: capabilities.voice || false,
    fax: capabilities.fax || false,
  };
}

// Helper function to get monthly cost estimate based on phone number type and country
export function getMonthlyPhoneNumberCost(type: string, countryCode: string): number {
  // These are approximate costs in cents - should be fetched from Twilio pricing API in production
  const pricing: Record<string, Record<string, number>> = {
    US: {
      local: 100, // $1.00
      mobile: 100, // $1.00
      tollfree: 200, // $2.00
    },
    GB: {
      local: 100,
      mobile: 150,
      tollfree: 500,
    },
    CA: {
      local: 100,
      mobile: 100,
      tollfree: 200,
    },
    // Add more countries as needed
  };

  return pricing[countryCode]?.[type] || 100; // Default to $1.00
}

// Initialize Twilio client with environment variables
export function initTwilioClient(): TwilioClient {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;

  if (!accountSid || !authToken) {
    throw new Error('Twilio credentials not configured');
  }

  return new TwilioClient({
    accountSid,
    authToken,
  });
}