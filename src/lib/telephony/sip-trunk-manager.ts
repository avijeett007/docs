import { prisma } from '@/lib/prisma';
import { TwilioSipService } from './twilio-sip-service';
import { SipConfigurationService } from './sip-config-service';
import { AgentProvider, SipTrunkConfig, ServiceResponse, TelephonyError } from './types';
import { logger } from '../logger';

export class SipTrunkManager {
  private twilioSipService: TwilioSipService;
  private sipConfigService: SipConfigurationService;

  constructor() {
    this.twilioSipService = new TwilioSipService();
    this.sipConfigService = new SipConfigurationService();
  }

  async enableSipTrunkForPhoneNumber(
    phoneNumberId: string,
    customerId: string,
    partnerId: string,
    agentProvider: AgentProvider = 'knova',
    agentId?: string
  ): Promise<ServiceResponse<SipTrunkConfig>> {
    try {
      // Get phone number details
      const phoneNumber = await prisma.phoneNumber.findUnique({
        where: { id: phoneNumberId },
        select: {
          id: true,
          phoneNumber: true,
          partnerId: true,
          customerId: true
        }
      });

      if (!phoneNumber) {
        return { success: false, error: 'Phone number not found' };
      }

      if (phoneNumber.partnerId !== partnerId) {
        return { success: false, error: 'Phone number does not belong to this partner' };
      }

      // Check if SIP trunk already exists
      const existingSipConfig = await this.sipConfigService.getSipConfiguration(phoneNumberId);
      if (existingSipConfig) {
        return { success: false, error: 'SIP trunk already enabled for this phone number' };
      }

      // Get customer's Twilio subaccount SID
      const customer = await prisma.customer.findUnique({
        where: { id: customerId },
        select: { twilioSubaccountSid: true }
      });

      const subaccountSid = customer?.twilioSubaccountSid || undefined;

      // Create SIP trunk in Twilio
      const sipTrunkConfig = await this.twilioSipService.createSipTrunkForPhoneNumber(
        phoneNumberId,
        phoneNumber.phoneNumber,
        customerId,
        partnerId,
        subaccountSid
      );

      // Store SIP configuration in database
      await this.sipConfigService.createSipConfiguration(sipTrunkConfig);

      // Create agent mapping if provided
      if (agentId) {
        await this.sipConfigService.createAgentPhoneMapping({
          phoneNumberId,
          agentProvider,
          agentId,
          customerId,
          partnerId
        });
      }

      // Update phone number to mark SIP as enabled
      await prisma.phoneNumber.update({
        where: { id: phoneNumberId },
        data: { sipEnabled: true }
      });

      return { success: true, data: sipTrunkConfig };
    } catch (error) {
      logger.error('Error enabling SIP trunk', error as Error, {
        operation: 'sip_trunk_manager',
        phoneNumberId,
        customerId,
        partnerId
      });
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to enable SIP trunk'
      };
    }
  }

  async disableSipTrunkForPhoneNumber(phoneNumberId: string): Promise<ServiceResponse<void>> {
    try {
      // Get SIP configuration
      const sipConfig = await this.sipConfigService.getSipConfiguration(phoneNumberId);
      if (!sipConfig) {
        return { success: false, error: 'SIP trunk not found for this phone number' };
      }

      // Get customer's Twilio subaccount SID
      const phoneNumber = await prisma.phoneNumber.findUnique({
        where: { id: phoneNumberId },
        include: { customer: { select: { twilioSubaccountSid: true } } }
      });

      const subaccountSid = phoneNumber?.customer?.twilioSubaccountSid || undefined;

      // Delete SIP trunk from Twilio
      await this.twilioSipService.deleteSipTrunk(sipConfig.sipTrunkSid, subaccountSid);

      // Delete SIP configuration from database
      await this.sipConfigService.deleteSipConfiguration(phoneNumberId);

      // Deactivate agent mappings
      await prisma.agentPhoneMapping.updateMany({
        where: { phoneNumberId },
        data: { status: 'inactive' }
      });

      // Update phone number to mark SIP as disabled
      await prisma.phoneNumber.update({
        where: { id: phoneNumberId },
        data: { sipEnabled: false }
      });

      return { success: true };
    } catch (error) {
      logger.error('Error disabling SIP trunk', error as Error, {
        operation: 'sip_trunk_manager',
        phoneNumberId
      });
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to disable SIP trunk'
      };
    }
  }

  async mapPhoneNumberToAgent(
    phoneNumberId: string,
    agentProvider: AgentProvider,
    agentId: string,
    agentName?: string
  ): Promise<ServiceResponse<void>> {
    try {
      // Check if SIP trunk is enabled
      const sipConfig = await this.sipConfigService.getSipConfiguration(phoneNumberId);
      if (!sipConfig) {
        return { success: false, error: 'SIP trunk must be enabled before mapping to agent' };
      }

      // Switch to new agent provider
      await this.sipConfigService.switchAgentProvider(phoneNumberId, agentProvider, agentId, agentName);

      return { success: true };
    } catch (error) {
      logger.error('Error mapping phone number to agent', error as Error, {
        operation: 'sip_trunk_manager',
        phoneNumberId,
        agentId,
        agentProvider
      });
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to map phone number to agent'
      };
    }
  }

  async getSipTrunkStatus(phoneNumberId: string): Promise<ServiceResponse<{
    sipEnabled: boolean;
    sipConfig?: any;
    agentMapping?: any;
    status?: string;
  }>> {
    try {
      const phoneNumber = await prisma.phoneNumber.findUnique({
        where: { id: phoneNumberId },
        include: {
          sipConfig: true,
          agentMappings: {
            where: { status: 'active' },
            take: 1
          }
        }
      });

      if (!phoneNumber) {
        return { success: false, error: 'Phone number not found' };
      }

      const sipEnabled = phoneNumber.sipEnabled || false;
      const sipConfig = phoneNumber.sipConfig;
      const agentMapping = phoneNumber.agentMappings?.[0];

      let status = 'disabled';
      if (sipEnabled && sipConfig) {
        status = sipConfig.status;
      }

      return {
        success: true,
        data: {
          sipEnabled,
          sipConfig: sipConfig ? {
            id: sipConfig.id,
            sipTrunkSid: sipConfig.sipTrunkSid,
            status: sipConfig.status,
            inboundEnabled: sipConfig.inboundEnabled,
            outboundEnabled: sipConfig.outboundEnabled
          } : undefined,
          agentMapping: agentMapping ? {
            id: agentMapping.id,
            agentProvider: agentMapping.agentProvider,
            agentId: agentMapping.agentId,
            agentName: agentMapping.agentName
          } : undefined,
          status
        }
      };
    } catch (error) {
      logger.error('Error getting SIP trunk status', error as Error, {
        operation: 'sip_trunk_manager',
        phoneNumberId
      });
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get SIP trunk status'
      };
    }
  }
}
