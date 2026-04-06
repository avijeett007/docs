import { loadStripe } from '@stripe/stripe-js';
import Stripe from 'stripe';

// Initialize server-side Stripe instance
export const getServerStripe = () => {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) {
    throw new Error('STRIPE_SECRET_KEY is not defined');
  }
  return new Stripe(secretKey, {
    apiVersion: '2023-10-16', // Use a stable version that's compatible with the installed Stripe types
  });
};

// Initialize client-side Stripe instance
export const getClientStripe = async () => {
  const publishableKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
  if (!publishableKey) {
    throw new Error('NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY is not defined');
  }
  return loadStripe(publishableKey);
};

// For backwards compatibility
export const getStripe = async () => {
  if (typeof window === 'undefined') {
    return getServerStripe();
  } else {
    return getClientStripe();
  }
};

export type SubscriptionPlan = {
  id: string;
  name: string;
  description: string;
  priceMonthly: number;
  priceYearly: number;
  stripePriceIdMonthly: string;
  stripePriceIdYearly: string;
  features: string[];
};

// This will be populated with actual price IDs from your Stripe dashboard
export const plans: Record<string, SubscriptionPlan> = {
  free_forever: {
    id: 'free_forever',
    name: 'Free Forever',
    description: 'Get started with essential AI voice agent features at no cost',
    priceMonthly: 0,
    priceYearly: 0,
    stripePriceIdMonthly: process.env.STRIPE_FREE_FOREVER_PRICE_ID || 'price_free_forever',
    stripePriceIdYearly: process.env.STRIPE_FREE_FOREVER_PRICE_ID || 'price_free_forever',
    features: [
      'Partner Dashboard Access',
      'Up to 3 Customers',
      'Unlimited Knova Agents',
      'Up to 3 Retell Agents',
      'Whitelabel on Subdomain',
      'Phone Numbers (+$5/month)',
      'Community Support',
      'Passkey Authentication',
      'Concurrency Limit: 5',
      'Stripe Connect (2.5% fee)'
    ]
  },
  free_forever_trial: {
    id: 'free_forever_trial',
    name: 'Free Forever Trial',
    description: '7-day trial of all premium features, then Free Forever',
    priceMonthly: 0,
    priceYearly: 0,
    stripePriceIdMonthly: process.env.STRIPE_FREE_TRIAL_PRICE_ID || 'price_free_trial',
    stripePriceIdYearly: process.env.STRIPE_FREE_TRIAL_PRICE_ID || 'price_free_trial',
    features: [
      '7-Day Trial: All Premium Features',
      'Then: All Free Forever Features',
      'Trial: All AI Providers',
      'Trial: Unlimited Customers',
      'Trial: Advanced Integrations',
      'Trial: Priority Support'
    ]
  },
  starter: {
    id: 'starter',
    name: 'Solo Agency Owner',
    description: 'Perfect for independent agencies starting their AI journey',
    priceMonthly: 149,
    priceYearly: 1499,
    stripePriceIdMonthly: process.env.STRIPE_STARTER_MONTHLY_PRICE_ID || 'price_starter_monthly',
    stripePriceIdYearly: process.env.STRIPE_STARTER_YEARLY_PRICE_ID || 'price_starter_yearly',
    features: [
      'All Free Forever Features +',
      'VAPI & All AI Providers',
      '500 Knotie Credits',
      'Up to 20 Customers',
      'Metered Billing (5 clients)',
      'Agent Migration',
      'Team Management (2 members)',
      'MCP API (5K calls/month)',
      'Custom SMTP',
      'Custom Domain Whitelabel',
      'Phone Numbers Included',
      'Email + Discord Support',
      'Concurrency Limit: 20'
    ]
  },
  starter_special: {
    id: 'starter_special',
    name: 'Solo Agency Owner (Special Offer)',
    description: 'Limited time special pricing for Solo Agency Owner plan',
    priceMonthly: 49,
    priceYearly: 499,
    stripePriceIdMonthly: process.env.STRIPE_STARTER_SPECIAL_MONTHLY_PRICE_ID || 'price_starter_special_monthly',
    stripePriceIdYearly: process.env.STRIPE_STARTER_SPECIAL_YEARLY_PRICE_ID || 'price_starter_special_yearly',
    features: [
      'All Free Forever Features +',
      'VAPI & All AI Providers',
      '500 Knotie Credits',
      'Up to 20 Customers',
      'Metered Billing (5 clients)',
      'Agent Migration',
      'Team Management (2 members)',
      'MCP API (5K calls/month)',
      'Custom SMTP',
      'Custom Domain Whitelabel',
      'Phone Numbers Included',
      'Email + Discord Support',
      'Concurrency Limit: 20',
      '🔥 Special Launch Pricing'
    ]
  },
  starter_tier_trial: {
    id: 'starter_tier_trial',
    name: 'Starter Tier Trial',
    description: '7-day trial of Starter features, then Free Forever',
    priceMonthly: 0,
    priceYearly: 0,
    stripePriceIdMonthly: process.env.STRIPE_STARTER_TRIAL_PRICE_ID || 'price_starter_trial',
    stripePriceIdYearly: process.env.STRIPE_STARTER_TRIAL_PRICE_ID || 'price_starter_trial',
    features: [
      '7-Day Trial: All Starter Features',
      'Then: Free Forever Features',
      'Trial: All AI Providers',
      'Trial: Up to 20 Customers',
      'Trial: Advanced Features',
      'Trial: Priority Support'
    ]
  },
  pro: {
    id: 'pro',
    name: 'Professional Agency Owner',
    description: 'Ideal for growing agencies ready to scale their AI offerings',
    priceMonthly: 397,
    priceYearly: 3995,
    stripePriceIdMonthly: process.env.STRIPE_PRO_MONTHLY_PRICE_ID || 'price_pro_monthly',
    stripePriceIdYearly: process.env.STRIPE_PRO_YEARLY_PRICE_ID || 'price_pro_yearly',
    features: [
      'All Solo Agency Features +',
      '3000 Knotie Credits',
      'Unlimited Customer Management',
      'Logo-Based White Label Portal (Coming Soon)',
      'Standard API Access',
      'Priority AI Processing',
      'Multi-platform Management',
      'Premium Support (4h)',
      'Full Training Resources',
      'Complete Marketing Kit',
      'Unlimited Demo Products'
    ]
  },
  enterprise: {
    id: 'enterprise',
    name: 'Ultimate Scaleup Agency',
    description: 'Complete white-label solution for agencies ready to dominate the AI market',
    priceMonthly: 699,
    priceYearly: 4999,
    stripePriceIdMonthly: process.env.STRIPE_ENTERPRISE_MONTHLY_PRICE_ID || 'price_enterprise_monthly',
    stripePriceIdYearly: process.env.STRIPE_ENTERPRISE_YEARLY_PRICE_ID || 'price_enterprise_yearly',
    features: [
      'All Professional Features +',
      '5000 Knotie Credits',
      'Complete White Label Portal (Coming Soon)',
      'Full API Integration',
      'Dedicated Platform Instance',
      '24/7 Priority Support',
      'Full Business Partnership',
      'Strategic Product Input',
      'White-Label Training System'
    ]
  }
};
