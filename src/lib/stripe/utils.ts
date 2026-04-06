// Stripe Connect utility functions

import { StripeConnectError } from './types';

/**
 * Create a custom Stripe Connect error
 */
export function createStripeConnectError(
  message: string,
  code: string,
  statusCode?: number,
  stripeCode?: string
): StripeConnectError {
  const error = new Error(message) as StripeConnectError;
  error.type = 'StripeConnectError';
  error.code = code;
  error.statusCode = statusCode;
  error.stripeCode = stripeCode;
  return error;
}

/**
 * Check if an error is a Stripe Connect error
 */
export function isStripeConnectError(error: any): error is StripeConnectError {
  return error && error.type === 'StripeConnectError';
}

/**
 * Calculate application fee amount based on percentage
 */
export function calculateApplicationFee(
  amount: number,
  feePercent: number
): number {
  return Math.round(amount * (feePercent / 100));
}

/**
 * Convert amount from dollars to cents
 */
export function dollarsToCents(dollars: number): number {
  return Math.round(dollars * 100);
}

/**
 * Convert amount from cents to dollars
 */
export function centsToDollars(cents: number): number {
  return cents / 100;
}

/**
 * Format currency amount for display
 */
export function formatCurrency(
  amount: number,
  currency: string = 'usd',
  inCents: boolean = true
): string {
  const value = inCents ? centsToDollars(amount) : amount;
  
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency.toUpperCase(),
  }).format(value);
}

/**
 * Validate Stripe account ID format
 */
export function isValidStripeAccountId(accountId: string): boolean {
  return /^acct_[a-zA-Z0-9]{16,}$/.test(accountId);
}

/**
 * Validate Stripe payment intent ID format
 */
export function isValidPaymentIntentId(paymentIntentId: string): boolean {
  return /^pi_[a-zA-Z0-9]{16,}$/.test(paymentIntentId);
}

/**
 * Validate Stripe charge ID format
 */
export function isValidChargeId(chargeId: string): boolean {
  return /^ch_[a-zA-Z0-9]{16,}$/.test(chargeId);
}

/**
 * Get user-friendly error message from Stripe error
 */
export function getStripeErrorMessage(error: any): string {
  if (error?.type === 'StripeError') {
    switch (error.code) {
      case 'account_invalid':
        return 'The Stripe account is invalid or not properly set up.';
      case 'account_not_onboarded':
        return 'The Stripe account needs to complete onboarding.';
      case 'charges_not_enabled':
        return 'The Stripe account cannot accept charges yet.';
      case 'payouts_not_enabled':
        return 'The Stripe account cannot receive payouts yet.';
      case 'amount_too_small':
        return 'The payment amount is too small.';
      case 'amount_too_large':
        return 'The payment amount is too large.';
      case 'currency_not_supported':
        return 'The currency is not supported.';
      case 'payment_intent_authentication_failure':
        return 'Payment authentication failed.';
      case 'payment_intent_payment_attempt_failed':
        return 'Payment attempt failed.';
      case 'card_declined':
        return 'The card was declined.';
      case 'insufficient_funds':
        return 'Insufficient funds on the card.';
      case 'expired_card':
        return 'The card has expired.';
      case 'incorrect_cvc':
        return 'The card security code is incorrect.';
      case 'processing_error':
        return 'An error occurred while processing the payment.';
      case 'rate_limit':
        return 'Too many requests. Please try again later.';
      default:
        return error.message || 'An unexpected error occurred.';
    }
  }
  
  return error?.message || 'An unexpected error occurred.';
}

/**
 * Sanitize metadata for Stripe (remove null/undefined values, ensure string values)
 */
export function sanitizeMetadata(metadata: Record<string, any>): Record<string, string> {
  const sanitized: Record<string, string> = {};
  
  for (const [key, value] of Object.entries(metadata)) {
    if (value !== null && value !== undefined) {
      sanitized[key] = String(value);
    }
  }
  
  return sanitized;
}

/**
 * Generate a unique idempotency key for Stripe requests
 */
export function generateIdempotencyKey(prefix: string = 'knotie'): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 15);
  return `${prefix}_${timestamp}_${random}`;
}

/**
 * Check if a Stripe account has required capabilities
 */
export function hasRequiredCapabilities(
  capabilities: Record<string, string>,
  required: string[] = ['card_payments', 'transfers']
): boolean {
  return required.every(capability => capabilities[capability] === 'active');
}

/**
 * Get the status of Stripe account requirements
 */
export function getAccountRequirementsStatus(requirements: {
  currently_due: string[];
  eventually_due: string[];
  past_due: string[];
  pending_verification: string[];
}): {
  isComplete: boolean;
  hasOverdueRequirements: boolean;
  hasPendingRequirements: boolean;
  totalRequirements: number;
} {
  const { currently_due, eventually_due, past_due, pending_verification } = requirements;
  
  return {
    isComplete: currently_due.length === 0 && past_due.length === 0,
    hasOverdueRequirements: past_due.length > 0,
    hasPendingRequirements: currently_due.length > 0 || pending_verification.length > 0,
    totalRequirements: currently_due.length + eventually_due.length + past_due.length + pending_verification.length,
  };
}

/**
 * Validate payment amount
 */
export function validatePaymentAmount(amount: number, currency: string = 'usd'): {
  isValid: boolean;
  error?: string;
} {
  // Minimum amounts by currency (in cents)
  const minimumAmounts: Record<string, number> = {
    usd: 50, // $0.50
    eur: 50, // €0.50
    gbp: 30, // £0.30
    cad: 50, // CA$0.50
    aud: 50, // AU$0.50
  };
  
  // Maximum amount (in cents) - Stripe's limit is $999,999.99
  const maximumAmount = 99999999;
  
  const minAmount = minimumAmounts[currency.toLowerCase()] || 50;
  
  if (amount < minAmount) {
    return {
      isValid: false,
      error: `Amount must be at least ${formatCurrency(minAmount, currency)}.`,
    };
  }
  
  if (amount > maximumAmount) {
    return {
      isValid: false,
      error: `Amount cannot exceed ${formatCurrency(maximumAmount, currency)}.`,
    };
  }
  
  return { isValid: true };
}

/**
 * Get supported currencies for Stripe Connect
 */
export function getSupportedCurrencies(): string[] {
  return [
    'usd', 'eur', 'gbp', 'cad', 'aud', 'jpy', 'chf', 'sek', 'nok', 'dkk',
    'pln', 'czk', 'huf', 'bgn', 'ron', 'hrk', 'ils', 'sgd', 'hkd', 'nzd',
    'mxn', 'brl', 'myr', 'thb', 'php', 'inr', 'krw', 'twd', 'zar'
  ];
}

/**
 * Check if currency is supported
 */
export function isSupportedCurrency(currency: string): boolean {
  return getSupportedCurrencies().includes(currency.toLowerCase());
}
