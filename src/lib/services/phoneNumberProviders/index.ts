import { PhoneNumberProviderFactory } from './BaseProvider';
import { TwilioProvider } from './TwilioProvider';
import { TelnyxProvider } from './TelnyxProvider';

// Register all providers
PhoneNumberProviderFactory.registerProvider('twilio', TwilioProvider);
PhoneNumberProviderFactory.registerProvider('telnyx', TelnyxProvider);

// Export everything
export * from './BaseProvider';
export { TwilioProvider } from './TwilioProvider';
export { TelnyxProvider } from './TelnyxProvider';

// Export the factory as default
export default PhoneNumberProviderFactory;

/**
 * Supported provider types
 */
export type SupportedProvider = 'twilio' | 'telnyx';

/**
 * Provider credential types
 */
export interface TwilioCredentials {
  accountSid: string;
  authToken: string;
}

export interface TelnyxCredentials {
  apiKey: string;
}

export type ProviderCredentialsMap = {
  twilio: TwilioCredentials;
  telnyx: TelnyxCredentials;
};

/**
 * Utility functions for provider management
 */
export class ProviderUtils {
  /**
   * Validate provider credentials format
   */
  static validateCredentialsFormat(provider: SupportedProvider, credentials: any): boolean {
    switch (provider) {
      case 'twilio':
        return (
          typeof credentials.accountSid === 'string' &&
          credentials.accountSid.startsWith('AC') &&
          credentials.accountSid.length === 34 &&
          typeof credentials.authToken === 'string' &&
          credentials.authToken.length >= 32
        );
      
      case 'telnyx':
        return (
          typeof credentials.apiKey === 'string' &&
          credentials.apiKey.startsWith('KEY') &&
          credentials.apiKey.length >= 40
        );
      
      default:
        return false;
    }
  }
  
  /**
   * Get provider display name
   */
  static getProviderDisplayName(provider: SupportedProvider): string {
    switch (provider) {
      case 'twilio':
        return 'Twilio';
      case 'telnyx':
        return 'Telnyx';
      default:
        return provider;
    }
  }
  
  /**
   * Get provider documentation URL
   */
  static getProviderDocumentationUrl(provider: SupportedProvider): string {
    switch (provider) {
      case 'twilio':
        return 'https://www.twilio.com/docs/phone-numbers';
      case 'telnyx':
        return 'https://developers.telnyx.com/docs/api/v2/numbers';
      default:
        return '';
    }
  }
  
  /**
   * Get provider credential requirements
   */
  static getCredentialRequirements(provider: SupportedProvider): Array<{
    field: string;
    label: string;
    type: string;
    placeholder: string;
    description: string;
    required: boolean;
  }> {
    switch (provider) {
      case 'twilio':
        return [
          {
            field: 'accountSid',
            label: 'Account SID',
            type: 'text',
            placeholder: 'ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
            description: 'Your Twilio Account SID (starts with AC)',
            required: true
          },
          {
            field: 'authToken',
            label: 'Auth Token',
            type: 'password',
            placeholder: 'Your Auth Token',
            description: 'Your Twilio Auth Token from the console',
            required: true
          }
        ];
      
      case 'telnyx':
        return [
          {
            field: 'apiKey',
            label: 'API Key',
            type: 'password',
            placeholder: 'KEYxxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx',
            description: 'Your Telnyx API Key (starts with KEY)',
            required: true
          }
        ];
      
      default:
        return [];
    }
  }
  
  /**
   * Mask sensitive credential data for logging/display
   */
  static maskCredentials(provider: SupportedProvider, credentials: any): any {
    switch (provider) {
      case 'twilio':
        return {
          accountSid: credentials.accountSid,
          authToken: credentials.authToken ? `${credentials.authToken.substring(0, 8)}...` : undefined
        };
      
      case 'telnyx':
        return {
          apiKey: credentials.apiKey ? `${credentials.apiKey.substring(0, 8)}...` : undefined
        };
      
      default:
        return credentials;
    }
  }
  
  /**
   * Get provider-specific error messages
   */
  static getProviderErrorMessage(provider: SupportedProvider, error: any): string {
    const baseMessage = error.message || 'Unknown error';
    
    switch (provider) {
      case 'twilio':
        if (baseMessage.includes('20003')) {
          return 'Invalid Account SID or Auth Token. Please check your Twilio credentials.';
        }
        if (baseMessage.includes('20404')) {
          return 'The requested resource was not found in your Twilio account.';
        }
        if (baseMessage.includes('20429')) {
          return 'Too many requests to Twilio API. Please try again later.';
        }
        break;
      
      case 'telnyx':
        if (baseMessage.includes('unauthorized')) {
          return 'Invalid API Key. Please check your Telnyx credentials.';
        }
        if (baseMessage.includes('forbidden')) {
          return 'Access forbidden. Please check your Telnyx API key permissions.';
        }
        if (baseMessage.includes('rate limit')) {
          return 'Too many requests to Telnyx API. Please try again later.';
        }
        break;
    }
    
    return baseMessage;
  }
  
  /**
   * Get provider capabilities
   */
  static getProviderCapabilities(provider: SupportedProvider): {
    supportsVoice: boolean;
    supportsSMS: boolean;
    supportsMMS: boolean;
    supportsFax: boolean;
    supportsEmergency: boolean;
    supportsPorting: boolean;
  } {
    switch (provider) {
      case 'twilio':
        return {
          supportsVoice: true,
          supportsSMS: true,
          supportsMMS: true,
          supportsFax: true,
          supportsEmergency: true,
          supportsPorting: true
        };
      
      case 'telnyx':
        return {
          supportsVoice: true,
          supportsSMS: true,
          supportsMMS: true,
          supportsFax: true,
          supportsEmergency: true,
          supportsPorting: true
        };
      
      default:
        return {
          supportsVoice: false,
          supportsSMS: false,
          supportsMMS: false,
          supportsFax: false,
          supportsEmergency: false,
          supportsPorting: false
        };
    }
  }
}
