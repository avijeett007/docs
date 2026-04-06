// Stripe Connect webhook handling service

import Stripe from 'stripe';
import { StripeConnectService } from './connect';
import { StripePaymentService } from './payments';
import { StripeWebhookEvent } from './types';
import { createStripeConnectError } from './utils';
import { prisma } from '@/lib/prisma';
import { emailService } from '@/lib/services/email-service';
import { generateRandomPassword } from '@/lib/password-generator';
import { sendPartnerWelcomeEmail } from '@/lib/email';
import { hashPassword } from '@/lib/password';
import { logger } from '@/lib/logger';
import { affiliateCommissionHandler } from '@/lib/affiliate-commission-handler';
import { SubscriptionCreditService } from '@/lib/services/subscriptionCreditService';

// Initialize Stripe with secret key
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2023-10-16',
});

// Function to provision partner in analytics service
async function provisionPartnerInAnalytics(partner: {
  id: string;
  businessName: string;
  contactName: string;
  emailAddress: string;
}) {
  try {
    const analyticsApiUrl = process.env.ANALYTICS_API_URL || 'http://localhost:8001';
    const analyticsApiKey = process.env.ANALYTICS_ADMIN_API_KEY;

    if (!analyticsApiKey) {
      logger.error('Missing ANALYTICS_ADMIN_API_KEY environment variable', new Error('Missing ANALYTICS_ADMIN_API_KEY environment variable'), {
        operation: 'stripe_webhook_analytics_provision'
      });
      return false;
    }

    const response = await fetch(`${analyticsApiUrl}/partners/provision`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': analyticsApiKey
      },
      body: JSON.stringify({
        partner_id: partner.id,
        business_name: partner.businessName,
        partner_name: partner.contactName,
        email: partner.emailAddress
      })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
      logger.error('Failed to provision partner in analytics', new Error('Analytics provisioning failed'), {
        operation: 'stripe_webhook_analytics_provision',
        errorData
      });
      return false;
    }

    return true;
  } catch (error) {
    logger.error('Error provisioning partner in analytics', error as Error, {
      operation: 'stripe_webhook_analytics_provision',
      partnerId: partner.id
    });
    return false;
  }
}

export class StripeWebhookService {
  /**
   * Verify webhook signature
   */
  static verifyWebhookSignature(
    payload: string | Buffer,
    signature: string,
    secret: string
  ): StripeWebhookEvent {
    try {
      const event = stripe.webhooks.constructEvent(payload, signature, secret);
      return event as StripeWebhookEvent;
    } catch (error: any) {
      logger.error('Webhook signature verification failed', error as Error, {
        operation: 'stripe_webhook_verification'
      });
      throw createStripeConnectError(
        'Invalid webhook signature',
        'INVALID_WEBHOOK_SIGNATURE',
        400
      );
    }
  }

  /**
   * Process webhook event
   */
  static async processWebhookEvent(event: StripeWebhookEvent, connectedAccountId?: string | null): Promise<void> {
    logger.info('Processing webhook event', {
      operation: 'stripe_webhook_processing',
      eventType: event.type,
      eventId: event.id,
      connectedAccountId
    });

    try {
      switch (event.type) {
        // Account events
        case 'account.updated':
          await this.handleAccountUpdated(event);
          break;

        case 'capability.updated':
          await this.handleCapabilityUpdated(event);
          break;

        case 'account.external_account.created':
        case 'account.external_account.updated':
          await this.handleExternalAccountUpdated(event);
          break;

        // Payment events
        case 'checkout.session.completed':
          await this.handleCheckoutSessionCompleted(event);
          break;

        case 'payment_intent.succeeded':
          await this.handlePaymentIntentSucceeded(event);
          break;

        case 'payment_intent.payment_failed':
          await this.handlePaymentIntentFailed(event);
          break;

        case 'payment_intent.canceled':
          await this.handlePaymentIntentCanceled(event);
          break;

        case 'charge.succeeded':
          await this.handleChargeSucceeded(event, connectedAccountId);
          break;

        case 'charge.failed':
          await this.handleChargeFailed(event, connectedAccountId);
          break;

        case 'charge.dispute.created':
          await this.handleChargeDisputeCreated(event);
          break;

        // Application fee events
        case 'application_fee.created':
          await this.handleApplicationFeeCreated(event);
          break;

        case 'application_fee.refunded':
          await this.handleApplicationFeeRefunded(event);
          break;

        // Transfer events
        case 'transfer.created':
          await this.handleTransferCreated(event);
          break;

        case 'transfer.failed':
          await this.handleTransferFailed(event);
          break;

        // Subscription events for tool call quotas
        case 'customer.subscription.created':
          await this.handleSubscriptionCreated(event);
          break;

        case 'customer.subscription.updated':
          await this.handleSubscriptionUpdated(event);
          break;

        case 'customer.subscription.deleted':
          await this.handleSubscriptionDeleted(event);
          break;

        case 'invoice.payment_succeeded':
          await this.handleInvoicePaymentSucceeded(event);
          break;

        case 'invoice.payment_failed':
          await this.handleInvoicePaymentFailed(event);
          break;

        default:
          logger.info('Unhandled webhook event type', {
            operation: 'stripe_webhook_processing',
            eventType: event.type,
            eventId: event.id
          });
      }
    } catch (error: any) {
      logger.error('Error processing webhook event', error as Error, {
        operation: 'stripe_webhook_processing',
        eventType: event.type,
        eventId: event.id
      });
      throw error;
    }
  }

