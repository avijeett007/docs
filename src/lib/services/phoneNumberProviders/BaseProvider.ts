export interface PhoneNumberInfo {
  id: string;
  phoneNumber: string;
  friendlyName?: string;
  capabilities: {
    voice: boolean;
    sms: boolean;
    mms: boolean;
    fax: boolean;
  };
  status: string;
  purchasedAt?: Date;
  monthlyRecurringCost?: number;
  metadata?: Record<string, any>;
}

export interface ProviderCredentials {
  [key: string]: string;
}

export interface ValidationResult {
  isValid: boolean;
  accountInfo?: {
    accountId: string;
    friendlyName?: string;
    status?: string;
  };
  error?: string;
}

export interface ListNumbersOptions {
  page?: number;
  limit?: number;
  filter?: {
    status?: string;
    phoneNumber?: string;
  };
}

export interface SearchNumbersOptions {
  countryCode: string;
  type: 'local' | 'mobile' | 'tollfree';
  areaCode?: string;
  contains?: string;
  locality?: string;
  region?: string;
  limit?: number;
  voiceEnabled?: boolean;
  smsEnabled?: boolean;
  mmsEnabled?: boolean;
  faxEnabled?: boolean;
}

export interface AvailablePhoneNumber {
  phoneNumber: string;
  friendlyName?: string;
  locality?: string;
  region?: string;
  countryCode: string;
  type: 'local' | 'mobile' | 'tollfree';
  capabilities: {
    voice: boolean;
    sms: boolean;
    mms: boolean;
    fax: boolean;
  };
  monthlyPrice?: number;
  setupFee?: number;
  currency?: string;
  metadata?: Record<string, any>;
}

export interface SearchNumbersResult {
  numbers: AvailablePhoneNumber[];
  pagination?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrevious: boolean;
  };
}

export interface PurchaseNumberOptions {
  phoneNumber: string;
  friendlyName?: string;
  voiceUrl?: string;
  smsUrl?: string;
  metadata?: Record<string, any>;
}

export interface PurchaseNumberResult {
  id: string;
  phoneNumber: string;
  friendlyName?: string;
  status: string;
  purchasedAt: Date;
  monthlyRecurringCost?: number;
  metadata?: Record<string, any>;
}

export interface ListNumbersResult {
  numbers: PhoneNumberInfo[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrevious: boolean;
  };
}

export abstract class BasePhoneNumberProvider {
  protected credentials: ProviderCredentials;
  protected providerName: string;
  
  constructor(credentials: ProviderCredentials, providerName: string) {
    this.credentials = credentials;
    this.providerName = providerName;
  }
  
  /**
   * Validate the provider credentials
   */
  abstract validateCredentials(): Promise<ValidationResult>;
  
  /**
   * List phone numbers from the provider
   */
  abstract listPhoneNumbers(options?: ListNumbersOptions): Promise<ListNumbersResult>;
  
  /**
   * Get a specific phone number by ID
   */
  abstract getPhoneNumber(numberId: string): Promise<PhoneNumberInfo | null>;

  /**
   * Delete a phone number from the provider
   */
  abstract deletePhoneNumber(phoneNumber: string): Promise<void>;

  /**
   * Search for available phone numbers to purchase
   */
  abstract searchAvailablePhoneNumbers(options: SearchNumbersOptions): Promise<SearchNumbersResult>;

  /**
   * Purchase a phone number
   */
  abstract purchasePhoneNumber(options: PurchaseNumberOptions): Promise<PurchaseNumberResult>;

  /**
   * Get the provider name
   */
  getProviderName(): string {
    return this.providerName;
  }
  
  /**
   * Make an authenticated request to the provider API
   */
  protected abstract makeRequest(endpoint: string, options?: any): Promise<any>;
  
