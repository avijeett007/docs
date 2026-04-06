import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import Stripe from 'stripe';
import { SubscriptionStatus, SubscriptionChangeType } from '@/lib/subscriptions/types';
import { SubscriptionCreditService } from '@/lib/services/subscriptionCreditService';
import { applyPlanFeaturesToCustomer } from '@/lib/services/planFeatureService';

export const dynamic = 'force-dynamic';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2023-10-16',
});

const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET!;

export async function POST(request: NextRequest) {
  try {
    const body = await request.text();
    const signature = request.headers.get('stripe-signature');

    if (!signature) {
      console.error('Missing Stripe signature');
      return NextResponse.json(
        { error: 'Missing signature' },
        { status: 400 }
      );
    }

    let event: Stripe.Event;

    try {
      event = stripe.webhooks.constructEvent(body, signature, endpointSecret);
    } catch (err) {
      console.error('Webhook signature verification failed:', err);
      return NextResponse.json(
        { error: 'Invalid signature' },
        { status: 400 }
      );
    }

    console.log('Processing Stripe subscription webhook event:', event.type);

    switch (event.type) {
      case 'customer.subscription.created':
        await handleSubscriptionCreated(event.data.object as Stripe.Subscription);
        break;

      case 'customer.subscription.updated':
        await handleSubscriptionUpdated(event.data.object as Stripe.Subscription);
        break;

      case 'customer.subscription.deleted':
        await handleSubscriptionDeleted(event.data.object as Stripe.Subscription);
        break;

      case 'customer.subscription.trial_will_end':
        await handleTrialWillEnd(event.data.object as Stripe.Subscription);
        break;

      case 'invoice.payment_succeeded':
        await handleInvoicePaymentSucceeded(event.data.object as Stripe.Invoice);
        break;

      case 'invoice.payment_failed':
        await handleInvoicePaymentFailed(event.data.object as Stripe.Invoice);
        break;

      default:
        console.log(`Unhandled subscription event type: ${event.type}`);
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error('Error processing subscription webhook:', error);
    return NextResponse.json(
      { error: 'Webhook processing failed' },
      { status: 500 }
    );
  }
}

async function handleSubscriptionCreated(subscription: Stripe.Subscription) {
  try {
    const customerId = subscription.metadata.customerId;
    const partnerId = subscription.metadata.partnerId;
    const planId = subscription.metadata.planId;

    if (!customerId || !partnerId || !planId) {
      console.error('Missing metadata in subscription created event');
      return;
    }

    // Update or create subscription record
    await prisma.customerSubscription.upsert({
      where: { stripeSubscriptionId: subscription.id },
      update: {
        status: subscription.status as SubscriptionStatus,
        currentPeriodStart: new Date(subscription.current_period_start * 1000),
        currentPeriodEnd: new Date(subscription.current_period_end * 1000),
        trialStart: subscription.trial_start ? new Date(subscription.trial_start * 1000) : null,
        trialEnd: subscription.trial_end ? new Date(subscription.trial_end * 1000) : null,
        cancelAtPeriodEnd: subscription.cancel_at_period_end,
      },
      create: {
        customerId,
        partnerId,
        planId,
        stripeSubscriptionId: subscription.id,
        stripeCustomerId: subscription.customer as string,
        status: subscription.status as SubscriptionStatus,
        currentPeriodStart: new Date(subscription.current_period_start * 1000),
        currentPeriodEnd: new Date(subscription.current_period_end * 1000),
        trialStart: subscription.trial_start ? new Date(subscription.trial_start * 1000) : null,
        trialEnd: subscription.trial_end ? new Date(subscription.trial_end * 1000) : null,
        cancelAtPeriodEnd: subscription.cancel_at_period_end,
        metadata: subscription.metadata,
      },
    });

    // Log subscription event
    await logSubscriptionEvent(subscription.id, 'created', {
      subscriptionId: subscription.id,
      status: subscription.status,
    });

    // Allocate initial credits for new subscription
    const plan = await prisma.subscriptionPlan.findUnique({
      where: { id: planId }
    });

    if (plan) {
      const creditResult = await SubscriptionCreditService.allocateMonthlyCredits(
        partnerId,
        plan.name,
        plan.id,
        true // force allocation for new subscriptions
      );

      if (creditResult.success) {
        console.log(`Allocated ${creditResult.creditsAllocated} initial credits for new subscription: ${subscription.id}`);
      } else {
        console.error(`Failed to allocate initial credits for subscription ${subscription.id}:`, creditResult.error);
      }

      // Apply plan features to customer
      try {
        await applyPlanFeaturesToCustomer(planId, customerId, partnerId);
      } catch (featureError) {
        console.error(`Failed to apply plan features for subscription ${subscription.id}:`, featureError);
      }
    }

    console.log(`Subscription created: ${subscription.id}`);
  } catch (error) {
    console.error('Error handling subscription created:', error);
  }
}

async function handleSubscriptionUpdated(subscription: Stripe.Subscription) {
  try {
    const existingSubscription = await prisma.customerSubscription.findUnique({
      where: { stripeSubscriptionId: subscription.id },
    });

    if (!existingSubscription) {
      console.error(`Subscription not found: ${subscription.id}`);
      return;
    }

    // Update subscription
    await prisma.customerSubscription.update({
      where: { stripeSubscriptionId: subscription.id },
      data: {
        status: subscription.status as SubscriptionStatus,
        currentPeriodStart: new Date(subscription.current_period_start * 1000),
        currentPeriodEnd: new Date(subscription.current_period_end * 1000),
        trialStart: subscription.trial_start ? new Date(subscription.trial_start * 1000) : null,
        trialEnd: subscription.trial_end ? new Date(subscription.trial_end * 1000) : null,
        canceledAt: subscription.canceled_at ? new Date(subscription.canceled_at * 1000) : null,
        cancelAtPeriodEnd: subscription.cancel_at_period_end,
        pausedAt: subscription.pause_collection ? new Date() : null,
      },
    });

    // Check if plan changed (upgrade/downgrade)
    const priceId = subscription.items.data[0]?.price?.id;
    if (priceId) {
      const newPlan = await prisma.subscriptionPlan.findUnique({
        where: { stripePriceId: priceId },
      });

      if (newPlan && newPlan.id !== existingSubscription.planId) {
        console.log(`Plan changed from ${existingSubscription.planId} to ${newPlan.id}`);
        
        // Update the plan ID in the subscription
        await prisma.customerSubscription.update({
          where: { stripeSubscriptionId: subscription.id },
          data: { planId: newPlan.id },
        });

        // Apply new plan features to customer
        try {
          await applyPlanFeaturesToCustomer(
            newPlan.id,
            existingSubscription.customerId,
            existingSubscription.partnerId
          );
        } catch (featureError) {
          console.error(`Failed to apply new plan features for subscription ${subscription.id}:`, featureError);
        }
      }
    }

    // Determine event type
    let eventType: SubscriptionChangeType = 'updated';
    if (subscription.status === 'canceled') {
      eventType = 'canceled';
    } else if (subscription.pause_collection) {
      eventType = 'paused';
    } else if (existingSubscription.pausedAt && !subscription.pause_collection) {
      eventType = 'resumed';
    }

    // Log subscription event
    await logSubscriptionEvent(subscription.id, eventType, {
      subscriptionId: subscription.id,
      status: subscription.status,
      previousStatus: existingSubscription.status,
    });

    console.log(`Subscription updated: ${subscription.id} - ${eventType}`);
  } catch (error) {
    console.error('Error handling subscription updated:', error);
  }
}

async function handleSubscriptionDeleted(subscription: Stripe.Subscription) {
  try {
    await prisma.customerSubscription.update({
      where: { stripeSubscriptionId: subscription.id },
      data: {
        status: 'canceled',
        canceledAt: new Date(),
      },
    });

    // Log subscription event
    await logSubscriptionEvent(subscription.id, 'canceled', {
      subscriptionId: subscription.id,
      canceledAt: new Date(),
    });

    console.log(`Subscription deleted: ${subscription.id}`);
  } catch (error) {
    console.error('Error handling subscription deleted:', error);
  }
}

async function handleTrialWillEnd(subscription: Stripe.Subscription) {
  try {
    // Log subscription event
    await logSubscriptionEvent(subscription.id, 'trial_ended', {
      subscriptionId: subscription.id,
      trialEnd: subscription.trial_end ? new Date(subscription.trial_end * 1000) : null,
    });

    // TODO: Send trial ending notification email
    console.log(`Trial will end for subscription: ${subscription.id}`);
  } catch (error) {
    console.error('Error handling trial will end:', error);
  }
}

async function handleInvoicePaymentSucceeded(invoice: Stripe.Invoice) {
  try {
    if (invoice.subscription) {
      // Log subscription event
      await logSubscriptionEvent(invoice.subscription as string, 'payment_succeeded', {
        invoiceId: invoice.id,
        amount: invoice.amount_paid,
        currency: invoice.currency,
      });

      // Find the subscription and allocate credits
      const subscription = await prisma.customerSubscription.findUnique({
        where: { stripeSubscriptionId: invoice.subscription as string },
        include: {
          plan: true,
        }
      });

      if (subscription && subscription.plan) {
        // Allocate monthly credits for subscription renewal
        const creditResult = await SubscriptionCreditService.handleSubscriptionRenewal(
          subscription.partnerId,
          subscription.plan.name,
          subscription.plan.id,
          new Date(invoice.period_start * 1000)
        );

        if (creditResult.success) {
          console.log(`Allocated ${creditResult.creditsAllocated} credits for subscription renewal: ${invoice.subscription}`);
        } else {
          console.error(`Failed to allocate credits for subscription ${invoice.subscription}:`, creditResult.error);
        }
      }

      console.log(`Payment succeeded for subscription: ${invoice.subscription}`);
    }
  } catch (error) {
    console.error('Error handling invoice payment succeeded:', error);
  }
}

async function handleInvoicePaymentFailed(invoice: Stripe.Invoice) {
  try {
    if (invoice.subscription) {
      // Log subscription event
      await logSubscriptionEvent(invoice.subscription as string, 'payment_failed', {
        invoiceId: invoice.id,
        amount: invoice.amount_due,
        currency: invoice.currency,
        failureReason: invoice.last_finalization_error?.message,
      });

      console.log(`Payment failed for subscription: ${invoice.subscription}`);
    }
  } catch (error) {
    console.error('Error handling invoice payment failed:', error);
  }
}

async function logSubscriptionEvent(
  stripeSubscriptionId: string,
  type: SubscriptionChangeType,
  data: Record<string, any>
): Promise<void> {
  try {
    const subscription = await prisma.customerSubscription.findUnique({
      where: { stripeSubscriptionId },
    });

    if (subscription) {
      await prisma.subscriptionEvent.create({
        data: {
          subscriptionId: subscription.id,
          type,
          data,
        },
      });
    }
  } catch (error) {
    console.error('Error logging subscription event:', error);
    // Don't throw - logging shouldn't break the main operation
  }
}
