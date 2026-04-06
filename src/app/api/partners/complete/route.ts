import { NextResponse, NextRequest } from 'next/server';

// This route uses dynamic features, so it must be server-rendered
export const dynamic = 'force-dynamic';

import { prisma } from '@/lib/prisma';
import { getStripe } from '@/lib/stripe';
import Stripe from 'stripe';
import { securePublicRoute, ValidationSchemas } from '@/lib/security/publicRoutesSecurity';

// POST /api/partners/complete - Complete partner setup after payment (Step 2)
export async function POST(req: NextRequest) {
  try {
    // Apply security measures
    const securityCheck = await securePublicRoute(req, {
      rateLimitRequests: 5, // Restrictive for checkout creation
      rateLimitWindowMs: 60 * 1000,
      requireOriginValidation: true,
      allowedMethods: ['POST']
    });

    if (!securityCheck.success) {
      return securityCheck.response;
    }

    const { partnerId, isLifetimeOffer, billingInterval, planId, referralId } = await req.json();

    if (!partnerId) {
      return NextResponse.json(
        { error: 'Partner ID is required' },
        { status: 400 }
      );
    }

    // Validate partner ID format
    try {
      ValidationSchemas.partnerId.parse(partnerId);
    } catch (validationError) {
      return NextResponse.json(
        { error: 'Invalid partner ID format' },
        { status: 400 }
      );
    }

    const partner = await prisma.partner.findUnique({
      where: { id: partnerId },
    });

    if (!partner) {
      return NextResponse.json(
        { error: 'Partner not found' },
        { status: 404 }
      );
    }

    // Get price ID based on billing interval and offer type
    let priceId;
    if (isLifetimeOffer) {
      priceId = process.env.STRIPE_LIFETIME_PRO_PRICE_ID;
      // For lifetime offer, we enforce pro plan
      if (planId !== 'pro') {
        return NextResponse.json(
          { error: 'Lifetime offer is only available for Pro plan' },
          { status: 400 }
        );
      }
    } else {
      // For regular subscriptions, use the selected plan's price
      if (!planId) {
        return NextResponse.json(
          { error: 'Plan ID is required for subscription' },
          { status: 400 }
        );
      }
      
      // Handle special plan ID mappings
      const envPlanId = planId.toUpperCase();

      // Map special plan IDs to environment variable names
      if (planId === 'free_forever' || planId === 'free_forever_trial') {
        priceId = process.env.STRIPE_FREE_FOREVER_PRICE_ID;
      } else if (planId === 'starter_tier_trial') {
        priceId = process.env.STRIPE_STARTER_TRIAL_PRICE_ID;
      } else if (planId === 'starter_special') {
        priceId = billingInterval === 'year'
          ? process.env.STRIPE_STARTER_SPECIAL_YEARLY_PRICE_ID
          : process.env.STRIPE_STARTER_SPECIAL_MONTHLY_PRICE_ID;
      } else {
        // Regular plan mapping
        priceId = billingInterval === 'year'
          ? process.env[`STRIPE_${envPlanId}_YEARLY_PRICE_ID`]
          : process.env[`STRIPE_${envPlanId}_MONTHLY_PRICE_ID`];
      }
    }

    if (!priceId) {
      return NextResponse.json(
        { error: 'Invalid price configuration' },
        { status: 500 }
      );
    }

    // Update partner with plan info
    await prisma.partner.update({
      where: { id: partnerId },
      data: {
        planId, // Use the selected plan ID
        billingInterval: isLifetimeOffer ? 'lifetime' : billingInterval,
      },
    });

    // Initialize Stripe
    const stripe = (await getStripe()) as Stripe;
    if (!stripe) {
      return NextResponse.json(
        { error: 'Failed to initialize payment provider' },
        { status: 500 }
      );
    }

    const origin = process.env.NEXT_PUBLIC_APP_URL;

    const sessionConfig: any = {
      payment_method_types: ['card'],
      billing_address_collection: 'required',
      customer_email: partner.emailAddress,
      success_url: `${origin}/api/partners/payment/success?session_id={CHECKOUT_SESSION_ID}&partner_id=${partnerId}`,
      cancel_url: `${origin}/partners?error=payment_cancelled`,
      metadata: {
        partnerId,
        isLifetimeOffer: isLifetimeOffer ? 'true' : 'false',
        planId,
        billingInterval: isLifetimeOffer ? 'lifetime' : billingInterval,
        ...(referralId && {
          referral_id: referralId,
          referral_source: 'rewardful'
        }),
      },
      allow_promotion_codes: true,
      mode: isLifetimeOffer ? 'payment' : 'subscription',
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
    };

    const session = await stripe.checkout.sessions.create(sessionConfig);

    return NextResponse.json({ 
      success: true,
      url: session.url,
    });
  } catch (error) {
    console.error('Error creating checkout session:', error);
    return NextResponse.json(
      { error: 'Error creating checkout session' },
      { status: 500 }
    );
  }
}
