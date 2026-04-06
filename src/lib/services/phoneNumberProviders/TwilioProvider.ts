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

interface TwilioCredentials {
  accountSid: string;
  authToken: string;
}

interface TwilioPhoneNumber {
  sid: string;
  account_sid: string;
  friendly_name: string;
  phone_number: string;
  voice_url?: string;
  voice_method?: string;
  voice_fallback_url?: string;
  voice_fallback_method?: string;
  voice_caller_id_lookup?: boolean;
  date_created: string;
  date_updated: string;
  sms_url?: string;
  sms_method?: string;
  sms_fallback_url?: string;
  sms_fallback_method?: string;
  address_requirements: string;
  beta: boolean;
  capabilities: {
    voice: boolean;
    sms: boolean;
    mms: boolean;
    fax: boolean;
  };
  status_callback?: string;
  status_callback_method?: string;
  api_version: string;
  voice_receive_mode?: string;
  status: string;
  uri: string;
}

interface TwilioListResponse {
  incoming_phone_numbers: TwilioPhoneNumber[];
  page: number;
  page_size: number;
  uri: string;
  first_page_uri: string;
  next_page_uri?: string;
  previous_page_uri?: string;
  start: number;
  end: number;
}

interface TwilioAccount {
  sid: string;
  friendly_name: string;
  status: string;
  type: string;
  date_created: string;
  date_updated: string;
}

export class TwilioProvider extends BasePhoneNumberProvider {
  private baseUrl: string;
  
  constructor(credentials: ProviderCredentials, providerName: string) {
    super(credentials, providerName);
    const twilioCredentials = credentials as unknown as TwilioCredentials;
    this.baseUrl = `https://api.twilio.com/2010-04-01/Accounts/${twilioCredentials.accountSid}`;
  }
  
  async validateCredentials(): Promise<ValidationResult> {
    try {
      const response = await this.makeRequest('.json');
      const account: TwilioAccount = response;
      
      return {
        isValid: true,
        accountInfo: {
          accountId: account.sid,
          friendlyName: account.friendly_name,
          status: account.status
        }
      };
    } catch (error: any) {
      logger.error('Twilio credential validation failed', error as Error, {
        operation: 'twilio_provider'
      });
      
      if (error instanceof ProviderAuthenticationError) {
        return {
          isValid: false,
          error: 'Invalid Account SID or Auth Token'
        };
      }
      
      return {
        isValid: false,
        error: error.message || 'Failed to validate Twilio credentials'
      };
    }
  }
  
  async listPhoneNumbers(options: ListNumbersOptions = {}): Promise<ListNumbersResult> {
    const { page = 0, limit = 50, filter } = options;
    
    try {
      const queryParams = new URLSearchParams({
        Page: page.toString(),
        PageSize: Math.min(limit, 1000).toString() // Twilio max is 1000
      });
      
      // Add filters if provided
      if (filter?.phoneNumber) {
        queryParams.append('PhoneNumber', filter.phoneNumber);
      }
      
      const endpoint = `/IncomingPhoneNumbers.json?${queryParams.toString()}`;
      const response: TwilioListResponse = await this.makeRequest(endpoint);
      
      const numbers: PhoneNumberInfo[] = response.incoming_phone_numbers.map(number => {
        // Debug logging for Twilio phone number status
        logger.debug('Twilio number details', {
          operation: 'twilio_provider',
          phoneNumber: number.phone_number,
          originalStatus: number.status,
          finalStatus: number.status || 'active',
          capabilities: number.capabilities
        });

        return {
          id: number.sid,
          phoneNumber: number.phone_number,
          friendlyName: number.friendly_name || number.phone_number,
          capabilities: this.parseCapabilities(number.capabilities),
          status: number.status || 'active',
          purchasedAt: new Date(number.date_created),
          metadata: {
            voiceUrl: number.voice_url,
            smsUrl: number.sms_url,
            addressRequirements: number.address_requirements,
            beta: number.beta,
            apiVersion: number.api_version,
            voiceReceiveMode: number.voice_receive_mode,
            uri: number.uri
          }
        };
      });
      
      // Calculate total from response metadata
      const total = response.end + 1; // Twilio uses 0-based indexing
      
      return {
        numbers,
        pagination: this.calculatePagination(page, limit, total)
      };
    } catch (error: any) {
      logger.error('Failed to list Twilio phone numbers', error as Error, {
        operation: 'twilio_provider'
      });
      throw this.handleProviderError(error);
    }
  }
  
  async getPhoneNumber(numberId: string): Promise<PhoneNumberInfo | null> {
    try {
      const endpoint = `/IncomingPhoneNumbers/${numberId}.json`;
      const number: TwilioPhoneNumber = await this.makeRequest(endpoint);

      return {
        id: number.sid,
        phoneNumber: number.phone_number,
        friendlyName: number.friendly_name || number.phone_number,
        capabilities: this.parseCapabilities(number.capabilities),
        status: number.status || 'active',
        purchasedAt: new Date(number.date_created),
        metadata: {
          voiceUrl: number.voice_url,
          smsUrl: number.sms_url,
          addressRequirements: number.address_requirements,
          beta: number.beta,
          apiVersion: number.api_version,
          voiceReceiveMode: number.voice_receive_mode,
          uri: number.uri
        }
      };
    } catch (error: any) {
      if (error.response?.status === 404) {
        return null;
      }

      logger.error('Failed to get Twilio phone number', error as Error, {
        operation: 'twilio_provider',
        numberId
      });
      throw this.handleProviderError(error);
    }
  }

