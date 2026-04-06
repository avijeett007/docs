import { prisma } from '@/lib/prisma';
import { AgentProvider, SipTrunkConfig, ServiceResponse } from './types';
import { encryptSipPassword, decryptSipPassword } from './encryption';

// Database model types
export interface PhoneNumberSipConfigModel {
  id: string;
  phoneNumberId: string;
  sipTrunkSid: string;
  sipDomain: string;
  terminationUri: string;
  originationUri: string;
  authUsername: string;
  authPassword: string; // Encrypted
  providerCredentialId?: string;
  providerPhoneId?: string;
  providerSpecificConfig?: Record<string, any>;
  inboundEnabled: boolean;
  outboundEnabled: boolean;
  status: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface AgentPhoneMappingData {
  id: string;
  phoneNumberId: string;
  agentProvider: string;
  agentId: string;
  agentName?: string;
  customerId: string;
  partnerId: string;
  inboundEnabled: boolean;
  outboundEnabled: boolean;
  status: string;
  providerConfig?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

export class SipConfigurationService {
  async createSipConfiguration(config: SipTrunkConfig): Promise<PhoneNumberSipConfigModel> {
    try {
      const encryptedPassword = encryptSipPassword(config.password);
      
      const sipConfig = await prisma.phoneNumberSipConfig.create({
        data: {
          phoneNumberId: config.phoneNumberId,
          sipTrunkSid: config.sipTrunkSid,
          sipDomain: config.sipDomain,
          terminationUri: config.terminationUri,
          originationUri: config.originationUri,
          authUsername: config.username,
          authPassword: encryptedPassword,
          inboundEnabled: config.inboundEnabled,
          outboundEnabled: config.outboundEnabled,
          status: config.status
        }
      });

      return this.mapToModel(sipConfig);
    } catch (error) {
      throw new Error(`Failed to create SIP configuration: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async getSipConfiguration(phoneNumberId: string): Promise<PhoneNumberSipConfigModel | null> {
    try {
      const sipConfig = await prisma.phoneNumberSipConfig.findUnique({
        where: { phoneNumberId }
      });

      return sipConfig ? this.mapToModel(sipConfig) : null;
    } catch (error) {
      throw new Error(`Failed to get SIP configuration: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async updateSipConfiguration(
    phoneNumberId: string,
    updates: Partial<SipTrunkConfig>
  ): Promise<PhoneNumberSipConfigModel> {
    try {
      const updateData: any = {};
      
      if (updates.sipDomain) updateData.sipDomain = updates.sipDomain;
      if (updates.terminationUri) updateData.terminationUri = updates.terminationUri;
      if (updates.originationUri) updateData.originationUri = updates.originationUri;
      if (updates.username) updateData.authUsername = updates.username;
      if (updates.password) updateData.authPassword = encryptSipPassword(updates.password);
      if (updates.inboundEnabled !== undefined) updateData.inboundEnabled = updates.inboundEnabled;
      if (updates.outboundEnabled !== undefined) updateData.outboundEnabled = updates.outboundEnabled;
      if (updates.status) updateData.status = updates.status;

      const sipConfig = await prisma.phoneNumberSipConfig.update({
        where: { phoneNumberId },
        data: updateData
      });

      return this.mapToModel(sipConfig);
    } catch (error) {
      throw new Error(`Failed to update SIP configuration: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async deleteSipConfiguration(phoneNumberId: string): Promise<void> {
    try {
      await prisma.phoneNumberSipConfig.delete({
        where: { phoneNumberId }
      });
    } catch (error) {
      throw new Error(`Failed to delete SIP configuration: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async createAgentPhoneMapping(data: {
    phoneNumberId: string;
    agentProvider: AgentProvider;
    agentId: string;
    agentName?: string;
    customerId: string;
    partnerId: string;
    inboundEnabled?: boolean;
    outboundEnabled?: boolean;
    providerConfig?: Record<string, any>;
  }): Promise<AgentPhoneMappingData> {
    try {
      const mapping = await prisma.agentPhoneMapping.upsert({
        where: {
          phoneNumberId_agentProvider: {
            phoneNumberId: data.phoneNumberId,
            agentProvider: data.agentProvider
          }
        },
        create: {
          phoneNumberId: data.phoneNumberId,
          agentProvider: data.agentProvider,
          agentId: data.agentId,
          agentName: data.agentName,
          customerId: data.customerId,
          partnerId: data.partnerId,
          inboundEnabled: data.inboundEnabled ?? true,
          outboundEnabled: data.outboundEnabled ?? true,
          status: 'active',
          providerConfig: data.providerConfig || {}
        },
        update: {
          agentId: data.agentId,
          agentName: data.agentName,
          customerId: data.customerId,
          inboundEnabled: data.inboundEnabled ?? true,
          outboundEnabled: data.outboundEnabled ?? true,
          status: 'active',
          providerConfig: data.providerConfig || {},
          updatedAt: new Date()
        }
      });

      return mapping as AgentPhoneMappingData;
    } catch (error) {
      throw new Error(`Failed to create agent phone mapping: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async switchAgentProvider(
    phoneNumberId: string,
    newProvider: AgentProvider,
    newAgentId: string,
    agentName?: string
  ): Promise<AgentPhoneMappingData> {
    try {
      // Deactivate current mapping
      await prisma.agentPhoneMapping.updateMany({
        where: {
          phoneNumberId,
          status: 'active'
        },
        data: { status: 'inactive' }
      });

      // Get phone number details for new mapping
      const phoneNumber = await prisma.phoneNumber.findUnique({
        where: { id: phoneNumberId },
        select: { customerId: true, partnerId: true }
      });

      if (!phoneNumber || !phoneNumber.customerId) {
        throw new Error('Phone number not found or not assigned to customer');
      }

      // Create new mapping
      return await this.createAgentPhoneMapping({
        phoneNumberId,
        agentProvider: newProvider,
        agentId: newAgentId,
        agentName,
        customerId: phoneNumber.customerId,
        partnerId: phoneNumber.partnerId
      });
    } catch (error) {
      throw new Error(`Failed to switch agent provider: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async getActiveAgentMapping(phoneNumberId: string): Promise<AgentPhoneMappingData | null> {
    try {
      const mapping = await prisma.agentPhoneMapping.findFirst({
        where: {
          phoneNumberId,
          status: 'active'
        }
      });

      return mapping as AgentPhoneMappingData | null;
    } catch (error) {
      throw new Error(`Failed to get active agent mapping: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private mapToModel(sipConfig: any): PhoneNumberSipConfigModel {
    return {
      id: sipConfig.id,
      phoneNumberId: sipConfig.phoneNumberId,
      sipTrunkSid: sipConfig.sipTrunkSid,
      sipDomain: sipConfig.sipDomain,
      terminationUri: sipConfig.terminationUri,
      originationUri: sipConfig.originationUri,
      authUsername: sipConfig.authUsername,
      authPassword: sipConfig.authPassword, // Keep encrypted for security
      providerCredentialId: sipConfig.providerCredentialId,
      providerPhoneId: sipConfig.providerPhoneId,
      providerSpecificConfig: sipConfig.providerSpecificConfig,
      inboundEnabled: sipConfig.inboundEnabled,
      outboundEnabled: sipConfig.outboundEnabled,
      status: sipConfig.status,
      createdAt: sipConfig.createdAt,
      updatedAt: sipConfig.updatedAt
    };
  }
}
