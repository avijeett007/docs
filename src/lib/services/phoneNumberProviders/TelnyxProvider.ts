import {
  BasePhoneNumberProvider,
  PhoneNumberInfo,
  ValidationResult,
  ListNumbersOptions,
  ListNumbersResult,
  SearchNumbersOptions,
  SearchNumbersResult,
  AvailablePhoneNumber,
  PurchaseNumberOptions,
  PurchaseNumberResult,
  ProviderAuthenticationError,
  ProviderRateLimitError,
  ProviderServiceError,
  ProviderCredentials
} from './BaseProvider';
import { logger } from '@/lib/logger';

interface TelnyxCredentials {
  apiKey: string;
}

interface TelnyxPhoneNumber {
  id: string;
  record_type: string;
  phone_number: string;
  status: string;
  tags: string[];
  connection_id?: string;
  customer_reference?: string;
  messaging_profile_id?: string;
  billing_group_id?: string;
  emergency_enabled: boolean;
  emergency_address_id?: string;
  call_forwarding_enabled: boolean;
  cnam_listing_enabled: boolean;
  caller_id_name_enabled: boolean;
  call_recording_enabled: boolean;
  t38_fax_gateway_enabled: boolean;
  purchased_at: string;
  created_at: string;
  updated_at: string;
}

interface TelnyxListResponse {
  data: TelnyxPhoneNumber[];
  meta: {
    total_pages: number;
    total_results: number;
    page_number: number;
    page_size: number;
  };
}

interface TelnyxSingleResponse {
  data: TelnyxPhoneNumber;
}

interface TelnyxErrorResponse {
  errors: Array<{
    code: string;
    title: string;
    detail: string;
    source?: {
      pointer?: string;
      parameter?: string;
    };
  }>;
}

interface TelnyxAvailableNumber {
  phone_number: string;
  vanity_format?: string;
  best_effort: boolean;
  quickship: boolean;
  reservable: boolean;
  upfront_cost: string;
  monthly_cost: string;
  features: Array<{
    name: string;
    type: string;
  }>;
  cost_information: {
    currency: string;
    upfront_cost: string;
    monthly_cost: string;
  };
  region_information: Array<{
    region_type: string;
    region_name: string;
  }>;
}

interface TelnyxAvailableNumbersResponse {
  data: TelnyxAvailableNumber[];
  meta: {
    total_results: number;
    best_effort_results: number;
  };
}

interface TelnyxNumberOrder {
  id: string;
  record_type: string;
  phone_numbers: Array<{
    id: string;
    phone_number: string;
    status: string;
    regulatory_requirements?: any[];
  }>;
  customer_reference?: string;
  created_at: string;
  updated_at: string;
  requirements_met: boolean;
  status: string;
}

interface TelnyxNumberOrderResponse {
  data: TelnyxNumberOrder;
}

export class TelnyxProvider extends BasePhoneNumberProvider {
  private baseUrl = 'https://api.telnyx.com/v2';
  
  constructor(credentials: ProviderCredentials, providerName: string) {
    super(credentials, providerName);
  }
  
  async validateCredentials(): Promise<ValidationResult> {
    try {
      // Test credentials by making a simple API call with minimal data
      const response = await this.makeRequest('/phone_numbers?page[size]=1');
      
      return {
        isValid: true,
        accountInfo: {
          accountId: 'telnyx-account', // Telnyx doesn't provide account info in phone numbers endpoint
          friendlyName: 'Telnyx Account',
          status: 'active'
        }
      };
    } catch (error: any) {
      logger.error('Telnyx credential validation failed', error as Error, {
        operation: 'telnyx_provider'
      });
      
      if (error instanceof ProviderAuthenticationError) {
        return {
          isValid: false,
          error: 'Invalid API Key'
        };
      }
      
      return {
        isValid: false,
        error: error.message || 'Failed to validate Telnyx credentials'
      };
    }
  }
  
