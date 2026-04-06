import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import Stripe from 'stripe';
import { z } from 'zod';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2023-10-16',
});

// Validation schema
const createCheckoutSchema = z.object({
  planId: z.string().uuid(),
  prospectId: z.string().uuid().optional(),
  customerId: z.string().uuid(),
  partnerId: z.string().uuid(),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Validate request
    const validationResult = createCheckoutSchema.safeParse(body);
    if (!validationResult.success) {
      logger.error('Invalid onboarding checkout request', new Error('Validation failed'), {
        operation: 'create-onboarding-checkout',
        errors: validationResult.error.errors
      });
      return NextResponse.json(
        { 
          success: false,
          error: 'Invalid request data',
          details: validationResult.error.errors 
        },
        { status: 400 }
      );
    }

    const { planId, prospectId, customerId, partnerId } = validationResult.data;

    logger.info('Creating onboarding checkout session', {
      operation: 'create-onboarding-checkout',
      planId,
      customerId,
      partnerId
    });

    // Get subscription plan
    const plan = await prisma.subscriptionPlan.findFirst({
      where: {
        id: planId,
        partnerId,
        isActive: true
      }
    });

    if (!plan) {
      logger.error('Subscription plan not found', new Error('Plan not found'), {
        operation: 'create-onboarding-checkout',
        planId,
        partnerId
      });
      return NextResponse.json(
        { success: false, error: 'Subscription plan not found' },
        { status: 404 }
      );
    }

    // Get partner details
    const partner = await prisma.partner.findUnique({
      where: { id: partnerId },
      select: {
        stripeAccountId: true,
        businessName: true,
        stripeOnboardingCompleted: true,
        stripeChargesEnabled: true
      }
    });

    if (!partner) {
      logger.error('Partner not found', new Error('Partner not found'), {
        operation: 'create-onboarding-checkout',
        partnerId
      });
      return NextResponse.json(
        { success: false, error: 'Partner not found' },
        { status: 404 }
      );
    }

    // Validate Stripe Connect setup
    if (!partner.stripeAccountId) {
      logger.error('Partner missing Stripe account', new Error('No Stripe account'), {
        operation: 'create-onboarding-checkout',
        partnerId
      });
      return NextResponse.json(
        { 
          success: false, 
          error: 'Payment processing not configured. Please contact support.',
          code: 'STRIPE_ACCOUNT_REQUIRED'
        },
        { status: 400 }
      );
    }

    if (!partner.stripeOnboardingCompleted || !partner.stripeChargesEnabled) {
      logger.error('Partner Stripe setup incomplete', new Error('Stripe setup incomplete'), {
        operation: 'create-onboarding-checkout',
        partnerId,
        onboardingCompleted: partner.stripeOnboardingCompleted,
        chargesEnabled: partner.stripeChargesEnabled
      });
      return NextResponse.json(
        { 
          success: false, 
          error: 'Payment processing setup incomplete. Please contact support.',
          code: 'STRIPE_SETUP_INCOMPLETE'
        },
        { status: 400 }
      );
    }

    // Get customer details for Stripe
    const customer = await prisma.customer.findUnique({
      where: { id: customerId },
      select: {
        email: true,
        firstName: true,
        lastName: true,
        stripeCustomerId: true
      }
    });

    if (!customer) {
      logger.error('Customer not found', new Error('Customer not found'), {
        operation: 'create-onboarding-checkout',
        customerId
      });
      return NextResponse.json(
        { success: false, error: 'Customer not found' },
        { status: 404 }
      );
    }

    // Prepare Stripe checkout session parameters
    const baseUrl = request.headers.get('origin') || process.env.NEXT_PUBLIC_APP_URL;
    // Include partnerId in success URL for Stripe Connect session retrieval (BUG 12 fix)
    const successUrl = `${baseUrl}/whitelabel/payment-success?session_id={CHECKOUT_SESSION_ID}&partner_id=${partnerId}`;
    const cancelUrl = `${baseUrl}/whitelabel/onboarding?step=9`;

    const checkoutParams: Stripe.Checkout.SessionCreateParams = {
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [
        {
          price: plan.stripePriceId,
          quantity: 1,
        }
      ],
      customer_email: customer.email,
      client_reference_id: customerId,
      success_url: successUrl,
      cancel_url: cancelUrl,
      metadata: {
        type: 'onboarding_subscription',
        prospectId: prospectId || '',
        customerId,
        partnerId,
        planId,
        partnerName: partner.businessName
      },
      subscription_data: {
        metadata: {
          type: 'onboarding_subscription',
          prospectId: prospectId || '',
          customerId,
          partnerId,
          planId
        }
      }
    };

    // Add trial period if plan has one
    if (plan.trialPeriodDays && plan.trialPeriodDays > 0) {
      checkoutParams.subscription_data = {
        ...checkoutParams.subscription_data,
        trial_period_days: plan.trialPeriodDays
      };
    }

    // Always collect payment method for onboarding (needed for trial or immediate charge)
    checkoutParams.payment_method_collection = 'always';

    // If customer already has a Stripe customer ID, use it
    if (customer.stripeCustomerId) {
      checkoutParams.customer = customer.stripeCustomerId;
      delete checkoutParams.customer_email;
    }

    logger.info('Creating Stripe checkout session', {
      operation: 'create-onboarding-checkout',
      planId,
      customerId,
      partnerId,
      stripeAccountId: partner.stripeAccountId,
      hasTrialPeriod: !!plan.trialPeriodDays,
      trialDays: plan.trialPeriodDays
    });

    // Create checkout session using partner's Stripe Connect account
    const session = await stripe.checkout.sessions.create(
      checkoutParams,
      {
        stripeAccount: partner.stripeAccountId
      }
    );

    logger.info('Stripe checkout session created successfully', {
      operation: 'create-onboarding-checkout',
      sessionId: session.id,
      planId,
      customerId,
      partnerId
    });

    return NextResponse.json({
      success: true,
      url: session.url,
      sessionId: session.id
    });

  } catch (error) {
    logger.error(
      'Error creating onboarding checkout session',
      error instanceof Error ? error : new Error(String(error)),
      {
        operation: 'create-onboarding-checkout',
        errorMessage: error instanceof Error ? error.message : String(error)
      }
    );
    
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to create checkout session. Please try again.' 
      },
      { status: 500 }
    );
  }
}
