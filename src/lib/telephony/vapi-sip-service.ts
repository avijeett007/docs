import { logger } from '@/lib/logger';

export interface VapiSipCredential {
  id: string;
  provider: string;
  realm?: string;
  username?: string;
  password?: string;
}

export interface VapiByoPhoneNumber {
  id: string;
  provider: string;
  number: string;
  credentialId: string;
  assistantId?: string;
  status: string;
}

export interface VapiCredentials {
  apiKey: string;
}

export class VapiSipService {
  private apiKey: string;
  private baseUrl = 'https://api.vapi.ai';

  constructor(credentials: VapiCredentials) {
    this.apiKey = credentials.apiKey;
  }

  /**
   * Make authenticated request to VAPI API
   */
  private async makeRequest(endpoint: string, method: string = 'GET', data?: any): Promise<any> {
    const url = `${this.baseUrl}${endpoint}`;
    
    const options: RequestInit = {
      method,
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json'
      }
    };

    if (data && (method === 'POST' || method === 'PATCH' || method === 'PUT')) {
      options.body = JSON.stringify(data);
    }

    logger.info('Making VAPI API request', {
      operation: 'vapi_sip_service',
      method,
      endpoint,
      hasData: !!data
    });

    const response = await fetch(url, options);
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      logger.error('VAPI API request failed', new Error(`${response.status}: ${response.statusText}`), {
        operation: 'vapi_sip_service',
        endpoint,
        status: response.status,
        error: errorData
      });
      throw new Error(`VAPI API request failed: ${errorData.message || response.statusText}`);
    }

    const result = await response.json();
    logger.info('VAPI API request successful', {
      operation: 'vapi_sip_service',
      endpoint,
      hasResult: !!result
    });

    return result;
  }

  /**
   * Create SIP credentials in VAPI for Telnyx SIP trunk
   */
  async createSipCredential(sipConfig: {
    realm: string;
    username: string;
    password: string;
  }): Promise<VapiSipCredential> {
    try {
      logger.info('Creating SIP credential in VAPI', {
        operation: 'vapi_sip_service',
        realm: sipConfig.realm,
        username: sipConfig.username
      });

      const credentialData = {
        provider: 'byo-sip-trunk',
        name: 'Telnyx Trunk',
        gateways: [
          {
            ip: 'sip.telnyx.com',
            inboundEnabled: false
          }
        ],
        outboundAuthenticationPlan: {
          authUsername: sipConfig.username,
          authPassword: sipConfig.password,
          sipRegisterPlan: {
            realm: sipConfig.realm
          }
        }
      };

      const credential = await this.makeRequest('/credential', 'POST', credentialData);

      logger.info('Created SIP credential in VAPI', {
        operation: 'vapi_sip_service',
        credentialId: credential.id
      });

      return credential;
    } catch (error: any) {
      logger.error('Error creating SIP credential', error as Error, {
        operation: 'vapi_sip_service',
        realm: sipConfig.realm
      });
      throw new Error(`Failed to create SIP credential: ${error.message}`);
    }
  }

  /**
   * Create BYO phone number in VAPI using SIP credential
   */
  async createByoPhoneNumber(config: {
    phoneNumber: string;
    credentialId: string;
    assistantId: string;
    name?: string;
  }): Promise<VapiByoPhoneNumber> {
    try {
      logger.info('Creating BYO phone number in VAPI', {
        operation: 'vapi_sip_service',
        phoneNumber: config.phoneNumber,
        credentialId: config.credentialId,
        assistantId: config.assistantId
      });

      const phoneNumberData = {
        provider: 'byo-phone-number',
        number: config.phoneNumber,
        credentialId: config.credentialId,
        assistantId: config.assistantId,
        name: config.name || `${config.phoneNumber.replace('+', '')}-${config.assistantId.slice(0, 8)}`
      };

      const phoneNumber = await this.makeRequest('/phone-number', 'POST', phoneNumberData);

      logger.info('Created BYO phone number in VAPI', {
        operation: 'vapi_sip_service',
        phoneNumberId: phoneNumber.id,
        phoneNumber: config.phoneNumber
      });

      return phoneNumber;
    } catch (error: any) {
      logger.error('Error creating BYO phone number', error as Error, {
        operation: 'vapi_sip_service',
        phoneNumber: config.phoneNumber
      });
      throw new Error(`Failed to create BYO phone number: ${error.message}`);
    }
  }

  /**
   * Delete SIP credential from VAPI
   */
  async deleteSipCredential(credentialId: string): Promise<void> {
    try {
      logger.info('Deleting SIP credential from VAPI', {
        operation: 'vapi_sip_service',
        credentialId
      });

      await this.makeRequest(`/credential/${credentialId}`, 'DELETE');

      logger.info('Deleted SIP credential from VAPI', {
        operation: 'vapi_sip_service',
        credentialId
      });
    } catch (error: any) {
      logger.error('Error deleting SIP credential', error as Error, {
        operation: 'vapi_sip_service',
        credentialId
      });
      throw new Error(`Failed to delete SIP credential: ${error.message}`);
    }
  }

  /**
   * Delete BYO phone number from VAPI
   */
  async deleteByoPhoneNumber(phoneNumberId: string): Promise<void> {
    try {
      logger.info('Deleting BYO phone number from VAPI', {
        operation: 'vapi_sip_service',
        phoneNumberId
      });

      await this.makeRequest(`/phone-number/${phoneNumberId}`, 'DELETE');

      logger.info('Deleted BYO phone number from VAPI', {
        operation: 'vapi_sip_service',
        phoneNumberId
      });
    } catch (error: any) {
      logger.error('Error deleting BYO phone number', error as Error, {
        operation: 'vapi_sip_service',
        phoneNumberId
      });
      throw new Error(`Failed to delete BYO phone number: ${error.message}`);
    }
  }
}
