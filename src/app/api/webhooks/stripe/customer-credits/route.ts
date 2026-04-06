import { NextRequest, NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { prisma } from '@/lib/prisma';
import Stripe from 'stripe';
import { getLiteLLMClient } from '@/lib/litellm';
import { decryptData } from '@/lib/encryption';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2023-10-16',
});

/**
 * POST /api/webhooks/stripe/customer-credits
 * Handle Stripe webhooks for customer credit purchases
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.text();
    const headersList = headers();
    const signature = headersList.get('stripe-signature');
    const connectedAccountId = headersList.get('stripe-account');

    if (!signature) {
      logger.error('Missing Stripe signature', undefined, { operation: 'customer_credits_webhook' });
      return NextResponse.json(
        { error: 'Missing signature' },
        { status: 400 }
      );
    }

    // Validate Stripe Connect account context for multi-tenant security
    if (!connectedAccountId) {
      logger.error('Missing Stripe Connect account context', undefined, { operation: 'customer_credits_webhook' });
      return NextResponse.json(
        { error: 'Missing account context' },
        { status: 400 }
      );
    }

    let stripeEvent: Stripe.Event;

    try {
      stripeEvent = stripe.webhooks.constructEvent(
        body,
        signature,
        process.env.STRIPE_WEBHOOK_SECRET!
      );
    } catch (err) {
      logger.error('Webhook signature verification failed', err instanceof Error ? err : new Error(String(err)), { operation: 'customer_credits_webhook' });
      return NextResponse.json(
        { error: 'Invalid signature' },
        { status: 400 }
      );
    }

    // Check for webhook idempotency to prevent duplicate processing
    const existingWebhookEvent = await prisma.stripeWebhookEvent.findUnique({
      where: { stripeEventId: stripeEvent.id },
    });

    if (existingWebhookEvent) {
      logger.info(`Webhook event ${stripeEvent.id} already processed, skipping`, { operation: 'customer_credits_webhook', eventId: stripeEvent.id });
      return NextResponse.json({ received: true, status: 'already_processed' });
    }

    // Record webhook event for idempotency
    await prisma.stripeWebhookEvent.create({
      data: {
        stripeEventId: stripeEvent.id,
        eventType: stripeEvent.type,
        stripeAccountId: connectedAccountId,
        processed: false,
        metadata: {
          source: 'customer_credits_webhook',
          timestamp: new Date().toISOString(),
        },
      },
    });

    // Handle the event
    switch (stripeEvent.type) {
      case 'checkout.session.completed':
        await handleCheckoutSessionCompleted(stripeEvent.data.object as Stripe.Checkout.Session, stripeEvent.id);
        break;
      case 'payment_intent.succeeded':
        await handlePaymentIntentSucceeded(stripeEvent.data.object as Stripe.PaymentIntent, stripeEvent.id);
        break;
      default:
        logger.info(`Unhandled event type: ${stripeEvent.type}`, { operation: 'customer_credits_webhook' });
    }

    // Mark webhook event as processed
    await prisma.stripeWebhookEvent.update({
      where: { stripeEventId: stripeEvent.id },
      data: {
        processed: true,
        processedAt: new Date()
      },
    });

    return NextResponse.json({ received: true });

  } catch (error) {
    logger.error('Webhook error', error instanceof Error ? error : new Error(String(error)), { operation: 'customer_credits_webhook' });

    // Mark webhook event as failed for debugging (if stripeEvent was created)
    try {
      // Try to find the webhook event by checking if it was created
      const webhookEventToUpdate = await prisma.stripeWebhookEvent.findFirst({
        where: {
          eventType: 'checkout.session.completed',
          processed: false,
          createdAt: {
            gte: new Date(Date.now() - 60000) // Within last minute
          }
        },
        orderBy: { createdAt: 'desc' }
      });

      if (webhookEventToUpdate) {
        await prisma.stripeWebhookEvent.update({
          where: { id: webhookEventToUpdate.id },
          data: {
            processed: false,
            errorMessage: error instanceof Error ? error.message : 'Unknown error'
          },
        });
      }
    } catch (updateError) {
      logger.error('Failed to update webhook event status', updateError instanceof Error ? updateError : new Error(String(updateError)), { operation: 'customer_credits_webhook' });
    }

    return NextResponse.json(
      { error: 'Webhook handler failed' },
      { status: 500 }
    );
  }
}

async function handleCheckoutSessionCompleted(session: Stripe.Checkout.Session, eventId: string) {
  try {
    logger.info(`Processing checkout session completed: ${session.id}`, { operation: 'customer_credits_webhook', sessionId: session.id, eventId });

    // Check if this is a customer credit purchase
    if (session.metadata?.type !== 'customer_credit_purchase') {
      return;
    }

    const customerId = session.metadata.customerId;
    const partnerId = session.metadata.partnerId;
    const planId = session.metadata.planId;
    const credits = parseInt(session.metadata.credits || '0');

    if (!customerId || !partnerId || !planId || !credits) {
      logger.error('Missing required metadata in checkout session', undefined, { operation: 'customer_credits_webhook', sessionId: session.id, metadata: session.metadata as Record<string, unknown> });
      return;
    }

    // Update the purchase record
    await prisma.customerCreditPurchase.updateMany({
      where: {
        customerId: customerId,
        partnerId: partnerId,
        planId: planId,
        stripePaymentIntentId: session.payment_intent as string,
        status: 'pending',
      },
      data: {
        status: 'completed',
        stripeChargeId: session.payment_intent as string,
      },
    });

    // Add credits to customer account
    await addCreditsToCustomer(customerId, partnerId, credits, planId);

    logger.info(`Successfully processed credit purchase for customer ${customerId}: ${credits} credits`, { operation: 'customer_credits_webhook', customerId, credits });

    // Re-enable any suspended AI Gateway keys (fire-and-forget)
    reEnableCustomerGatewayKeys(customerId).catch(() => { /* non-blocking */ });

    // After successful credit purchase, reassociate any phone numbers
    // that were suspended due to insufficient credits (fire-and-forget)
    try {
      const connectHubUrl = process.env.CONNECT_HUB_URL;
      if (connectHubUrl) {
        logger.info(`Triggering phone reassociation for customer ${customerId} after credit purchase`, { operation: 'customer_credits_webhook', customerId });
        fetch(`${connectHubUrl}/api/phone-reassociation/${customerId}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${process.env.CONNECT_HUB_API_KEY || ''}`,
          },
        }).then(async (res) => {
          if (res.ok) {
            const data = await res.json();
            logger.info(`Phone reassociation completed for customer ${customerId}`, { operation: 'customer_credits_webhook', customerId, totalFound: data.totalFound, restored: data.restored, failed: data.failed });
          } else {
            logger.error(`Phone reassociation failed for customer ${customerId}: HTTP ${res.status}`, undefined, { operation: 'customer_credits_webhook', customerId });
          }
        }).catch((err) => {
          logger.error(`Phone reassociation request failed for customer ${customerId}`, err instanceof Error ? err : new Error(String(err)), { operation: 'customer_credits_webhook', customerId });
        });
      }
    } catch (reassocError) {
      logger.error('Error triggering phone reassociation', reassocError instanceof Error ? reassocError : new Error(String(reassocError)), { operation: 'customer_credits_webhook', customerId });
      // Don't throw - reassociation failure shouldn't fail the webhook
    }

  } catch (error) {
    logger.error('Error handling checkout session completed', error instanceof Error ? error : new Error(String(error)), { operation: 'customer_credits_webhook' });
  }
}