  /**
   * Handle account.updated event
   */
  private static async handleAccountUpdated(event: StripeWebhookEvent): Promise<void> {
    const account = event.data.object;
    logger.info('Account updated', {
      operation: 'stripe_webhook_account_updated',
      accountId: account.id
    });

    await StripeConnectService.updateAccountFromWebhook(account.id, account);
  }

  /**
   * Handle capability.updated event
   */
  private static async handleCapabilityUpdated(event: StripeWebhookEvent): Promise<void> {
    const capability = event.data.object;
    logger.info('Capability updated', {
      operation: 'stripe_webhook_capability_updated',
      capabilityId: capability.id,
      accountId: capability.account
    });

    // Fetch the full account to get updated capabilities
    const account = await stripe.accounts.retrieve(capability.account);
    await StripeConnectService.updateAccountFromWebhook(account.id, account);
  }

  /**
   * Handle external account events
   */
  private static async handleExternalAccountUpdated(event: StripeWebhookEvent): Promise<void> {
    const externalAccount = event.data.object;
    logger.info('External account updated', {
      operation: 'stripe_webhook_external_account_updated',
      externalAccountId: externalAccount.id,
      accountId: externalAccount.account
    });

    // Fetch the full account to get updated information
    const account = await stripe.accounts.retrieve(externalAccount.account);
    await StripeConnectService.updateAccountFromWebhook(account.id, account);
  }

