import { logger } from '@/lib/logger';

export interface TelnyxSipConfig {
  connectionId: string;
  fqdnId: string;
  phoneNumberId: string;
  username: string;
  password: string;
  sipDomain: string;
}

export interface TelnyxCredentials {
  apiKey: string;
}

export class TelnyxSipService {
  private apiKey: string;
  private baseUrl = 'https://api.telnyx.com/v2';

  constructor(credentials: TelnyxCredentials) {
    this.apiKey = credentials.apiKey;
  }

  /**
   * Create an outbound voice profile for Retell outbound calls
   */
  async createOutboundVoiceProfile(phoneNumber: string): Promise<string> {
    try {
      logger.info('Creating outbound voice profile for Retell', {
        operation: 'telnyx_sip_service',
        phoneNumber
      });

      // Create outbound voice profile with minimal required settings
      const profileData = {
        name: `Retell-Outbound-${phoneNumber.replace('+', '')}`,
        enabled: true,
        service_plan: "global",
        whitelisted_destinations: ["US", "CA"], // Default destinations
        traffic_type: "conversational",
        usage_payment_method: "rate-deck"
      };

      const response = await this.makeRequest('/outbound_voice_profiles', 'POST', profileData);
      const profile = response.data;

      logger.info('Created outbound voice profile', {
        operation: 'telnyx_sip_service',
        profileId: profile.id,
        profileName: profile.name
      });

      return profile.id;
    } catch (error: any) {
      logger.error('Failed to create outbound voice profile', error as Error, {
        operation: 'telnyx_sip_service',
        phoneNumber,
        response: error.response?.data
      });
      throw new Error(`Failed to create outbound voice profile: ${error.message}`);
    }
  }

  /**
   * Delete outbound voice profile for a phone number
   */
  async deleteOutboundVoiceProfile(phoneNumber: string): Promise<void> {
    try {
      logger.info('Deleting outbound voice profile for phone number', {
        operation: 'telnyx_sip_service',
        phoneNumber
      });

      // Use the same naming convention as creation to find the profile
      const profileName = `Retell-Outbound-${phoneNumber.replace('+', '')}`;

      // Get all outbound voice profiles and find the one with matching name
      const profilesResponse = await this.makeRequest('/outbound_voice_profiles');
      const profiles = profilesResponse.data || [];

      const targetProfile = profiles.find((profile: any) => profile.name === profileName);

      if (!targetProfile) {
        logger.info('No outbound voice profile found to delete', {
          operation: 'telnyx_sip_service',
          phoneNumber,
          profileName
        });
        return;
      }

      // Delete the profile
      await this.makeRequest(`/outbound_voice_profiles/${targetProfile.id}`, 'DELETE');

      logger.info('Successfully deleted outbound voice profile', {
        operation: 'telnyx_sip_service',
        phoneNumber,
        profileId: targetProfile.id,
        profileName: targetProfile.name
      });

    } catch (error: any) {
      // Log error but don't throw - cleanup should be resilient
      logger.error('Failed to delete outbound voice profile', error as Error, {
        operation: 'telnyx_sip_service',
        phoneNumber,
        response: error.response?.data
      });

      // Only throw if it's not a "not found" error
      if (!error.message?.includes('not found') && !error.message?.includes('404')) {
        console.warn(`[CLEANUP] Could not delete outbound voice profile for ${phoneNumber}: ${error.message}`);
      }
    }
  }

  /**
   * Get the correct Telnyx FQDN for termination URI based on SIP region
   * This is what Retell needs to route calls back to Telnyx
   */
  getTelnyxFqdnForPhoneNumber(phoneNumber: string): string {
    const sipRegion = this.getSipRegionForPhoneNumber(phoneNumber);

    // Map SIP regions to their corresponding Telnyx FQDNs
    // Based on https://sip.telnyx.com/
    switch (sipRegion) {
      case 'US':
        return 'sip.telnyx.com';
      case 'Europe':
        return 'europe.sip.telnyx.com';
      case 'Australia':
        return 'australia.sip.telnyx.com';
      default:
        // Global routing - use main FQDN
        return 'sip.telnyx.com';
    }
  }

