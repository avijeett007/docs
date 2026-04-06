import { TwilioClient } from '@/lib/twilio';
import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';

export interface WebhookConfig {
  partnerId: string;
  customerId: string;
  phoneNumberSid: string;
  phoneNumber: string;
}

export class TwilioWebhookService {
  private twilioClient: TwilioClient;
  private connectHubBaseUrl: string;

  constructor() {
    this.twilioClient = new TwilioClient({
      accountSid: process.env.TWILIO_ACCOUNT_SID || '',
      authToken: process.env.TWILIO_AUTH_TOKEN || ''
    });
    this.connectHubBaseUrl = process.env.CONNECT_HUB_URL || 'https://connecthub.knotie-ai.pro';
  }

  /**
   * Generate webhook URL for a specific partner/customer combination
   */
  private generateWebhookUrl(partnerId: string, customerId: string): string {
    return `${this.connectHubBaseUrl}/webhook/twilio/usage/${partnerId}/${customerId}`;
  }

  /**
   * Setup webhooks for a newly purchased phone number
   */
  async setupWebhooks(config: WebhookConfig): Promise<void> {
    try {
      const webhookUrl = this.generateWebhookUrl(config.partnerId, config.customerId);

      logger.info('Setting up Twilio webhooks', {
        phoneNumber: config.phoneNumber,
        phoneNumberSid: config.phoneNumberSid,
        partnerId: config.partnerId,
        customerId: config.customerId,
        webhookUrl
      });

      // Update the phone number configuration with webhook URLs
      await this.twilioClient.updatePhoneNumber(config.phoneNumberSid, {
        statusCallback: webhookUrl,
        statusCallbackMethod: 'POST',
        // Keep existing voice/SMS URLs if they exist
        voiceUrl: process.env.TWILIO_VOICE_WEBHOOK_URL || 'https://api.knotie-ai.pro/twilio/inbound-call',
        voiceMethod: 'POST',
        smsUrl: process.env.TWILIO_SMS_WEBHOOK_URL || 'https://api.knotie-ai.pro/webhook/sms',
        smsMethod: 'POST'
      });

      // Store webhook configuration in database
      await prisma.phoneNumber.update({
        where: { phoneNumberSid: config.phoneNumberSid },
        data: {
          webhookUrl: webhookUrl,
          webhookStatus: 'active',
          webhookLastUpdated: new Date()
        }
      });

      logger.info('Twilio webhooks setup successfully', {
        phoneNumber: config.phoneNumber,
        webhookUrl
      });

    } catch (error) {
      logger.error('Failed to setup Twilio webhooks', error instanceof Error ? error : new Error(String(error)), {
        phoneNumber: config.phoneNumber,
        phoneNumberSid: config.phoneNumberSid
      });
      throw error;
    }
  }

  /**
   * Update webhooks when a phone number is reassigned to a different customer
   */
  async updateWebhooks(phoneNumberSid: string, newCustomerId: string): Promise<void> {
    try {
      // Get phone number details
      const phoneNumber = await prisma.phoneNumber.findUnique({
        where: { phoneNumberSid },
        select: {
          phoneNumber: true,
          partnerId: true,
          customerId: true,
          webhookUrl: true
        }
      });

      if (!phoneNumber) {
        throw new Error(`Phone number not found: ${phoneNumberSid}`);
      }

      const newWebhookUrl = this.generateWebhookUrl(phoneNumber.partnerId, newCustomerId);

      logger.info('Updating Twilio webhooks', {
        phoneNumber: phoneNumber.phoneNumber,
        phoneNumberSid,
        oldCustomerId: phoneNumber.customerId,
        newCustomerId,
        oldWebhookUrl: phoneNumber.webhookUrl,
        newWebhookUrl
      });

      // Update Twilio configuration
      await this.twilioClient.updatePhoneNumber(phoneNumberSid, {
        statusCallback: newWebhookUrl,
        statusCallbackMethod: 'POST'
      });

      // Update database
      await prisma.phoneNumber.update({
        where: { phoneNumberSid },
        data: {
          customerId: newCustomerId,
          webhookUrl: newWebhookUrl,
          webhookLastUpdated: new Date()
        }
      });

      logger.info('Twilio webhooks updated successfully', {
        phoneNumber: phoneNumber.phoneNumber,
        newWebhookUrl
      });

    } catch (error) {
      logger.error('Failed to update Twilio webhooks', error instanceof Error ? error : new Error(String(error)), {
        phoneNumberSid,
        newCustomerId
      });
      throw error;
    }
  }

  /**
   * Cancel webhooks when a phone number is released
   */
  async cancelWebhooks(phoneNumberSid: string): Promise<void> {
    try {
      // Get phone number details
      const phoneNumber = await prisma.phoneNumber.findUnique({
        where: { phoneNumberSid },
        select: {
          phoneNumber: true,
          webhookUrl: true
        }
      });

      if (!phoneNumber) {
        throw new Error(`Phone number not found: ${phoneNumberSid}`);
      }

      logger.info('Canceling Twilio webhooks', {
        phoneNumber: phoneNumber.phoneNumber,
        phoneNumberSid,
        webhookUrl: phoneNumber.webhookUrl
      });

      // Remove webhook URLs from Twilio
      await this.twilioClient.updatePhoneNumber(phoneNumberSid, {
        statusCallback: '',
        statusCallbackMethod: 'POST'
      });

      // Update database
      await prisma.phoneNumber.update({
        where: { phoneNumberSid },
        data: {
          webhookUrl: null,
          webhookStatus: 'cancelled',
          webhookLastUpdated: new Date()
        }
      });

      logger.info('Twilio webhooks cancelled successfully', {
        phoneNumber: phoneNumber.phoneNumber
      });

    } catch (error) {
      logger.error('Failed to cancel Twilio webhooks', error instanceof Error ? error : new Error(String(error)));
      throw error;
    }
  }

  /**
   * Verify webhook configuration for a phone number
   */
  async verifyWebhooks(phoneNumberSid: string): Promise<boolean> {
    try {
      const twilioNumber = await this.twilioClient.getPhoneNumber(phoneNumberSid);
      const dbNumber = await prisma.phoneNumber.findUnique({
        where: { phoneNumberSid },
        select: { webhookUrl: true, partnerId: true, customerId: true }
      });

      if (!dbNumber) {
        return false;
      }

      const expectedUrl = this.generateWebhookUrl(dbNumber.partnerId, dbNumber.customerId!);
      const actualUrl = twilioNumber.statusCallback;

      const isValid = actualUrl === expectedUrl;

      logger.info('Webhook verification result', {
        phoneNumberSid,
        expectedUrl,
        actualUrl,
        isValid
      });

      return isValid;

    } catch (error) {
      logger.error('Failed to verify webhooks', error instanceof Error ? error : new Error(String(error)));
      return false;
    }
  }
}

// Export singleton instance
export const twilioWebhookService = new TwilioWebhookService();
