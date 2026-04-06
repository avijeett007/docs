import { logger } from '@/lib/logger';

export interface WebhookUpdateResult {
  success: boolean;
  phoneNumber: string;
  webhookUrl?: string;
  error?: string;
  retellResponse?: any;
}

export class RetellWebhookManagementService {
  private static readonly RETELL_API_BASE_URL = 'https://api.retellai.com';
  private static readonly CONNECT_HUB_BASE_URL = process.env.CONNECT_HUB_URL || 'https://connecthub.knotie-ai.pro';

  /**
   * Generate webhook URL for Retell inbound call validation
   */
  static generateWebhookUrl(partnerId: string, customerId: string, retellAgentId: string): string {
    return `${this.CONNECT_HUB_BASE_URL}/retellinbound/${partnerId}/${customerId}/${retellAgentId}/validate`;
  }

  /**
   * Update Retell phone number with webhook URL for credit validation
   */
  static async setupInboundWebhook(
    phoneNumber: string,
    partnerId: string,
    customerId: string,
    retellAgentId: string,
    retellApiKey: string
  ): Promise<WebhookUpdateResult> {
    const webhookUrl = this.generateWebhookUrl(partnerId, customerId, retellAgentId);

    logger.info('🔗 WEBHOOK SETUP: Setting up inbound webhook', {
      phoneNumber: this.maskPhoneNumber(phoneNumber),
      partnerId,
      customerId,
      retellAgentId,
      webhookUrl
    });

    try {
      const response = await this.updateRetellPhoneNumber(phoneNumber, {
        inbound_webhook_url: webhookUrl,
        inbound_agent_id: retellAgentId
      }, retellApiKey);

      if (response.success) {
        logger.info('✅ WEBHOOK SETUP: Successfully configured inbound webhook', {
          phoneNumber: this.maskPhoneNumber(phoneNumber),
          webhookUrl
        });

        return {
          success: true,
          phoneNumber,
          webhookUrl,
          retellResponse: response.data
        };
      } else {
        logger.error('❌ WEBHOOK SETUP: Failed to configure inbound webhook',
          new Error(`Failed to configure webhook for ${this.maskPhoneNumber(phoneNumber)}: ${response.error}`));

        return {
          success: false,
          phoneNumber,
          webhookUrl,
          error: response.error,
          retellResponse: response.data
        };
      }

    } catch (error) {
      logger.error('❌ WEBHOOK SETUP: Exception during webhook setup',
        new Error(`Exception for ${this.maskPhoneNumber(phoneNumber)}: ${error instanceof Error ? error.message : String(error)}`));

      return {
        success: false,
        phoneNumber,
        webhookUrl,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  /**
   * Remove webhook URL from Retell phone number (disable credit validation)
   */
  static async removeInboundWebhook(
    phoneNumber: string,
    retellApiKey: string
  ): Promise<WebhookUpdateResult> {
    logger.info('🔗 WEBHOOK REMOVAL: Removing inbound webhook', {
      phoneNumber: this.maskPhoneNumber(phoneNumber)
    });

    try {
      const response = await this.updateRetellPhoneNumber(phoneNumber, {
        inbound_webhook_url: null
      }, retellApiKey);

      if (response.success) {
        logger.info('✅ WEBHOOK REMOVAL: Successfully removed inbound webhook', {
          phoneNumber: this.maskPhoneNumber(phoneNumber)
        });

        return {
          success: true,
          phoneNumber,
          retellResponse: response.data
        };
      } else {
        logger.error('❌ WEBHOOK REMOVAL: Failed to remove inbound webhook',
          new Error(`Failed to remove webhook for ${this.maskPhoneNumber(phoneNumber)}: ${response.error}`));

        return {
          success: false,
          phoneNumber,
          error: response.error,
          retellResponse: response.data
        };
      }

    } catch (error) {
      logger.error('❌ WEBHOOK REMOVAL: Exception during webhook removal',
        new Error(`Exception for ${this.maskPhoneNumber(phoneNumber)}: ${error instanceof Error ? error.message : String(error)}`));

      return {
        success: false,
        phoneNumber,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  /**
   * Update agent assignment and webhook URL when phone number is reassigned
   */
  static async updatePhoneNumberAssignment(
    phoneNumber: string,
    newPartnerId: string,
    newCustomerId: string,
    newRetellAgentId: string,
    retellApiKey: string
  ): Promise<WebhookUpdateResult> {
    const newWebhookUrl = this.generateWebhookUrl(newPartnerId, newCustomerId, newRetellAgentId);

    logger.info('🔄 WEBHOOK UPDATE: Updating phone number assignment', {
      phoneNumber: this.maskPhoneNumber(phoneNumber),
      newPartnerId,
      newCustomerId,
      newRetellAgentId,
      newWebhookUrl
    });

    try {
      const response = await this.updateRetellPhoneNumber(phoneNumber, {
        inbound_webhook_url: newWebhookUrl,
        inbound_agent_id: newRetellAgentId
      }, retellApiKey);

      if (response.success) {
        logger.info('✅ WEBHOOK UPDATE: Successfully updated phone number assignment', {
          phoneNumber: this.maskPhoneNumber(phoneNumber),
          newWebhookUrl
        });

        return {
          success: true,
          phoneNumber,
          webhookUrl: newWebhookUrl,
          retellResponse: response.data
        };
      } else {
        logger.error('❌ WEBHOOK UPDATE: Failed to update phone number assignment',
          new Error(`Failed to update assignment for ${this.maskPhoneNumber(phoneNumber)}: ${response.error}`));

        return {
          success: false,
          phoneNumber,
          webhookUrl: newWebhookUrl,
          error: response.error,
          retellResponse: response.data
        };
      }

    } catch (error) {
      logger.error('❌ WEBHOOK UPDATE: Exception during assignment update',
        new Error(`Exception for ${this.maskPhoneNumber(phoneNumber)}: ${error instanceof Error ? error.message : String(error)}`));

      return {
        success: false,
        phoneNumber,
        webhookUrl: newWebhookUrl,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  /**
   * Generic method to update Retell phone number configuration
   */
  private static async updateRetellPhoneNumber(
    phoneNumber: string,
    updateData: any,
    retellApiKey: string
  ): Promise<{ success: boolean; data?: any; error?: string }> {
    if (!retellApiKey) {
      throw new Error('Retell API key is required');
    }

    try {
      const url = `${this.RETELL_API_BASE_URL}/update-phone-number/${encodeURIComponent(phoneNumber)}`;

      logger.debug('🔄 RETELL API: Making update request', {
        url,
        updateData,
        phoneNumber: this.maskPhoneNumber(phoneNumber)
      });

      const response = await fetch(url, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${retellApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updateData),
      });

      const responseData = await response.json();

      if (!response.ok) {
        const errorMessage = responseData.message || responseData.error || `HTTP ${response.status}: ${response.statusText}`;
        logger.error('❌ RETELL API: Update request failed',
          new Error(`Update failed for ${this.maskPhoneNumber(phoneNumber)} (${response.status}): ${errorMessage}`));

        return {
          success: false,
          error: errorMessage,
          data: responseData
        };
      }

      logger.debug('✅ RETELL API: Update request successful', {
        phoneNumber: this.maskPhoneNumber(phoneNumber),
        responseData
      });

      return {
        success: true,
        data: responseData
      };

    } catch (error) {
      logger.error('❌ RETELL API: Network error during update',
        new Error(`Network error for ${this.maskPhoneNumber(phoneNumber)}: ${error instanceof Error ? error.message : String(error)}`));

      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  /**
   * Mask phone number for logging (show only last 4 digits)
   */
  private static maskPhoneNumber(phoneNumber: string): string {
    if (phoneNumber.length <= 4) return phoneNumber;
    return '*'.repeat(phoneNumber.length - 4) + phoneNumber.slice(-4);
  }
}
