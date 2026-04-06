// Telephony Integration Types

export type AgentProvider = 'vapi' | 'retell' | 'ultravox' | 'elevenlabs' | 'knova' | 'byo';

export interface SipTrunkConfig {
  phoneNumber: string;
  phoneNumberId: string;
  customerId: string;
  partnerId: string;
  sipTrunkSid: string;
  sipDomain: string;
  terminationUri: string;
  originationUri: string;
  username: string;
  password: string;
  agentId: string;
  agentProvider: AgentProvider;
  inboundEnabled: boolean;
  outboundEnabled: boolean;
  status: 'active' | 'suspended' | 'error';
}

export interface ProviderSipConfiguration {
  success: boolean;
  providerCredentialId?: string;
  providerPhoneId?: string;
  providerSpecificConfig?: Record<string, any>;
  error?: string;
}

export interface ProviderSipHandler {
  configureSipTrunk(phoneNumberId: string, sipConfig: SipTrunkConfig): Promise<ProviderSipConfiguration>;
  updateSipConfiguration(phoneNumberId: string, sipConfig: SipTrunkConfig): Promise<void>;
  initiateOutboundCall?(callRequest: OutboundCallRequest): Promise<OutboundCallResponse>;
  removeSipConfiguration?(phoneNumberId: string): Promise<void>;
}

export interface OutboundCallRequest {
  phoneNumberId: string;
  fromNumber: string;
  toNumber: string;
  agentId: string;
  agentProvider: AgentProvider;
  customerId: string;
  partnerId: string;
  metadata?: Record<string, any>;
}

export interface OutboundCallResponse {
  success: boolean;
  callSid?: string;
  callId?: string;
  error?: string;
  estimatedCostCents?: number;
}

export interface CallRecord {
  id: string;
  phoneNumberId: string;
  agentProvider: AgentProvider;
  agentId: string;
  callSid: string;
  direction: 'inbound' | 'outbound';
  fromNumber: string;
  toNumber: string;
  startTime: Date;
  endTime?: Date;
  durationSeconds?: number;
  billableSeconds?: number;
  vendorCostCents?: number;
  partnerCostCents?: number;
  customerCostCents?: number;
  customerId: string;
  partnerId: string;
  status: string;
  failureReason?: string;
  metadata: Record<string, any>;
}

export interface WebhookCallEvent {
  callSid: string;
  phoneNumberId?: string;
  agentId?: string;
  agentProvider?: AgentProvider;
  direction: 'inbound' | 'outbound';
  fromNumber: string;
  toNumber: string;
  startTime: Date;
  endTime?: Date;
  durationSeconds?: number;
  status: string;
  failureReason?: string;
  metadata?: Record<string, any>;
}

export interface BillingData {
  vendorCostCents: number;
  partnerCostCents: number;
  customerCostCents: number;
  billableSeconds: number;
  gracePeriodSeconds: number;
}

export interface ServiceResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

// Custom Error Classes
export class TelephonyError extends Error {
  constructor(message: string, public code?: string) {
    super(message);
    this.name = 'TelephonyError';
  }
}

export class SipConfigurationError extends TelephonyError {
  constructor(message: string, public phoneNumberId?: string) {
    super(message, 'SIP_CONFIG_ERROR');
    this.name = 'SipConfigurationError';
  }
}

export class CallInitiationError extends TelephonyError {
  constructor(message: string, public callRequest?: OutboundCallRequest) {
    super(message, 'CALL_INITIATION_ERROR');
    this.name = 'CallInitiationError';
  }
}

export class BillingError extends TelephonyError {
  constructor(message: string, public callSid?: string) {
    super(message, 'BILLING_ERROR');
    this.name = 'BillingError';
  }
}