  /**
   * Get the appropriate SIP region based on phone number country code
   * Valid Telnyx regions: "US", "Europe", "Australia"
   * Returns null to omit the field if we want to use global routing
   */
  private getSipRegionForPhoneNumber(phoneNumber: string): string | null {
    // Option 1: Always return null to use global routing (sip.telnyx.com)
    // This allows Telnyx to automatically route to the nearest PoP
    // This is recommended for global customers including South America, Asia, Africa, etc.
    if (process.env.TELNYX_USE_GLOBAL_ROUTING === 'true') {
      return null;
    }

    // Option 2: Use region-specific routing based on phone number
    // Remove + and get country code
    const cleanNumber = phoneNumber.replace('+', '');

    // Map country codes to Telnyx SIP regions
    if (cleanNumber.startsWith('1')) {
      // US/Canada
      return 'US';
    } else if (cleanNumber.startsWith('44') || // UK
               cleanNumber.startsWith('49') || // Germany
               cleanNumber.startsWith('33') || // France
               cleanNumber.startsWith('39') || // Italy
               cleanNumber.startsWith('34') || // Spain
               cleanNumber.startsWith('31') || // Netherlands
               cleanNumber.startsWith('32') || // Belgium
               cleanNumber.startsWith('41') || // Switzerland
               cleanNumber.startsWith('43') || // Austria
               cleanNumber.startsWith('45') || // Denmark
               cleanNumber.startsWith('46') || // Sweden
               cleanNumber.startsWith('47') || // Norway
               cleanNumber.startsWith('48') || // Poland
               cleanNumber.startsWith('420') || // Czech Republic
               cleanNumber.startsWith('421') || // Slovakia
               cleanNumber.startsWith('358') || // Finland
               cleanNumber.startsWith('372') || // Estonia
               cleanNumber.startsWith('371') || // Latvia
               cleanNumber.startsWith('370') || // Lithuania
               cleanNumber.startsWith('351') || // Portugal
               cleanNumber.startsWith('30') || // Greece
               cleanNumber.startsWith('36') || // Hungary
               cleanNumber.startsWith('385') || // Croatia
               cleanNumber.startsWith('386') || // Slovenia
               cleanNumber.startsWith('40') || // Romania
               cleanNumber.startsWith('359') || // Bulgaria
               cleanNumber.startsWith('353')) { // Ireland
      // Europe
      return 'Europe';
    } else if (cleanNumber.startsWith('61')) {
      // Australia/New Zealand
      return 'Australia';
    }

    // For all other regions (Asia, South America, Africa, Middle East),
    // use US as default since Telnyx only has these 3 regions
    return 'US';
  }

  private async makeRequest(endpoint: string, method: 'GET' | 'POST' | 'PATCH' | 'DELETE' = 'GET', data?: any) {
    const url = `${this.baseUrl}${endpoint}`;
    const headers = {
      'Authorization': `Bearer ${this.apiKey}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    };

    const config: RequestInit = {
      method,
      headers,
    };

    if (data && (method === 'POST' || method === 'PATCH')) {
      config.body = JSON.stringify(data);
    }

    const response = await fetch(url, config);
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Telnyx API error: ${response.status} ${response.statusText} - ${errorText}`);
    }