  async listPhoneNumbers(options: ListNumbersOptions = {}): Promise<ListNumbersResult> {
    const { page = 1, limit = 20, filter } = options;
    
    try {
      const queryParams = new URLSearchParams({
        'page[number]': page.toString(),
        'page[size]': Math.min(limit, 250).toString() // Telnyx max is 250
      });
      
      // Add filters if provided
      if (filter?.phoneNumber) {
        queryParams.append('filter[phone_number]', filter.phoneNumber);
      }
      
      if (filter?.status) {
        queryParams.append('filter[status]', filter.status);
      }
      
      const endpoint = `/phone_numbers?${queryParams.toString()}`;
      const response: TelnyxListResponse = await this.makeRequest(endpoint);
      
      const numbers: PhoneNumberInfo[] = response.data.map(number => ({
        id: number.id,
        phoneNumber: number.phone_number,
        friendlyName: number.customer_reference || number.phone_number,
        capabilities: {
          voice: true, // Telnyx numbers typically support voice
          sms: true,   // and SMS
          mms: true,   // and MMS
          fax: number.t38_fax_gateway_enabled
        },
        status: number.status,
        purchasedAt: new Date(number.purchased_at),
        metadata: {
          connectionId: number.connection_id,
          messagingProfileId: number.messaging_profile_id,
          billingGroupId: number.billing_group_id,
          emergencyEnabled: number.emergency_enabled,
          emergencyAddressId: number.emergency_address_id,
          callForwardingEnabled: number.call_forwarding_enabled,
          cnamListingEnabled: number.cnam_listing_enabled,
          callerIdNameEnabled: number.caller_id_name_enabled,
          callRecordingEnabled: number.call_recording_enabled,
          t38FaxGatewayEnabled: number.t38_fax_gateway_enabled,
          tags: number.tags,
          recordType: number.record_type,
          createdAt: number.created_at,
          updatedAt: number.updated_at
        }
      }));
      
      return {
        numbers,
        pagination: this.calculatePagination(
          response.meta.page_number,
          response.meta.page_size,
          response.meta.total_results
        )
      };
    } catch (error: any) {
      logger.error('Failed to list Telnyx phone numbers', error as Error, {
        operation: 'telnyx_provider'
      });
      throw this.handleProviderError(error);
    }
  }
  
  async getPhoneNumber(numberId: string): Promise<PhoneNumberInfo | null> {
    try {
      const endpoint = `/phone_numbers/${numberId}`;
      const response: TelnyxSingleResponse = await this.makeRequest(endpoint);
      const number = response.data;
      
      return {
        id: number.id,
        phoneNumber: number.phone_number,
        friendlyName: number.customer_reference || number.phone_number,
        capabilities: {
          voice: true,
          sms: true,
          mms: true,
          fax: number.t38_fax_gateway_enabled
        },
        status: number.status,
        purchasedAt: new Date(number.purchased_at),
        metadata: {
          connectionId: number.connection_id,
          messagingProfileId: number.messaging_profile_id,
          billingGroupId: number.billing_group_id,
          emergencyEnabled: number.emergency_enabled,
          emergencyAddressId: number.emergency_address_id,
          callForwardingEnabled: number.call_forwarding_enabled,
          cnamListingEnabled: number.cnam_listing_enabled,
          callerIdNameEnabled: number.caller_id_name_enabled,
          callRecordingEnabled: number.call_recording_enabled,
          t38FaxGatewayEnabled: number.t38_fax_gateway_enabled,
          tags: number.tags,
          recordType: number.record_type,
          createdAt: number.created_at,
          updatedAt: number.updated_at
        }
      };
    } catch (error: any) {
      if (error.response?.status === 404) {
        return null;
      }
      
      logger.error('Failed to get Telnyx phone number', error as Error, {
        operation: 'telnyx_provider',
        numberId
      });
      throw this.handleProviderError(error);
    }
  }

  async deletePhoneNumber(phoneNumber: string): Promise<void> {
    try {
      // First, find the phone number by searching for it
      const queryParams = new URLSearchParams({
        'filter[phone_number]': phoneNumber,
        'page[size]': '1'
      });

      const searchEndpoint = `/phone_numbers?${queryParams.toString()}`;
      const searchResponse: TelnyxListResponse = await this.makeRequest(searchEndpoint);

      if (searchResponse.data.length === 0) {
        throw new Error(`Phone number ${phoneNumber} not found in Telnyx account`);
      }

      const numberId = searchResponse.data[0].id;

      // Delete the phone number using its ID
      const deleteEndpoint = `/phone_numbers/${numberId}`;
      await this.makeRequest(deleteEndpoint, { method: 'DELETE' });

      logger.info('Successfully deleted phone number from Telnyx', {
        operation: 'telnyx_provider',
        phoneNumber
      });
    } catch (error: any) {
      logger.error('Failed to delete Telnyx phone number', error as Error, {
        operation: 'telnyx_provider',
        phoneNumber
      });
      throw this.handleProviderError(error);
    }
  }

