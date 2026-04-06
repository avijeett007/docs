import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyPartnerAuth } from '@/lib/auth/partnerAuth';
import Stripe from 'stripe';
import { z } from 'zod';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2023-10-16',
});

// Validation schema for creating subscription plans
const createPlanSchema = z.object({
  name: z.string().min(1, 'Plan name is required').max(100, 'Plan name too long'),
  description: z.string().optional(),
  amount: z.number().int().min(50, 'Minimum amount is $0.50').max(99999999, 'Amount too large'), // in cents
  currency: z.string().optional().default('usd'),
  interval: z.enum(['day', 'week', 'month', 'year']),
  intervalCount: z.number().int().min(1).max(12).optional().default(1),
  trialPeriodDays: z.number().int().min(0).max(365).optional(),
  requireCardForTrial: z.boolean().optional().default(false),
  showOnLandingPage: z.boolean().optional().default(false),
  features: z.array(z.string()).optional().default([]),
  planFeatures: z.object({
    enableAdvancedAnalytics: z.boolean().optional(),
    enableDetailedCallAnalysis: z.boolean().optional(),
    enableActionPointAnalysis: z.boolean().optional(),
    showIntegration: z.boolean().optional(),
    showDocsAndMedia: z.boolean().optional(),
    showPhoneNumbers: z.boolean().optional(),
    allowedApps: z.array(z.string()).optional(),
    aiCreditsEnabled: z.boolean().optional(),
    lowCreditNotificationsEnabled: z.boolean().optional(),
    lowCreditThreshold: z.number().int().min(0).optional(),
    initialAiCredits: z.number().int().min(0).optional(),
  }).optional(),
  metadata: z.record(z.string()).optional(),
});

/**
 * Get partner's subscription plans
 */