  /**
   * Handle and normalize provider-specific errors
   */
  protected handleProviderError(error: any): Error {
    if (error.response) {
      // HTTP error response
      const status = error.response.status;
      const message = error.response.data?.message || error.response.data?.error || error.message;
      
      switch (status) {
        case 401:
          return new Error('Invalid credentials or authentication failed');
        case 403:
          return new Error('Access forbidden - check your account permissions');
        case 404:
          return new Error('Resource not found');
        case 429:
          return new Error('Rate limit exceeded - please try again later');
        case 500:
        case 502:
        case 503:
        case 504:
          return new Error('Provider service temporarily unavailable');
        default:
          return new Error(`Provider API error (${status}): ${message}`);
      }
    } else if (error.code) {
      // Network or other errors
      switch (error.code) {
        case 'ECONNREFUSED':
        case 'ENOTFOUND':
        case 'ETIMEDOUT':
          return new Error('Unable to connect to provider - check your internet connection');
        default:
          return new Error(`Network error: ${error.message}`);
      }
    }
    
    return new Error(error.message || 'Unknown provider error');
  }
  
  /**
   * Validate phone number format
   */
  protected validatePhoneNumber(phoneNumber: string): boolean {
    // Basic E.164 format validation
    const e164Regex = /^\+[1-9]\d{1,14}$/;
    return e164Regex.test(phoneNumber);
  }
  
  /**
   * Normalize phone number to E.164 format
   */
  protected normalizePhoneNumber(phoneNumber: string): string {
    // Remove all non-digit characters except +
    let normalized = phoneNumber.replace(/[^\d+]/g, '');
    
    // Add + if not present
    if (!normalized.startsWith('+')) {
      normalized = '+' + normalized;
    }
    
    return normalized;
  }
  
  /**
   * Parse capabilities from provider-specific format
   */
  protected parseCapabilities(providerCapabilities: any): PhoneNumberInfo['capabilities'] {
    return {
      voice: Boolean(providerCapabilities?.voice),
      sms: Boolean(providerCapabilities?.sms || providerCapabilities?.SMS),
      mms: Boolean(providerCapabilities?.mms || providerCapabilities?.MMS),
      fax: Boolean(providerCapabilities?.fax)
    };
  }
  
  /**
   * Calculate pagination info
   */
  protected calculatePagination(page: number, limit: number, total: number) {
    const totalPages = Math.ceil(total / limit);
    
    return {
      page,
      limit,
      total,
      totalPages,
      hasNext: page < totalPages,
      hasPrevious: page > 1
    };
  }
}

/**
 * Provider factory for creating provider instances
 */
export class PhoneNumberProviderFactory {
  private static providers: Map<string, new (credentials: ProviderCredentials, providerName: string) => BasePhoneNumberProvider> = new Map();

  /**
   * Register a provider class
   */
  static registerProvider(name: string, providerClass: new (credentials: ProviderCredentials, providerName: string) => BasePhoneNumberProvider) {
    this.providers.set(name.toLowerCase(), providerClass);
  }
  
  /**
   * Create a provider instance
   */
  static createProvider(providerName: string, credentials: ProviderCredentials): BasePhoneNumberProvider {
    const ProviderClass = this.providers.get(providerName.toLowerCase());
    
    if (!ProviderClass) {
      throw new Error(`Unknown provider: ${providerName}`);
    }
    
    return new ProviderClass(credentials, providerName);
  }
  
  /**
   * Get list of supported providers
   */
  static getSupportedProviders(): string[] {
    return Array.from(this.providers.keys());
  }
  
  /**
   * Check if a provider is supported
   */
  static isProviderSupported(providerName: string): boolean {
    return this.providers.has(providerName.toLowerCase());
  }
}

/**
 * Provider-specific error types
 */
export class ProviderAuthenticationError extends Error {
  constructor(message: string, public provider: string) {
    super(message);
    this.name = 'ProviderAuthenticationError';
  }
}

export class ProviderRateLimitError extends Error {
  constructor(message: string, public provider: string, public retryAfter?: number) {
    super(message);
    this.name = 'ProviderRateLimitError';
  }
}

export class ProviderServiceError extends Error {
  constructor(message: string, public provider: string, public statusCode?: number) {
    super(message);
    this.name = 'ProviderServiceError';
  }
}

export class ProviderValidationError extends Error {
  constructor(message: string, public provider: string) {
    super(message);
    this.name = 'ProviderValidationError';
  }
}