    return response.json();
  }

  /**
   * Check if a phone number has an existing SIP connection
   */
  async checkExistingSipConnection(phoneNumber: string): Promise<TelnyxSipConfig | null> {
    try {
      logger.info('Checking existing SIP connection for phone number', {
        operation: 'telnyx_sip_service',
        phoneNumber
      });

      // Get phone number details
      const phoneNumbersResponse = await this.makeRequest(`/phone_numbers?filter[phone_number]=${phoneNumber.replace('+', '')}`);

      if (!phoneNumbersResponse.data || phoneNumbersResponse.data.length === 0) {
        logger.info('Phone number not found in Telnyx', {
          operation: 'telnyx_sip_service',
          phoneNumber
        });
        return null;
      }

      const phoneNumberData = phoneNumbersResponse.data[0];

      if (phoneNumberData.connection_id) {
        logger.info('Found existing connection', {
          operation: 'telnyx_sip_service',
          connectionId: phoneNumberData.connection_id,
          phoneNumber
        });

        // Get connection details
        const connectionResponse = await this.makeRequest(`/fqdn_connections/${phoneNumberData.connection_id}`);
        const connection = connectionResponse.data;

        // Get FQDN details
        const fqdnsResponse = await this.makeRequest(`/fqdns?filter[connection_id]=${phoneNumberData.connection_id}`);
        const fqdn = fqdnsResponse.data && fqdnsResponse.data.length > 0 ? fqdnsResponse.data[0] : null;

        return {
          connectionId: connection.id,
          fqdnId: fqdn?.id || '',
          phoneNumberId: phoneNumberData.id,
          username: connection.user_name || '',
          password: connection.password || '',
          sipDomain: fqdn?.fqdn || ''
        };
      }

      logger.info('No existing SIP connection found for phone number', {
        operation: 'telnyx_sip_service',
        phoneNumber
      });
      return null;

    } catch (error: any) {
      // Handle 404 errors gracefully - phone number doesn't exist in this Telnyx account
      if (error.message && error.message.includes('404 Not Found')) {
        logger.warn('Phone number not found in Telnyx account - no existing SIP connection', {
          operation: 'telnyx_sip_service',
          phoneNumber,
          error: error.message
        });
        return null; // No existing SIP connection if phone number doesn't exist
      }

      logger.error('Error checking existing SIP connection', error as Error, {
        operation: 'telnyx_sip_service',
        phoneNumber
      });
      throw new Error(`Failed to check existing SIP connection: ${error.message}`);
    }
  }

  /**
   * Create a new SIP connection configured for Retell
   */
  async createSipConnectionForRetell(phoneNumber: string, retellSipEndpoint: string, assignmentType?: 'inbound' | 'outbound' | 'dual'): Promise<TelnyxSipConfig> {
    try {
      logger.info('Creating SIP connection for Retell', {
        operation: 'telnyx_sip_service',
        phoneNumber,
        retellSipEndpoint
      });

      // Generate credentials for the connection
      // Telnyx requires username to contain only letters and numbers (no underscores, spaces, or special chars)
      // Also has a 32-character limit, so we need to keep it short
      const cleanPhoneNumber = phoneNumber.replace(/\D/g, ''); // Remove all non-digits
      const shortTimestamp = Date.now().toString().slice(-8); // Last 8 digits for uniqueness
      const username = `r${cleanPhoneNumber}${shortTimestamp}`; // "r" + phone + timestamp (under 32 chars)
      const password = this.generateSecurePassword();

      // Create outbound voice profile if this is for outbound calls
      let outboundVoiceProfileId = "";
      if (assignmentType === 'outbound' || assignmentType === 'dual') {
        outboundVoiceProfileId = await this.createOutboundVoiceProfile(phoneNumber);
      }

      // Create FQDN connection for both inbound and outbound
      // Add timestamp to make connection name unique and avoid conflicts
      const timestamp = Date.now().toString().slice(-8); // Last 8 digits for uniqueness
      const connectionData = {
        active: true,
        anchorsite_override: "Latency",
        connection_name: `Retell-${phoneNumber}-${timestamp}`,
        user_name: username,
        password: password,
        inbound: {
          ani_number_format: "+E.164",
          dnis_number_format: "+e164",
          codecs: ["G722", "G729", "OPUS"],  // Required codecs for Retell
          default_routing_method: "sequential",
          channel_limit: 10,
          generate_ringback_tone: true,
          isup_headers_enabled: false,
          prack_enabled: false,
          privacy_zone_enabled: false,
          sip_compact_headers_enabled: false,
          transport: "tcp",  // CRITICAL: Retell requires TCP transport (UDP not supported)
          ...(this.getSipRegionForPhoneNumber(phoneNumber) && {
            sip_region: this.getSipRegionForPhoneNumber(phoneNumber)
          }),
          sip_subdomain_receive_settings: "only_my_connections",
          timeout_1xx_secs: 3,
          timeout_2xx_secs: 90,
          t38_reinvite_source: "customer"
        },
        outbound: {
          ani_override: "",
          ani_override_type: "always",
          call_parking_enabled: false,
          channel_limit: 10,
          generate_ringback_tone: true,
          instant_ringback_enabled: false,
          localization: "US",
          outbound_voice_profile_id: outboundVoiceProfileId,  // Use created profile ID for outbound calls
          t38_reinvite_source: "customer"
        }
      };

      let connectionResponse;
      let connection;

      try {
        connectionResponse = await this.makeRequest('/fqdn_connections', 'POST', connectionData);
        connection = connectionResponse.data;
      } catch (error: any) {
        // If connection name conflict, try with a more unique name
        if (error.message && error.message.includes('10015') && error.message.includes('name you have chosen is already in use')) {
          logger.warn('Connection name conflict, retrying with more unique name', {
            operation: 'telnyx_sip_service',
            originalName: connectionData.connection_name
          });

          // Add more uniqueness with full timestamp + random suffix
          const uniqueSuffix = `${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
          connectionData.connection_name = `Retell-${phoneNumber}-${uniqueSuffix}`;

          connectionResponse = await this.makeRequest('/fqdn_connections', 'POST', connectionData);
          connection = connectionResponse.data;
        } else {
          throw error;
        }
      }

      logger.info('Created FQDN connection', {
        operation: 'telnyx_sip_service',
        connectionId: connection.id
      });

      // Create FQDN pointing to Retell's SIP endpoint
      // Note: For SRV records, port field must be completely omitted per Telnyx API requirements
      // Including port (even as null) causes "sip.retellai.com:null" to appear in dashboard
      const fqdnData = {
        connection_id: connection.id,
        fqdn: retellSipEndpoint,
        dns_record_type: "srv"  // SRV record type as required by Retell
      };
      // Do NOT include port field for SRV records - this is critical!

      const fqdnResponse = await this.makeRequest('/fqdns', 'POST', fqdnData);
      const fqdn = fqdnResponse.data;

      logger.info('Created FQDN', {
        operation: 'telnyx_sip_service',
        fqdnId: fqdn.id,
        fqdn: retellSipEndpoint
      });

      // Get phone number ID
      const phoneNumbersResponse = await this.makeRequest(`/phone_numbers?filter[phone_number]=${phoneNumber.replace('+', '')}`);

      if (!phoneNumbersResponse.data || phoneNumbersResponse.data.length === 0) {
        throw new Error(`Phone number ${phoneNumber} not found in Telnyx account. Please verify the phone number exists and you have the correct credentials.`);
      }

      const phoneNumberData = phoneNumbersResponse.data[0];

      // Associate phone number with the connection
      await this.makeRequest(`/phone_numbers/${phoneNumberData.id}`, 'PATCH', {
        connection_id: connection.id
      });

      logger.info('Associated phone number with connection', {
        operation: 'telnyx_sip_service',
        phoneNumberId: phoneNumberData.id,
        connectionId: connection.id
      });

      return {
        connectionId: connection.id,
        fqdnId: fqdn.id,
        phoneNumberId: phoneNumberData.id,
        username: username,
        password: password,
        sipDomain: retellSipEndpoint
      };

    } catch (error: any) {
      // Handle 404 errors gracefully - phone number doesn't exist in this Telnyx account
      if (error.message && error.message.includes('404 Not Found')) {
        logger.error('Phone number not found in Telnyx account during SIP creation', error as Error, {
          operation: 'telnyx_sip_service',
          phoneNumber
        });
        throw new Error(`Phone number ${phoneNumber} not found in Telnyx account. Please verify the phone number exists and you have the correct credentials.`);
      }

      logger.error('Error creating SIP connection', error as Error, {
        operation: 'telnyx_sip_service',
        phoneNumber
      });
      throw new Error(`Failed to create SIP connection: ${error.message}`);
    }
  }

  /**
   * Update an existing SIP connection's inbound settings for Retell compatibility
   */
  async updateConnectionInboundSettings(connectionId: string, phoneNumber: string): Promise<void> {
    try {
      logger.info('Updating SIP connection inbound settings for Retell', {
        operation: 'telnyx_sip_service',
        connectionId,
        phoneNumber
      });

      const inboundSettings = {
        inbound: {
          ani_number_format: "+E.164",
          dnis_number_format: "+e164",
          codecs: ["G722", "G729", "OPUS"],  // Required codecs for Retell
          default_routing_method: "sequential",
          channel_limit: 10,
          generate_ringback_tone: true,
          isup_headers_enabled: false,
          prack_enabled: false,
          privacy_zone_enabled: false,
          sip_compact_headers_enabled: false,
          transport: "tcp",  // CRITICAL: Retell requires TCP transport (UDP not supported)
          ...(this.getSipRegionForPhoneNumber(phoneNumber) && {
            sip_region: this.getSipRegionForPhoneNumber(phoneNumber)
          }),
          sip_subdomain_receive_settings: "only_my_connections",
          timeout_1xx_secs: 3,
          timeout_2xx_secs: 90,
          t38_reinvite_source: "customer"
        }
      };

      await this.makeRequest(`/fqdn_connections/${connectionId}`, 'PATCH', inboundSettings);

      logger.info('Successfully updated SIP connection inbound settings', {
        operation: 'telnyx_sip_service',
        connectionId,
        phoneNumber,
        sipRegion: this.getSipRegionForPhoneNumber(phoneNumber)
      });

    } catch (error: any) {
      logger.error('Error updating SIP connection inbound settings', error as Error, {
        operation: 'telnyx_sip_service',
        connectionId,
        phoneNumber
      });
      throw new Error(`Failed to update connection inbound settings: ${error.message}`);
    }
  }

  /**
   * Update the FQDN of an existing SIP connection to point to Retell
   */
  async updateFqdnForRetell(connectionId: string, retellSipEndpoint: string): Promise<void> {
    try {
      logger.info('Updating FQDN for connection to Retell', {
        operation: 'telnyx_sip_service',
        connectionId,
        retellSipEndpoint
      });

      // Get existing FQDNs for the connection
      const fqdnsResponse = await this.makeRequest(`/fqdns?filter[connection_id]=${connectionId}`);

      // Delete existing FQDNs
      if (fqdnsResponse.data && fqdnsResponse.data.length > 0) {
        for (const fqdn of fqdnsResponse.data) {
          await this.makeRequest(`/fqdns/${fqdn.id}`, 'DELETE');
          logger.info('Deleted existing FQDN', {
            operation: 'telnyx_sip_service',
            fqdnId: fqdn.id
          });
        }
      }

      // Create new FQDN pointing to Retell
      // Note: For SRV records, port field must be completely omitted per Telnyx API requirements
      // Including port (even as null) causes "sip.retellai.com:null" to appear in dashboard
      const fqdnData = {
        connection_id: connectionId,
        fqdn: retellSipEndpoint,
        dns_record_type: "srv"  // SRV record type as required by Retell
      };
      // Do NOT include port field for SRV records - this is critical!

      await this.makeRequest('/fqdns', 'POST', fqdnData);

      logger.info('Updated FQDN for connection to Retell', {
        operation: 'telnyx_sip_service',
        connectionId,
        retellSipEndpoint
      });

    } catch (error: any) {
      logger.error('Error updating FQDN', error as Error, {
        operation: 'telnyx_sip_service',
        connectionId
      });
      throw new Error(`Failed to update FQDN: ${error.message}`);
    }
  }

  /**
   * Create a new SIP connection configured for VAPI
   */
  async createSipConnectionForVapi(phoneNumber: string, vapiSipEndpoint: string): Promise<TelnyxSipConfig> {
    try {
      logger.info('Creating SIP connection for VAPI', {
        operation: 'telnyx_sip_service',
        phoneNumber,
        vapiSipEndpoint
      });

      // Generate credentials for the connection
      // Telnyx requires username to contain only letters and numbers (no underscores, spaces, or special chars)
      // Also has a 32-character limit, so we need to keep it short
      const cleanPhoneNumber = phoneNumber.replace(/\D/g, ''); // Remove all non-digits
      const shortTimestamp = Date.now().toString().slice(-8); // Last 8 digits for uniqueness
      const username = `v${cleanPhoneNumber}${shortTimestamp}`; // "v" + phone + timestamp (under 32 chars)
      const password = this.generateSecurePassword();

      // Create FQDN connection for both inbound and outbound
      // Add timestamp to make connection name unique and avoid conflicts
      const timestamp = Date.now().toString().slice(-8); // Last 8 digits for uniqueness
      const connectionData = {
        active: true,
        anchorsite_override: "Latency",
        connection_name: `VAPI-${phoneNumber}-${timestamp}`,
        user_name: username,
        password: password,
        inbound: {
          ani_number_format: "+E.164",
          dnis_number_format: "+e164",
          codecs: ["G722", "G729", "OPUS"],  // Standard codecs for voice AI
          default_routing_method: "sequential",
          channel_limit: 10,
          generate_ringback_tone: true,
          ...(this.getSipRegionForPhoneNumber(phoneNumber) && {
            sip_region: this.getSipRegionForPhoneNumber(phoneNumber)
          }),
          sip_subdomain_receive_settings: "only_my_connections"
        },
        outbound: {
          ani_override: "",
          ani_override_type: "always",
          channel_limit: 10,
          generate_ringback_tone: true,
          instant_ringback_enabled: false,  // CRITICAL: Cannot be true when generate_ringback_tone is true
          localization: "US"
        }
      };

      let connectionResponse;
      let connection;

      try {
        connectionResponse = await this.makeRequest('/fqdn_connections', 'POST', connectionData);
        connection = connectionResponse.data;
      } catch (error: any) {
        // If connection name conflict, try with a more unique name
        if (error.message && error.message.includes('10015') && error.message.includes('name you have chosen is already in use')) {
          logger.warn('Connection name conflict, retrying with more unique name', {
            operation: 'telnyx_sip_service',
            originalName: connectionData.connection_name
          });

          // Add more uniqueness with full timestamp + random suffix
          const uniqueSuffix = `${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
          connectionData.connection_name = `VAPI-${phoneNumber}-${uniqueSuffix}`;

          connectionResponse = await this.makeRequest('/fqdn_connections', 'POST', connectionData);
          connection = connectionResponse.data;
        } else {
          throw error;
        }
      }

      logger.info('Created FQDN connection for VAPI', {
        operation: 'telnyx_sip_service',
        connectionId: connection.id
      });

      // Create FQDN pointing to VAPI's SIP endpoint
      const fqdnData = {
        connection_id: connection.id,
        fqdn: vapiSipEndpoint,
        port: 5060,
        dns_record_type: "a"
      };

      const fqdnResponse = await this.makeRequest('/fqdns', 'POST', fqdnData);
      const fqdn = fqdnResponse.data;

      logger.info('Created FQDN for VAPI', {
        operation: 'telnyx_sip_service',
        fqdnId: fqdn.id,
        fqdn: vapiSipEndpoint
      });

      // Get phone number ID first (same logic as Retell assignment)
      const phoneNumbersResponse = await this.makeRequest(`/phone_numbers?filter[phone_number]=${phoneNumber.replace('+', '')}`);

      if (!phoneNumbersResponse.data || phoneNumbersResponse.data.length === 0) {
        throw new Error(`Phone number ${phoneNumber} not found in Telnyx account. Please verify the phone number exists and you have the correct credentials.`);
      }

      const phoneNumberData = phoneNumbersResponse.data[0];

      // Assign the connection to the phone number using the correct Telnyx phone number ID
      await this.makeRequest(`/phone_numbers/${phoneNumberData.id}`, 'PATCH', {
        connection_id: connection.id
      });

      logger.info('Assigned connection to phone number for VAPI', {
        operation: 'telnyx_sip_service',
        phoneNumber,
        connectionId: connection.id
      });

      return {
        connectionId: connection.id,
        fqdnId: fqdn.id,
        phoneNumberId: phoneNumberData.id,  // Use the correct Telnyx phone number ID
        username: username,
        password: password,
        sipDomain: `${connection.id}.telnyx.com`
      };

    } catch (error: any) {
      // Handle 404 errors gracefully - phone number doesn't exist in this Telnyx account
      if (error.message && error.message.includes('404 Not Found')) {
        logger.error('Phone number not found in Telnyx account during VAPI SIP creation', error as Error, {
          operation: 'telnyx_sip_service',
          phoneNumber
        });
        throw new Error(`Phone number ${phoneNumber} not found in Telnyx account. Please verify the phone number exists and you have the correct credentials.`);
      }

      logger.error('Error creating SIP connection for VAPI', error as Error, {
        operation: 'telnyx_sip_service',
        phoneNumber
      });
      throw new Error(`Failed to create SIP connection for VAPI: ${error.message}`);
    }
  }

  /**
   * Remove SIP connection configuration from a phone number
   * Also cleans up associated outbound voice profiles for Retell agents
   */
  async removeSipConnection(phoneNumberId: string, connectionId: string, phoneNumber?: string): Promise<void> {
    const cleanupResults = {
      phoneNumberUnassigned: false,
      fqdnsDeleted: 0,
      connectionDeleted: false,
      outboundProfileDeleted: false
    };

    try {
      logger.info('Removing SIP connection configuration', {
        operation: 'telnyx_sip_service',
        phoneNumberId,
        connectionId,
        phoneNumber
      });

      // STEP 1: Get the actual Telnyx phone number ID first
      // The phoneNumberId parameter is actually the phone number (without +), but Telnyx API needs the internal ID
      let telnyxPhoneNumberId: string;
      try {
        const phoneNumbersResponse = await this.makeRequest(`/phone_numbers?filter[phone_number]=${phoneNumberId}`);

        if (!phoneNumbersResponse.data || phoneNumbersResponse.data.length === 0) {
          logger.warn('Phone number not found in Telnyx account during cleanup', {
            operation: 'telnyx_sip_service',
            phoneNumber: phoneNumberId
          });
          // Continue with other cleanup steps even if phone number not found
          telnyxPhoneNumberId = '';
        } else {
          telnyxPhoneNumberId = phoneNumbersResponse.data[0].id;
          logger.info('Found Telnyx phone number ID for cleanup', {
            operation: 'telnyx_sip_service',
            phoneNumber: phoneNumberId,
            telnyxPhoneNumberId
          });
        }
      } catch (error: any) {
        logger.warn('Error looking up Telnyx phone number ID, continuing with cleanup', {
          operation: 'telnyx_sip_service',
          phoneNumber: phoneNumberId,
          error: error.message
        });
        telnyxPhoneNumberId = '';
      }

      // STEP 2: Remove connection assignment from phone number FIRST (if we found the ID)
      // This is CRITICAL - Telnyx requires phone number to be unlinked before connection can be deleted
      // Error 10015: "Cannot be deleted when in use by a number or a telephone data endpoint"
      if (telnyxPhoneNumberId) {
        try {
          await this.makeRequest(`/phone_numbers/${telnyxPhoneNumberId}`, 'PATCH', {
            connection_id: null
          });
          cleanupResults.phoneNumberUnassigned = true;
          logger.info('Successfully unlinked phone number from SIP connection', {
            operation: 'telnyx_sip_service',
            phoneNumber: phoneNumberId,
            telnyxPhoneNumberId,
            connectionId
          });
        } catch (error: any) {
          if (error.message.includes('404') || error.message.includes('not found')) {
            logger.warn('Phone number already unassigned or not found', {
              operation: 'telnyx_sip_service',
              phoneNumber: phoneNumberId,
              telnyxPhoneNumberId
            });
            // Continue with cleanup even if phone number not found
          } else {
            logger.error('Failed to unlink phone number from SIP connection', error as Error, {
              operation: 'telnyx_sip_service',
              phoneNumber: phoneNumberId,
              telnyxPhoneNumberId,
              connectionId
            });
            throw error;
          }
        }
      }

      // STEP 3: Get and delete FQDNs associated with the connection (resilient to 404)
      try {
        const fqdnsResponse = await this.makeRequest(`/fqdns?filter[connection_id]=${connectionId}`);
        if (fqdnsResponse.data && fqdnsResponse.data.length > 0) {
          for (const fqdn of fqdnsResponse.data) {
            try {
              await this.makeRequest(`/fqdns/${fqdn.id}`, 'DELETE');
              cleanupResults.fqdnsDeleted++;
              logger.info('Successfully deleted FQDN', {
                operation: 'telnyx_sip_service',
                fqdnId: fqdn.id,
                connectionId
              });
            } catch (fqdnError: any) {
              if (!fqdnError.message.includes('404') && !fqdnError.message.includes('not found')) {
                throw fqdnError;
              }
            }
          }
        }
      } catch (error: any) {
        if (!error.message.includes('404') && !error.message.includes('not found')) {
          throw error;
        }
      }

      // STEP 4: Delete the connection (now that phone number is unlinked)
      try {
        await this.makeRequest(`/fqdn_connections/${connectionId}`, 'DELETE');
        cleanupResults.connectionDeleted = true;
        logger.info('Successfully deleted SIP connection', {
          operation: 'telnyx_sip_service',
          connectionId
        });
      } catch (error: any) {
        if (error.message.includes('404') || error.message.includes('not found')) {
          logger.warn('SIP connection already deleted or not found', {
            operation: 'telnyx_sip_service',
            connectionId
          });
        } else {
          logger.error('Failed to delete SIP connection', error as Error, {
            operation: 'telnyx_sip_service',
            connectionId
          });
          throw error;
        }
      }

      // STEP 5: Clean up outbound voice profile if phone number is provided
      // This is important for Retell agents that had outbound capabilities
      if (phoneNumber) {
        await this.deleteOutboundVoiceProfile(phoneNumber);
        cleanupResults.outboundProfileDeleted = true;
      }

      logger.info('Successfully completed SIP connection cleanup', {
        operation: 'telnyx_sip_service',
        connectionId,
        phoneNumber,
        cleanupResults
      });

    } catch (error: any) {
      logger.error('Error during SIP connection cleanup', error as Error, {
        operation: 'telnyx_sip_service',
        connectionId,
        phoneNumber,
        partialCleanupResults: cleanupResults
      });
      throw new Error(`Failed to remove SIP connection: ${error.message}`);
    }
  }

  private generateSecurePassword(): string {
    // Use crypto-secure random generation instead of Math.random()
    const crypto = require('crypto');
    return crypto.randomBytes(16).toString('hex');
  }
}
