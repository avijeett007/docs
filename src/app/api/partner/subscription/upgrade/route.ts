import { NextRequest, NextResponse } from 'next/server';
import { verifyPartnerToken } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import Stripe from 'stripe';
import { getReferralMetadata } from '@/lib/referral-tracking';
import { affiliateCommissionHandler } from '@/lib/affiliate-commission-handler';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2023-10-16',
});

interface UpgradeRequest {
  planId: string;
  stripePriceId: string;
  billingInterval: 'monthly' | 'yearly';
  couponCode?: string;
}

// Map Stripe price IDs to tier names
function getTierFromStripePriceId(priceId: string | null | undefined): string | null {
  if (!priceId) return null;

  const priceToTierMap: Record<string, string> = {};

  if (process.env.STRIPE_FREE_FOREVER_PRICE_ID) {
    priceToTierMap[process.env.STRIPE_FREE_FOREVER_PRICE_ID] = 'free_forever';
  }
  if (process.env.STRIPE_STARTER_MONTHLY_PRICE_ID) {
    priceToTierMap[process.env.STRIPE_STARTER_MONTHLY_PRICE_ID] = 'starter';
  }
  if (process.env.STRIPE_STARTER_YEARLY_PRICE_ID) {
    priceToTierMap[process.env.STRIPE_STARTER_YEARLY_PRICE_ID] = 'starter';
  }
  if (process.env.STRIPE_STARTER_TRIAL_PRICE_ID) {
    priceToTierMap[process.env.STRIPE_STARTER_TRIAL_PRICE_ID] = 'starter';
  }
  if (process.env.STRIPE_ENTERPRISE_MONTHLY_PRICE_ID) {
    priceToTierMap[process.env.STRIPE_ENTERPRISE_MONTHLY_PRICE_ID] = 'enterprise';
  }
  if (process.env.STRIPE_ENTERPRISE_YEARLY_PRICE_ID) {
    priceToTierMap[process.env.STRIPE_ENTERPRISE_YEARLY_PRICE_ID] = 'enterprise';
  }
  if (process.env.STRIPE_LIFETIME_PRO_PRICE_ID) {
    priceToTierMap[process.env.STRIPE_LIFETIME_PRO_PRICE_ID] = 'lifetime_pro';
  }

  return priceToTierMap[priceId] || null;
}

// Normalize tier name to base tier
// IMPORTANT: planId is the authoritative field for subscription tier
// marketingTier is for marketing campaign limits, not subscription tier
function normalizeCurrentTier(marketingTier: string | null | undefined, planId: string | null | undefined): string {
  // PRIORITY 1: Check planId first - it's the authoritative subscription tier field

  // If planId is a Stripe price ID, map it to a tier
  if (planId && planId.startsWith('price_')) {
    const tierFromPrice = getTierFromStripePriceId(planId);
    if (tierFromPrice) return tierFromPrice;
  }

  // If planId is a tier string, normalize it
  if (planId) {
    const lowerPlanId = planId.toLowerCase();
    if (lowerPlanId.includes('free_forever') || lowerPlanId === 'free_forever_trial' || lowerPlanId === 'free') {
      return 'free_forever';
    }
    if (lowerPlanId.includes('starter') || lowerPlanId === 'starter_tier_trial' || lowerPlanId === 'starter_special') {
      return 'starter';
    }
    if (lowerPlanId.includes('pro') && !lowerPlanId.includes('lifetime')) {
      return 'pro';
    }
    if (lowerPlanId.includes('enterprise') || lowerPlanId.includes('ultimate')) {
      return 'enterprise';
    }
    if (lowerPlanId.includes('lifetime')) {
      return 'lifetime_pro';
    }
  }

  // PRIORITY 2: Fall back to marketingTier only if planId is not set
  // (marketingTier is for marketing limits, not subscription tier, but can be used as fallback)
  if (marketingTier) {
    const lowerTier = marketingTier.toLowerCase();

    if (lowerTier.includes('free_forever') || lowerTier === 'free_forever_trial' || lowerTier === 'free') {
      return 'free_forever';
    }
    if (lowerTier.includes('starter') || lowerTier === 'starter_tier_trial' || lowerTier === 'starter_special') {
      return 'starter';
    }
    if (lowerTier.includes('pro') && !lowerTier.includes('lifetime')) {
      return 'pro';
    }
    if (lowerTier.includes('enterprise') || lowerTier.includes('ultimate')) {
      return 'enterprise';
    }
    if (lowerTier.includes('lifetime')) {
      return 'lifetime_pro';
    }
    if (lowerTier === 'unlimited') {
      return 'enterprise';
    }
  }

  // Default to free_forever if no tier information available
  return 'free_forever';
}