  /**
   * Handle checkout.session.completed event for one-time payments (including lifetime offers)
   */
  private static async handleCheckoutSessionCompleted(event: StripeWebhookEvent): Promise<void> {
    const session = event.data.object as Stripe.Checkout.Session;
    logger.info('Checkout session completed', {
      operation: 'stripe_webhook_checkout_completed',
      sessionId: session.id
    });

    try {
      // Handle subscription-based tool call quota upgrades
      if (session.mode === 'subscription' && session.metadata?.quotaTier) {
        logger.info('Processing tool call quota subscription checkout session', {
          operation: 'stripe_webhook_checkout_quota'
        });

        const { customerId, quotaTier } = session.metadata;

        if (customerId && quotaTier) {
          logger.info('Updating customer quota tier from checkout session', {
            operation: 'stripe_webhook_checkout_quota',
            customerId,
            quotaTier
          });

          // Update customer quota tier immediately
          await this.updateCustomerQuotaTier(customerId, quotaTier, session.subscription as string);

          logger.info('Tool call quota updated for customer', {
            operation: 'stripe_webhook_checkout_quota',
            customerId,
            quotaTier
          });
        } else {
          logger.error('Missing customerId or quotaTier in checkout session metadata', new Error('Missing required metadata'), {
            operation: 'stripe_webhook_checkout_quota',
            sessionMetadata: session.metadata
          });
        }

        return;
      }

      // Handle subscription-based upgrades FIRST (uses partner_id with underscore)
      if (session.subscription && session.metadata?.is_upgrade === 'true') {
        const upgradePartnerId = session.metadata?.partner_id;
        logger.info('Processing subscription upgrade checkout session', {
          operation: 'stripe_webhook_checkout_upgrade',
          sessionId: session.id,
          partnerId: upgradePartnerId,
          upgradeFrom: session.metadata?.upgrade_from,
          planId: session.metadata?.plan_id
        });

        await this.handleSubscriptionUpgrade(session);
        return;
      }

      // Check if this is a one-time payment (lifetime offer) - uses partnerId camelCase
      const partnerId = session.metadata?.partnerId;
      const couponId = session.metadata?.couponId;

      if (!partnerId) {
        logger.info('No partnerId in session metadata, skipping processing', {
          operation: 'stripe_webhook_checkout_completed',
          sessionId: session.id
        });
        return;
      }

      // For one-time payments, session.subscription will be null
      // This handles app-managed lifetime offers (with or without couponId)
      if (session.subscription) {
        logger.info('Session has subscription, handled by subscription webhook logic', {
          operation: 'stripe_webhook_checkout_completed',
          sessionId: session.id,
          subscriptionId: typeof session.subscription === 'string' ? session.subscription : session.subscription?.id
        });
        return;
      }

      logger.info('Processing one-time payment for partner', {
        operation: 'stripe_webhook_onetime_payment',
        partnerId,
        couponId,
        sessionId: session.id
      });

      // Check if this is a credit purchase - these are handled by their own webhook handlers
      const sessionType = session.metadata?.type;
      const isCreditPurchase = sessionType === 'credit_purchase' ||
                               sessionType === 'telephony_credit_purchase' ||
                               sessionType === 'customer_credit_purchase' ||
                               sessionType === 'ai_credits';

      if (isCreditPurchase) {
        logger.info('Credit purchase detected, skipping lifetime offer processing', {
          operation: 'stripe_webhook_checkout_completed',
          sessionType,
          sessionId: session.id,
          partnerId
        });
        return;
      }

      // This is a one-time payment - could be lifetime offer with app coupon or regular one-time payment

      // Get partner details
      const partner = await prisma.partner.findUnique({ where: { id: partnerId } });
      if (!partner) {
        logger.error('Partner not found for one-time payment', new Error('Partner not found'), {
          operation: 'stripe_webhook_onetime_payment',
          partnerId,
          sessionId: session.id
        });
        return;
      }

      // Get coupon details if couponId is provided
      let coupon = null;
      if (couponId) {
        coupon = await prisma.coupon.findUnique({ where: { id: couponId } });
        if (!coupon) {
          logger.error('Coupon not found for one-time payment', new Error('Coupon not found'), {
            operation: 'stripe_webhook_onetime_payment',
            couponId,
            partnerId,
            sessionId: session.id
          });
          return;
        }
      }

      // Get payment intent details
      let paymentIntent: Stripe.PaymentIntent | null = null;
      if (session.payment_intent) {
        paymentIntent = await stripe.paymentIntents.retrieve(session.payment_intent as string);
      }

      // Create coupon usage record only if coupon exists and not already created
      if (coupon) {
        try {
          // Check if coupon usage already exists for this partner and coupon
          const existingUsage = await prisma.couponUsage.findUnique({
            where: {
              couponId_partnerId: {
                couponId: coupon.id,
                partnerId: partner.id
              }
            }
          });

          if (!existingUsage) {
            await prisma.couponUsage.create({
              data: {
                couponId: coupon.id,
                partnerId: partner.id,
                orderAmount: Number(coupon.lifetimeOfferPrice || 0),
                discountAmount: Number(coupon.originalPrice || 0) - Number(coupon.lifetimeOfferPrice || 0),
                stripeSessionId: session.id,
                stripePaymentIntentId: paymentIntent?.id || null,
                metadata: {
                  checkoutSessionId: session.id,
                  customerEmail: session.customer_details?.email,
                  amountTotal: session.amount_total,
                  currency: session.currency,
                }
              }
            });
            logger.info('Created coupon usage record', {
              operation: 'stripe_webhook_onetime_payment',
              partnerId: partner.id,
              couponId: coupon.id,
              sessionId: session.id
            });
          } else {
            logger.info('Coupon usage already exists, skipping creation', {
              operation: 'stripe_webhook_onetime_payment',
              partnerId: partner.id,
              couponId: coupon.id,
              sessionId: session.id
            });
          }
        } catch (couponUsageError: any) {
          // If it's a unique constraint error, log and continue (webhook retry scenario)
          if (couponUsageError.code === 'P2002') {
            logger.info('Coupon usage already exists (duplicate webhook), continuing processing', {
              operation: 'stripe_webhook_onetime_payment',
              partnerId: partner.id,
              couponId: coupon.id,
              sessionId: session.id
            });
          } else {
            logger.error('Error creating coupon usage', couponUsageError as Error, {
              operation: 'stripe_webhook_onetime_payment',
              partnerId: partner.id,
              couponId: coupon.id,
              sessionId: session.id
            });
            throw couponUsageError;
          }
        }
      }

      // Activate partner account for lifetime offers
      if (coupon && coupon.type === 'lifetime_offer') {
        try {
          // Check if partner is already active to avoid duplicate processing
          if (partner.approvalStatus !== 'ACTIVE') {
            // Generate random password for the partner
            const randomPassword = generateRandomPassword();
            const hashedPassword = await hashPassword(randomPassword);

            // Update partner status to ACTIVE and set lifetime access
            await prisma.partner.update({
              where: { id: partner.id },
              data: {
                approvalStatus: 'ACTIVE',
                planId: 'lifetime',
                billingInterval: 'lifetime',
                hashedPassword: hashedPassword
              }
            });

            logger.info('Partner activated with ACTIVE status for lifetime offer', {
              operation: 'stripe_webhook_onetime_payment',
              partnerId: partner.id,
              sessionId: session.id
            });

            // Provision partner in analytics service
            const analyticsResult = await provisionPartnerInAnalytics({
              id: partner.id,
              businessName: partner.businessName,
              contactName: partner.contactName || partner.businessName,
              emailAddress: partner.emailAddress,
            });

            if (!analyticsResult) {
              logger.warn('Partner provisioning in analytics service failed, but continuing with onboarding', {
                operation: 'stripe_webhook_onetime_payment',
                partnerId: partner.id,
                sessionId: session.id
              });
            } else {
              logger.info('Successfully provisioned partner in analytics service', {
                operation: 'stripe_webhook_onetime_payment',
                partnerId: partner.id,
                sessionId: session.id
              });
            }

            // Send welcome email with password
            await sendPartnerWelcomeEmail({
              to: partner.emailAddress,
              businessName: partner.businessName,
              password: randomPassword,
            });

            logger.info('Welcome email with credentials sent', {
              operation: 'stripe_webhook_onetime_payment',
              partnerId: partner.id,
              emailAddress: partner.emailAddress,
              sessionId: session.id
            });
          } else {
            logger.info('Partner is already ACTIVE, skipping activation', {
              operation: 'stripe_webhook_onetime_payment',
              partnerId: partner.id,
              sessionId: session.id
            });
          }
        } catch (activationError) {
          logger.error('Error activating partner for lifetime offer', activationError as Error, {
            operation: 'stripe_webhook_onetime_payment',
            partnerId: partner.id,
            sessionId: session.id
          });
          // Don't throw error - activation failure shouldn't fail the webhook
        }
      }

      // Create receipt record and send emails
      if (session.customer_details?.email) {
        const receiptNumber = `RCP-${Date.now()}-${partner.id.slice(-6).toUpperCase()}`;
        const amount = (session.amount_total || 0) / 100; // Convert from cents

        // Check if receipt already exists for this session to prevent duplicates
        const existingReceipt = await prisma.receipt.findFirst({
          where: { stripeSessionId: session.id }
        });

        if (existingReceipt) {
          logger.info('Receipt already exists for session', {
            operation: 'stripe_webhook_onetime_payment',
            sessionId: session.id
          });
          return;
        }

        // Create receipt record in database
        const receipt = await prisma.receipt.create({
          data: {
            receiptNumber,
            amount,
            currency: session.currency || 'usd',
            customerName: partner.businessName,
            customerEmail: session.customer_details.email,
            businessName: partner.businessName,
            partnerId: partner.id,
            couponId: coupon?.id || null,
            stripeSessionId: session.id,
            stripePaymentIntentId: paymentIntent?.id || null,
            emailSent: false,
            metadata: {
              checkoutSessionId: session.id,
              customerEmail: session.customer_details?.email || null,
              customerName: session.customer_details?.name || null,
              amountTotal: session.amount_total,
              currency: session.currency,
            }
          }
        });

        // Send receipt email only if coupon exists (since receipt template expects coupon data)
        let emailSent = false;
        if (coupon) {
          const receiptData = {
            customerName: partner.businessName,
            customerEmail: session.customer_details.email,
            businessName: partner.businessName,
            amount,
            couponCode: coupon.code,
            couponName: coupon.name,
            transactionId: paymentIntent?.id || session.id,
            date: new Date().toLocaleDateString('en-US', {
              year: 'numeric',
              month: 'long',
              day: 'numeric',
              hour: '2-digit',
              minute: '2-digit'
            }),
            invoiceUrl: session.invoice ? await this.getInvoiceUrl(session.invoice as string) : undefined,
          };

          // Send receipt email
          emailSent = await emailService.sendReceiptEmail(receiptData);
        } else {
          logger.info('No coupon found, skipping receipt email (receipt template requires coupon data)', {
            operation: 'stripe_webhook_onetime_payment',
            sessionId: session.id
          });
        }

        // Update receipt record with email status
        if (emailSent) {
          await prisma.receipt.update({
            where: { id: receipt.id },
            data: {
              emailSent: true,
              emailSentAt: new Date(),
            }
          });
        }

        // Only send welcome email for lifetime offers
        // Credit purchases are already filtered out by the early return above
        // Lifetime offers have a coupon with type 'lifetime_offer'
        if (coupon && coupon.type === 'lifetime_offer') {
          try {
            await emailService.sendWelcomeEmail({
              customerEmail: session.customer_details.email,
              businessName: partner.businessName,
              loginUrl: `${process.env.NEXT_PUBLIC_APP_URL || process.env.NEXTAUTH_URL || 'https://knotie-ai.pro'}/partner/login`,
            });
            logger.info('Welcome email sent for lifetime offer payment', {
              operation: 'stripe_webhook_onetime_payment',
              email: session.customer_details?.email,
              sessionId: session.id,
              couponType: coupon.type
            });
          } catch (emailError) {
            logger.error('Failed to send welcome email for lifetime offer payment', emailError as Error, {
              operation: 'stripe_webhook_onetime_payment',
              email: session.customer_details?.email,
              sessionId: session.id
            });
            // Don't throw error - email failure shouldn't fail the webhook
          }
        }
      }

      logger.info('One-time payment checkout session processed successfully', {
        operation: 'stripe_webhook_onetime_payment',
        sessionId: session.id
      });
    } catch (error) {
      logger.error('Error processing one-time payment checkout session', error as Error, {
        operation: 'stripe_webhook_onetime_payment',
        sessionId: session.id
      });
      throw error;
    }
  }

