// Subscription management types for customer subscriptions

export type SubscriptionStatus = 
  | 'active'
  | 'past_due'
  | 'unpaid'
  | 'canceled'
  | 'incomplete'
  | 'incomplete_expired'
  | 'trialing'
  | 'paused';

export type SubscriptionInterval = 'month' | 'year' | 'week' | 'day';

export type SubscriptionChangeType = 
  | 'created'
  | 'updated'
  | 'canceled'
  | 'paused'
  | 'resumed'
  | 'upgraded'
  | 'downgraded'
  | 'trial_started'
  | 'trial_ended'
  | 'payment_failed'
  | 'payment_succeeded';

export interface SubscriptionPlan {
  id: string;
  name: string;
  description: string;
  amount: number; // in cents
  currency: string;
  interval: SubscriptionInterval;
  intervalCount: number; // e.g., 1 for monthly, 3 for quarterly
  trialPeriodDays?: number;
  requireCardForTrial?: boolean;
  features: string[];
  stripePriceId: string;
  isActive: boolean;
}

export interface CustomerSubscription {
  id: string;
  customerId: string;
  partnerId: string;
  planId: string;
  stripeSubscriptionId: string;
  stripeCustomerId: string;
  status: SubscriptionStatus;
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  trialStart?: Date;
  trialEnd?: Date;
  canceledAt?: Date;
  cancelAtPeriodEnd: boolean;
  pausedAt?: Date;
  resumeAt?: Date;
  metadata: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

export interface SubscriptionUsage {
  id: string;
  subscriptionId: string;
  metricName: string;
  quantity: number;
  timestamp: Date;
  metadata: Record<string, any>;
}

export interface SubscriptionEvent {
  id: string;
  subscriptionId: string;
  type: SubscriptionChangeType;
  data: Record<string, any>;
  stripeEventId?: string;
  processedAt?: Date;
  createdAt: Date;
}

// API Request/Response types
export interface CreateSubscriptionRequest {
  customerId: string;
  planId: string;
  trialPeriodDays?: number;
  couponId?: string;
  metadata?: Record<string, any>;
}

export interface UpdateSubscriptionRequest {
  planId?: string;
  quantity?: number;
  couponId?: string;
  cancelAtPeriodEnd?: boolean;
  pauseCollection?: {
    behavior: 'keep_as_draft' | 'mark_uncollectible' | 'void';
    resumesAt?: Date;
  };
  metadata?: Record<string, any>;
}

export interface SubscriptionMetrics {
  totalSubscriptions: number;
  activeSubscriptions: number;
  trialingSubscriptions: number;
  canceledSubscriptions: number;
  pausedSubscriptions: number;
  monthlyRecurringRevenue: number;
  annualRecurringRevenue: number;
  averageRevenuePerUser: number;
  churnRate: number;
  lifetimeValue: number;
}

// Webhook event types
export interface StripeSubscriptionWebhookEvent {
  id: string;
  type: string;
  data: {
    object: any;
    previous_attributes?: any;
  };
  created: number;
}

// Subscription lifecycle actions
export interface SubscriptionAction {
  type: 'pause' | 'resume' | 'cancel' | 'upgrade' | 'downgrade' | 'add_trial';
  effectiveDate?: Date;
  reason?: string;
  metadata?: Record<string, any>;
}