  protected async makeRequest(endpoint: string, options: any = {}): Promise<any> {
    const url = `${this.baseUrl}${endpoint}`;
    
    const requestOptions = {
      method: options.method || 'GET',
      headers: {
        'Authorization': `Bearer ${(this.credentials as unknown as TelnyxCredentials).apiKey}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        ...options.headers
      },
      body: options.body ? JSON.stringify(options.body) : undefined
    };
    
    try {
      const response = await fetch(url, requestOptions);
      
      if (!response.ok) {
        const errorData: TelnyxErrorResponse = await response.json().catch(() => ({ errors: [] }));
        const firstError = errorData.errors?.[0];
        const errorMessage = firstError?.detail || firstError?.title || `HTTP ${response.status}`;
        
        switch (response.status) {
          case 401:
            throw new ProviderAuthenticationError(
              'Invalid API Key or authentication failed',
              'telnyx'
            );
          case 403:
            throw new ProviderAuthenticationError(
              'Access forbidden - check your API key permissions',
              'telnyx'
            );
          case 429:
            const retryAfter = response.headers.get('Retry-After');
            throw new ProviderRateLimitError(
              'Rate limit exceeded',
              'telnyx',
              retryAfter ? parseInt(retryAfter) : undefined
            );
          default:
            throw new ProviderServiceError(
              errorMessage,
              'telnyx',
              response.status
            );
        }
      }
      
      return await response.json();
    } catch (error: any) {
      if (error instanceof ProviderAuthenticationError || 
          error instanceof ProviderRateLimitError || 
          error instanceof ProviderServiceError) {
        throw error;
      }
      
      // Network or other errors
      throw new Error(`Telnyx API request failed: ${error.message}`);
    }
  }
  
  /**
   * Check if a phone number is available for import (exists in the account)
   */
  async isNumberAvailableForImport(phoneNumber: string): Promise<boolean> {
    try {
      // Search for the number in the account
      const queryParams = new URLSearchParams({
        'filter[phone_number]': phoneNumber,
        'page[size]': '1'
      });
      
      const endpoint = `/phone_numbers?${queryParams.toString()}`;
      const response: TelnyxListResponse = await this.makeRequest(endpoint);
      
      return response.data.length > 0;
    } catch (error) {
      logger.error('Failed to check number availability', error as Error, {
        operation: 'telnyx_provider'
      });
      return false;
    }
  }
  
  /**
   * Get account balance information
   */
  async getAccountBalance(): Promise<any> {
    try {
      const endpoint = '/balance';
      return await this.makeRequest(endpoint);
    } catch (error) {
      logger.error('Failed to get account balance', error as Error, {
        operation: 'telnyx_provider'
      });
      return null;
    }
  }
  
  /**
   * Get billing information
   */
  async getBillingInfo(): Promise<any> {
    try {
      const endpoint = '/billing_groups';
      return await this.makeRequest(endpoint);
    } catch (error) {
      logger.error('Failed to get billing info', error as Error, {
        operation: 'telnyx_provider'
      });
      return null;
    }
  }
  
  /**
   * Get connections (SIP trunks) information
   */
  async getConnections(): Promise<any> {
    try {
      const endpoint = '/connections';
      return await this.makeRequest(endpoint);
    } catch (error) {
      logger.error('Failed to get connections', error as Error, {
        operation: 'telnyx_provider'
      });
      return null;
    }
  }

  /**
   * Search for available phone numbers to purchase
   */
  async searchAvailablePhoneNumbers(options: SearchNumbersOptions): Promise<SearchNumbersResult> {
    const { countryCode, type, areaCode, contains, locality, region, limit = 10 } = options;

    try {
      const queryParams = new URLSearchParams({
        'filter[country_code]': countryCode,
        'filter[limit]': Math.min(limit, 250).toString() // Telnyx max is 250
      });

      // Map type to Telnyx number type
      const telnyxType = this.mapNumberType(type);
      if (telnyxType) {
        queryParams.append('filter[number_type]', telnyxType);
      }

      // Add optional filters
      if (areaCode) {
        queryParams.append('filter[national_destination_code]', areaCode);
      }

      if (contains) {
        queryParams.append('filter[contains]', contains);
      }

      if (locality) {
        queryParams.append('filter[locality]', locality);
      }

      if (region) {
        queryParams.append('filter[administrative_area]', region);
      }

      // Add feature requirements
      const features = [];
      if (options.voiceEnabled !== false) features.push('voice');
      if (options.smsEnabled) features.push('sms');
      if (options.mmsEnabled) features.push('mms');
      if (options.faxEnabled) features.push('fax');

      if (features.length > 0) {
        queryParams.append('filter[features]', features.join(','));
      }

      const endpoint = `/available_phone_numbers?${queryParams.toString()}`;
      const response: TelnyxAvailableNumbersResponse = await this.makeRequest(endpoint);

      const numbers: AvailablePhoneNumber[] = response.data.map(number => ({
        phoneNumber: number.phone_number,
        friendlyName: number.vanity_format || number.phone_number,
        locality: this.extractRegionInfo(number.region_information, 'locality'),
        region: this.extractRegionInfo(number.region_information, 'administrative_area'),
        countryCode,
        type,
        capabilities: {
          voice: number.features.some(f => f.name === 'voice'),
          sms: number.features.some(f => f.name === 'sms'),
          mms: number.features.some(f => f.name === 'mms'),
          fax: number.features.some(f => f.name === 'fax')
        },
        monthlyPrice: parseFloat(number.cost_information.monthly_cost),
        setupFee: parseFloat(number.cost_information.upfront_cost),
        currency: number.cost_information.currency,
        metadata: {
          bestEffort: number.best_effort,
          quickship: number.quickship,
          reservable: number.reservable,
          vanityFormat: number.vanity_format,
          features: number.features,
          regionInformation: number.region_information
        }
      }));

      return {
        numbers,
        pagination: {
          page: 1,
          limit,
          total: response.meta.total_results,
          totalPages: Math.ceil(response.meta.total_results / limit),
          hasNext: false,
          hasPrevious: false
        }
      };
    } catch (error: any) {
      logger.error('Failed to search available Telnyx phone numbers', error as Error, {
        operation: 'telnyx_provider'
      });
      throw this.handleProviderError(error);
    }
  }

  /**
   * Purchase a phone number
   */
  async purchasePhoneNumber(options: PurchaseNumberOptions): Promise<PurchaseNumberResult> {
    const { phoneNumber, friendlyName, metadata } = options;

    try {
      const requestBody = {
        phone_numbers: [{ phone_number: phoneNumber }],
        ...(friendlyName && { customer_reference: friendlyName }),
        ...(metadata && { metadata })
      };

      const endpoint = '/number_orders';
      const response: TelnyxNumberOrderResponse = await this.makeRequest(endpoint, {
        method: 'POST',
        body: requestBody
      });

      const order = response.data;
      const purchasedNumber = order.phone_numbers[0];

      // Accept both 'success' and 'pending' as valid statuses
      // 'pending' means the purchase request was accepted and is being processed
      const validStatuses = ['success', 'pending'];
      if (!purchasedNumber || !validStatuses.includes(purchasedNumber.status)) {
        throw new Error(`Failed to purchase number: ${purchasedNumber?.status || 'unknown error'}`);
      }

      // Log successful purchase with status for monitoring
      logger.info('Successfully initiated Telnyx phone number purchase', {
        operation: 'telnyx_provider',
        phoneNumber,
        status: purchasedNumber.status,
        orderId: order.id
      });

      return {
        id: purchasedNumber.id,
        phoneNumber: purchasedNumber.phone_number,
        friendlyName: order.customer_reference || phoneNumber,
        status: purchasedNumber.status,
        purchasedAt: new Date(order.created_at),
        metadata: {
          orderId: order.id,
          requirementsMet: order.requirements_met,
          orderStatus: order.status,
          regulatoryRequirements: purchasedNumber.regulatory_requirements,
          ...metadata
        }
      };
    } catch (error: any) {
      logger.error('Failed to purchase Telnyx phone number', error as Error, {
        operation: 'telnyx_provider',
        phoneNumber
      });
      throw this.handleProviderError(error);
    }
  }

  /**
   * Helper method to map generic number type to Telnyx-specific type
   */
  private mapNumberType(type: 'local' | 'mobile' | 'tollfree'): string | null {
    switch (type) {
      case 'local':
        return 'local';
      case 'mobile':
        return 'mobile';
      case 'tollfree':
        return 'toll_free';
      default:
        return null;
    }
  }

  /**
   * Helper method to extract region information
   */
  private extractRegionInfo(regionInfo: Array<{ region_type: string; region_name: string }>, type: string): string | undefined {
    const region = regionInfo.find(r => r.region_type === type);
    return region?.region_name;
  }
}