  /**
   * Handle payment_intent.succeeded event
   */
  private static async handlePaymentIntentSucceeded(event: StripeWebhookEvent): Promise<void> {
    const paymentIntent = event.data.object;
    logger.info('Payment intent succeeded', {
      operation: 'stripe_webhook_payment_intent',
      paymentIntentId: paymentIntent.id
    });

    await StripePaymentService.updatePaymentFromStripe(paymentIntent);

    // TODO: Send confirmation email to customer
    // TODO: Notify partner of successful payment
  }

  /**
   * Handle payment_intent.payment_failed event
   */
  private static async handlePaymentIntentFailed(event: StripeWebhookEvent): Promise<void> {
    const paymentIntent = event.data.object;
    logger.info('Payment intent failed', {
      operation: 'stripe_webhook_payment_intent',
      paymentIntentId: paymentIntent.id
    });

    await StripePaymentService.updatePaymentFromStripe(paymentIntent);

    // TODO: Send failure notification to customer
    // TODO: Log failure for analytics
  }

  /**
   * Handle payment_intent.canceled event
   */
  private static async handlePaymentIntentCanceled(event: StripeWebhookEvent): Promise<void> {
    const paymentIntent = event.data.object;
    logger.info('Payment intent canceled', {
      operation: 'stripe_webhook_payment_intent',
      paymentIntentId: paymentIntent.id
    });

    await StripePaymentService.updatePaymentFromStripe(paymentIntent);
  }