export async function POST(request: NextRequest) {
  try {
    const authResult = await verifyPartnerToken(request);
    if (authResult.error) {
      return authResult.error;
    }
    const partner = authResult.partner;

    const body: UpgradeRequest = await request.json();
    const { planId, stripePriceId, billingInterval, couponCode } = body;

    // Validate required fields
    if (!planId || !stripePriceId || !billingInterval) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Check if partner can upgrade - normalize the tier first
    const rawTier = partner.marketingTier;
    const currentTier = normalizeCurrentTier(rawTier, partner.planId);
    const canUpgrade = validateUpgradeEligibility(currentTier, planId);

    console.log('Upgrade validation:', { rawTier, currentTier, targetPlan: planId, canUpgrade });
    
    if (!canUpgrade) {
      return NextResponse.json(
        { error: 'Invalid upgrade path' },
        { status: 400 }
      );
    }

    // Get or create Stripe customer
    let stripeCustomerId = partner.stripeCustomerId;
    
    if (!stripeCustomerId) {
      const customer = await stripe.customers.create({
        email: partner.emailAddress,
        name: partner.businessName,
        metadata: {
          partner_id: partner.id,
          upgrade_from: currentTier,
        },
      });
      
      stripeCustomerId = customer.id;
      
      // Update partner with Stripe customer ID
      await prisma.partner.update({
        where: { id: partner.id },
        data: { stripeCustomerId },
      });
    }

    // Prepare checkout session metadata
    const metadata: Record<string, string> = {
      partner_id: partner.id,
      plan_id: planId,
      billing_interval: billingInterval,
      upgrade_from: currentTier,
      is_upgrade: 'true',
    };

    // Add referral metadata if this is a Free Forever upgrade
    if (currentTier === 'free_forever') {
      const referralMetadata = getReferralMetadata();
      Object.assign(metadata, referralMetadata);
      
      // Check if partner has referral attribution
      if (partner.referralSource) {
        metadata.referral_source = partner.referralSource;
        metadata.referral_date = partner.referralDate?.toISOString() || '';
      }
    }

    // Prepare line items
    const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = [
      {
        price: stripePriceId,
        quantity: 1,
      },
    ];

    // Cancel existing free forever subscription and expire open checkout sessions
    // to avoid Stripe "cannot combine currencies" error
    if (currentTier === 'free_forever') {
      // 0. Mark upgrade intent BEFORE cancelling subscription
      // This prevents the subscription.deleted webhook from deactivating the partner
      await prisma.partner.update({
        where: { id: partner.id },
        data: {
          upgradeIntentPlanId: planId,
          upgradeIntentBillingInterval: billingInterval,
          upgradeIntentCreatedAt: new Date(),
        },
      });

      // 1. Expire any open checkout sessions for this customer
      try {
        const openSessions = await stripe.checkout.sessions.list({
          customer: stripeCustomerId,
          status: 'open',
        });
        for (const openSession of openSessions.data) {
          await stripe.checkout.sessions.expire(openSession.id);
          console.log('Expired open checkout session:', openSession.id);
        }
      } catch (expireError) {
        console.warn('Error expiring open checkout sessions:', expireError);
        // Continue even if this fails
      }

      // 2. Cancel the existing free forever subscription
      try {
        if (partner.stripeSubscriptionId) {
          await stripe.subscriptions.cancel(partner.stripeSubscriptionId);
          console.log('Cancelled free forever subscription:', partner.stripeSubscriptionId);
        } else {
          // If no subscription ID stored, look it up from Stripe
          const subscriptions = await stripe.subscriptions.list({
            customer: stripeCustomerId,
            status: 'active',
          });
          for (const sub of subscriptions.data) {
            await stripe.subscriptions.cancel(sub.id);
            console.log('Cancelled active subscription:', sub.id);
          }
        }
      } catch (cancelError) {
        console.warn('Error cancelling existing subscription:', cancelError);
        // Continue even if this fails - the checkout might still work
      }
    }

    // Prepare checkout session parameters
    const sessionParams: Stripe.Checkout.SessionCreateParams = {
      customer: stripeCustomerId,
      payment_method_types: ['card'],
      line_items: lineItems,
      mode: 'subscription',
      success_url: `${process.env.NEXT_PUBLIC_APP_URL}/partner/settings?upgrade=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/partner/settings?upgrade=cancelled`,
      metadata,
      subscription_data: {
        metadata,
      },
      allow_promotion_codes: true,
    };

    // Add coupon if provided
    if (couponCode) {
      try {
        // Validate coupon exists in Stripe
        const coupon = await stripe.coupons.retrieve(couponCode);
        if (coupon.valid) {
          sessionParams.discounts = [{ coupon: couponCode }];
        }
      } catch (error) {
        // If coupon is invalid, continue without it
        console.warn('Invalid coupon code provided:', couponCode);
      }
    }

    // Create checkout session
    const session = await stripe.checkout.sessions.create(sessionParams);

    // Store upgrade intent for tracking (only if not already set above for free_forever)
    if (currentTier !== 'free_forever') {
      await prisma.partner.update({
        where: { id: partner.id },
        data: {
          upgradeIntentPlanId: planId,
          upgradeIntentBillingInterval: billingInterval,
          upgradeIntentCreatedAt: new Date(),
        },
      });
    }

    return NextResponse.json({
      success: true,
      checkoutUrl: session.url,
      sessionId: session.id,
    });

  } catch (error) {
    console.error('Error creating upgrade checkout session:', error);
    return NextResponse.json(
      { error: 'Failed to initiate upgrade' },
      { status: 500 }
    );
  }
}

function validateUpgradeEligibility(currentTier: string, targetPlan: string): boolean {
  // Based on pricing.json tiers: Free Forever -> Solo Agency Owner (starter) -> Ultimate Scaleup Agency (enterprise)
  const upgradeMatrix: Record<string, string[]> = {
    'free_forever': ['starter', 'enterprise'],
    'starter': ['enterprise'],
    'pro': ['enterprise'], // Legacy tier support
    'enterprise': [], // Can't upgrade from enterprise
    'lifetime_pro': [], // Lifetime users can't upgrade
  };

  return upgradeMatrix[currentTier]?.includes(targetPlan) || false;
}
