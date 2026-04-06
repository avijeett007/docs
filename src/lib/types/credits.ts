// Credit Management Types

export interface CreditPackage {
  id: string;
  name: string;
  credits: number;
  priceCents: number;
  discountPercentage: number | string; // Can be Prisma Decimal or number
  isActive: boolean;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
}

// Telephony Credit Management Types

export interface TelephonyCreditPackage {
  id: string;
  name: string;
  dollarAmount: number; // Amount in dollars (e.g., 50.00)
  priceCents: number; // Price in cents (e.g., 5000 for $50)
  discountPercentage: number | string; // Can be Prisma Decimal or number
  isActive: boolean;
  sortOrder: number;
  description?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreditTransaction {
  id: string;
  partnerId: string;
  customerId?: string;
  type: CreditTransactionType;
  amount: number; // DEPRECATED: Legacy integer field
  amountDecimal?: number | string | null; // New field for fractional credits (0.1, 0.03, etc.)
  balanceAfter: number; // DEPRECATED: Legacy integer field
  balanceAfterDecimal?: number | string | null; // New field for accurate balance with decimals
  description?: string;
  referenceId?: string; // stripe payment intent, subscription id, etc.
  metadata: Record<string, any>;
  createdAt: Date;
  createdBy?: string; // admin user id for manual transactions
}

export interface TelephonyCreditTransaction {
  id: string;
  partnerId: string;
  customerId?: string | null;
  type: TelephonyCreditTransactionType;
  amount: number; // Amount in cents (positive for credits added, negative for credits used)
  balanceAfter: number; // Balance in cents after transaction
  description?: string | null;
  referenceId?: string | null; // stripe payment intent, phone number purchase id, etc.
  metadata: Record<string, any>;
  createdAt: Date;
  createdBy?: string | null; // admin user id for manual transactions
}

export interface CreditPurchase {
  id: string;
  partnerId: string;
  packageId?: string;
  creditsPurchased: number;
  amountPaidCents: number;
  discountApplied: number;
  stripePaymentIntentId: string;
  stripeChargeId?: string;
  status: CreditPurchaseStatus;
  currency: string;
  metadata: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

export interface TelephonyCreditPurchase {
  id: string;
  partnerId: string;
  packageId?: string;
  dollarAmountPurchased: number; // Amount in dollars (e.g., 50.00)
  amountPaidCents: number; // Amount paid in cents
  discountApplied: number;
  stripePaymentIntentId: string;
  stripeChargeId?: string;
  status: TelephonyCreditPurchaseStatus;
  currency: string;
  metadata: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

export interface SubscriptionCreditAllocation {
  id: string;
  partnerId: string;
  subscriptionTier: SubscriptionTier;
  creditsAllocated: number;
  allocationPeriod: AllocationPeriod;
  periodStart: Date;
  periodEnd: Date;
  status: AllocationStatus;
  autoRenew: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface AdminCreditGrant {
  id: string;
  partnerId: string;
  grantedBy: string; // admin user id
  creditsGranted: number;
  grantType: GrantType;
  recurringEndDate?: Date;
  reason?: string;
  status: GrantStatus;
  nextGrantDate?: Date;
  totalGranted: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreditUsageLog {
  id: string;
  partnerId: string;
  customerId?: string;
  agentId?: string;
  usageType: UsageType;
  creditsUsed: number; // DEPRECATED: Legacy integer field
  creditsUsedDecimal?: number | string | null; // New field for fractional credits (0.1, 0.03, etc.)
  costCalculation: Record<string, any>;
  sessionId?: string;
  durationSeconds?: number;
  metadata: Record<string, any>;
  createdAt: Date;
}

export interface CreditBalance {
  partnerId: string;
  currentBalance: number;
  monthlyCreditAllocation: number;
  lastCreditAllocationDate?: Date;
  lowCreditThreshold?: number;
  lowCreditNotificationsEnabled: boolean;
  totalCreditsPurchased: number;
  totalCreditsUsed: number;
  lowCreditAlert?: {
    shouldAlert: boolean;
    currentBalance: number;
    threshold: number;
  };
}

export interface TelephonyCreditBalance {
  partnerId: string;
  currentBalanceCents: number; // Balance in cents
  lowCreditThresholdCents?: number | null; // Threshold in cents
  lowCreditNotificationsEnabled: boolean;
  autoTopUpEnabled: boolean;
  autoTopUpThresholdCents?: number | null; // Auto top-up when balance falls below this
  autoTopUpAmountCents?: number | null; // Amount to top up in cents
  totalDollarsPurchased: number; // Total dollars purchased (for display)
  totalDollarsUsed: number; // Total dollars used (for display)
  lowCreditAlert?: {
    shouldAlert: boolean;
    currentBalanceCents: number;
    thresholdCents: number;
  };
}

// Enums
export type CreditTransactionType =
  | 'purchase'
  | 'allocation'
  | 'usage'
  | 'refund'
  | 'adjustment'
  | 'ai_gateway_reserve'
  | 'ai_gateway_refund'
  | 'ai_gateway_topup';

export type TelephonyCreditTransactionType =
  | 'purchase'
  | 'usage'
  | 'refund'
  | 'adjustment'
  | 'auto_topup'
  | 'phone_number_purchase'
  | 'inbound_call'
  | 'outbound_call';

export type CreditPurchaseStatus =
  | 'pending'
  | 'completed'
  | 'failed'
  | 'refunded';

export type TelephonyCreditPurchaseStatus =
  | 'pending'
  | 'completed'
  | 'failed'
  | 'refunded';

export type SubscriptionTier = 
  | 'starter' 
  | 'pro' 
  | 'ultimate';

export type AllocationPeriod = 
  | 'monthly' 
  | 'yearly';

export type AllocationStatus = 
  | 'active' 
  | 'expired' 
  | 'cancelled';

export type GrantType = 
  | 'one_time' 
  | 'monthly_recurring';

export type GrantStatus = 
  | 'active' 
  | 'expired' 
  | 'cancelled';

export type UsageType =
  | 'voice_ai'
  | 'video_ai'
  | 'analytics'
  | 'chatbot'
  | 'avatar'
  | 'knowledge_base_processing'
  | 'email_notification'
  | 'ai_gateway'
  | 'other';

// API Request/Response Types
export interface CreditPurchaseRequest {
  packageId?: string;
  customCredits?: number;
  partnerId: string;
}

export interface CreditPurchaseResponse {
  success: boolean;
  checkoutUrl?: string;
  error?: string;
}

export interface CreditBalanceResponse {
  success: boolean;
  data?: CreditBalance;
  error?: string;
}

export interface TelephonyCreditPurchaseRequest {
  packageId?: string;
  customDollarAmount?: number;
  partnerId: string;
}

export interface TelephonyCreditPurchaseResponse {
  success: boolean;
  checkoutUrl?: string;
  error?: string;
}

export interface TelephonyCreditBalanceResponse {
  success: boolean;
  data?: TelephonyCreditBalance;
  error?: string;
}

export interface CreditTransactionListResponse {
  success: boolean;
  data?: {
    transactions: CreditTransaction[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    };
  };
  error?: string;
}

export interface AdminCreditAllocationRequest {
  partnerId: string;
  creditsGranted: number;
  grantType: GrantType;
  recurringEndDate?: string; // ISO date string
  reason?: string;
}

export interface AdminCreditAllocationResponse {
  success: boolean;
  data?: AdminCreditGrant;
  error?: string;
}

// Credit Package Pricing Configuration
export interface CreditPricingTier {
  credits: number;
  priceCents: number;
  discountPercentage: number;
  displayName: string;
  popular?: boolean;
}

export const DEFAULT_CREDIT_PACKAGES: CreditPricingTier[] = [
  {
    credits: 1000,
    priceCents: 1000, // $10.00
    discountPercentage: 0,
    displayName: '1,000 Credits'
  },
  {
    credits: 10000,
    priceCents: 9700, // $97.00 (3% discount)
    discountPercentage: 3,
    displayName: '10,000 Credits',
    popular: true
  },
  {
    credits: 50000,
    priceCents: 47500, // $475.00 (5% discount)
    discountPercentage: 5,
    displayName: '50,000 Credits'
  },
  {
    credits: 100000,
    priceCents: 92000, // $920.00 (8% discount)
    discountPercentage: 8,
    displayName: '100,000 Credits'
  },
  {
    credits: 250000,
    priceCents: 212500, // $2,125.00 (15% discount)
    discountPercentage: 15,
    displayName: '250,000 Credits'
  },
  {
    credits: 500000,
    priceCents: 350000, // $3,500.00 (30% discount)
    discountPercentage: 30,
    displayName: '500,000 Credits'
  }
];

// Subscription Tier Credit Allocations
export const SUBSCRIPTION_CREDIT_ALLOCATIONS: Record<SubscriptionTier, number> = {
  starter: 1000,
  pro: 5000,
  ultimate: 12000
};

// Credit Usage Rate Calculations
export interface CreditUsageRate {
  baseRate: number; // credits per unit
  multiplier?: number; // additional multiplier based on usage type
  minimumCharge?: number; // minimum credits to charge
}

export const CREDIT_USAGE_RATES: Record<UsageType, CreditUsageRate> = {
  voice_ai: { baseRate: 1, multiplier: 1.0 }, // 1 credit per minute
  video_ai: { baseRate: 2, multiplier: 1.5 }, // 2 credits per minute with 1.5x multiplier
  analytics: { baseRate: 0.1, minimumCharge: 1 }, // 0.1 credits per analysis, min 1 credit
  chatbot: { baseRate: 0.5, multiplier: 1.0 }, // 0.5 credits per message
  avatar: { baseRate: 3, multiplier: 2.0 }, // 3 credits per minute with 2x multiplier
  knowledge_base_processing: { baseRate: 50, multiplier: 1.0 }, // 50 credits per processing
  email_notification: { baseRate: 0.1, multiplier: 1.0 }, // 0.1 credits per email (100 credits for 1000 emails = $1.00)
  ai_gateway: { baseRate: 1, multiplier: 1.0 }, // 1 credit = 1 cent of LLM spend (dynamic, actual cost used)
  other: { baseRate: 1, multiplier: 1.0 } // default rate
};

// Utility Functions
export function calculateDiscountedPrice(credits: number): { priceCents: number; discountPercentage: number } {
  const basePrice = credits; // 1 credit = 1 cent
  
  if (credits >= 500000) {
    return { priceCents: Math.round(basePrice * 0.7), discountPercentage: 30 };
  } else if (credits >= 250000) {
    return { priceCents: Math.round(basePrice * 0.85), discountPercentage: 15 };
  } else if (credits >= 100000) {
    return { priceCents: Math.round(basePrice * 0.92), discountPercentage: 8 };
  } else if (credits >= 50000) {
    return { priceCents: Math.round(basePrice * 0.95), discountPercentage: 5 };
  } else if (credits >= 10000) {
    return { priceCents: Math.round(basePrice * 0.97), discountPercentage: 3 };
  }
  
  return { priceCents: basePrice, discountPercentage: 0 };
}

/**
 * Get the actual amount from a credit transaction, preferring the new decimal field
 */
export function getTransactionAmount(transaction: CreditTransaction): number {
  // Prefer the new decimal field if it exists
  if (transaction.amountDecimal !== null && transaction.amountDecimal !== undefined) {
    return typeof transaction.amountDecimal === 'string'
      ? parseFloat(transaction.amountDecimal)
      : transaction.amountDecimal;
  }
  // Fall back to legacy integer field
  return transaction.amount;
}

/**
 * Get the actual balance from a credit transaction, preferring the new decimal field
 */
export function getTransactionBalance(transaction: CreditTransaction): number {
  // Prefer the new decimal field if it exists
  if (transaction.balanceAfterDecimal !== null && transaction.balanceAfterDecimal !== undefined) {
    return typeof transaction.balanceAfterDecimal === 'string'
      ? parseFloat(transaction.balanceAfterDecimal)
      : transaction.balanceAfterDecimal;
  }
  // Fall back to legacy integer field
  return transaction.balanceAfter;
}

/**
 * Get the actual credits used from a usage log, preferring the new decimal field
 */
export function getUsageLogCredits(log: CreditUsageLog): number {
  // Prefer the new decimal field if it exists
  if (log.creditsUsedDecimal !== null && log.creditsUsedDecimal !== undefined) {
    return typeof log.creditsUsedDecimal === 'string'
      ? parseFloat(log.creditsUsedDecimal)
      : log.creditsUsedDecimal;
  }
  // Fall back to legacy integer field
  return log.creditsUsed;
}

export function formatCredits(credits: number | string | null | undefined): string {
  // Handle null, undefined, or invalid values
  if (credits === null || credits === undefined || credits === '') {
    return '0';
  }

  // Convert to number if it's a string
  const numericValue = typeof credits === 'string' ? parseFloat(credits) : credits;

  // Check if the result is a valid number
  if (isNaN(numericValue) || !isFinite(numericValue)) {
    return '0';
  }

  if (numericValue >= 1000000) {
    return `${(numericValue / 1000000).toFixed(1)}M`;
  } else if (numericValue >= 1000) {
    return `${(numericValue / 1000).toFixed(1)}K`;
  }

  // For small fractional values (less than 1), show up to 2 decimal places
  if (Math.abs(numericValue) < 1 && numericValue !== 0) {
    return numericValue.toFixed(2);
  }

  // For values with decimals, show up to 2 decimal places if they have fractional parts
  if (numericValue % 1 !== 0) {
    return numericValue.toFixed(2);
  }

  return numericValue.toString();
}

export function formatPrice(cents: number | string | null | undefined): string {
  // Handle null, undefined, or invalid values
  if (cents === null || cents === undefined || cents === '') {
    return '$0.00';
  }

  // Convert to number if it's a string
  const numericValue = typeof cents === 'string' ? parseFloat(cents) : cents;

  // Check if the result is a valid number
  if (isNaN(numericValue) || !isFinite(numericValue)) {
    return '$0.00';
  }

  return `$${(numericValue / 100).toFixed(2)}`;
}

// Telephony Credit Utility Functions
export function formatTelephonyBalance(cents: number | string | null | undefined): string {
  // Handle null, undefined, or invalid values
  if (cents === null || cents === undefined || cents === '') {
    return '$0.00';
  }

  // Convert to number if it's a string
  const numericValue = typeof cents === 'string' ? parseFloat(cents) : cents;

  // Check if the result is a valid number
  if (isNaN(numericValue) || !isFinite(numericValue)) {
    return '$0.00';
  }

  return `$${(numericValue / 100).toFixed(2)}`;
}

export function formatTelephonyAmount(dollars: number | string | null | undefined): string {
  // Handle null, undefined, or invalid values
  if (dollars === null || dollars === undefined || dollars === '') {
    return '$0.00';
  }

  // Convert to number if it's a string
  const numericValue = typeof dollars === 'string' ? parseFloat(dollars) : dollars;

  // Check if the result is a valid number
  if (isNaN(numericValue) || !isFinite(numericValue)) {
    return '$0.00';
  }

  return `$${numericValue.toFixed(2)}`;
}

export function dollarsToCents(dollars: number | string | null | undefined): number {
  // Handle null, undefined, or invalid values
  if (dollars === null || dollars === undefined || dollars === '') {
    return 0;
  }

  // Convert to number if it's a string
  const numericValue = typeof dollars === 'string' ? parseFloat(dollars) : dollars;

  // Check if the result is a valid number
  if (isNaN(numericValue) || !isFinite(numericValue)) {
    return 0;
  }

  return Math.round(numericValue * 100);
}

export function centsToDollars(cents: number | string | null | undefined): number {
  // Handle null, undefined, or invalid values
  if (cents === null || cents === undefined || cents === '') {
    return 0;
  }

  // Convert to number if it's a string
  const numericValue = typeof cents === 'string' ? parseFloat(cents) : cents;

  // Check if the result is a valid number
  if (isNaN(numericValue) || !isFinite(numericValue)) {
    return 0;
  }

  return numericValue / 100;
}

// Telephony Credit Package Configuration
export interface TelephonyCreditPricingTier {
  dollarAmount: number;
  priceCents: number;
  discountPercentage: number;
  displayName: string;
  popular?: boolean;
}

export const DEFAULT_TELEPHONY_CREDIT_PACKAGES: TelephonyCreditPricingTier[] = [
  {
    dollarAmount: 25,
    priceCents: 2500, // $25.00
    discountPercentage: 0,
    displayName: '$25 Telephony Credits'
  },
  {
    dollarAmount: 50,
    priceCents: 5000, // $50.00
    discountPercentage: 0,
    displayName: '$50 Telephony Credits',
    popular: true
  },
  {
    dollarAmount: 100,
    priceCents: 10000, // $100.00
    discountPercentage: 0,
    displayName: '$100 Telephony Credits'
  },
  {
    dollarAmount: 250,
    priceCents: 25000, // $250.00
    discountPercentage: 0,
    displayName: '$250 Telephony Credits'
  },
  {
    dollarAmount: 500,
    priceCents: 50000, // $500.00
    discountPercentage: 0,
    displayName: '$500 Telephony Credits'
  },
  {
    dollarAmount: 1000,
    priceCents: 100000, // $1,000.00
    discountPercentage: 0,
    displayName: '$1,000 Telephony Credits'
  }
];