  /**
   * Handle charge.succeeded event
   */
  private static async handleChargeSucceeded(event: StripeWebhookEvent, connectedAccountId?: string | null): Promise<void> {
    const charge = event.data.object;
    logger.info('Charge succeeded', {
      operation: 'stripe_webhook_charge',
      chargeId: charge.id,
      connectedAccountId
    });

    // Update payment record with charge ID
    if (charge.payment_intent) {
      try {
        // Retrieve payment intent with connected account context if available
        const retrieveOptions = connectedAccountId ? { stripeAccount: connectedAccountId } : {};
        const paymentIntent = await stripe.paymentIntents.retrieve(charge.payment_intent, retrieveOptions);
        await StripePaymentService.updatePaymentFromStripe(paymentIntent);
      } catch (error) {
        logger.error('Error retrieving payment intent', error as Error, {
          operation: 'stripe_webhook_charge',
          chargeId: charge.id,
          paymentIntentId: charge.payment_intent
        });
        // Don't throw - this is a webhook handler and we don't want to cause retries for this specific error
      }
    }
  }

  /**
   * Handle charge.failed event
   */
  private static async handleChargeFailed(event: StripeWebhookEvent, connectedAccountId?: string | null): Promise<void> {
    const charge = event.data.object;
    logger.info('Charge failed', {
      operation: 'stripe_webhook_charge',
      chargeId: charge.id,
      connectedAccountId
    });

    // Update payment record
    if (charge.payment_intent) {
      try {
        // Retrieve payment intent with connected account context if available
        const retrieveOptions = connectedAccountId ? { stripeAccount: connectedAccountId } : {};
        const paymentIntent = await stripe.paymentIntents.retrieve(charge.payment_intent, retrieveOptions);
        await StripePaymentService.updatePaymentFromStripe(paymentIntent);
      } catch (error) {
        logger.error('Error retrieving payment intent', error as Error, {
          operation: 'stripe_webhook_charge',
          chargeId: charge.id,
          paymentIntentId: charge.payment_intent
        });
        // Don't throw - this is a webhook handler and we don't want to cause retries for this specific error
      }
    }
  }

