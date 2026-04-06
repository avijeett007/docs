import { logger } from '@/lib/logger';

export interface RetellPhoneNumberImportRequest {
  phone_number: string;
  termination_uri: string;
  inbound_agent_id?: string;
  outbound_agent_id?: string;
  auth_username?: string;
  auth_password?: string;
  inbound_webhook_url?: string;
  nickname?: string;
}

export interface RetellPhoneNumberImportResponse {
  phone_number_id: string;
  phone_number: string;
  termination_uri: string;
  inbound_agent_id?: string;
  outbound_agent_id?: string;
  nickname?: string;
  created_at: number;
}

export interface RetellApiCredentials {
  apiKey: string;
}

export class RetellPhoneNumberService {
  private apiKey: string;
  private baseUrl: string = 'https://api.retellai.com';

  constructor(credentials: RetellApiCredentials) {
    this.apiKey = credentials.apiKey;
  }

  /**
   * Import a phone number to Retell and assign it to agents (inbound and/or outbound)
   */
  async importPhoneNumber(request: RetellPhoneNumberImportRequest): Promise<RetellPhoneNumberImportResponse> {
    try {
      const agentInfo = request.inbound_agent_id
        ? `inbound: ${request.inbound_agent_id}${request.outbound_agent_id ? `, outbound: ${request.outbound_agent_id}` : ''}`
        : `outbound: ${request.outbound_agent_id}`;

      logger.info('Importing phone number to Retell', {
        operation: 'retell_phone_service',
        phoneNumber: request.phone_number,
        agentInfo,
        apiUrl: `${this.baseUrl}/import-phone-number`,
        requestPayload: request
      });

      // Validate that at least one agent is provided
      if (!request.inbound_agent_id && !request.outbound_agent_id) {
        throw new Error('At least one agent (inbound or outbound) must be specified');
      }

      const response = await fetch(`${this.baseUrl}/import-phone-number`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(request),
      });

      logger.info('Retell API response received', {
        operation: 'retell_phone_service',
        status: response.status,
        statusText: response.statusText
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        logger.error('Retell API error response', new Error('API Error'), {
          operation: 'retell_phone_service',
          errorData
        });
        const errorMessage = errorData.message || errorData.error || `HTTP ${response.status}: ${response.statusText}`;
        throw new Error(`Retell API error: ${errorMessage}`);
      }

      const data = await response.json();
      logger.info('Successfully imported phone number to Retell', {
        operation: 'retell_phone_service',
        phoneNumber: request.phone_number,
        responseData: data
      });

      return data;

    } catch (error: any) {
      logger.error('Error importing phone number to Retell', error as Error, {
        operation: 'retell_phone_service',
        phoneNumber: request.phone_number
      });
      throw new Error(`Failed to import phone number to Retell: ${error.message}`);
    }
  }

