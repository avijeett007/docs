/**
 * TypeScript interfaces for Rewardful webhook payloads
 * Based on Rewardful API documentation
 */

export interface RewardfulAffiliate {
  id: string;
  email: string;
  token: string;
  status: 'active' | 'inactive' | 'pending';
  first_name?: string;
  last_name?: string;
  company?: string;
  website?: string;
  commission_rate?: number;
  commission_type?: 'percentage' | 'fixed';
  created_at: string;
  updated_at: string;
}

export interface RewardfulConversion {
  id: string;
  affiliate_id: string;
  amount: number;
  currency: string;
  commission_amount: number;
  commission_rate: number;
  status: 'pending' | 'approved' | 'rejected' | 'paid';
  order_id?: string;
  customer_email?: string;
  created_at: string;
  updated_at: string;
  metadata?: Record<string, any>;
}

export interface RewardfulWebhookPayload {
  event: string;
  data: RewardfulAffiliate | RewardfulConversion;
  created_at: string;
}

// Type guards for webhook data validation
export function isRewardfulAffiliate(data: any): data is RewardfulAffiliate {
  return (
    typeof data === 'object' &&
    data !== null &&
    typeof data.id === 'string' &&
    typeof data.email === 'string' &&
    typeof data.token === 'string' &&
    ['active', 'inactive', 'pending'].includes(data.status) &&
    typeof data.created_at === 'string' &&
    typeof data.updated_at === 'string'
  );
}

export function isRewardfulConversion(data: any): data is RewardfulConversion {
  return (
    typeof data === 'object' &&
    data !== null &&
    typeof data.id === 'string' &&
    typeof data.affiliate_id === 'string' &&
    typeof data.amount === 'number' &&
    typeof data.currency === 'string' &&
    typeof data.commission_amount === 'number' &&
    typeof data.commission_rate === 'number' &&
    ['pending', 'approved', 'rejected', 'paid'].includes(data.status) &&
    typeof data.created_at === 'string' &&
    typeof data.updated_at === 'string'
  );
}

export function validateWebhookPayload(payload: any): payload is RewardfulWebhookPayload {
  if (typeof payload !== 'object' || payload === null) {
    return false;
  }

  if (typeof payload.event !== 'string' || typeof payload.created_at !== 'string') {
    return false;
  }

  // Validate data based on event type
  if (payload.event.startsWith('affiliate.')) {
    return isRewardfulAffiliate(payload.data);
  }

  if (payload.event.startsWith('conversion.')) {
    return isRewardfulConversion(payload.data);
  }

  return false;
}

// Input validation schemas for admin routes
export interface AffiliateUpdateRequest {
  commissionRate: number;
  commissionDuration: number;
  commissionTier: 'public' | 'partner' | 'vip';
  status: 'ACTIVE' | 'INACTIVE' | 'PENDING';
}

export function validateAffiliateUpdateRequest(data: any): data is AffiliateUpdateRequest {
  return (
    typeof data === 'object' &&
    data !== null &&
    typeof data.commissionRate === 'number' &&
    data.commissionRate >= 0 &&
    data.commissionRate <= 1 && // 0-100% as decimal
    typeof data.commissionDuration === 'number' &&
    data.commissionDuration > 0 &&
    ['public', 'partner', 'vip'].includes(data.commissionTier) &&
    ['ACTIVE', 'INACTIVE', 'PENDING'].includes(data.status)
  );
}

// Sanitization functions for database operations
export function sanitizeRewardfulId(id: any): string | null {
  if (typeof id !== 'string' || id.length === 0 || id.length > 100) {
    return null;
  }
  
  // Rewardful IDs should be alphanumeric with possible hyphens/underscores
  const sanitized = id.replace(/[^a-zA-Z0-9\-_]/g, '');
  return sanitized.length > 0 ? sanitized : null;
}

export function sanitizeEmail(email: any): string | null {
  if (typeof email !== 'string') {
    return null;
  }
  
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email) ? email.toLowerCase().trim() : null;
}

export function sanitizeAmount(amount: any): number | null {
  const num = Number(amount);
  if (isNaN(num) || num < 0 || num > 1000000) { // Max $1M
    return null;
  }
  return Math.round(num * 100) / 100; // Round to 2 decimal places
}