  /**
   * Handle charge.dispute.created event
   */
  private static async handleChargeDisputeCreated(event: StripeWebhookEvent): Promise<void> {
    const dispute = event.data.object;
    logger.info('Charge dispute created', {
      operation: 'stripe_webhook_dispute',
      disputeId: dispute.id,
      chargeId: dispute.charge
    });

    // TODO: Notify partner of dispute
    // TODO: Create dispute record in database
    // TODO: Send dispute handling instructions
  }

  /**
   * Handle application_fee.created event
   */
  private static async handleApplicationFeeCreated(event: StripeWebhookEvent): Promise<void> {
    const applicationFee = event.data.object;
    logger.info('Application fee created', {
      operation: 'stripe_webhook_application_fee',
      applicationFeeId: applicationFee.id
    });

    // TODO: Record application fee for revenue tracking
    // TODO: Update partner revenue analytics
  }

  /**
   * Handle application_fee.refunded event
   */
  private static async handleApplicationFeeRefunded(event: StripeWebhookEvent): Promise<void> {
    const applicationFee = event.data.object;
    logger.info('Application fee refunded', {
      operation: 'stripe_webhook_application_fee',
      applicationFeeId: applicationFee.id
    });

    // TODO: Update revenue tracking
    // TODO: Adjust partner analytics
  }

  /**
   * Handle transfer.created event
   */
  private static async handleTransferCreated(event: StripeWebhookEvent): Promise<void> {
    const transfer = event.data.object;
    logger.info('Transfer created', {
      operation: 'stripe_webhook_transfer',
      transferId: transfer.id,
      destination: transfer.destination
    });

    // TODO: Log transfer for audit purposes
    // TODO: Update partner payout tracking
  }

  /**
   * Handle transfer.failed event
   */
  private static async handleTransferFailed(event: StripeWebhookEvent): Promise<void> {
    const transfer = event.data.object;
    logger.info('Transfer failed', {
      operation: 'stripe_webhook_transfer',
      transferId: transfer.id,
      destination: transfer.destination
    });

    // TODO: Notify partner of failed transfer
    // TODO: Log failure for investigation
    // TODO: Retry transfer if appropriate
  }

  /**
   * Get webhook events for debugging
   */
  static async getWebhookEvents(
    limit: number = 10,
    type?: string
  ): Promise<StripeWebhookEvent[]> {
    try {
      const params: any = { limit };
      if (type) {
        params.type = type;
      }

      const events = await stripe.events.list(params);
      return events.data as StripeWebhookEvent[];
    } catch (error: any) {
      logger.error('Error retrieving webhook events', error as Error, {
        operation: 'stripe_webhook_retry'
      });
      throw createStripeConnectError(
        'Failed to retrieve webhook events',
        'WEBHOOK_EVENTS_FAILED',
        500
      );
    }
  }

  /**
   * Retry webhook event processing
   */
  static async retryWebhookEvent(eventId: string, connectedAccountId?: string | null): Promise<void> {
    try {
      const event = await stripe.events.retrieve(eventId);
      await this.processWebhookEvent(event as StripeWebhookEvent, connectedAccountId);
    } catch (error: any) {
      logger.error('Error retrying webhook event', error as Error, {
        operation: 'stripe_webhook_retry',
        eventId
      });
      throw createStripeConnectError(
        'Failed to retry webhook event',
        'WEBHOOK_RETRY_FAILED',
        500
      );
    }
  }

  /**
   * Get invoice PDF URL from Stripe
   */
  private static async getInvoiceUrl(invoiceId: string): Promise<string | undefined> {
    try {
      const invoice = await stripe.invoices.retrieve(invoiceId);
      return invoice.invoice_pdf || undefined;
    } catch (error) {
      logger.error('Error retrieving invoice URL', error as Error, {
        operation: 'stripe_webhook_invoice_url',
        invoiceId
      });
      return undefined;
    }
  }

  /**
   * Handle customer.subscription.created event for tool call quotas
   */
  private static async handleSubscriptionCreated(event: StripeWebhookEvent): Promise<void> {
    const subscription = event.data.object as Stripe.Subscription;
    logger.info('Subscription created', {
      operation: 'stripe_webhook_subscription',
      subscriptionId: subscription.id
    });

    // Check if this is a tool call quota subscription
    if (subscription.metadata?.type === 'tool_call_quota') {
      const { customerId, quotaTier } = subscription.metadata;

      if (customerId && quotaTier) {
        await this.updateCustomerQuotaTier(customerId, quotaTier, subscription.id);
      }
    }
  }