  /**
   * Update the agent assignment for an existing phone number
   */
  async updatePhoneNumberAgent(phoneNumberId: string, agentId: string, agentType: 'inbound' | 'outbound' = 'inbound'): Promise<void> {
    try {
      logger.info('Updating phone number agent assignment', {
        operation: 'retell_phone_service',
        phoneNumberId,
        agentType,
        agentId
      });

      const updatePayload: any = {
        phone_number_id: phoneNumberId,
      };

      if (agentType === 'inbound') {
        updatePayload.inbound_agent_id = agentId;
      } else {
        updatePayload.outbound_agent_id = agentId;
      }

      const response = await fetch(`${this.baseUrl}/update-phone-number`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updatePayload),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const errorMessage = errorData.message || errorData.error || `HTTP ${response.status}: ${response.statusText}`;
        throw new Error(`Retell API error: ${errorMessage}`);
      }

      logger.info('Successfully updated phone number agent assignment', {
        operation: 'retell_phone_service',
        phoneNumberId,
        agentType
      });

    } catch (error: any) {
      logger.error('Error updating phone number agent assignment', error as Error, {
        operation: 'retell_phone_service',
        phoneNumberId,
        agentType
      });
      throw new Error(`Failed to update phone number ${agentType} agent in Retell: ${error.message}`);
    }
  }

  /**
   * Update phone number with comprehensive agent configuration
   */
  async updatePhoneNumberConfiguration(phoneNumber: string, config: {
    inbound_agent_id?: string | null;
    outbound_agent_id?: string | null;
    inbound_webhook_url?: string;
    nickname?: string;
  }): Promise<void> {
    try {
      logger.info('Updating phone number configuration', {
        operation: 'retell_phone_service',
        phoneNumber,
        config
      });

      const updatePayload: any = {
        phone_number: phoneNumber,
        ...config
      };

      const response = await fetch(`${this.baseUrl}/update-phone-number`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updatePayload),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const errorMessage = errorData.message || errorData.error || `HTTP ${response.status}: ${response.statusText}`;
        throw new Error(`Retell API error: ${errorMessage}`);
      }

      logger.info('Successfully updated phone number configuration', {
        operation: 'retell_phone_service',
        phoneNumber
      });

    } catch (error: any) {
      logger.error('Error updating phone number configuration', error as Error, {
        operation: 'retell_phone_service',
        phoneNumber
      });
      throw new Error(`Failed to update phone number configuration in Retell: ${error.message}`);
    }
  }

  /**
   * Remove a phone number from Retell
   */
  async removePhoneNumber(phoneNumber: string): Promise<void> {
    try {
      logger.info('Removing phone number from Retell', {
        operation: 'retell_phone_service',
        phoneNumber
      });

      // Use the correct API endpoint format: DELETE /delete-phone-number/{phone_number}
      const response = await fetch(`${this.baseUrl}/delete-phone-number/${encodeURIComponent(phoneNumber)}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
      });

      logger.info('Retell delete response received', {
        operation: 'retell_phone_service',
        status: response.status,
        statusText: response.statusText
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        logger.error('Retell delete error response', new Error('Delete API Error'), {
          operation: 'retell_phone_service',
          errorData
        });
        const errorMessage = errorData.message || errorData.error || `HTTP ${response.status}: ${response.statusText}`;

        // Handle specific error cases
        if (response.status === 404) {
          throw new Error(`Phone number not found in Retell: ${errorMessage}`);
        } else {
          throw new Error(`Retell API error: ${errorMessage}`);
        }
      }

      logger.info('Successfully removed phone number from Retell', {
        operation: 'retell_phone_service',
        phoneNumber
      });

    } catch (error: any) {
      logger.error('Error removing phone number from Retell', error as Error, {
        operation: 'retell_phone_service',
        phoneNumber
      });
      throw new Error(`Failed to remove phone number from Retell: ${error.message}`);
    }
  }

  /**
   * Get phone number details from Retell
   */
  async getPhoneNumber(phoneNumberId: string): Promise<any> {
    try {
      logger.info('Getting phone number details from Retell', {
        operation: 'retell_phone_service',
        phoneNumberId
      });

      const response = await fetch(`${this.baseUrl}/get-phone-number/${phoneNumberId}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const errorMessage = errorData.message || errorData.error || `HTTP ${response.status}: ${response.statusText}`;
        throw new Error(`Retell API error: ${errorMessage}`);
      }

      const data = await response.json();
      logger.info('Successfully retrieved phone number details from Retell', {
        operation: 'retell_phone_service',
        phoneNumberId
      });
      
      return data;

    } catch (error: any) {
      logger.error('Error getting phone number details from Retell', error as Error, {
        operation: 'retell_phone_service',
        phoneNumberId
      });
      throw new Error(`Failed to get phone number details from Retell: ${error.message}`);
    }
  }

  /**
   * List all phone numbers in Retell account
   */
  async listPhoneNumbers(): Promise<any[]> {
    try {
      logger.info('Listing all phone numbers from Retell', {
        operation: 'retell_phone_service'
      });

      const response = await fetch(`${this.baseUrl}/list-phone-numbers`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const errorMessage = errorData.message || errorData.error || `HTTP ${response.status}: ${response.statusText}`;
        throw new Error(`Retell API error: ${errorMessage}`);
      }

      const data = await response.json();
      logger.info('Successfully retrieved phone numbers list from Retell', {
        operation: 'retell_phone_service'
      });

      return data.phone_numbers || [];

    } catch (error: any) {
      logger.error('Error listing phone numbers from Retell', error as Error, {
        operation: 'retell_phone_service'
      });
      throw new Error(`Failed to list phone numbers from Retell: ${error.message}`);
    }
  }



  /**
   * Import or update phone number with agent assignment
   * Handles the case where phone number already exists in Retell
   */
  async importOrUpdatePhoneNumber(request: RetellPhoneNumberImportRequest): Promise<RetellPhoneNumberImportResponse> {
    try {
      logger.info('Attempting to import or update phone number', {
        operation: 'retell_phone_service',
        phoneNumber: request.phone_number
      });

      // First, try to import the phone number
      try {
        return await this.importPhoneNumber(request);
      } catch (error: any) {
        // Log the actual error for debugging
        logger.error('Phone number import failed, analyzing error', error as Error, {
          operation: 'retell_phone_service',
          phoneNumber: request.phone_number,
          errorMessage: error.message
        });

        // If the error is "Phone number already exists", try to update instead
        if (error.message?.includes('Phone number already exists') ||
            error.message?.includes('already imported') ||
            error.message?.includes('409')) {
          logger.info('Phone number exists, attempting to update configuration directly', {
            operation: 'retell_phone_service',
            phoneNumber: request.phone_number
          });

          try {
            // Update the phone number configuration directly (no need to find it first)
            await this.updatePhoneNumberConfiguration(request.phone_number, {
              inbound_agent_id: request.inbound_agent_id,
              outbound_agent_id: request.outbound_agent_id,
              inbound_webhook_url: request.inbound_webhook_url,
              nickname: request.nickname
            });

            logger.info('Successfully updated existing phone number', {
              operation: 'retell_phone_service',
              phoneNumber: request.phone_number
            });

            // Return a response indicating successful update
            // We generate a mock phone_number_id since we don't need to fetch it
            return {
              phone_number_id: `updated_${Date.now()}`, // Mock ID for existing phone number
              phone_number: request.phone_number,
              inbound_agent_id: request.inbound_agent_id,
              outbound_agent_id: request.outbound_agent_id,
              nickname: request.nickname,
              termination_uri: request.termination_uri,
              created_at: Date.now()
            };
          } catch (updateError: any) {
            // If update fails with 404, the phone number exists but is not accessible
            // This usually means it's associated with a different API key/account
            if (updateError.message?.includes('404') || updateError.message?.includes('Not Found')) {
              logger.warn('Phone number exists but not accessible, attempting to delete and re-import', {
                operation: 'retell_phone_service',
                phoneNumber: request.phone_number,
                updateError: updateError.message
              });

              try {
                // Try to delete the phone number first
                await this.removePhoneNumber(request.phone_number);
                logger.info('Successfully deleted inaccessible phone number', {
                  operation: 'retell_phone_service',
                  phoneNumber: request.phone_number
                });
              } catch (deleteError: any) {
                // If delete also fails, log it but continue with re-import attempt
                logger.warn('Failed to delete inaccessible phone number, continuing with re-import', {
                  operation: 'retell_phone_service',
                  phoneNumber: request.phone_number,
                  deleteError: deleteError.message
                });
              }

              // Now try to import again
              logger.info('Attempting to re-import phone number after cleanup', {
                operation: 'retell_phone_service',
                phoneNumber: request.phone_number
              });
              return await this.importPhoneNumber(request);
            }

            // If it's a different error, re-throw it
            throw updateError;
          }
        }

        // If it's a different error, re-throw it with more context
        logger.error('Phone number import failed with non-recoverable error', error as Error, {
          operation: 'retell_phone_service',
          phoneNumber: request.phone_number,
          errorType: 'non_recoverable'
        });
        throw error;
      }

    } catch (error: any) {
      logger.error('Error importing or updating phone number', error as Error, {
        operation: 'retell_phone_service',
        phoneNumber: request.phone_number
      });
      throw error;
    }
  }
}