async function handlePaymentIntentSucceeded(paymentIntent: Stripe.PaymentIntent, eventId: string) {
  try {
    logger.info(`Processing payment intent succeeded: ${paymentIntent.id}`, { operation: 'customer_credits_webhook', paymentIntentId: paymentIntent.id, eventId });

    // Find the purchase record by payment intent ID
    const purchase = await prisma.customerCreditPurchase.findFirst({
      where: {
        stripePaymentIntentId: paymentIntent.id,
        status: 'pending',
      },
    });

    if (!purchase) {
      logger.info(`No pending purchase found for payment intent: ${paymentIntent.id}`, { operation: 'customer_credits_webhook', paymentIntentId: paymentIntent.id });
      return;
    }

    // Update purchase status
    await prisma.customerCreditPurchase.update({
      where: {
        id: purchase.id,
      },
      data: {
        status: 'completed',
        stripeChargeId: paymentIntent.latest_charge as string,
      },
    });

    // Add credits to customer account
    await addCreditsToCustomer(
      purchase.customerId,
      purchase.partnerId,
      purchase.creditsPurchased,
      purchase.planId
    );

    logger.info(`Successfully processed credit purchase for customer ${purchase.customerId}: ${purchase.creditsPurchased} credits`, { operation: 'customer_credits_webhook', customerId: purchase.customerId, credits: purchase.creditsPurchased });

    // Re-enable any suspended AI Gateway keys (fire-and-forget)
    reEnableCustomerGatewayKeys(purchase.customerId).catch(() => { /* non-blocking */ });

    // After successful credit purchase, reassociate any phone numbers
    // that were suspended due to insufficient credits (fire-and-forget)
    try {
      const connectHubUrl = process.env.CONNECT_HUB_URL;
      if (connectHubUrl) {
        logger.info(`Triggering phone reassociation for customer ${purchase.customerId} after payment intent succeeded`, { operation: 'customer_credits_webhook', customerId: purchase.customerId });
        fetch(`${connectHubUrl}/api/phone-reassociation/${purchase.customerId}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${process.env.CONNECT_HUB_API_KEY || ''}`,
          },
        }).then(async (res) => {
          if (res.ok) {
            const data = await res.json();
            logger.info(`Phone reassociation completed for customer ${purchase.customerId}`, { operation: 'customer_credits_webhook', customerId: purchase.customerId, totalFound: data.totalFound, restored: data.restored, failed: data.failed });
          } else {
            logger.error(`Phone reassociation failed for customer ${purchase.customerId}: HTTP ${res.status}`, undefined, { operation: 'customer_credits_webhook', customerId: purchase.customerId });
          }
        }).catch((err) => {
          logger.error(`Phone reassociation request failed for customer ${purchase.customerId}`, err instanceof Error ? err : new Error(String(err)), { operation: 'customer_credits_webhook', customerId: purchase.customerId });
        });
      }
    } catch (reassocError) {
      logger.error('Error triggering phone reassociation', reassocError instanceof Error ? reassocError : new Error(String(reassocError)), { operation: 'customer_credits_webhook', customerId: purchase.customerId });
      // Don't throw - reassociation failure shouldn't fail the webhook
    }

  } catch (error) {
    logger.error('Error handling payment intent succeeded', error instanceof Error ? error : new Error(String(error)), { operation: 'customer_credits_webhook' });
  }
}