  async deletePhoneNumber(phoneNumber: string): Promise<void> {
    try {
      // First, find the phone number by searching for it
      const queryParams = new URLSearchParams({
        PhoneNumber: phoneNumber,
        PageSize: '1'
      });

      const searchEndpoint = `/IncomingPhoneNumbers.json?${queryParams.toString()}`;
      const searchResponse: TwilioListResponse = await this.makeRequest(searchEndpoint);

      if (searchResponse.incoming_phone_numbers.length === 0) {
        throw new Error(`Phone number ${phoneNumber} not found in Twilio account`);
      }

      const numberSid = searchResponse.incoming_phone_numbers[0].sid;

      // Delete the phone number using its SID
      const deleteEndpoint = `/IncomingPhoneNumbers/${numberSid}.json`;
      await this.makeRequest(deleteEndpoint, { method: 'DELETE' });

      logger.info('Successfully deleted phone number from Twilio', {
        operation: 'twilio_provider',
        phoneNumber
      });
    } catch (error: any) {
      logger.error('Failed to delete Twilio phone number', error as Error, {
        operation: 'twilio_provider',
        phoneNumber
      });
      throw this.handleProviderError(error);
    }
  }
  
  protected async makeRequest(endpoint: string, options: any = {}): Promise<any> {
    const url = `${this.baseUrl}${endpoint}`;
    const twilioCredentials = this.credentials as unknown as TwilioCredentials;
    const auth = Buffer.from(`${twilioCredentials.accountSid}:${twilioCredentials.authToken}`).toString('base64');
    
    const requestOptions = {
      method: options.method || 'GET',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/json',
        ...options.headers
      },
      body: options.body
    };
    
    try {
      const response = await fetch(url, requestOptions);
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        
        switch (response.status) {
          case 401:
            throw new ProviderAuthenticationError(
              errorData.message || 'Invalid Account SID or Auth Token',
              'twilio'
            );
          case 429:
            const retryAfter = response.headers.get('Retry-After');
            throw new ProviderRateLimitError(
              'Rate limit exceeded',
              'twilio',
              retryAfter ? parseInt(retryAfter) : undefined
            );
          default:
            throw new ProviderServiceError(
              errorData.message || `HTTP ${response.status}`,
              'twilio',
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
      throw new Error(`Twilio API request failed: ${error.message}`);
    }
  }
  
  /**
   * Get account information
   */
  async getAccountInfo(): Promise<TwilioAccount> {
    return await this.makeRequest('.json');
  }
  
  /**
   * Check if a phone number is available for import (not already in use)
   */
  async isNumberAvailableForImport(phoneNumber: string): Promise<boolean> {
    try {
      // Search for the number in the account
      const queryParams = new URLSearchParams({
        PhoneNumber: phoneNumber,
        PageSize: '1'
      });
      
      const endpoint = `/IncomingPhoneNumbers.json?${queryParams.toString()}`;
      const response: TwilioListResponse = await this.makeRequest(endpoint);
      
      return response.incoming_phone_numbers.length > 0;
    } catch (error) {
      logger.error('Failed to check number availability', error as Error, {
        operation: 'twilio_provider'
      });
      return false;
    }
  }
  
  /**
   * Get usage statistics for the account
   */
  async getUsageStatistics(): Promise<any> {
    try {
      const endpoint = '/Usage/Records.json?Category=phonenumbers&Granularity=all_time';
      return await this.makeRequest(endpoint);
    } catch (error) {
      logger.error('Failed to get usage statistics', error as Error, {
        operation: 'twilio_provider'
      });
      return null;
    }
  }

  /**
   * Search for available phone numbers to purchase
   * Note: This method delegates to the existing TwilioClient for now
   * In the future, this could be refactored to use the provider pattern directly
   */
  async searchAvailablePhoneNumbers(options: SearchNumbersOptions): Promise<SearchNumbersResult> {
    // For now, throw an error indicating this should use the TwilioClient
    // This maintains backward compatibility while we transition
    throw new Error('Twilio phone number search should use TwilioClient.searchAvailablePhoneNumbers() for now. Provider-based search coming soon.');
  }

  /**
   * Purchase a phone number
   * Note: This method delegates to the existing TwilioClient for now
   * In the future, this could be refactored to use the provider pattern directly
   */
  async purchasePhoneNumber(options: PurchaseNumberOptions): Promise<PurchaseNumberResult> {
    // For now, throw an error indicating this should use the TwilioClient
    // This maintains backward compatibility while we transition
    throw new Error('Twilio phone number purchase should use TwilioClient.purchasePhoneNumber() for now. Provider-based purchase coming soon.');
  }
}
