// Stripe Connect types and interfaces

export interface StripeConnectAccount {
  id: string;
  type: 'express' | 'standard';
  charges_enabled: boolean;
  payouts_enabled: boolean;
  details_submitted: boolean;
  capabilities: {
    card_payments?: 'active' | 'inactive' | 'pending';
    transfers?: 'active' | 'inactive' | 'pending';
  };
  requirements: {
    currently_due: string[];
    eventually_due: string[];
    past_due: string[];
    pending_verification: string[];
  };
  country: string;
  default_currency: string;
  email?: string;
  business_profile?: {
    name?: string;
    url?: string;
  };
}

export interface StripeAccountLink {
  object: 'account_link';
  created: number;
  expires_at: number;
  url: string;
}

export interface CreateAccountLinkParams {
  account: string;
  refresh_url: string;
  return_url: string;
  type: 'account_onboarding' | 'account_update';
}

export interface PaymentIntentParams {
  amount: number;
  currency: string;
  customer_email?: string;
  description?: string;
  metadata?: Record<string, string>;
  application_fee_amount?: number;
  transfer_data?: {
    destination: string;
  };
  on_behalf_of?: string;
}

export interface StripePaymentIntent {
  id: string;
  object: 'payment_intent';
  amount: number;
  amount_capturable: number;
  amount_received: number;
  application: string | null;
  application_fee_amount: number | null;
  canceled_at: number | null;
  cancellation_reason: string | null;
  capture_method: 'automatic' | 'manual';
  charges: {
    object: 'list';
    data: StripeCharge[];
    has_more: boolean;
    total_count: number;
    url: string;
  };
  client_secret: string;
  confirmation_method: 'automatic' | 'manual';
  created: number;
  currency: string;
  customer: string | null;
  description: string | null;
  invoice: string | null;
  last_payment_error: any | null;
  metadata: Record<string, string>;
  next_action: any | null;
  on_behalf_of: string | null;
  payment_method: string | null;
  payment_method_options: any;
  payment_method_types: string[];
  processing: any | null;
  receipt_email: string | null;
  review: string | null;
  setup_future_usage: string | null;
  shipping: any | null;
  source: string | null;
  statement_descriptor: string | null;
  statement_descriptor_suffix: string | null;
  status: 'requires_payment_method' | 'requires_confirmation' | 'requires_action' | 'processing' | 'requires_capture' | 'canceled' | 'succeeded';
  transfer_data: {
    destination: string;
  } | null;
  transfer_group: string | null;
}

export interface StripeCharge {
  id: string;
  object: 'charge';
  amount: number;
  amount_captured: number;
  amount_refunded: number;
  application: string | null;
  application_fee: string | null;
  application_fee_amount: number | null;
  balance_transaction: string;
  billing_details: any;
  calculated_statement_descriptor: string | null;
  captured: boolean;
  created: number;
  currency: string;
  customer: string | null;
  description: string | null;
  destination: string | null;
  dispute: string | null;
  disputed: boolean;
  failure_code: string | null;
  failure_message: string | null;
  fraud_details: any;
  invoice: string | null;
  livemode: boolean;
  metadata: Record<string, string>;
  on_behalf_of: string | null;
  order: string | null;
  outcome: any;
  paid: boolean;
  payment_intent: string;
  payment_method: string | null;
  payment_method_details: any;
  receipt_email: string | null;
  receipt_number: string | null;
  receipt_url: string;
  refunded: boolean;
  refunds: any;
  review: string | null;
  shipping: any | null;
  source: any | null;
  source_transfer: string | null;
  statement_descriptor: string | null;
  statement_descriptor_suffix: string | null;
  status: 'succeeded' | 'pending' | 'failed';
  transfer_data: {
    destination: string;
  } | null;
  transfer_group: string | null;
}

export interface StripeWebhookEvent {
  id: string;
  object: 'event';
  api_version: string;
  created: number;
  data: {
    object: any;
    previous_attributes?: any;
  };
  livemode: boolean;
  pending_webhooks: number;
  request: {
    id: string | null;
    idempotency_key: string | null;
  };
  type: string;
}

export interface PartnerStripeStatus {
  hasStripeAccount: boolean;
  accountId?: string;
  accountType?: 'express' | 'standard';
  onboardingCompleted: boolean;
  chargesEnabled: boolean;
  payoutsEnabled: boolean;
  detailsSubmitted: boolean;
  applicationFeePercent: number;
  capabilities: Record<string, string>;
  requirements: {
    currentlyDue: string[];
    eventuallyDue: string[];
    pastDue: string[];
    pendingVerification: string[];
  };
  needsOnboarding: boolean;
}

export interface CreatePaymentIntentRequest {
  amount: number;
  currency?: string;
  description?: string;
  customerEmail?: string;
  metadata?: Record<string, string>;
  partnerId: string;
  customerId?: string;
}

export interface CreatePaymentIntentResponse {
  paymentIntentId: string;
  clientSecret: string;
  amount: number;
  applicationFeeAmount: number;
  currency: string;
  status: string;
}

export interface PaymentHistoryItem {
  id: string;
  paymentIntentId: string;
  chargeId?: string;
  amount: number;
  applicationFee: number;
  currency: string;
  status: string;
  description?: string;
  customerEmail?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface StripeConnectError extends Error {
  type: 'StripeConnectError';
  code: string;
  statusCode?: number;
  stripeCode?: string;
}

export interface OnboardingFlowParams {
  partnerId: string;
  refreshUrl: string;
  returnUrl: string;
  accountType?: 'express' | 'standard';
}

export interface OnboardingFlowResponse {
  accountId: string;
  onboardingUrl: string;
  expiresAt: number;
}

export interface DisconnectAccountParams {
  partnerId: string;
  accountId: string;
}

export interface RefreshOnboardingParams {
  partnerId: string;
  accountId: string;
  refreshUrl: string;
  returnUrl: string;
}
