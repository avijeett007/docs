import { TwilioClient } from '@/lib/twilio';
import { SipTrunkConfig, TelephonyError } from './types';
import { generateSipCredentials, encryptSipPassword } from './encryption';
import { logger } from '../logger';

export class TwilioSipService {
  private twilioClient: TwilioClient;

  constructor() {
    this.twilioClient = new TwilioClient({
      accountSid: process.env.TWILIO_ACCOUNT_SID!,
      authToken: process.env.TWILIO_AUTH_TOKEN!
    });
  }

  async createSipTrunkForPhoneNumber(
    phoneNumberId: string,
    phoneNumber: string,
    customerId: string,
    partnerId: string,
    subaccountSid?: string
  ): Promise<SipTrunkConfig> {
    try {
      // Generate SIP credentials
      const sipCredentials = generateSipCredentials(customerId, phoneNumberId);
      const friendlyName = `knotie-${customerId}-${phoneNumberId.slice(0, 8)}`;

      // Create SIP trunk
      const sipTrunk = await this.twilioClient.createSipTrunk(friendlyName, subaccountSid);
      
      if (!sipTrunk || !sipTrunk.sid) {
        throw new TelephonyError('Failed to create SIP trunk');
      }

      // TODO: Create credential list for authentication when TwilioClient methods are available
      // await this.createSipCredentialList(sipTrunk.sid, sipCredentials.username, sipCredentials.password, subaccountSid);

      // Configure termination (outbound calls)
      const terminationUri = `sip:${sipCredentials.username}@${process.env.WEBHOOK_BASE_URL || 'api.knotie-ai.pro'}`;
      // TODO: Configure SIP termination when TwilioClient methods are available
      // await this.configureSipTermination(sipTrunk.sid, terminationUri, sipCredentials.username, sipCredentials.password, subaccountSid);

      // Configure origination (inbound calls)
      const originationUri = `${process.env.WEBHOOK_BASE_URL || 'https://api.knotie-ai.pro'}/api/webhooks/telephony/inbound`;
      // TODO: Configure SIP origination when TwilioClient methods are available
      // await this.configureSipOrigination(sipTrunk.sid, originationUri, subaccountSid);

      // TODO: Assign phone number to SIP trunk when TwilioClient methods are available
      // await this.twilioClient.assignPhoneNumberToTrunk(phoneNumber, sipTrunk.sid, subaccountSid);

      return {
        phoneNumber,
        phoneNumberId,
        customerId,
        partnerId,
        sipTrunkSid: sipTrunk.sid,
        sipDomain: sipTrunk.domainName || `${sipTrunk.sid}.sip.twilio.com`,
        terminationUri,
        originationUri,
        username: sipCredentials.username,
        password: sipCredentials.password,
        agentId: '', // Will be set when mapping to agent
        agentProvider: 'knova', // Default provider
        inboundEnabled: true,
        outboundEnabled: true,
        status: 'active'
      };
    } catch (error) {
      throw new TelephonyError(
        `Failed to create SIP trunk for phone number ${phoneNumber}: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  private async createSipCredentialList(
    sipTrunkSid: string,
    username: string,
    password: string,
    subaccountSid?: string
  ): Promise<void> {
    // TODO: Implement when TwilioClient has the required methods
    // This is not needed for basic phone number import/assign functionality
    logger.info('SIP credential list creation skipped - not implemented yet', {
      operation: 'twilio_sip_service'
    });
  }

  private async configureSipTermination(
    sipTrunkSid: string,
    terminationUri: string,
    username: string,
    password: string,
    subaccountSid?: string
  ): Promise<void> {
    // TODO: Implement when TwilioClient has the required methods
    logger.info('SIP termination configuration skipped - not implemented yet', {
      operation: 'twilio_sip_service'
    });
  }

  private async configureSipOrigination(
    sipTrunkSid: string,
    originationUri: string,
    subaccountSid?: string
  ): Promise<void> {
    // TODO: Implement when TwilioClient has the required methods
    logger.info('SIP origination configuration skipped - not implemented yet', {
      operation: 'twilio_sip_service'
    });
  }

  async deleteSipTrunk(sipTrunkSid: string, subaccountSid?: string): Promise<void> {
    try {
      logger.info('Deleting Twilio SIP trunk', {
        operation: 'twilio_sip_service',
        sipTrunkSid,
        subaccountSid
      });

      // Use TwilioClient to delete the SIP trunk
      await this.twilioClient.deleteSipTrunk(sipTrunkSid, subaccountSid);

      logger.info('Successfully deleted Twilio SIP trunk', {
        operation: 'twilio_sip_service',
        sipTrunkSid
      });
    } catch (error: any) {
      logger.error('Failed to delete Twilio SIP trunk', error as Error, {
        operation: 'twilio_sip_service',
        sipTrunkSid,
        subaccountSid
      });
      throw error;
    }
  }

  async getSipTrunkStatus(sipTrunkSid: string, subaccountSid?: string): Promise<string> {
    // TODO: Implement when TwilioClient has the required methods
    logger.info('SIP trunk status check skipped - not implemented yet', {
      operation: 'twilio_sip_service'
    });
    return 'unknown';
  }

  async updateSipTrunkConfiguration(
    sipTrunkSid: string,
    terminationUri?: string,
    originationUri?: string,
    subaccountSid?: string
  ): Promise<void> {
    // TODO: Implement when TwilioClient has the required methods
    logger.info('SIP trunk configuration update skipped - not implemented yet', {
      operation: 'twilio_sip_service'
    });
  }

  async unassignPhoneNumberFromTrunk(phoneNumberSid: string, sipTrunkSid: string, subaccountSid?: string): Promise<void> {
    try {
      logger.info('Unassigning phone number from Twilio SIP trunk', {
        operation: 'twilio_sip_service',
        phoneNumberSid,
        sipTrunkSid,
        subaccountSid
      });

      // Remove phone number from SIP trunk and set to neutral/default webhook routing
      const connectHubBaseUrl = process.env.CONNECT_HUB_URL || 'https://connecthub.knotie-ai.pro';
      const defaultWebhookUrl = `${connectHubBaseUrl}/webhook/twilio/default`;

      logger.info('Switching phone number from SIP trunk to webhook routing', {
        operation: 'twilio_sip_service',
        phoneNumberSid,
        sipTrunkSid,
        defaultWebhookUrl,
        action: 'remove_trunk_assignment'
      });

      await this.twilioClient.updatePhoneNumber(phoneNumberSid, {
        trunkSid: '', // Remove trunk assignment with empty string - this switches from SIP to webhook routing
        voiceUrl: defaultWebhookUrl, // Set to neutral webhook URL
        voiceMethod: 'POST',
        smsUrl: defaultWebhookUrl, // Set to neutral webhook URL
        smsMethod: 'POST'
      });

      logger.info('Successfully unassigned phone number from SIP trunk', {
        operation: 'twilio_sip_service',
        phoneNumberSid,
        sipTrunkSid
      });
    } catch (error: any) {
      logger.error('Failed to unassign phone number from SIP trunk', error as Error, {
        operation: 'twilio_sip_service',
        phoneNumberSid,
        sipTrunkSid,
        subaccountSid
      });
      // Don't throw - continue with cleanup
    }
  }
}