  /**
   * Handle customer.subscription.updated event for tool call quotas
   */
  private static async handleSubscriptionUpdated(event: StripeWebhookEvent): Promise<void> {
    const subscription = event.data.object as Stripe.Subscription;
    logger.info('Subscription updated', {
      operation: 'stripe_webhook_subscription',
      subscriptionId: subscription.id
    });

    // Check if this is a tool call quota subscription
    if (subscription.metadata?.type === 'tool_call_quota') {
      const { customerId, quotaTier } = subscription.metadata;

      if (customerId && quotaTier) {
        // Handle subscription status changes
        if (subscription.status === 'active') {
          await this.updateCustomerQuotaTier(customerId, quotaTier, subscription.id);
        } else if (['canceled', 'unpaid', 'past_due'].includes(subscription.status)) {
          // Downgrade to basic tier if subscription is not active
          await this.updateCustomerQuotaTier(customerId, 'basic', null);
        }
      }
    }
  }

  /**
   * Handle customer.subscription.deleted event for tool call quotas
   */
  private static async handleSubscriptionDeleted(event: StripeWebhookEvent): Promise<void> {
    const subscription = event.data.object as Stripe.Subscription;
    logger.info('Subscription deleted', {
      operation: 'stripe_webhook_subscription',
      subscriptionId: subscription.id
    });

    // Check if this is a tool call quota subscription
    if (subscription.metadata?.type === 'tool_call_quota') {
      const { customerId } = subscription.metadata;

      if (customerId) {
        // Downgrade to basic tier when subscription is deleted
        await this.updateCustomerQuotaTier(customerId, 'basic', null);
      }
    }
  }

  /**
   * Handle invoice.payment_succeeded event for tool call quotas
   */
  private static async handleInvoicePaymentSucceeded(event: StripeWebhookEvent): Promise<void> {
    const invoice = event.data.object as Stripe.Invoice;
    logger.info('Invoice payment succeeded', {
      operation: 'stripe_webhook_invoice',
      invoiceId: invoice.id
    });

    // Check if this is for a tool call quota subscription
    if (invoice.subscription) {
      const subscription = await stripe.subscriptions.retrieve(invoice.subscription as string);

      if (subscription.metadata?.type === 'tool_call_quota') {
        const { customerId, quotaTier } = subscription.metadata;

        if (customerId && quotaTier) {
          // Ensure customer has the correct quota tier after successful payment
          await this.updateCustomerQuotaTier(customerId, quotaTier, subscription.id);
        }
      }
    }
  }

  /**
   * Handle invoice.payment_failed event for tool call quotas
   */
  private static async handleInvoicePaymentFailed(event: StripeWebhookEvent): Promise<void> {
    const invoice = event.data.object as Stripe.Invoice;
    logger.info('Invoice payment failed', {
      operation: 'stripe_webhook_invoice',
      invoiceId: invoice.id
    });

    // Check if this is for a tool call quota subscription
    if (invoice.subscription) {
      const subscription = await stripe.subscriptions.retrieve(invoice.subscription as string);

      if (subscription.metadata?.type === 'tool_call_quota') {
        const { customerId } = subscription.metadata;

        if (customerId) {
          // Optionally downgrade to basic tier after payment failure
          // You might want to implement a grace period here
          logger.info('Payment failed for tool call quota subscription', {
            operation: 'stripe_webhook_invoice_quota',
            subscriptionId: subscription.id,
            customerId
          });

          // For now, just log - you can implement grace period logic here
          // await this.updateCustomerQuotaTier(customerId, 'basic', null);
        }
      }
    }
  }

