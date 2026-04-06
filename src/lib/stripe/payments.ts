// Stripe Connect payment processing service

import Stripe from 'stripe';
import { prisma } from '@/lib/prisma';
import {
  StripePaymentIntent,
  CreatePaymentIntentRequest,
  CreatePaymentIntentResponse,
  PaymentHistoryItem,
} from './types';
import {
  createStripeConnectError,
  calculateApplicationFee,
  validatePaymentAmount,
  sanitizeMetadata,
  generateIdempotencyKey,
  getStripeErrorMessage,
  isValidPaymentIntentId,
} from './utils';
import { logger } from '@/lib/logger';

// Initialize Stripe with secret key
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2023-10-16',
});

export class StripePaymentService {
  /**
   * Create a payment intent for a customer payment to a partner
   */
  static async createPaymentIntent(
    request: CreatePaymentIntentRequest
  ): Promise<CreatePaymentIntentResponse> {
    try {
      // Validate payment amount
      const amountValidation = validatePaymentAmount(request.amount, request.currency);
      if (!amountValidation.isValid) {
        throw createStripeConnectError(
          amountValidation.error!,
          'INVALID_AMOUNT',
          400
        );
      }

      // Get partner's Stripe account information
      const partner = await prisma.partner.findUnique({
        where: { id: request.partnerId },
        select: {
          stripeAccountId: true,
          stripeChargesEnabled: true,
          applicationFeePercent: true,
          businessName: true,
        },
      });

      if (!partner) {
        throw createStripeConnectError(
          'Partner not found',
          'PARTNER_NOT_FOUND',
          404
        );
      }

      if (!partner.stripeAccountId) {
        throw createStripeConnectError(
          'Partner has not connected their Stripe account',
          'NO_STRIPE_ACCOUNT',
          400
        );
      }

      if (!partner.stripeChargesEnabled) {
        throw createStripeConnectError(
          'Partner cannot accept charges yet',
          'CHARGES_NOT_ENABLED',
          400
        );
      }

      // Calculate application fee
      const applicationFeeAmount = calculateApplicationFee(
        request.amount,
        Number(partner.applicationFeePercent)
      );

      // Prepare metadata
      const metadata = sanitizeMetadata({
        partner_id: request.partnerId,
        customer_id: request.customerId,
        platform: 'knotie-ai-pro',
        ...request.metadata,
      });

      // Create payment intent with direct charge
      const paymentIntent = await stripe.paymentIntents.create({
        amount: request.amount,
        currency: request.currency || 'usd',
        application_fee_amount: applicationFeeAmount,
        description: request.description || `Payment to ${partner.businessName}`,
        receipt_email: request.customerEmail,
        metadata,
        on_behalf_of: partner.stripeAccountId,
        transfer_data: {
          destination: partner.stripeAccountId,
        },
      }, {
        idempotencyKey: generateIdempotencyKey('payment'),
      });

      // Store payment record in database
      await prisma.customerPayment.create({
        data: {
          customerId: request.customerId || 'guest',
          partnerId: request.partnerId,
          stripePaymentIntentId: paymentIntent.id,
          amountTotal: request.amount,
          amountApplicationFee: applicationFeeAmount,
          currency: request.currency || 'usd',
          status: paymentIntent.status,
          description: request.description,
          customerEmail: request.customerEmail,
          metadata: metadata,
        },
      });

      return {
        paymentIntentId: paymentIntent.id,
        clientSecret: paymentIntent.client_secret!,
        amount: request.amount,
        applicationFeeAmount,
        currency: request.currency || 'usd',
        status: paymentIntent.status,
      };
    } catch (error: any) {
      logger.error('Error creating payment intent', error as Error, {
        operation: 'stripe_payments',
        partnerId: request.partnerId,
        customerId: request.customerId,
        amount: request.amount
      });

      if (error.type === 'StripeConnectError') {
        throw error;
      }

      throw createStripeConnectError(
        getStripeErrorMessage(error),
        'PAYMENT_INTENT_CREATION_FAILED',
        500,
        error.code
      );
    }
  }

  /**
   * Confirm a payment intent
   */
  static async confirmPaymentIntent(
    paymentIntentId: string,
    paymentMethodId?: string
  ): Promise<StripePaymentIntent> {
    try {
      if (!isValidPaymentIntentId(paymentIntentId)) {
        throw createStripeConnectError(
          'Invalid payment intent ID',
          'INVALID_PAYMENT_INTENT_ID',
          400
        );
      }

      const confirmParams: any = {};
      if (paymentMethodId) {
        confirmParams.payment_method = paymentMethodId;
      }

      const paymentIntent = await stripe.paymentIntents.confirm(
        paymentIntentId,
        confirmParams
      );

      // Update payment record in database
      await this.updatePaymentFromStripe(paymentIntent);

      return paymentIntent as unknown as StripePaymentIntent;
    } catch (error: any) {
      logger.error('Error confirming payment intent', error as Error, {
        operation: 'stripe_payments',
        paymentIntentId
      });

      throw createStripeConnectError(
        getStripeErrorMessage(error),
        'PAYMENT_CONFIRMATION_FAILED',
        500,
        error.code
      );
    }
  }

  /**
   * Get payment intent details
   */
  static async getPaymentIntent(paymentIntentId: string): Promise<StripePaymentIntent> {
    try {
      if (!isValidPaymentIntentId(paymentIntentId)) {
        throw createStripeConnectError(
          'Invalid payment intent ID',
          'INVALID_PAYMENT_INTENT_ID',
          400
        );
      }

      const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
      return paymentIntent as unknown as StripePaymentIntent;
    } catch (error: any) {
      logger.error('Error retrieving payment intent', error as Error, {
        operation: 'stripe_payments',
        paymentIntentId
      });

      throw createStripeConnectError(
        getStripeErrorMessage(error),
        'PAYMENT_RETRIEVAL_FAILED',
        500,
        error.code
      );
    }
  }

