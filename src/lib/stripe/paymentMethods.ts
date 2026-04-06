import Stripe from 'stripe';
import { prisma } from '@/lib/prisma';
import {
  createStripeConnectError,
  getStripeErrorMessage,
  sanitizeMetadata,
} from './utils';
import { logger } from '@/lib/logger';

// Initialize Stripe with secret key
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2023-10-16',
});

export interface PaymentMethodData {
  id: string;
  customerId: string;
  partnerId: string;
  stripePaymentMethodId: string;
  type: 'card' | 'bank_account';
  lastFour?: string;
  brand?: string;
  expMonth?: number;
  expYear?: number;
  bankName?: string;
  accountType?: string;
  isDefault: boolean;
  isActive: boolean;
  billingAddress?: any;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateSetupIntentRequest {
  customerId: string;
  partnerId: string;
  returnUrl: string;
  metadata?: Record<string, any>;
}

export interface CreateSetupIntentResponse {
  setupIntentId: string;
  clientSecret?: string;
  sessionId?: string;
  status: string;
  stripeAccountId?: string;
}

export interface SavePaymentMethodRequest {
  customerId: string;
  partnerId: string;
  stripePaymentMethodId: string;
  setAsDefault?: boolean;
  billingAddress?: any;
  metadata?: Record<string, any>;
}

export class PaymentMethodService {
  /**
   * Create a Setup Intent for collecting payment method
   */
  static async createSetupIntent(
    request: CreateSetupIntentRequest
  ): Promise<CreateSetupIntentResponse> {
    try {
      // Get customer and partner details
      const [customer, partner] = await Promise.all([
        prisma.customer.findUnique({ where: { id: request.customerId } }),
        prisma.partner.findUnique({ 
          where: { id: request.partnerId },
          select: { stripeAccountId: true, businessName: true }
        }),
      ]);

      if (!customer || !partner) {
        throw createStripeConnectError(
          'Customer or partner not found',
          'CUSTOMER_OR_PARTNER_NOT_FOUND',
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

      // Get or create Stripe customer
      let stripeCustomerId = customer.stripeCustomerId;
      if (!stripeCustomerId) {
        const stripeCustomer = await stripe.customers.create({
          email: customer.email,
          name: `${customer.firstName} ${customer.lastName}`.trim(),
          metadata: sanitizeMetadata({
            customer_id: customer.id,
            partner_id: request.partnerId,
            platform: 'knotie-ai-pro',
            ...request.metadata,
          }),
        }, {
          stripeAccount: partner.stripeAccountId,
        });

        stripeCustomerId = stripeCustomer.id;

        // Update customer with Stripe customer ID
        await prisma.customer.update({
          where: { id: request.customerId },
          data: { stripeCustomerId: stripeCustomerId },
        });
      }

      // Create Checkout Session for hosted payment method collection
      const checkoutSession = await stripe.checkout.sessions.create({
        customer: stripeCustomerId,
        mode: 'setup',
        payment_method_types: ['card'],
        success_url: request.returnUrl,
        cancel_url: request.returnUrl,
        metadata: sanitizeMetadata({
          customer_id: request.customerId,
          partner_id: request.partnerId,
          platform: 'knotie-ai-pro',
          type: 'payment_method_setup',
          ...request.metadata,
        }),
      }, {
        stripeAccount: partner.stripeAccountId,
      });

      return {
        setupIntentId: checkoutSession.id,
        sessionId: checkoutSession.id,
        status: 'requires_action',
        stripeAccountId: partner.stripeAccountId,
      };
    } catch (error: any) {
      logger.error('Error creating setup intent', error as Error, {
        operation: 'stripe_payment_methods',
        customerId: request.customerId,
        partnerId: request.partnerId
      });
      
      if (error.type === 'StripeConnectError') {
        throw error;
      }

      throw createStripeConnectError(
        getStripeErrorMessage(error),
        'SETUP_INTENT_CREATION_FAILED',
        500,
        error.code
      );
    }
  }

  /**
   * Save a payment method after successful Setup Intent
   */
  static async savePaymentMethod(
    request: SavePaymentMethodRequest
  ): Promise<PaymentMethodData> {
    try {
      // Get partner's Stripe account
      const partner = await prisma.partner.findUnique({
        where: { id: request.partnerId },
        select: { stripeAccountId: true },
      });

      if (!partner?.stripeAccountId) {
        throw createStripeConnectError(
          'Partner Stripe account not found',
          'NO_STRIPE_ACCOUNT',
          400
        );
      }

      // Retrieve payment method from Stripe
      const stripePaymentMethod = await stripe.paymentMethods.retrieve(
        request.stripePaymentMethodId,
        { stripeAccount: partner.stripeAccountId }
      );

      // Extract payment method details
      const paymentMethodData: any = {
        customerId: request.customerId,
        partnerId: request.partnerId,
        stripePaymentMethodId: request.stripePaymentMethodId,
        type: stripePaymentMethod.type,
        isDefault: request.setAsDefault || false,
        isActive: true,
        billingAddress: request.billingAddress || {},
        metadata: request.metadata || {},
      };

      // Add type-specific fields
      if (stripePaymentMethod.type === 'card' && stripePaymentMethod.card) {
        paymentMethodData.lastFour = stripePaymentMethod.card.last4;
        paymentMethodData.brand = stripePaymentMethod.card.brand;
        paymentMethodData.expMonth = stripePaymentMethod.card.exp_month;
        paymentMethodData.expYear = stripePaymentMethod.card.exp_year;
      } else if (stripePaymentMethod.type === 'us_bank_account' && stripePaymentMethod.us_bank_account) {
        paymentMethodData.lastFour = stripePaymentMethod.us_bank_account.last4;
        paymentMethodData.bankName = stripePaymentMethod.us_bank_account.bank_name;
        paymentMethodData.accountType = stripePaymentMethod.us_bank_account.account_type;
      }

      // If setting as default, unset other default payment methods
      if (request.setAsDefault) {
        await prisma.customerPaymentMethod.updateMany({
          where: {
            customerId: request.customerId,
            partnerId: request.partnerId,
            isDefault: true,
            isActive: true,
          },
          data: { isDefault: false },
        });
      }

      // Save payment method to database
      const savedPaymentMethod = await prisma.customerPaymentMethod.create({
        data: paymentMethodData,
      });

      return savedPaymentMethod as PaymentMethodData;
    } catch (error: any) {
      logger.error('Error saving payment method', error as Error, {
        operation: 'stripe_payment_methods',
        customerId: request.customerId,
        partnerId: request.partnerId
      });
      
      if (error.type === 'StripeConnectError') {
        throw error;
      }

      throw createStripeConnectError(
        getStripeErrorMessage(error),
        'PAYMENT_METHOD_SAVE_FAILED',
        500,
        error.code
      );
    }
  }

  /**
   * Get customer's payment methods
   */
  static async getCustomerPaymentMethods(
    customerId: string,
    partnerId: string
  ): Promise<PaymentMethodData[]> {
    try {
      // First try to get payment methods directly from Stripe
      try {
        // Get customer and partner info
        const customer = await prisma.customer.findUnique({
          where: { id: customerId },
          select: { stripeCustomerId: true },
        });

        const partner = await prisma.partner.findUnique({
          where: { id: partnerId },
          select: { stripeAccountId: true },
        });

        if (customer?.stripeCustomerId && partner?.stripeAccountId) {
          // Get payment methods from Stripe
          const stripePaymentMethods = await stripe.paymentMethods.list({
            customer: customer.stripeCustomerId,
            type: 'card',
          }, {
            stripeAccount: partner.stripeAccountId,
          });

          // Convert Stripe payment methods to our format
          const paymentMethods: PaymentMethodData[] = stripePaymentMethods.data.map((pm, index) => ({
            id: pm.id,
            customerId,
            partnerId,
            stripePaymentMethodId: pm.id,
            type: pm.type as 'card' | 'bank_account',
            lastFour: pm.card?.last4 || undefined,
            brand: pm.card?.brand || undefined,
            expMonth: pm.card?.exp_month || undefined,
            expYear: pm.card?.exp_year || undefined,
            isDefault: index === 0, // First payment method is considered default
            isActive: true,
            billingAddress: pm.billing_details?.address ? {
              line1: pm.billing_details.address.line1 || undefined,
              line2: pm.billing_details.address.line2 || undefined,
              city: pm.billing_details.address.city || undefined,
              state: pm.billing_details.address.state || undefined,
              postalCode: pm.billing_details.address.postal_code || undefined,
              country: pm.billing_details.address.country || undefined,
            } : undefined,
            createdAt: new Date(),
            updatedAt: new Date(),
          }));

          return paymentMethods;
        }
      } catch (stripeError) {
        logger.error('Error fetching payment methods from Stripe', stripeError as Error, {
          operation: 'stripe_payment_methods',
          customerId,
          partnerId
        });
        // Fall through to database fallback
      }

      // Fallback to database if Stripe fails or data not available
      const paymentMethods = await prisma.customerPaymentMethod.findMany({
        where: {
          customerId,
          partnerId,
          isActive: true,
        },
        orderBy: [
          { isDefault: 'desc' },
          { createdAt: 'desc' },
        ],
      });

      return paymentMethods as PaymentMethodData[];
    } catch (error: any) {
      logger.error('Error fetching payment methods', error as Error, {
        operation: 'stripe_payment_methods',
        customerId,
        partnerId
      });
      throw createStripeConnectError(
        'Failed to fetch payment methods',
        'PAYMENT_METHODS_FETCH_FAILED',
        500
      );
    }
  }

  /**
   * Set payment method as default
   */
  static async setDefaultPaymentMethod(
    paymentMethodId: string,
    customerId: string,
    partnerId: string
  ): Promise<void> {
    try {
      // Verify payment method belongs to customer
      const paymentMethod = await prisma.customerPaymentMethod.findFirst({
        where: {
          id: paymentMethodId,
          customerId,
          partnerId,
          isActive: true,
        },
      });

      if (!paymentMethod) {
        throw createStripeConnectError(
          'Payment method not found',
          'PAYMENT_METHOD_NOT_FOUND',
          404
        );
      }

      // Unset other default payment methods
      await prisma.customerPaymentMethod.updateMany({
        where: {
          customerId,
          partnerId,
          isDefault: true,
          isActive: true,
        },
        data: { isDefault: false },
      });

      // Set new default
      await prisma.customerPaymentMethod.update({
        where: { id: paymentMethodId },
        data: { isDefault: true },
      });
    } catch (error: any) {
      logger.error('Error setting default payment method', error as Error, {
        operation: 'stripe_payment_methods',
        paymentMethodId,
        customerId,
        partnerId
      });
      
      if (error.type === 'StripeConnectError') {
        throw error;
      }

      throw createStripeConnectError(
        'Failed to set default payment method',
        'SET_DEFAULT_FAILED',
        500
      );
    }
  }

  /**
   * Delete payment method
   */
  static async deletePaymentMethod(
    paymentMethodId: string,
    customerId: string,
    partnerId: string
  ): Promise<void> {
    try {
      // Verify payment method belongs to customer
      const paymentMethod = await prisma.customerPaymentMethod.findFirst({
        where: {
          id: paymentMethodId,
          customerId,
          partnerId,
          isActive: true,
        },
      });

      if (!paymentMethod) {
        throw createStripeConnectError(
          'Payment method not found',
          'PAYMENT_METHOD_NOT_FOUND',
          404
        );
      }

      // Get partner's Stripe account
      const partner = await prisma.partner.findUnique({
        where: { id: partnerId },
        select: { stripeAccountId: true },
      });

      if (partner?.stripeAccountId) {
        // Detach payment method from Stripe
        try {
          await stripe.paymentMethods.detach(
            paymentMethod.stripePaymentMethodId,
            { stripeAccount: partner.stripeAccountId }
          );
        } catch (stripeError: any) {
          // Log error but don't fail the operation
          logger.warn('Failed to detach payment method from Stripe', {
            operation: 'stripe_payment_methods',
            paymentMethodId,
            stripeError: stripeError.message
          });
        }
      }

      // Mark as inactive in database
      await prisma.customerPaymentMethod.update({
        where: { id: paymentMethodId },
        data: { isActive: false, isDefault: false },
      });
    } catch (error: any) {
      logger.error('Error deleting payment method', error as Error, {
        operation: 'stripe_payment_methods',
        paymentMethodId,
        customerId,
        partnerId
      });
      
      if (error.type === 'StripeConnectError') {
        throw error;
      }

      throw createStripeConnectError(
        'Failed to delete payment method',
        'PAYMENT_METHOD_DELETE_FAILED',
        500
      );
    }
  }
}