  /**
   * Update customer quota tier in database
   */
  private static async updateCustomerQuotaTier(
    customerId: string,
    tier: string,
    subscriptionId: string | null
  ): Promise<void> {
    try {
      logger.info('Updating customer quota tier', {
        operation: 'stripe_webhook_quota_update',
        customerId,
        tier,
        subscriptionId: subscriptionId || undefined
      });

      const { getQuotaTier } = await import('@/lib/toolCallQuotas');
      const quotaTier = getQuotaTier(tier);

      if (!quotaTier) {
        logger.error('Invalid quota tier', new Error('Invalid quota tier'), {
          operation: 'stripe_webhook_quota_update',
          tier,
          customerId
        });
        return;
      }

      logger.info('Quota tier details', {
        operation: 'stripe_webhook_quota_update',
        limit: quotaTier.limit,
        windowMs: quotaTier.windowMs,
        customerId
      });

      const updatedCustomer = await prisma.customer.update({
        where: { id: customerId },
        data: {
          toolCallQuotaTier: tier,
          toolCallQuotaLimit: quotaTier.limit,
          toolCallQuotaWindow: quotaTier.windowMs,
          toolCallQuotaSubscriptionId: subscriptionId,
          toolCallQuotaStripeProductId: quotaTier.stripePriceId,
          toolCallQuotaLastReset: new Date(),
          toolCallQuotaUsedInWindow: 0, // Reset usage when tier changes
        },
      });

      logger.info('Successfully updated customer quota', {
        operation: 'stripe_webhook_quota_update',
        customerId,
        tier: updatedCustomer.toolCallQuotaTier,
        limit: updatedCustomer.toolCallQuotaLimit
      });

      logger.info('Updated customer quota tier', {
        operation: 'stripe_webhook_quota_update',
        customerId,
        tier
      });

      // Reset rate limit in Connect Hub
      try {
        const connectHubUrl = process.env.CONNECT_HUB_URL;
        if (connectHubUrl) {
          await fetch(`${connectHubUrl}/api/quota/reset/${customerId}`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${process.env.CONNECT_HUB_API_KEY}`,
            },
          });
        }
      } catch (error) {
        logger.warn('Failed to reset rate limit in Connect Hub', {
          operation: 'stripe_webhook_quota_update',
          customerId,
          error: error instanceof Error ? error.message : String(error)
        });
      }
    } catch (error) {
      logger.error('Failed to update customer quota tier', error as Error, {
        operation: 'stripe_webhook_quota_update',
        customerId,
        tier
      });
      throw error;
    }
  }

  /**
   * Handle subscription upgrade from checkout session
   */
  private static async handleSubscriptionUpgrade(session: Stripe.Checkout.Session): Promise<void> {
    const partnerId = session.metadata?.partner_id;
    const planId = session.metadata?.plan_id;
    const billingInterval = session.metadata?.billing_interval;
    const upgradeFrom = session.metadata?.upgrade_from;

    if (!partnerId || !planId || !billingInterval) {
      logger.error('Missing required metadata for subscription upgrade', new Error('Missing upgrade metadata'), {
        operation: 'stripe_webhook_upgrade',
        sessionId: session.id,
        metadata: session.metadata
      });
      return;
    }

    try {
      // Update partner subscription details
      const subscriptionId = typeof session.subscription === 'string'
        ? session.subscription
        : session.subscription?.id;

      await prisma.partner.update({
        where: { id: partnerId },
        data: {
          subscriptionStatus: 'ACTIVE',
          marketingTier: planId,
          planId: planId,
          billingInterval: billingInterval,
          stripeSubscriptionId: subscriptionId,
          upgradeIntentPlanId: null, // Clear upgrade intent
          upgradeIntentBillingInterval: null,
          upgradeIntentCreatedAt: null,
        },
      });

      logger.info('Partner subscription upgraded successfully', {
        operation: 'stripe_webhook_upgrade',
        partnerId,
        planId,
        upgradeFrom,
        subscriptionId
      });

      // Allocate credits for the new plan immediately
      try {
        const oldPlanName = upgradeFrom || 'free_forever';
        await SubscriptionCreditService.handleSubscriptionPlanChange(
          partnerId,
          oldPlanName,
          planId
        );
        logger.info('Credits allocated for subscription upgrade', {
          operation: 'stripe_webhook_upgrade_credits',
          partnerId,
          oldPlan: oldPlanName,
          newPlan: planId
        });
      } catch (creditError) {
        logger.error('Failed to allocate credits for upgrade', creditError as Error, {
          operation: 'stripe_webhook_upgrade_credits',
          partnerId,
          planId
        });
        // Don't fail the upgrade if credit allocation fails
      }

      // Handle affiliate commission for Free Forever upgrades
      if (upgradeFrom === 'free_forever') {
        try {
          // Get partner's Stripe customer ID for commission processing
          const partner = await prisma.partner.findUnique({
            where: { id: partnerId },
            select: { stripeCustomerId: true }
          });

          if (partner?.stripeCustomerId) {
            await affiliateCommissionHandler.processCommissionForPayment(
              partner.stripeCustomerId,
              session.amount_total || 0,
              subscriptionId || '',
              planId
            );
          }

          logger.info('Affiliate commission processed for Free Forever upgrade', {
            operation: 'stripe_webhook_upgrade_commission',
            partnerId,
            planId,
            amount: session.amount_total
          });
        } catch (commissionError) {
          logger.error('Failed to process affiliate commission for upgrade', commissionError as Error, {
            operation: 'stripe_webhook_upgrade_commission',
            partnerId,
            planId
          });
          // Don't fail the upgrade if commission processing fails
        }
      }

    } catch (error) {
      logger.error('Failed to process subscription upgrade', error as Error, {
        operation: 'stripe_webhook_upgrade',
        partnerId,
        planId,
        sessionId: session.id
      });
      throw error;
    }
  }
}