/**
 * Re-enable any AI Gateway keys that were suspended due to zero customer AI Credits.
 * Called (fire-and-forget) after a successful customer credit top-up.
 */
async function reEnableCustomerGatewayKeys(customerId: string): Promise<void> {
  try {
    const suspendedKeys = await prisma.aiGatewayKey.findMany({
      where: { customerId, status: 'suspended' },
      select: { id: true, encryptedVirtualKey: true },
    });

    if (suspendedKeys.length === 0) return;

    const litellm = getLiteLLMClient();
    for (const key of suspendedKeys) {
      try {
        const rawVirtualKey = await decryptData(key.encryptedVirtualKey);
        await litellm.unblockKey(rawVirtualKey);
        await prisma.aiGatewayKey.update({
          where: { id: key.id },
          data: { status: 'active' },
        });
        logger.info(`[CustomerWebhook] Re-enabled AI Gateway key ${key.id} for customer ${customerId}`, { operation: 'customer_credits_webhook', customerId, keyId: key.id });
      } catch (err) {
        logger.error(`[CustomerWebhook] Failed to re-enable key ${key.id}`, err instanceof Error ? err : new Error(String(err)), { operation: 'customer_credits_webhook', customerId, keyId: key.id });
      }
    }
  } catch (err) {
    logger.error('[CustomerWebhook] reEnableCustomerGatewayKeys error', err instanceof Error ? err : new Error(String(err)), { operation: 'customer_credits_webhook', customerId });
  }
}

async function addCreditsToCustomer(
  customerId: string,
  partnerId: string,
  credits: number,
  planId: string
) {
  try {
    // Use database transaction for atomic credit updates
    const result = await prisma.$transaction(async (tx) => {
      // Get current customer balance within transaction
      const customer = await tx.customer.findUnique({
        where: { id: customerId },
        select: {
          creditBalance: true,
          totalCreditsAllocated: true,
        },
      });

      if (!customer) {
        throw new Error(`Customer not found: ${customerId}`);
      }

      const newBalance = customer.creditBalance + credits;
      const newTotalAllocated = customer.totalCreditsAllocated + credits;

      // Update customer credit balance atomically (sync both integer and decimal fields)
      const updatedCustomer = await tx.customer.update({
        where: { id: customerId },
        data: {
          creditBalance: newBalance,
          totalCreditsAllocated: newTotalAllocated,
        },
      });

      // Get credit plan details for transaction description
      const creditPlan = await tx.customerCreditPlan.findUnique({
        where: { id: planId },
        select: { name: true },
      });

      // Create credit transaction record atomically
      const transaction = await tx.creditTransaction.create({
        data: {
          customerId: customerId,
          partnerId: partnerId,
          type: 'credit',
          amount: credits,
          balanceAfter: newBalance,
          description: `Credit purchase: ${creditPlan?.name || 'Credit Plan'}`,
          metadata: {
            source: 'stripe_purchase',
            planId: planId,
            type: 'customer_credit_purchase',
          },
        },
      });

      return { updatedCustomer, transaction, newBalance };
    });

    logger.info(`Added ${credits} credits to customer ${customerId}. New balance: ${result.newBalance}`, { operation: 'customer_credits_webhook', customerId, credits, newBalance: result.newBalance });
    return result;

  } catch (error) {
    logger.error('Error adding credits to customer', error instanceof Error ? error : new Error(String(error)), { operation: 'customer_credits_webhook', customerId });
    throw error;
  }
}