export async function GET(request: NextRequest) {
  try {
    // Verify partner authentication
    const authResult = await verifyPartnerAuth(request);
    if (!authResult) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const partnerId = authResult.id;

    // Get partner's subscription plans
    const plans = await prisma.subscriptionPlan.findMany({
      where: { partnerId },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({
      success: true,
      data: plans,
    });
  } catch (error) {
    logger.error(
      'Error fetching subscription plans',
      error instanceof Error ? error : new Error(String(error)),
      { operation: 'subscription-plans-list' }
    );
    return NextResponse.json(
      { success: false, error: 'Failed to fetch subscription plans' },
      { status: 500 }
    );
  }
}

// Helper function to check if partner is on free forever plan
function isFreeForeverPartner(planId: string | null): boolean {
  if (!planId) return false;
  const freeForeverPriceId = process.env.STRIPE_FREE_FOREVER_PRICE_ID;
  return (
    planId === 'free_forever_trial' ||
    planId === 'free_forever' ||
    (freeForeverPriceId !== undefined && planId === freeForeverPriceId)
  );
}

/**
 * Create a new subscription plan
 */
export async function POST(request: NextRequest) {
  try {
    // Verify partner authentication
    const authResult = await verifyPartnerAuth(request);
    if (!authResult) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const partnerId = authResult.id;

    // Check if partner is on free forever plan - they cannot create subscription plans
    if (isFreeForeverPartner(authResult.planId)) {
      return NextResponse.json(
        {
          success: false,
          error: 'Free Forever plan users cannot create subscription plans. Please upgrade your plan to access this feature.',
          code: 'FREE_FOREVER_RESTRICTED'
        },
        { status: 403 }
      );
    }

    const body = await request.json();

    // Validate request body
    const validationResult = createPlanSchema.safeParse(body);
    if (!validationResult.success) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid request data',
          details: validationResult.error.errors
        },
        { status: 400 }
      );
    }

    const {
      name,
      description,
      amount,
      currency,
      interval,
      intervalCount,
      trialPeriodDays,
      requireCardForTrial,
      showOnLandingPage,
      features,
      planFeatures,
      metadata,
    } = validationResult.data;

    // Get partner details for Stripe Connect
    const partner = await prisma.partner.findUnique({
      where: { id: partnerId },
      select: {
        stripeAccountId: true,
        businessName: true,
        stripeOnboardingCompleted: true,
        stripeChargesEnabled: true,
        stripeDetailsSubmitted: true,
      },
    });

    if (!partner) {
      return NextResponse.json(
        { success: false, error: 'Partner not found' },
        { status: 404 }
      );
    }

    // Validate Stripe Connect setup
    if (!partner.stripeAccountId) {
      return NextResponse.json(
        {
          success: false,
          error: 'Stripe Connect account required. Please set up your Stripe account first.',
          code: 'STRIPE_ACCOUNT_REQUIRED'
        },
        { status: 400 }
      );
    }

    if (!partner.stripeOnboardingCompleted) {
      return NextResponse.json(
        {
          success: false,
          error: 'Please complete your Stripe onboarding before creating plans.',
          code: 'STRIPE_ONBOARDING_INCOMPLETE'
        },
        { status: 400 }
      );
    }

    if (!partner.stripeChargesEnabled) {
      return NextResponse.json(
        {
          success: false,
          error: 'Your Stripe account is not enabled for charges. Please complete verification.',
          code: 'STRIPE_CHARGES_DISABLED'
        },
        { status: 400 }
      );
    }

    // Create Stripe product in partner's account
    const stripeProductParams: Stripe.ProductCreateParams = {
      name: `${partner.businessName} - ${name}`,
      description: description || undefined,
      metadata: {
        partnerId,
        planName: name,
        knotieAiPro: 'true',
        createdAt: new Date().toISOString(),
        ...metadata,
      },
    };

    // Always create in partner's Stripe Connect account (required)
    const stripeOptions = { stripeAccount: partner.stripeAccountId };

    logger.info('Creating Stripe product for partner', {
      operation: 'subscription-plans-create',
      partnerId,
      stripeAccountId: partner.stripeAccountId
    });
    const stripeProduct = await stripe.products.create(stripeProductParams, stripeOptions);

    const stripePriceParams: Stripe.PriceCreateParams = {
      product: stripeProduct.id,
      unit_amount: amount,
      currency: currency,
      recurring: {
        interval: interval as Stripe.PriceCreateParams.Recurring.Interval,
        interval_count: intervalCount,
        trial_period_days: trialPeriodDays || undefined,
      },
      metadata: {
        partnerId,
        planName: name,
        knotieAiPro: 'true',
        createdAt: new Date().toISOString(),
        ...metadata,
      },
    };

    logger.info('Creating Stripe price for product', {
      operation: 'subscription-plans-create',
      partnerId,
      productId: stripeProduct.id,
      stripeAccountId: partner.stripeAccountId
    });
    const stripePrice = await stripe.prices.create(stripePriceParams, stripeOptions);

    // Create subscription plan in database
    const plan = await prisma.subscriptionPlan.create({
      data: {
        partnerId,
        name,
        description,
        amount,
        currency,
        interval,
        intervalCount,
        trialPeriodDays,
        requireCardForTrial,
        showOnLandingPage,
        stripePriceId: stripePrice.id,
        features,
        planFeatures: planFeatures || {},
        metadata: metadata || {},
      },
    });

    logger.info('Successfully created subscription plan', {
      operation: 'subscription-plans-create',
      partnerId,
      planId: plan.id,
      stripePriceId: stripePrice.id
    });

    return NextResponse.json({
      success: true,
      data: {
        ...plan,
        stripeProductId: stripeProduct.id,
        stripePriceId: stripePrice.id,
      },
      message: 'Subscription plan created successfully in your Stripe account',
    });
  } catch (error) {
    logger.error(
      'Error creating subscription plan',
      error instanceof Error ? error : new Error(String(error)),
      { operation: 'subscription-plans-create' }
    );

    // Handle specific Stripe errors
    if (error instanceof Error) {
      // Stripe Connect account errors
      if (error.message.includes('No such account')) {
        return NextResponse.json(
          {
            success: false,
            error: 'Stripe Connect account not found. Please complete your Stripe onboarding.',
            code: 'STRIPE_ACCOUNT_NOT_FOUND'
          },
          { status: 400 }
        );
      }

      // Charges not enabled
      if (error.message.includes('charges_enabled') || error.message.includes('not enabled')) {
        return NextResponse.json(
          {
            success: false,
            error: 'Your Stripe account is not enabled for charges. Please complete verification.',
            code: 'STRIPE_CHARGES_DISABLED'
          },
          { status: 400 }
        );
      }

      // Account not verified
      if (error.message.includes('details_submitted') || error.message.includes('verification')) {
        return NextResponse.json(
          {
            success: false,
            error: 'Your Stripe account verification is incomplete. Please complete your account setup.',
            code: 'STRIPE_VERIFICATION_INCOMPLETE'
          },
          { status: 400 }
        );
      }

      // Invalid currency or amount
      if (error.message.includes('currency') || error.message.includes('amount')) {
        return NextResponse.json(
          {
            success: false,
            error: 'Invalid currency or amount. Please check your plan details.',
            code: 'INVALID_PLAN_DATA'
          },
          { status: 400 }
        );
      }

      // Rate limiting
      if (error.message.includes('rate_limit')) {
        return NextResponse.json(
          {
            success: false,
            error: 'Too many requests. Please try again in a moment.',
            code: 'RATE_LIMITED'
          },
          { status: 429 }
        );
      }
    }

    return NextResponse.json(
      {
        success: false,
        error: 'Failed to create subscription plan. Please try again or contact support.',
        code: 'INTERNAL_ERROR'
      },
      { status: 500 }
    );
  }
}
