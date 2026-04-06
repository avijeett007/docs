import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import Stripe from 'stripe';
import { invoiceEmailService } from '@/lib/email/invoiceEmailService';
import { logger } from '@/lib/logger';
import { convertExperienceProspectToCustomer } from '@/lib/services/experienceBookingService';
import { getLiteLLMClient } from '@/lib/litellm';
import { decryptData } from '@/lib/encryption';

export const dynamic = 'force-dynamic';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2023-10-16',
});

const endpointSecret = process.env.STRIPE_CUSTOMER_WEBHOOK_SECRET || process.env.STRIPE_WEBHOOK_SECRET!;

export async function POST(request: NextRequest) {
  try {
    const body = await request.text();
    const signature = request.headers.get('stripe-signature');

    if (!signature) {
      logger.error('Missing Stripe signature', undefined, { operation: 'stripe_webhook' });
      return NextResponse.json(
        { error: 'Missing signature' },
        { status: 400 }
      );
    }

    let event: Stripe.Event;

    try {
      event = stripe.webhooks.constructEvent(body, signature, endpointSecret);
    } catch (err) {
      logger.error('Webhook signature verification failed', err instanceof Error ? err : new Error(String(err)), { operation: 'stripe_webhook' });
      return NextResponse.json(
        { error: 'Invalid signature' },
        { status: 400 }
      );
    }

    logger.info(`Processing Stripe webhook event: ${event.type} (${event.id})`, { operation: 'stripe_webhook' });

    // Check if this event has already been processed (idempotency)
    const existingEvent = await prisma.stripeWebhookEvent.findUnique({
      where: { stripeEventId: event.id }
    });

    if (existingEvent?.processed) {
      logger.info(`Event ${event.id} already processed, skipping`, { operation: 'stripe_webhook' });
      return NextResponse.json({ received: true, status: 'already_processed' });
    }

    // Create or update event record
    const webhookEvent = await prisma.stripeWebhookEvent.upsert({
      where: { stripeEventId: event.id },
      create: {
        stripeEventId: event.id,
        eventType: event.type,
        stripeAccountId: request.headers.get('stripe-account'),
        eventData: JSON.stringify(event),
        metadata: {
          livemode: event.livemode,
          api_version: event.api_version
        }
      },
      update: {
        eventType: event.type,
        stripeAccountId: request.headers.get('stripe-account'),
        eventData: JSON.stringify(event)
      }
    });

    let processingError: string | null = null;

    try {
      switch (event.type) {
      case 'invoice.paid':
        await handleInvoicePaid(event.data.object as Stripe.Invoice);
        break;

      case 'invoice.payment_failed':
        await handleInvoicePaymentFailed(event.data.object as Stripe.Invoice);
        break;

      case 'payment_intent.succeeded':
        await handlePaymentIntentSucceeded(event.data.object as Stripe.PaymentIntent);
        break;

      case 'payment_intent.payment_failed':
        await handlePaymentIntentFailed(event.data.object as Stripe.PaymentIntent);
        break;

      case 'checkout.session.completed':
        // Keep this for other payment flows (subscriptions, credit purchases, etc.)
        await handleCheckoutSessionCompleted(event.data.object as Stripe.Checkout.Session, request);
        break;

        default:
          logger.info(`Unhandled event type: ${event.type}`, { operation: 'stripe_webhook' });
      }

      // Mark event as processed
      await prisma.stripeWebhookEvent.update({
        where: { id: webhookEvent.id },
        data: {
          processed: true,
          processedAt: new Date()
        }
      });

      logger.info(`Successfully processed webhook event: ${event.type} (${event.id})`, { operation: 'stripe_webhook' });
      return NextResponse.json({ received: true });
    } catch (error) {
      processingError = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Error processing webhook', error instanceof Error ? error : new Error(String(error)), { operation: 'stripe_webhook' });

      // Mark event as failed
      await prisma.stripeWebhookEvent.update({
        where: { id: webhookEvent.id },
        data: {
          errorMessage: processingError
        }
      });

      return NextResponse.json(
        { error: 'Webhook processing failed' },
        { status: 500 }
      );
    }
  } catch (error) {
    logger.error('Error in webhook handler', error instanceof Error ? error : new Error(String(error)), { operation: 'stripe_webhook' });
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

async function handleInvoicePaid(invoice: Stripe.Invoice) {
  try {
    logger.info(`Processing invoice paid: ${invoice.id}`, { operation: 'handle_invoice_paid' });

    // Extract invoice ID from metadata
    const invoiceId = invoice.metadata?.invoiceId;

    if (!invoiceId) {
      logger.error('No invoice ID in Stripe invoice metadata', undefined, { operation: 'handle_invoice_paid' });
      return;
    }

    // Start a transaction to update invoice and create payment record
    await prisma.$transaction(async (tx) => {
      // Check if invoice exists and is not already paid
      const existingInvoice = await tx.invoice.findUnique({
        where: { id: invoiceId },
        include: {
          partner: {
            select: {
              id: true,
              stripeAccountId: true,
            },
          },
        },
      });

      if (!existingInvoice) {
        logger.error(`Invoice ${invoiceId} not found`, undefined, { operation: 'handle_invoice_paid' });
        return;
      }

      if (existingInvoice.status === 'paid') {
        logger.info(`Invoice ${invoiceId} already marked as paid, skipping`, { operation: 'handle_invoice_paid' });
        return;
      }

      // Update invoice status
      await tx.invoice.update({
        where: { id: invoiceId },
        data: {
          status: 'paid',
          paidAt: new Date(),
        },
      });

      // Determine payment intent ID - handle both direct payment intents and hosted invoice payments
      let paymentIntentId = invoice.payment_intent as string || invoice.id;

      // For Connect accounts, we might need to retrieve payment intent with proper context
      if (invoice.payment_intent && existingInvoice.partner.stripeAccountId) {
        try {
          const retrieveOptions = { stripeAccount: existingInvoice.partner.stripeAccountId };
          const paymentIntent = await stripe.paymentIntents.retrieve(
            invoice.payment_intent as string,
            {},
            retrieveOptions
          );
          logger.info(`Successfully retrieved payment intent ${invoice.payment_intent} from Connect account`, { operation: 'handle_invoice_paid' });
          paymentIntentId = paymentIntent.id;
        } catch (error) {
          logger.warn(`Could not retrieve payment intent ${invoice.payment_intent} from Connect account, using invoice ID as fallback`, { operation: 'handle_invoice_paid', error: String(error) });
          paymentIntentId = invoice.id;
        }
      }

      // Create payment record
      await tx.invoicePayment.create({
        data: {
          invoiceId: invoiceId,
          stripePaymentIntentId: paymentIntentId,
          amount: invoice.amount_paid,
          currency: invoice.currency,
          status: 'succeeded',
          paidAt: new Date(),
        },
      });

      logger.info(`Invoice ${invoiceId} marked as paid (${invoice.amount_paid} ${invoice.currency})`, { operation: 'handle_invoice_paid' });
    });

    // Send payment confirmation email
    try {
      await invoiceEmailService.sendPaymentConfirmation(invoiceId, invoice.amount_paid);
    } catch (emailError) {
      logger.error('Failed to send payment confirmation email', emailError instanceof Error ? emailError : new Error(String(emailError)), { operation: 'handle_invoice_paid' });
      // Don't throw - email failure shouldn't fail the webhook
    }

    // Handle recurring invoice processing
    try {
      const { recurringPaymentService } = await import('../../../../../../lib/billing/recurringPaymentService');
      await recurringPaymentService.handleRecurringInvoicePayment(invoiceId);
    } catch (recurringError) {
      logger.error('Error processing recurring invoice', recurringError instanceof Error ? recurringError : new Error(String(recurringError)), { operation: 'handle_invoice_paid' });
      // Don't throw - recurring processing failure shouldn't fail the webhook
    }

  } catch (error) {
    logger.error('Error processing invoice paid webhook', error instanceof Error ? error : new Error(String(error)), { operation: 'handle_invoice_paid' });
    throw error;
  }
}

async function handlePaymentIntentSucceeded(paymentIntent: Stripe.PaymentIntent) {
  try {
    const invoiceId = paymentIntent.metadata.invoiceId;

    if (!invoiceId) {
      logger.info('No invoice ID in payment intent metadata - may be for credit purchase or subscription', { operation: 'handle_payment_intent_succeeded' });
      return;
    }

    logger.info(`Processing payment success for invoice ${invoiceId}, payment intent ${paymentIntent.id}`, { operation: 'handle_payment_intent_succeeded' });

    // Start a transaction to update invoice and create payment record
    await prisma.$transaction(async (tx) => {
      // Check if invoice exists and is not already paid
      const invoice = await tx.invoice.findUnique({
        where: { id: invoiceId }
      });

      if (!invoice) {
        logger.error(`Invoice ${invoiceId} not found`, undefined, { operation: 'handle_payment_intent_succeeded' });
        return;
      }

      if (invoice.status === 'paid') {
        logger.info(`Invoice ${invoiceId} already marked as paid, skipping`, { operation: 'handle_payment_intent_succeeded' });
        return;
      }

      // Update invoice status
      await tx.invoice.update({
        where: { id: invoiceId },
        data: {
          status: 'paid',
          paidAt: new Date(),
        },
      });

      // Check if payment record already exists
      const existingPayment = await tx.invoicePayment.findFirst({
        where: {
          invoiceId: invoiceId,
          stripePaymentIntentId: paymentIntent.id
        }
      });

      if (!existingPayment) {
        // Create payment record
        await tx.invoicePayment.create({
          data: {
            invoiceId: invoiceId,
            amount: paymentIntent.amount,
            currency: paymentIntent.currency,
            status: 'succeeded',
            stripePaymentIntentId: paymentIntent.id,
            paidAt: new Date(),
          },
        });
      }

      logger.info(`Successfully updated invoice ${invoiceId} to paid status`, { operation: 'handle_payment_intent_succeeded' });
    });

    // Send payment confirmation email
    try {
      const emailSent = await invoiceEmailService.sendPaymentConfirmation(
        invoiceId,
        paymentIntent.amount
      );
      if (emailSent) {
        logger.info(`Payment confirmation email sent for invoice ${invoiceId}`, { operation: 'handle_payment_intent_succeeded' });
      } else {
        logger.warn(`Failed to send payment confirmation email for invoice ${invoiceId}`, { operation: 'handle_payment_intent_succeeded' });
      }
    } catch (error) {
      logger.error(`Error sending payment confirmation email for invoice ${invoiceId}`, error instanceof Error ? error : new Error(String(error)), { operation: 'handle_payment_intent_succeeded' });
      // Don't fail the webhook if email fails
    }

    logger.info(`Payment succeeded for invoice ${invoiceId}`, { operation: 'handle_payment_intent_succeeded' });
  } catch (error) {
    logger.error('Error handling payment success', error instanceof Error ? error : new Error(String(error)), { operation: 'handle_payment_intent_succeeded' });
  }
}

async function handlePaymentIntentFailed(paymentIntent: Stripe.PaymentIntent) {
  try {
    const invoiceId = paymentIntent.metadata.invoiceId;

    if (!invoiceId) {
      logger.info('No invoice ID in payment intent metadata - may be for credit purchase or subscription', { operation: 'handle_payment_intent_failed' });
      return;
    }

    // Create failed payment record
    await prisma.invoicePayment.create({
      data: {
        invoiceId: invoiceId,
        amount: paymentIntent.amount,
        currency: paymentIntent.currency,
        status: 'failed',
        stripePaymentIntentId: paymentIntent.id,
        failureReason: paymentIntent.last_payment_error?.message || 'Payment failed',
      },
    });

    logger.info(`Payment failed for invoice ${invoiceId}`, { operation: 'handle_payment_intent_failed' });
  } catch (error) {
    logger.error('Error handling payment failure', error instanceof Error ? error : new Error(String(error)), { operation: 'handle_payment_intent_failed' });
  }
}








async function handleInvoicePaymentFailed(invoice: Stripe.Invoice) {
  try {
    // Extract invoice ID from metadata
    const invoiceId = invoice.metadata?.invoiceId;

    if (!invoiceId) {
      logger.error('No invoice ID in Stripe invoice metadata', undefined, { operation: 'handle_invoice_payment_failed' });
      return;
    }

    // Create failed payment record
    await prisma.invoicePayment.create({
      data: {
        invoiceId: invoiceId,
        stripePaymentIntentId: invoice.payment_intent as string || invoice.id,
        amount: invoice.amount_due,
        currency: invoice.currency,
        status: 'failed',
        failureReason: 'Invoice payment failed',
      },
    });

    logger.info(`Invoice payment failed for invoice ${invoiceId}`, { operation: 'handle_invoice_payment_failed' });
  } catch (error) {
    logger.error('Error handling invoice payment failure', error instanceof Error ? error : new Error(String(error)), { operation: 'handle_invoice_payment_failed' });
  }
}

async function handleCheckoutSessionCompleted(session: Stripe.Checkout.Session, request: NextRequest) {
  try {
    logger.info(`Processing checkout session completed: ${session.id}`, { operation: 'handle_checkout_session_completed' });

    // Extract connected account ID at the beginning for use throughout the function
    const connectedAccountId = request.headers.get('stripe-account');
    logger.info(`Connected account ID from header: ${connectedAccountId}`, { operation: 'handle_checkout_session_completed' });

    // SECURITY: Tool call quota subscriptions are handled by main platform webhook only
    // This Connect webhook is only for partner-specific billing (customer credits, invoices)
    if (session.mode === 'subscription' && session.metadata?.quotaTier) {
      logger.warn('Tool call quota subscription detected - should be handled by main platform webhook', { operation: 'handle_checkout_session_completed', sessionId: session.id });
      logger.info('Skipping processing to prevent revenue misdirection', { operation: 'handle_checkout_session_completed' });
      return;
    }

    // ── Experience booking (prepaid) ─────────────────────────────────────────
    // Handled BEFORE the connectedAccountId guard because the Stripe CLI may not
    // forward the stripe-account header during local testing. We identify the
    // partner via metadata.partnerId and optionally verify the account header if present.
    if (session.metadata?.type === 'experience_booking') {
      const { prospectId, experienceId, partnerId } = session.metadata;
      if (!prospectId || !experienceId || !partnerId) {
        logger.error('Missing metadata for experience_booking', undefined, { operation: 'handle_checkout_session_completed', sessionId: session.id });
        return;
      }

      // Look up partner by ID (not by stripeAccountId — header may be absent during local testing)
      const partner = await prisma.partner.findFirst({
        where: { id: partnerId },
        select: {
          id: true,
          businessName: true,
          stripeAccountId: true,
          subdomain: true,
          customDomain: true,
          customDomainVerified: true,
          logo: true,
          primaryColor: true,
          secondaryColor: true,
          autoDeployEnabled: true,
          planId: true,
          approvalStatus: true,
          customLandingPageUrl: true,
          // AI Gateway / Credits auto-enablement for new customers
          customerGatewayEnabled: true,
          customerGatewayForNewCustomers: true,
        },
      });
      if (!partner) {
        logger.error(`Partner ${partnerId} not found`, undefined, { operation: 'handle_checkout_session_completed', partnerId });
        return;
      }

      // If the stripe-account header IS present, verify it matches the partner's account
      if (connectedAccountId && partner.stripeAccountId && partner.stripeAccountId !== connectedAccountId) {
        logger.error(`Stripe account mismatch for partner ${partnerId}: expected ${partner.stripeAccountId}, got ${connectedAccountId}`, undefined, { operation: 'handle_checkout_session_completed', partnerId });
        return;
      }

      // Idempotency: skip if already marked paid
      const prospect = await prisma.prospect.findFirst({
        where: { id: prospectId, partnerId },
        select: {
          id: true,
          partnerId: true,
          firstName: true,
          lastName: true,
          email: true,
          phone: true,
          businessName: true,
          serviceCategories: true,
          ghlContactId: true,
          convertedToCustomerId: true,
        },
      });
      if (!prospect) {
        logger.error(`Prospect ${prospectId} not found`, undefined, { operation: 'handle_checkout_session_completed', partnerId });
        return;
      }

      const existingPayment = (prospect.serviceCategories as Record<string, unknown> | null)?.stripeSessionId;
      if (existingPayment === session.id) {
        logger.info(`Experience booking already processed for prospect ${prospectId}, skipping`, { operation: 'handle_checkout_session_completed', partnerId });
        return;
      }

      // Mark prospect as paid in serviceCategories JSON
      const currentData = (prospect.serviceCategories as Record<string, unknown>) || {};
      await prisma.prospect.update({
        where: { id: prospectId },
        data: {
          serviceCategories: {
            ...currentData,
            isPaid: true,
            stripeSessionId: session.id,
            stripePaymentIntent: session.payment_intent as string || null,
            paidAt: new Date().toISOString(),
            paidAmount: session.amount_total,
            paidCurrency: session.currency,
          },
        },
      });

      logger.info(`Experience booking payment confirmed for prospect ${prospectId}`, { operation: 'handle_checkout_session_completed', partnerId });

      // Convert prospect to customer (if not already done)
      if (!prospect.convertedToCustomerId) {
        try {
          await convertExperienceProspectToCustomer(prospect, partner);
          logger.info(`Prospect ${prospectId} converted to customer`, { operation: 'handle_checkout_session_completed', partnerId });
        } catch (convErr) {
          // Log but don't fail the webhook — payment is already recorded
          logger.error('[Whitelabel Webhook] Failed to convert prospect to customer after payment', convErr instanceof Error ? convErr : new Error(String(convErr)), {
            operation: 'experience_booking_webhook',
            prospectId,
            partnerId,
          });
        }
      } else {
        logger.info(`Prospect ${prospectId} already converted to customer ${prospect.convertedToCustomerId}, skipping`, { operation: 'handle_checkout_session_completed' });
      }

      return;
    }

    // Security: All other payment flows require the Stripe Connect account context
    if (!connectedAccountId) {
      logger.error('Missing Stripe account context for non-experience webhook', undefined, { operation: 'handle_checkout_session_completed', sessionId: session.id });
      return;
    }

    logger.info(`Processing checkout session with connected account: ${connectedAccountId}`, { operation: 'handle_checkout_session_completed' });

    // Check if this is an onboarding subscription (fallback handler)
    if (session.metadata?.type === 'onboarding_subscription') {
      logger.info('Processing onboarding subscription as fallback', { operation: 'handle_checkout_session_completed' });
      
      try {
        const response = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/whitelabel/complete-onboarding-after-payment`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ sessionId: session.id })
        });

        if (!response.ok) {
          const errorData = await response.json();
          logger.error('Failed to complete onboarding after payment', new Error(JSON.stringify(errorData)), { operation: 'handle_checkout_session_completed' });
        } else {
          logger.info('Successfully completed onboarding after payment via webhook fallback', { operation: 'handle_checkout_session_completed' });
          // Note: Payment confirmation email is sent by complete-onboarding-after-payment API
        }
      } catch (error) {
        logger.error('Error calling complete-onboarding-after-payment', error instanceof Error ? error : new Error(String(error)), { operation: 'handle_checkout_session_completed' });
      }
      
      return;
    }

    // Check if this is a customer credit purchase
    if (session.metadata?.type === 'customer_credit_purchase') {
      const { customerId, partnerId, planId, credits } = session.metadata;

      if (!customerId || !partnerId || !planId || !credits) {
        logger.error('Missing required metadata in checkout session', undefined, { operation: 'handle_checkout_session_completed', sessionId: session.id });
        return;
      }

      // Verify the partner owns the connected account
      const partner = await prisma.partner.findFirst({
        where: {
          id: partnerId,
          stripeAccountId: connectedAccountId
        }
      });

      if (!partner) {
        logger.error(`Partner ${partnerId} does not own Stripe account ${connectedAccountId}`, undefined, { operation: 'handle_checkout_session_completed', partnerId });
        return;
      }

      logger.info(`Processing credit purchase: ${credits} credits for customer ${customerId}`, { operation: 'handle_checkout_session_completed', partnerId, customerId });

      // Check for existing processing (idempotency)
      const existingTransaction = await prisma.creditTransaction.findFirst({
        where: {
          OR: [
            {
              metadata: {
                path: ['stripeSessionId'],
                equals: session.id
              }
            },
            {
              referenceId: session.payment_intent as string
            }
          ]
        }
      });

      if (existingTransaction) {
        const source = existingTransaction.metadata && typeof existingTransaction.metadata === 'object' && 'source' in existingTransaction.metadata
          ? existingTransaction.metadata.source
          : 'unknown';
        logger.info(`Payment ${session.payment_intent} already processed via ${source}, skipping webhook`, { operation: 'handle_checkout_session_completed' });
        return;
      }

      await prisma.$transaction(async (tx) => {
        // Double-check within transaction to prevent race conditions
        const existingInTransaction = await tx.creditTransaction.findFirst({
          where: {
            OR: [
              {
                metadata: {
                  path: ['stripeSessionId'],
                  equals: session.id
                }
              },
              {
                referenceId: session.payment_intent as string
              }
            ]
          }
        });

        if (existingInTransaction) {
          logger.info(`Payment already processed in transaction: ${existingInTransaction.id}`, { operation: 'handle_checkout_session_completed' });
          return;
        }

        // Update the purchase record to completed
        await tx.customerCreditPurchase.updateMany({
          where: {
            customerId,
            planId,
            status: 'pending',
            metadata: {
              path: ['stripeSessionId'],
              equals: session.id
            }
          },
          data: {
            status: 'completed',
            stripePaymentIntentId: session.payment_intent as string || '',
          }
        });

        // Get current customer balance
        const customer = await tx.customer.findUnique({
          where: { id: customerId },
          select: { creditBalance: true }
        });

        if (!customer) {
          throw new Error(`Customer ${customerId} not found`);
        }

        const creditsToAdd = parseInt(credits);
        const newBalance = customer.creditBalance + creditsToAdd;

        // Atomically update customer balance and create transaction
        const [updatedCustomer, creditPlan] = await Promise.all([
          tx.customer.update({
            where: { id: customerId },
            data: {
              creditBalance: newBalance,
              totalCreditsAllocated: {
                increment: creditsToAdd
              }
            }
          }),
          tx.customerCreditPlan.findUnique({
            where: { id: planId },
            select: { name: true }
          })
        ]);

        // Create credit transaction record
        await tx.creditTransaction.create({
          data: {
            customerId: customerId,
            partnerId: partnerId,
            type: 'purchase',
            amount: creditsToAdd,
            balanceAfter: updatedCustomer.creditBalance,
            description: `Credit purchase: ${creditPlan?.name || 'Credit Plan'}`,
            referenceId: session.payment_intent as string || session.id,
            metadata: {
              source: 'stripe_webhook',
              planId: planId,
              type: 'customer_credit_purchase',
              stripeSessionId: session.id,
              stripeAccountId: connectedAccountId,
              processedAt: new Date().toISOString()
            }
          }
        });

        logger.info(`Successfully added ${creditsToAdd} credits to customer ${customerId} via webhook. New balance: ${updatedCustomer.creditBalance}`, { operation: 'handle_checkout_session_completed', customerId, partnerId });
      }, {
        isolationLevel: 'Serializable',
        timeout: 10000
      });

      // Re-enable any suspended AI Gateway keys for this customer (fire-and-forget)
      reEnableCustomerGatewayKeys(customerId).catch(() => { /* non-blocking */ });

      // After successful credit purchase, reassociate any phone numbers
      // that were suspended due to insufficient credits (fire-and-forget)
      try {
        const connectHubUrl = process.env.CONNECT_HUB_URL;
        if (connectHubUrl) {
          logger.info(`Triggering phone reassociation for customer ${customerId} after credit purchase`, { operation: 'handle_checkout_session_completed', customerId });
          fetch(`${connectHubUrl}/api/phone-reassociation/${customerId}`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${process.env.CONNECT_HUB_API_KEY || ''}`,
            },
          }).then(async (res) => {
            if (res.ok) {
              const data = await res.json();
              logger.info(`Phone reassociation completed for customer ${customerId}`, { operation: 'handle_checkout_session_completed', customerId, totalFound: data.totalFound, restored: data.restored, failed: data.failed });
            } else {
              logger.error(`Phone reassociation failed for customer ${customerId}: HTTP ${res.status}`, undefined, { operation: 'handle_checkout_session_completed', customerId });
            }
          }).catch((err) => {
            logger.error(`Phone reassociation request failed for customer ${customerId}`, err instanceof Error ? err : new Error(String(err)), { operation: 'handle_checkout_session_completed', customerId });
          });
        }
      } catch (reassocError) {
        logger.error('Error triggering phone reassociation', reassocError instanceof Error ? reassocError : new Error(String(reassocError)), { operation: 'handle_checkout_session_completed', customerId });
        // Don't throw - reassociation failure shouldn't fail the webhook
      }
    } else if (session.payment_intent && typeof session.payment_intent === 'string') {
      // Handle invoice payments via checkout session
      logger.info('Checking if checkout session is for invoice payment', { operation: 'handle_checkout_session_completed', sessionId: session.id });

      // Get the payment intent to check for invoice metadata
      // For connected accounts, we need to specify the account context
      const retrieveOptions = connectedAccountId ? { stripeAccount: connectedAccountId } : {};

      let paymentIntent;
      try {
        logger.info(`Retrieving payment intent ${session.payment_intent}`, { operation: 'handle_checkout_session_completed' });
        paymentIntent = await stripe.paymentIntents.retrieve(
          session.payment_intent as string,
          retrieveOptions
        );
        logger.info(`Successfully retrieved payment intent ${session.payment_intent}`, { operation: 'handle_checkout_session_completed' });
      } catch (error) {
        logger.error(`Error retrieving payment intent ${session.payment_intent}`, error instanceof Error ? error : new Error(String(error)), { operation: 'handle_checkout_session_completed', connectedAccountId: connectedAccountId ?? undefined });

        // For hosted invoices, PaymentIntent might not exist - this is normal
        // The invoice.paid webhook will handle the payment processing instead
        logger.info('PaymentIntent not found - likely a hosted invoice payment, skipping checkout session processing', { operation: 'handle_checkout_session_completed' });
        return;
      }

      if (paymentIntent.metadata?.invoiceId) {
        logger.info(`Processing invoice payment via checkout session: ${paymentIntent.metadata.invoiceId}`, { operation: 'handle_checkout_session_completed' });
        await handlePaymentIntentSucceeded(paymentIntent);
      } else {
        logger.info('Checkout session payment intent has no invoice metadata, skipping', { operation: 'handle_checkout_session_completed' });
      }
    } else {
      logger.info('Checkout session is not a customer credit purchase or invoice payment, skipping', { operation: 'handle_checkout_session_completed', sessionId: session.id });
    }
  } catch (error) {
    logger.error('Error handling checkout session completed', error instanceof Error ? error : new Error(String(error)), { operation: 'handle_checkout_session_completed' });
  }
}


// NOTE: convertExperienceProspectToCustomer lives in src/lib/services/experienceBookingService.ts
// REMOVED: updateCustomerQuotaTier — handled exclusively by main platform webhook

// ============================================
// AI Gateway Key Re-enable Helper
// ============================================

/**
 * Re-enable suspended customer AI Gateway keys after a successful credit top-up.
 * Fire-and-forget: errors are logged but do not fail the webhook response.
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
        logger.info(`[WhitelabelBillingWebhook] Re-enabled AI Gateway key ${key.id} for customer ${customerId}`, { operation: 'stripe_webhook' });
      } catch (err) {
        logger.error(`[WhitelabelBillingWebhook] Failed to re-enable key ${key.id}`, err instanceof Error ? err : new Error(String(err)), { operation: 'stripe_webhook' });
      }
    }
  } catch (err) {
    logger.error('[WhitelabelBillingWebhook] reEnableCustomerGatewayKeys error', err instanceof Error ? err : new Error(String(err)), { operation: 'stripe_webhook' });
  }
}
