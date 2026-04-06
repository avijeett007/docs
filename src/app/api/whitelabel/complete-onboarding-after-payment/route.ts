import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import Stripe from 'stripe';
import { z } from 'zod';
import { logger } from '@/lib/logger';
import { applyPlanFeaturesToCustomer } from '@/lib/services/planFeatureService';
import { sendPaymentConfirmationEmail } from '@/lib/emails/paymentConfirmationEmail';

export const dynamic = 'force-dynamic';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2023-10-16',
});

const KNOTIE_MANAGER_URL = process.env.KNOTIE_MANAGER_URL || 'http://localhost:3003';
const KNOTIE_MANAGER_API_KEY = process.env.KNOTIE_MANAGER_API_KEY;

// Validation schema
const completeOnboardingSchema = z.object({
  sessionId: z.string().min(1),
  partnerId: z.string().optional(),
});

/**
 * Queue auto-deploy job to KnotieManager
 */
async function queueAutoDeployJob(params: {
  customerId: string;
  partnerId: string;
  prospectId: string;
  customerEmail: string;
  customerFirstName: string;
  customerLastName: string;
  customerPhone?: string;
  businessName: string;
  country?: string;
}): Promise<{ success: boolean; jobId?: string; error?: string }> {
  try {
    if (!KNOTIE_MANAGER_API_KEY) {
      logger.error('KNOTIE_MANAGER_API_KEY not configured', new Error('Missing API key'), {
        operation: 'auto-deploy-queue'
      });
      return { success: false, error: 'KnotieManager API key not configured' };
    }

    const response = await fetch(`${KNOTIE_MANAGER_URL}/api/auto-deploy/queue`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-internal-api-key': KNOTIE_MANAGER_API_KEY
      },
      body: JSON.stringify(params)
    });

    const data = await response.json();

    if (!response.ok) {
      logger.warn('Failed to queue auto-deploy job', {
        operation: 'auto-deploy-queue',
        customerId: params.customerId,
        partnerId: params.partnerId,
        error: data.error || data.message
      });
      return { success: false, error: data.error || data.message };
    }

    logger.info('Auto-deploy job queued successfully', {
      operation: 'auto-deploy-queue',
      customerId: params.customerId,
      jobId: data.jobId
    });

    return { success: true, jobId: data.jobId };
  } catch (error) {
    logger.error(
      'Error queuing auto-deploy job',
      error instanceof Error ? error : new Error(String(error)),
      { operation: 'auto-deploy-queue', customerId: params.customerId }
    );
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Validate request
    const validationResult = completeOnboardingSchema.safeParse(body);
    if (!validationResult.success) {
      logger.error('Invalid complete onboarding request', new Error('Validation failed'), {
        operation: 'complete-onboarding-after-payment',
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

    const { sessionId, partnerId: requestPartnerId } = validationResult.data;

    logger.info('Processing payment completion for onboarding', {
      operation: 'complete-onboarding-after-payment',
      sessionId,
      requestPartnerId
    });

    // Retrieve the Stripe checkout session
    // For Stripe Connect, we MUST use the partner's stripeAccountId
    let session: Stripe.Checkout.Session;
    let stripeAccountId: string | undefined;

    // Strategy: Look up partner's Stripe account first, then retrieve session with correct context
    // 1. Use partnerId from request (passed from payment success page)
    // 2. Fall back to stripeWebhookEvent lookup
    // 3. Last resort: try without account context (non-Connect sessions only)
    
    if (requestPartnerId) {
      const partnerLookup = await prisma.partner.findUnique({
        where: { id: requestPartnerId },
        select: { stripeAccountId: true }
      });
      stripeAccountId = partnerLookup?.stripeAccountId || undefined;
    }

    if (!stripeAccountId) {
      // Fallback: check webhook events for account context
      // eventData is a Text field (not Json), so use string contains search
      const webhookMeta = await prisma.stripeWebhookEvent.findFirst({
        where: {
          eventData: {
            contains: sessionId
          }
        },
        orderBy: { createdAt: 'desc' },
        select: { stripeAccountId: true }
      });
      stripeAccountId = webhookMeta?.stripeAccountId || undefined;
    }

    try {
      if (stripeAccountId) {
        session = await stripe.checkout.sessions.retrieve(sessionId, {
          expand: ['subscription', 'customer']
        }, {
          stripeAccount: stripeAccountId
        });
      } else {
        // Try without account context (for non-Connect sessions)
        session = await stripe.checkout.sessions.retrieve(sessionId, {
          expand: ['subscription', 'customer']
        });

        // If session has partnerId metadata, re-retrieve with correct account
        if (session.metadata?.partnerId) {
          const partner = await prisma.partner.findUnique({
            where: { id: session.metadata.partnerId },
            select: { stripeAccountId: true }
          });
          if (partner?.stripeAccountId) {
            stripeAccountId = partner.stripeAccountId;
            session = await stripe.checkout.sessions.retrieve(sessionId, {
              expand: ['subscription', 'customer']
            }, {
              stripeAccount: stripeAccountId
            });
          }
        }
      }
    } catch (retrieveError) {
      logger.error(
        'Failed to retrieve Stripe checkout session',
        retrieveError instanceof Error ? retrieveError : new Error(String(retrieveError)),
        {
          operation: 'complete-onboarding-after-payment',
          sessionId,
          stripeAccountId,
          requestPartnerId
        }
      );
      return NextResponse.json(
        { success: false, error: 'Failed to retrieve payment session' },
        { status: 500 }
      );
    }

    // Extract metadata
    const { customerId, partnerId, planId, prospectId } = session.metadata || {};

    if (!customerId || !partnerId || !planId) {
      logger.error('Missing required metadata in checkout session', new Error('Missing metadata'), {
        operation: 'complete-onboarding-after-payment',
        sessionId,
        metadata: session.metadata
      });
      return NextResponse.json(
        { success: false, error: 'Invalid payment session metadata' },
        { status: 400 }
      );
    }

    logger.info('Retrieved checkout session metadata', {
      operation: 'complete-onboarding-after-payment',
      sessionId,
      customerId,
      partnerId,
      planId,
      prospectId
    });

    // Check if already processed (idempotency)
    const existingSubscription = await prisma.customerSubscription.findFirst({
      where: {
        customerId,
        partnerId,
        planId,
        metadata: {
          path: ['checkoutSessionId'],
          equals: sessionId
        }
      }
    });

    if (existingSubscription) {
      logger.info('Payment already processed, returning success', {
        operation: 'complete-onboarding-after-payment',
        sessionId,
        subscriptionId: existingSubscription.id
      });
      return NextResponse.json({
        success: true,
        alreadyProcessed: true,
        message: 'Payment already processed'
      });
    }

    // Get customer, partner, and plan details
    const [customer, partner, plan, prospect] = await Promise.all([
      prisma.customer.findUnique({
        where: { id: customerId },
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          stripeCustomerId: true
        }
      }),
      prisma.partner.findUnique({
        where: { id: partnerId },
        select: {
          id: true,
          businessName: true,
          autoDeployEnabled: true,
          telephonyCreditBalanceCents: true,
          creditBalance: true,
          emailAddress: true,
          planId: true
        }
      }),
      prisma.subscriptionPlan.findUnique({
        where: { id: planId },
        select: {
          id: true,
          name: true,
          trialPeriodDays: true,
          requireCardForTrial: true
        }
      }),
      prospectId ? prisma.prospect.findUnique({
        where: { id: prospectId },
        select: {
          id: true,
          businessName: true,
          businessCountry: true
        }
      }) : null
    ]);

    if (!customer || !partner || !plan) {
      logger.error('Required data not found', new Error('Data not found'), {
        operation: 'complete-onboarding-after-payment',
        sessionId,
        hasCustomer: !!customer,
        hasPartner: !!partner,
        hasPlan: !!plan
      });
      return NextResponse.json(
        { success: false, error: 'Required data not found' },
        { status: 404 }
      );
    }

    // Create subscription record from Stripe subscription
    const stripeSubscription = session.subscription as Stripe.Subscription;
    
    if (!stripeSubscription) {
      logger.error('No subscription in checkout session', new Error('No subscription'), {
        operation: 'complete-onboarding-after-payment',
        sessionId
      });
      return NextResponse.json(
        { success: false, error: 'No subscription created' },
        { status: 400 }
      );
    }

    // Update or create Stripe customer ID if needed
    const stripeCustomerId = typeof session.customer === 'string' 
      ? session.customer 
      : session.customer?.id;

    if (stripeCustomerId && customer.stripeCustomerId !== stripeCustomerId) {
      await prisma.customer.update({
        where: { id: customerId },
        data: { stripeCustomerId }
      });
    }

    // Create subscription record in database
    const subscription = await prisma.customerSubscription.create({
      data: {
        customerId,
        partnerId,
        planId,
        stripeSubscriptionId: stripeSubscription.id,
        stripeCustomerId: stripeCustomerId || customer.stripeCustomerId || '',
        status: stripeSubscription.status,
        currentPeriodStart: new Date(stripeSubscription.current_period_start * 1000),
        currentPeriodEnd: new Date(stripeSubscription.current_period_end * 1000),
        trialStart: stripeSubscription.trial_start ? new Date(stripeSubscription.trial_start * 1000) : null,
        trialEnd: stripeSubscription.trial_end ? new Date(stripeSubscription.trial_end * 1000) : null,
        cancelAtPeriodEnd: false,
        metadata: {
          checkoutSessionId: sessionId,
          createdVia: 'onboarding_checkout'
        }
      }
    });

    logger.info('Created subscription record', {
      operation: 'complete-onboarding-after-payment',
      subscriptionId: subscription.id,
      stripeSubscriptionId: stripeSubscription.id,
      status: stripeSubscription.status
    });

    // Mark prospect as completed if it exists
    if (prospectId) {
      await prisma.prospect.update({
        where: { id: prospectId },
        data: {
          currentStep: 9,
          isCompleted: true,
          updatedAt: new Date()
        }
      });
    }

    // Determine deployment status
    const MIN_TELEPHONY_CREDITS_CENTS = 500;
    const MIN_KNOTIE_CREDITS = 200;
    
    const hasSufficientTelephonyCredits = (partner.telephonyCreditBalanceCents || 0) >= MIN_TELEPHONY_CREDITS_CENTS;
    const hasSufficientKnotieCredits = (partner.creditBalance || 0) >= MIN_KNOTIE_CREDITS;
    const hasSufficientCredits = hasSufficientTelephonyCredits && hasSufficientKnotieCredits;

    let deploymentStatus = 'not_started';
    if (partner.autoDeployEnabled) {
      deploymentStatus = hasSufficientCredits ? 'queued' : 'pending_credits';
    }

    // Update customer record
    await prisma.customer.update({
      where: { id: customerId },
      data: {
        deploymentStatus,
        deploymentRequestedAt: new Date(),
        updatedAt: new Date()
      }
    });

    // Apply plan features
    try {
      await applyPlanFeaturesToCustomer(planId, customerId, partnerId);
      logger.info('Applied plan features after payment', {
        operation: 'complete-onboarding-after-payment',
        customerId,
        planId
      });
    } catch (featureError) {
      logger.error(
        'Failed to apply plan features',
        featureError instanceof Error ? featureError : new Error(String(featureError)),
        {
          operation: 'complete-onboarding-after-payment',
          customerId,
          planId
        }
      );
    }

    // Send payment confirmation email with login credentials
    try {
      await sendPaymentConfirmationEmail({
        customerId,
        partnerId,
        planId,
        subscriptionId: subscription.id,
        trialEnd: subscription.trialEnd
      });
      logger.info('Payment confirmation email sent', {
        operation: 'complete-onboarding-after-payment',
        customerId,
        email: customer.email
      });
    } catch (emailError) {
      logger.error(
        'Failed to send payment confirmation email',
        emailError instanceof Error ? emailError : new Error(String(emailError)),
        {
          operation: 'complete-onboarding-after-payment',
          customerId
        }
      );
      // Don't fail the request if email fails
    }

    // Queue auto-deploy if enabled and sufficient credits
    let autoDeployQueued = false;
    if (partner.autoDeployEnabled && hasSufficientCredits && prospectId) {
      const deployResult = await queueAutoDeployJob({
        customerId,
        partnerId,
        prospectId,
        customerEmail: customer.email,
        customerFirstName: customer.firstName || '',
        customerLastName: customer.lastName || '',
        customerPhone: undefined,
        businessName: prospect?.businessName || '',
        country: prospect?.businessCountry || undefined
      });

      autoDeployQueued = deployResult.success;
    }

    logger.info('Onboarding completion after payment successful', {
      operation: 'complete-onboarding-after-payment',
      customerId,
      partnerId,
      subscriptionId: subscription.id,
      autoDeployQueued
    });

    return NextResponse.json({
      success: true,
      message: 'Payment processed and onboarding completed',
      customer: {
        id: customer.id,
        email: customer.email
      },
      subscription: {
        id: subscription.id,
        status: subscription.status,
        trialEnd: subscription.trialEnd
      },
      autoDeployQueued
    });

  } catch (error) {
    logger.error(
      'Error completing onboarding after payment',
      error instanceof Error ? error : new Error(String(error)),
      { operation: 'complete-onboarding-after-payment' }
    );
    
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to complete onboarding. Please contact support.' 
      },
      { status: 500 }
    );
  }
}