  /**
   * Get payment history for a partner
   */
  static async getPartnerPaymentHistory(
    partnerId: string,
    limit: number = 50,
    offset: number = 0
  ): Promise<{
    payments: PaymentHistoryItem[];
    total: number;
    hasMore: boolean;
  }> {
    try {
      const [payments, total] = await Promise.all([
        prisma.customerPayment.findMany({
          where: { partnerId },
          orderBy: { createdAt: 'desc' },
          take: limit,
          skip: offset,
        }),
        prisma.customerPayment.count({
          where: { partnerId },
        }),
      ]);

      const paymentHistory: PaymentHistoryItem[] = payments.map(payment => ({
        id: payment.id,
        paymentIntentId: payment.stripePaymentIntentId,
        chargeId: payment.stripeChargeId || undefined,
        amount: payment.amountTotal,
        applicationFee: payment.amountApplicationFee,
        currency: payment.currency,
        status: payment.status,
        description: payment.description || undefined,
        customerEmail: payment.customerEmail || undefined,
        createdAt: payment.createdAt,
        updatedAt: payment.updatedAt,
      }));

      return {
        payments: paymentHistory,
        total,
        hasMore: offset + limit < total,
      };
    } catch (error: any) {
      logger.error('Error getting payment history', error as Error, {
        operation: 'stripe_payments',
        partnerId
      });

      throw createStripeConnectError(
        'Failed to retrieve payment history',
        'PAYMENT_HISTORY_FAILED',
        500
      );
    }
  }

  /**
   * Get payment history for a customer
   */
  static async getCustomerPaymentHistory(
    customerId: string,
    limit: number = 50,
    offset: number = 0
  ): Promise<{
    payments: PaymentHistoryItem[];
    total: number;
    hasMore: boolean;
  }> {
    try {
      const [payments, total] = await Promise.all([
        prisma.customerPayment.findMany({
          where: { customerId },
          orderBy: { createdAt: 'desc' },
          take: limit,
          skip: offset,
        }),
        prisma.customerPayment.count({
          where: { customerId },
        }),
      ]);

      const paymentHistory: PaymentHistoryItem[] = payments.map(payment => ({
        id: payment.id,
        paymentIntentId: payment.stripePaymentIntentId,
        chargeId: payment.stripeChargeId || undefined,
        amount: payment.amountTotal,
        applicationFee: payment.amountApplicationFee,
        currency: payment.currency,
        status: payment.status,
        description: payment.description || undefined,
        customerEmail: payment.customerEmail || undefined,
        createdAt: payment.createdAt,
        updatedAt: payment.updatedAt,
      }));

      return {
        payments: paymentHistory,
        total,
        hasMore: offset + limit < total,
      };
    } catch (error: any) {
      logger.error('Error getting customer payment history', error as Error, {
        operation: 'stripe_payments',
        customerId,
        limit,
        offset
      });

      throw createStripeConnectError(
        'Failed to retrieve payment history',
        'PAYMENT_HISTORY_FAILED',
        500
      );
    }
  }

  /**
   * Update payment record from Stripe webhook data
   */
  static async updatePaymentFromStripe(paymentIntent: any): Promise<void> {
    try {
      const chargeId = paymentIntent.charges?.data?.[0]?.id || null;

      await prisma.customerPayment.updateMany({
        where: { stripePaymentIntentId: paymentIntent.id },
        data: {
          status: paymentIntent.status,
          stripeChargeId: chargeId,
          updatedAt: new Date(),
        },
      });
    } catch (error: any) {
      logger.error('Error updating payment from Stripe', error as Error, {
        operation: 'stripe_payments',
        paymentIntentId: paymentIntent.id
      });
      // Don't throw here as this is called from webhooks
    }
  }

  /**
   * Process refund for a payment
   */
  static async refundPayment(
    paymentIntentId: string,
    amount?: number,
    reason?: string
  ): Promise<any> {
    try {
      if (!isValidPaymentIntentId(paymentIntentId)) {
        throw createStripeConnectError(
          'Invalid payment intent ID',
          'INVALID_PAYMENT_INTENT_ID',
          400
        );
      }

      // Get the payment record
      const payment = await prisma.customerPayment.findFirst({
        where: { stripePaymentIntentId: paymentIntentId },
      });

      if (!payment) {
        throw createStripeConnectError(
          'Payment not found',
          'PAYMENT_NOT_FOUND',
          404
        );
      }

      if (!payment.stripeChargeId) {
        throw createStripeConnectError(
          'Payment has no charge to refund',
          'NO_CHARGE_TO_REFUND',
          400
        );
      }

      // Create refund
      const refund = await stripe.refunds.create({
        charge: payment.stripeChargeId,
        amount: amount || payment.amountTotal,
        reason: reason as any || 'requested_by_customer',
        metadata: {
          payment_id: payment.id,
          partner_id: payment.partnerId,
        },
      });

      return refund;
    } catch (error: any) {
      logger.error('Error processing refund', error as Error, {
        operation: 'stripe_payments',
        paymentIntentId,
        amount,
        reason
      });

      if (error.type === 'StripeConnectError') {
        throw error;
      }

      throw createStripeConnectError(
        getStripeErrorMessage(error),
        'REFUND_FAILED',
        500,
        error.code
      );
    }
  }
}
