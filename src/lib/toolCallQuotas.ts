/**
 * Tool Call Quota Tiers Configuration
 * Defines pricing tiers for N8N tool call rate limiting
 */

export interface ToolCallQuotaTier {
  id: string;
  name: string;
  description: string;
  limit: number; // Requests per window
  windowMs: number; // Window in milliseconds
  priceMonthly: number; // Price in cents
  stripePriceId?: string; // Stripe price ID (to be populated)
  features: string[];
  popular?: boolean;
}

export const TOOL_CALL_QUOTA_TIERS: Record<string, ToolCallQuotaTier> = {
  basic: {
    id: 'basic',
    name: 'Basic',
    description: 'Perfect for small workflows and testing',
    limit: 100,
    windowMs: 15 * 60 * 1000, // 15 minutes
    priceMonthly: 0, // Free tier
    stripePriceId: process.env.STRIPE_TOOL_CALLS_BASIC_PRICE_ID,
    features: [
      '100 tool calls per 15 minutes',
      'Basic rate limiting',
      'Standard support',
      'All integrations included'
    ]
  },
  standard: {
    id: 'standard',
    name: 'Standard',
    description: 'Great for growing agencies with moderate usage',
    limit: 1000,
    windowMs: 15 * 60 * 1000, // 15 minutes
    priceMonthly: 499, // $4.99
    stripePriceId: process.env.STRIPE_TOOL_CALLS_STANDARD_PRICE_ID,
    features: [
      '1,000 tool calls per 15 minutes',
      'Enhanced rate limiting',
      'Priority support',
      'All integrations included',
      'Usage analytics'
    ],
    popular: true
  },
  premium: {
    id: 'premium',
    name: 'Premium',
    description: 'Ideal for high-volume automation workflows',
    limit: 3000,
    windowMs: 15 * 60 * 1000, // 15 minutes
    priceMonthly: 999, // $9.99
    stripePriceId: process.env.STRIPE_TOOL_CALLS_PREMIUM_PRICE_ID,
    features: [
      '3,000 tool calls per 15 minutes',
      'Advanced rate limiting',
      'Priority support',
      'All integrations included',
      'Advanced usage analytics',
      'Custom webhook notifications'
    ]
  },
  enterprise: {
    id: 'enterprise',
    name: 'Enterprise',
    description: 'For large-scale operations requiring maximum throughput',
    limit: 10000,
    windowMs: 15 * 60 * 1000, // 15 minutes
    priceMonthly: 1999, // $19.99
    stripePriceId: process.env.STRIPE_TOOL_CALLS_ENTERPRISE_PRICE_ID,
    features: [
      '10,000 tool calls per 15 minutes',
      'Enterprise rate limiting',
      'Dedicated support',
      'All integrations included',
      'Real-time usage analytics',
      'Custom webhook notifications',
      'SLA guarantees'
    ]
  },
  unlimited: {
    id: 'unlimited',
    name: 'Unlimited',
    description: 'No limits for enterprise customers (global limits apply)',
    limit: 100000, // Effectively unlimited (global limit)
    windowMs: 60 * 1000, // 1 minute window for global limit
    priceMonthly: 2999, // $29.99
    stripePriceId: process.env.STRIPE_TOOL_CALLS_UNLIMITED_PRICE_ID,
    features: [
      'Unlimited tool calls*',
      'Global rate limiting only',
      'White-glove support',
      'All integrations included',
      'Real-time usage analytics',
      'Custom webhook notifications',
      'SLA guarantees',
      'Custom integrations available'
    ]
  }
};

/**
 * Get quota tier by ID
 */
export function getQuotaTier(tierId: string): ToolCallQuotaTier | null {
  return TOOL_CALL_QUOTA_TIERS[tierId] || null;
}

/**
 * Get all available quota tiers
 */
export function getAllQuotaTiers(): ToolCallQuotaTier[] {
  return Object.values(TOOL_CALL_QUOTA_TIERS);
}

/**
 * Get quota tier by Stripe price ID
 */
export function getQuotaTierByStripePrice(stripePriceId: string): ToolCallQuotaTier | null {
  return Object.values(TOOL_CALL_QUOTA_TIERS).find(
    tier => tier.stripePriceId === stripePriceId
  ) || null;
}

/**
 * Format price for display
 */
export function formatQuotaPrice(priceInCents: number): string {
  if (priceInCents === 0) return 'Free';
  return `$${(priceInCents / 100).toFixed(2)}`;
}

/**
 * Get upgrade recommendations
 */
export function getUpgradeRecommendation(currentTier: string, usage: number): {
  shouldUpgrade: boolean;
  recommendedTier?: ToolCallQuotaTier;
  reason?: string;
} {
  const current = getQuotaTier(currentTier);
  if (!current) return { shouldUpgrade: false };

  // If usage is approaching limit (80% or more), recommend upgrade
  const usagePercentage = (usage / current.limit) * 100;
  
  if (usagePercentage >= 80) {
    // Find next tier that can handle 150% of current usage
    const targetLimit = Math.ceil(usage * 1.5);
    const recommendedTier = getAllQuotaTiers().find(
      tier => tier.limit > targetLimit && tier.id !== current.id
    );

    if (recommendedTier) {
      return {
        shouldUpgrade: true,
        recommendedTier,
        reason: `You're using ${usagePercentage.toFixed(1)}% of your quota. Upgrade to avoid hitting limits.`
      };
    }
  }

  return { shouldUpgrade: false };
}
