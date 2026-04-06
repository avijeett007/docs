import { NextRequest, NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { getServerStripe } from '@/lib/stripe';
import { CreditPurchaseService } from '@/lib/services/creditPurchaseService';
import { prisma } from '@/lib/prisma';
import Stripe from 'stripe';
import { getLiteLLMClient } from '@/lib/litellm';
import { decryptData } from '@/lib/encryption';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

/**
 * POST /api/partner/credits/webhook
 * Handle Stripe webhook events for credit purchases
 */
export async function POST(request: NextRequest) {
  const stripe = getServerStripe();
  if (!stripe) {
    return new NextResponse('Stripe is not properly initialized', { status: 500 });
  }

  const body = await request.text();
  const signature = headers().get('Stripe-Signature') as string;

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!
    );
  } catch (error: any) {
    logger.error('Webhook signature verification failed', error instanceof Error ? error : new Error(String(error.message)), { operation: 'partner_credits_webhook' });
    return new NextResponse(`Webhook Error: ${error.message}`, { status: 400 });
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        
        // Check if this is a credit purchase
        if (session.metadata?.type === 'credit_purchase') {
          // Check for idempotency - has this event been processed?
          const existingPurchase = await prisma.creditPurchase.findFirst({
            where: {
              OR: [
                { stripePaymentIntentId: session.payment_intent as string },
                { stripePaymentIntentId: session.id }
              ],
              status: 'completed'
            }
          });

          if (existingPurchase) {
            return NextResponse.json({
              received: true,
              message: 'Event already processed',
              purchaseId: existingPurchase.id
            });
          }

          const result = await CreditPurchaseService.handleSuccessfulPurchase(
            session.id,
            session.payment_intent as string
          );

          if (!result.success) {
            logger.error('Failed to process credit purchase', new Error(result.error || 'Unknown error'), { operation: 'partner_credits_webhook', sessionId: session.id });
            return new NextResponse(`Error processing purchase: ${result.error}`, { status: 500 });
          }

          logger.info(`Credit purchase processed successfully: ${session.id}`, { operation: 'partner_credits_webhook', sessionId: session.id });

          // Re-enable any suspended customer AI Gateway keys (fire-and-forget)
          const partnerId = session.metadata?.partnerId;
          if (partnerId) {
            reEnablePartnerCustomerGatewayKeys(partnerId).catch(() => { /* non-blocking */ });
          }
        }
        break;
      }

      case 'payment_intent.succeeded': {
        const paymentIntent = event.data.object as Stripe.PaymentIntent;

        // Check if this is a credit purchase
        if (paymentIntent.metadata?.type === 'credit_purchase') {
          logger.info(`Processing credit purchase payment success: ${paymentIntent.id}`, { operation: 'partner_credits_webhook', paymentIntentId: paymentIntent.id });

          const result = await CreditPurchaseService.handleSuccessfulPurchase(
            paymentIntent.metadata.stripeSessionId || paymentIntent.id,
            paymentIntent.id
          );

          if (!result.success) {
            logger.error('Failed to process credit purchase payment', new Error(result.error || 'Unknown error'), { operation: 'partner_credits_webhook', paymentIntentId: paymentIntent.id });
            return new NextResponse(`Error processing payment: ${result.error}`, { status: 500 });
          }

          logger.info(`Credit purchase payment processed successfully: ${paymentIntent.id}`, { operation: 'partner_credits_webhook', paymentIntentId: paymentIntent.id });

          // Re-enable any suspended customer AI Gateway keys (fire-and-forget)
          prisma.creditPurchase.findFirst({
            where: { stripePaymentIntentId: paymentIntent.id, status: 'completed' },
            select: { partnerId: true },
          }).then(purchase => {
            if (purchase?.partnerId) {
              return reEnablePartnerCustomerGatewayKeys(purchase.partnerId);
            }
          }).catch(() => { /* non-blocking */ });
        }
        break;
      }

      case 'payment_intent.payment_failed': {
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        
        // Check if this is a credit purchase
        if (paymentIntent.metadata?.type === 'credit_purchase') {
          logger.info(`Processing credit purchase payment failure: ${paymentIntent.id}`, { operation: 'partner_credits_webhook', paymentIntentId: paymentIntent.id });

          const result = await CreditPurchaseService.handleFailedPurchase(
            paymentIntent.id,
            paymentIntent.last_payment_error?.message
          );

          if (!result.success) {
            logger.error('Failed to process credit purchase failure', new Error(result.error || 'Unknown error'), { operation: 'partner_credits_webhook', paymentIntentId: paymentIntent.id });
            return new NextResponse(`Error processing failure: ${result.error}`, { status: 500 });
          }

          logger.info(`Credit purchase failure processed successfully: ${paymentIntent.id}`, { operation: 'partner_credits_webhook', paymentIntentId: paymentIntent.id });
        }
        break;
      }

      case 'charge.dispute.created': {
        const dispute = event.data.object as Stripe.Dispute;

        // Handle credit purchase disputes
        if (dispute.metadata?.type === 'credit_purchase') {
          logger.warn(`Credit purchase dispute created: ${dispute.id}`, { operation: 'partner_credits_webhook', disputeId: dispute.id });
          // TODO: Implement dispute handling logic
          // This might involve freezing the partner account or reversing credits
        }
        break;
      }

      default:
        logger.info(`Unhandled credit webhook event type: ${event.type}`, { operation: 'partner_credits_webhook' });
    }

    return new NextResponse('Webhook processed successfully', { status: 200 });
  } catch (error) {
    logger.error('Error processing credit webhook', error instanceof Error ? error : new Error(String(error)), { operation: 'partner_credits_webhook' });
    return new NextResponse('Webhook error', { status: 500 });
  }
}

// ============================================
// AI Gateway Key Re-enable Helpers
// ============================================

const PARTNER_SUSPEND_THRESHOLD = 1000;

/**
 * Re-enable suspended customer AI Gateway keys after a partner credit top-up,
 * provided the partner's balance is now above the suspension threshold.
 */
async function reEnablePartnerCustomerGatewayKeys(partnerId: string): Promise<void> {
  try {
    // Check the current partner balance first
    const { CreditService } = await import('@/lib/services/creditService');
    const balance = await CreditService.getPartnerCreditBalance(partnerId);
    if (!balance || balance.currentBalance < PARTNER_SUSPEND_THRESHOLD) {
      logger.info(`[PartnerWebhook] Partner ${partnerId} balance still below threshold (${balance?.currentBalance ?? 0}), skipping re-enable`, { operation: 'partner_credits_webhook', partnerId });
      return;
    }

    const suspendedKeys = await prisma.aiGatewayKey.findMany({
      where: { partnerId, status: 'suspended', customerId: { not: null } },
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
        logger.info(`[PartnerWebhook] Re-enabled AI Gateway key ${key.id} for partner ${partnerId}`, { operation: 'partner_credits_webhook', partnerId, keyId: key.id });
      } catch (err) {
        logger.error(`[PartnerWebhook] Failed to re-enable key ${key.id}`, err instanceof Error ? err : new Error(String(err)), { operation: 'partner_credits_webhook', partnerId, keyId: key.id });
      }
    }
  } catch (err) {
    logger.error('[PartnerWebhook] reEnablePartnerCustomerGatewayKeys error', err instanceof Error ? err : new Error(String(err)), { operation: 'partner_credits_webhook', partnerId });
  }
}
