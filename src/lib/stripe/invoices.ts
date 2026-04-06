import Stripe from 'stripe';
import { prisma } from '@/lib/prisma';
import {
  createStripeConnectError,
  calculateApplicationFee,
  validatePaymentAmount,
  sanitizeMetadata,
  generateIdempotencyKey,
  getStripeErrorMessage,
} from './utils';
import { invoiceEmailService } from '@/lib/email/invoiceEmailService';
import { logger } from '@/lib/logger';

// Initialize Stripe with secret key
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2023-10-16',
});

// Types for invoice operations
export interface CreateInvoiceRequest {
  partnerId: string;
  customerId: string;
  title: string;
  description?: string;
  amount: number; // in cents
  currency?: string;
  dueDate?: Date;
  type: 'one_time' | 'recurring';
  recurringInterval?: 'weekly' | 'monthly' | 'yearly';
  recurringCount?: number; // null for infinite
  autoChargeEnabled?: boolean;
  paymentMethodId?: string;
  metadata?: Record<string, any>;
}

export interface UpdateInvoiceRequest {
  title?: string;
  description?: string;
  amount?: number;
  dueDate?: Date;
  status?: 'draft' | 'sent' | 'paid' | 'overdue' | 'cancelled';
  metadata?: Record<string, any>;
}

export interface InvoiceWithDetails {
  id: string;
  invoiceNumber: string;
  title: string;
  description?: string;
  amount: number;
  currency: string;
  status: string;
  type: string;
  recurringInterval?: string;
  recurringCount?: number;
  nextPaymentDate?: Date;
  stripePaymentIntentId?: string;
  stripeInvoiceId?: string;
  hostedInvoiceUrl?: string;
  dueDate?: Date;
  paidAt?: Date;
  createdAt: Date;
  updatedAt: Date;
  partnerId: string;
  customerId: string;
  partner: {
    id: string;
    businessName: string;
    emailAddress: string;
    stripeAccountId?: string;
  };
  customer: {
    id: string;
    email: string;
    firstName?: string;
    lastName?: string;
  };
  payments: Array<{
    id: string;
    amount: number;
    status: string;
    paidAt?: Date;
  }>;
}

export class InvoiceService {
  /**
   * Generate a unique invoice number
   */
  private static generateInvoiceNumber(): string {
    const timestamp = Date.now().toString();
    const random = Math.random().toString(36).substring(2, 8).toUpperCase();
    return `INV-${timestamp}-${random}`;
  }

  /**
   * Create a new invoice
   */
  static async createInvoice(data: CreateInvoiceRequest): Promise<InvoiceWithDetails> {
    try {
      // Validate input data
      if (!data.partnerId || !data.customerId) {
        throw createStripeConnectError(
          'Partner ID and Customer ID are required',
          'INVALID_REQUEST',
          400
        );
      }

      if (!validatePaymentAmount(data.amount)) {
        throw createStripeConnectError(
          'Invalid payment amount',
          'INVALID_AMOUNT',
          400
        );
      }

      // Verify partner exists and has Stripe Connect enabled
      const partner = await prisma.partner.findUnique({
        where: { id: data.partnerId },
        select: {
          id: true,
          businessName: true,
          emailAddress: true,
          stripeAccountId: true,
          stripeChargesEnabled: true,
          applicationFeePercent: true,
        },
      });

      if (!partner) {
        throw createStripeConnectError(
          'Partner not found',
          'PARTNER_NOT_FOUND',
          404
        );
      }

      if (!partner.stripeAccountId || !partner.stripeChargesEnabled) {
        throw createStripeConnectError(
          'Partner must complete Stripe Connect onboarding first',
          'STRIPE_NOT_READY',
          400
        );
      }

      // Verify customer exists
      const customer = await prisma.customer.findUnique({
        where: { id: data.customerId },
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
        },
      });

      if (!customer) {
        throw createStripeConnectError(
          'Customer not found',
          'CUSTOMER_NOT_FOUND',
          404
        );
      }

      // Generate invoice number
      const invoiceNumber = this.generateInvoiceNumber();

      // Sanitize metadata
      const sanitizedMetadata = sanitizeMetadata(data.metadata || {});

      // First, create or get Stripe customer in partner's account
      let stripeCustomerId: string;

      // Check if customer already has a Stripe customer ID for this partner
      const existingCustomer = await prisma.customer.findUnique({
        where: { id: data.customerId },
        select: { stripeCustomerId: true }
      });

      if (existingCustomer?.stripeCustomerId) {
        stripeCustomerId = existingCustomer.stripeCustomerId;
      } else {
        // Create Stripe customer in partner's account
        const stripeCustomer = await stripe.customers.create({
          email: customer.email,
          name: `${customer.firstName || ''} ${customer.lastName || ''}`.trim() || undefined,
          metadata: {
            partnerId: data.partnerId,
            customerId: data.customerId,
            platform: 'knotie-ai-pro',
          },
        }, {
          stripeAccount: partner.stripeAccountId,
        });

        stripeCustomerId = stripeCustomer.id;

        // Update customer with Stripe customer ID
        await prisma.customer.update({
          where: { id: data.customerId },
          data: { stripeCustomerId: stripeCustomerId },
        });
      }

      // Create Stripe invoice in partner's account with hosted payment
      const invoiceCreateParams: any = {
        customer: stripeCustomerId,
        description: data.description || data.title,
        currency: data.currency || 'usd',
        collection_method: 'charge_automatically', // Key change for Option A
        auto_advance: true, // Auto-finalize and make payable
        automatic_tax: {
          enabled: false, // Disable automatic tax calculation
        },
        metadata: {
          partnerId: data.partnerId,
          customerId: data.customerId,
          invoiceNumber,
          type: data.type,
          platform: 'knotie-ai-pro',
          ...sanitizedMetadata,
        },
      };

      // Note: due_date cannot be set when collection_method is 'charge_automatically'
      // For hosted invoices, Stripe handles payment timing automatically

      const stripeInvoice = await stripe.invoices.create(invoiceCreateParams, {
        stripeAccount: partner.stripeAccountId,
      });

      // Add line item to the Stripe invoice
      await stripe.invoiceItems.create({
        customer: stripeCustomerId,
        invoice: stripeInvoice.id,
        amount: data.amount,
        currency: data.currency || 'usd',
        description: data.title,
      }, {
        stripeAccount: partner.stripeAccountId,
      });

      // Finalize the invoice manually to ensure we get the hosted_invoice_url
      logger.info('Initial invoice status', {
        operation: 'stripe_invoices',
        stripeInvoiceId: stripeInvoice.id,
        status: stripeInvoice.status,
        hostedInvoiceUrl: stripeInvoice.hosted_invoice_url
      });

      let finalizedInvoice = stripeInvoice;

      // If invoice is still draft, finalize it manually
      if (stripeInvoice.status === 'draft') {
        logger.info('Finalizing draft invoice', {
          operation: 'stripe_invoices',
          stripeInvoiceId: stripeInvoice.id
        });
        finalizedInvoice = await stripe.invoices.finalizeInvoice(stripeInvoice.id, {}, {
          stripeAccount: partner.stripeAccountId,
        });
        logger.info('Invoice finalized', {
          operation: 'stripe_invoices',
          stripeInvoiceId: finalizedInvoice.id,
          status: finalizedInvoice.status,
          hostedInvoiceUrl: finalizedInvoice.hosted_invoice_url
        });
      } else {
        // Retrieve the invoice to get the latest data
        finalizedInvoice = await stripe.invoices.retrieve(stripeInvoice.id, {
          stripeAccount: partner.stripeAccountId,
        });
        logger.info('Retrieved invoice', {
          operation: 'stripe_invoices',
          stripeInvoiceId: finalizedInvoice.id,
          status: finalizedInvoice.status,
          hostedInvoiceUrl: finalizedInvoice.hosted_invoice_url
        });
      }

      // ATOMIC OPERATION: Create invoice in database with error handling
      // If this fails, we need to clean up the Stripe invoice to prevent orphaned resources
      let invoice;
      try {
        invoice = await prisma.invoice.create({
        data: {
          partnerId: data.partnerId,
          customerId: data.customerId,
          invoiceNumber,
          title: data.title,
          description: data.description,
          amount: data.amount,
          currency: data.currency || 'usd',
          status: 'sent', // Invoice is automatically sent with auto_advance: true
          type: data.type,
          recurringInterval: data.recurringInterval,
          recurringCount: data.recurringCount,
          dueDate: data.dueDate,
          stripeInvoiceId: stripeInvoice.id, // Store Stripe invoice ID
          hostedInvoiceUrl: finalizedInvoice.hosted_invoice_url as string, // Store hosted payment URL
        } as any,
        include: {
          partner: {
            select: {
              id: true,
              businessName: true,
              emailAddress: true,
            },
          },
          customer: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
            },
          },
          payments: {
            select: {
              id: true,
              amount: true,
              status: true,
              paidAt: true,
            },
          },
        },
      });
      } catch (dbError) {
        logger.error('Failed to create invoice in database, cleaning up Stripe invoice', dbError as Error, {
          operation: 'stripe_invoices',
          stripeInvoiceId: finalizedInvoice.id
        });

        // CLEANUP: Delete the Stripe invoice to prevent orphaned resources
        try {
          await stripe.invoices.del(finalizedInvoice.id, {
            stripeAccount: partner.stripeAccountId,
          });
          logger.info('Cleaned up orphaned Stripe invoice', {
            operation: 'stripe_invoices',
            stripeInvoiceId: finalizedInvoice.id
          });
        } catch (cleanupError) {
          logger.error('Failed to cleanup Stripe invoice', cleanupError as Error, {
            operation: 'stripe_invoices',
            stripeInvoiceId: finalizedInvoice.id
          });
          // Log this for manual cleanup but don't throw
        }

        throw dbError;
      }

      // Update Stripe invoice metadata with the database invoice ID
      // RACE CONDITION MITIGATION: Retry metadata update to ensure webhook processing works
      let metadataUpdateSuccess = false;
      const maxRetries = 3;

      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
          await stripe.invoices.update(
            finalizedInvoice.id,
            {
              metadata: {
                ...finalizedInvoice.metadata,
                invoiceId: invoice.id, // Add the database invoice ID
              },
            },
            {
              stripeAccount: partner.stripeAccountId,
            }
          );
          logger.info('Updated Stripe invoice metadata with invoiceId', {
            operation: 'stripe_invoices',
            invoiceId: invoice.id,
            stripeInvoiceId: finalizedInvoice.id,
            attempt
          });
          metadataUpdateSuccess = true;
          break;
        } catch (error) {
          logger.error('Failed to update Stripe invoice metadata', error as Error, {
            operation: 'stripe_invoices',
            stripeInvoiceId: finalizedInvoice.id,
            attempt,
            maxRetries
          });
          if (attempt === maxRetries) {
            // Log critical error for monitoring - webhook processing may fail
            logger.error('CRITICAL: Stripe invoice created without metadata. Webhook processing may fail', new Error('Metadata update failed'), {
              operation: 'stripe_invoices',
              stripeInvoiceId: finalizedInvoice.id,
              severity: 'CRITICAL'
            });
          } else {
            // Wait before retry
            await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
          }
        }
      }

      // Store metadata update status for monitoring
      if (!metadataUpdateSuccess) {
        // Could add to a monitoring/alert system here
        logger.warn('Invoice created successfully but Stripe metadata update failed', {
          operation: 'stripe_invoices',
          invoiceId: invoice.id,
          stripeInvoiceId: finalizedInvoice.id,
          maxRetries
        });
      }

      // Send our branded email notification (instead of relying on Stripe's automatic emails)
      try {
        const emailSent = await invoiceEmailService.sendInvoiceNotification(invoice.id);
        if (emailSent) {
          logger.info('Branded invoice notification sent', {
            operation: 'stripe_invoices',
            invoiceNumber: invoice.invoiceNumber,
            invoiceId: invoice.id
          });
        } else {
          logger.warn('Failed to send branded invoice notification', {
            operation: 'stripe_invoices',
            invoiceNumber: invoice.invoiceNumber,
            invoiceId: invoice.id
          });
        }
      } catch (error) {
        logger.error('Error sending branded invoice notification', error as Error, {
          operation: 'stripe_invoices',
          invoiceId: invoice.id
        });
        // Don't fail invoice creation if email fails
      }

      logger.info('Invoice created successfully', {
        operation: 'stripe_invoices',
        invoiceId: invoice.id,
        invoiceNumber: invoice.invoiceNumber,
        partnerId: data.partnerId,
        customerId: data.customerId,
        amount: data.amount,
        hostedInvoiceUrl: finalizedInvoice.hosted_invoice_url
      });

      return invoice as InvoiceWithDetails;
    } catch (error: any) {
      logger.error('Error creating invoice', error as Error, {
        operation: 'stripe_invoices',
        partnerId: data.partnerId,
        customerId: data.customerId
      });

      if (error.type === 'StripeConnectError') {
        throw error;
      }

      throw createStripeConnectError(
        'Failed to create invoice',
        'INVOICE_CREATION_FAILED',
        500
      );
    }
  }

  /**
   * Get invoice by ID
   */
  static async getInvoice(invoiceId: string): Promise<InvoiceWithDetails | null> {
    try {
      const invoice = await prisma.invoice.findUnique({
        where: { id: invoiceId },
        include: {
          partner: {
            select: {
              id: true,
              businessName: true,
              emailAddress: true,
            },
          },
          customer: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
            },
          },
          payments: {
            select: {
              id: true,
              amount: true,
              status: true,
              paidAt: true,
            },
          },
        },
      });

      return invoice as InvoiceWithDetails | null;
    } catch (error: any) {
      logger.error('Error fetching invoice', error as Error, {
        operation: 'stripe_invoices',
        invoiceId
      });
      throw createStripeConnectError(
        'Failed to fetch invoice',
        'INVOICE_FETCH_FAILED',
        500
      );
    }
  }

  /**
   * Update invoice
   */
  static async updateInvoice(
    invoiceId: string,
    data: UpdateInvoiceRequest
  ): Promise<InvoiceWithDetails> {
    try {
      // Check if invoice exists
      const existingInvoice = await prisma.invoice.findUnique({
        where: { id: invoiceId },
        select: { id: true, status: true },
      });

      if (!existingInvoice) {
        throw createStripeConnectError(
          'Invoice not found',
          'INVOICE_NOT_FOUND',
          404
        );
      }

      // Prevent updates to paid invoices
      if (existingInvoice.status === 'paid') {
        throw createStripeConnectError(
          'Cannot update paid invoice',
          'INVOICE_ALREADY_PAID',
          400
        );
      }

      // Validate amount if provided
      if (data.amount && !validatePaymentAmount(data.amount)) {
        throw createStripeConnectError(
          'Invalid payment amount',
          'INVALID_AMOUNT',
          400
        );
      }

      // Update invoice
      const updatedInvoice = await prisma.invoice.update({
        where: { id: invoiceId },
        data: {
          ...(data.title && { title: data.title }),
          ...(data.description !== undefined && { description: data.description }),
          ...(data.amount && { amount: data.amount }),
          ...(data.dueDate !== undefined && { dueDate: data.dueDate }),
          ...(data.status && { status: data.status }),
        },
        include: {
          partner: {
            select: {
              id: true,
              businessName: true,
              emailAddress: true,
            },
          },
          customer: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
            },
          },
          payments: {
            select: {
              id: true,
              amount: true,
              status: true,
              paidAt: true,
            },
          },
        },
      });

      logger.info('Invoice updated successfully', {
        operation: 'stripe_invoices',
        invoiceId,
        updatedFields: Object.keys(data)
      });

      return updatedInvoice as InvoiceWithDetails;
    } catch (error: any) {
      logger.error('Error updating invoice', error as Error, {
        operation: 'stripe_invoices',
        invoiceId
      });

      if (error.type === 'StripeConnectError') {
        throw error;
      }

      throw createStripeConnectError(
        'Failed to update invoice',
        'INVOICE_UPDATE_FAILED',
        500
      );
    }
  }

  /**
   * Get invoices by partner
   */
  static async getInvoicesByPartner(
    partnerId: string,
    options: {
      limit?: number;
      offset?: number;
      status?: string;
      customerId?: string;
    } = {}
  ): Promise<{ invoices: InvoiceWithDetails[]; total: number; hasMore: boolean }> {
    try {
      const { limit = 50, offset = 0, status, customerId } = options;

      const where: any = { partnerId };
      if (status) where.status = status;
      if (customerId) where.customerId = customerId;

      const [invoices, total] = await Promise.all([
        prisma.invoice.findMany({
          where,
          include: {
            partner: {
              select: {
                id: true,
                businessName: true,
                emailAddress: true,
              },
            },
            customer: {
              select: {
                id: true,
                email: true,
                firstName: true,
                lastName: true,
              },
            },
            payments: {
              select: {
                id: true,
                amount: true,
                status: true,
                paidAt: true,
              },
            },
          },
          orderBy: { createdAt: 'desc' },
          take: limit,
          skip: offset,
        }),
        prisma.invoice.count({ where }),
      ]);

      return {
        invoices: invoices as InvoiceWithDetails[],
        total,
        hasMore: offset + invoices.length < total,
      };
    } catch (error: any) {
      logger.error('Error fetching partner invoices', error as Error, {
        operation: 'stripe_invoices',
        partnerId
      });
      throw createStripeConnectError(
        'Failed to fetch invoices',
        'INVOICES_FETCH_FAILED',
        500
      );
    }
  }

  /**
   * Get invoices by customer
   */
  static async getInvoicesByCustomer(
    customerId: string,
    options: {
      limit?: number;
      offset?: number;
      status?: string;
    } = {}
  ): Promise<{ invoices: InvoiceWithDetails[]; total: number; hasMore: boolean }> {
    try {
      const { limit = 50, offset = 0, status } = options;

      const where: any = { customerId };
      if (status) where.status = status;

      const [invoices, total] = await Promise.all([
        prisma.invoice.findMany({
          where,
          include: {
            partner: {
              select: {
                id: true,
                businessName: true,
                emailAddress: true,
              },
            },
            customer: {
              select: {
                id: true,
                email: true,
                firstName: true,
                lastName: true,
              },
            },
            payments: {
              select: {
                id: true,
                amount: true,
                status: true,
                paidAt: true,
              },
            },
          },
          orderBy: { createdAt: 'desc' },
          take: limit,
          skip: offset,
        }),
        prisma.invoice.count({ where }),
      ]);

      return {
        invoices: invoices as InvoiceWithDetails[],
        total,
        hasMore: offset + invoices.length < total,
      };
    } catch (error: any) {
      logger.error('Error fetching customer invoices', error as Error, {
        operation: 'stripe_invoices',
        customerId
      });
      throw createStripeConnectError(
        'Failed to fetch invoices',
        'INVOICES_FETCH_FAILED',
        500
      );
    }
  }

  /**
   * Create payment intent for invoice
   */
  static async createPaymentIntent(invoiceId: string): Promise<{
    paymentIntentId: string;
    clientSecret: string;
    amount: number;
    applicationFeeAmount: number;
    currency: string;
  }> {
    try {
      // Get invoice with partner and customer details
      const invoice = await prisma.invoice.findUnique({
        where: { id: invoiceId },
        include: {
          partner: {
            select: {
              id: true,
              stripeAccountId: true,
              stripeChargesEnabled: true,
              applicationFeePercent: true,
              businessName: true,
            },
          },
          customer: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
            },
          },
        },
      });

      if (!invoice) {
        throw createStripeConnectError(
          'Invoice not found',
          'INVOICE_NOT_FOUND',
          404
        );
      }

      if (invoice.status === 'paid') {
        throw createStripeConnectError(
          'Invoice is already paid',
          'INVOICE_ALREADY_PAID',
          400
        );
      }

      if (invoice.status === 'cancelled') {
        throw createStripeConnectError(
          'Invoice is cancelled',
          'INVOICE_CANCELLED',
          400
        );
      }

      if (!invoice.partner.stripeAccountId || !invoice.partner.stripeChargesEnabled) {
        throw createStripeConnectError(
          'Partner Stripe account is not ready for payments',
          'STRIPE_NOT_READY',
          400
        );
      }

      // Calculate application fee
      const applicationFeeAmount = calculateApplicationFee(
        invoice.amount,
        Number(invoice.partner.applicationFeePercent)
      );

      // Create payment intent with Stripe Connect
      const paymentIntent = await stripe.paymentIntents.create({
        amount: invoice.amount,
        currency: invoice.currency,
        application_fee_amount: applicationFeeAmount,
        description: `Payment for invoice ${invoice.invoiceNumber}: ${invoice.title}`,
        receipt_email: invoice.customer.email,
        metadata: {
          invoiceId: invoice.id,
          invoiceNumber: invoice.invoiceNumber,
          partnerId: invoice.partner.id,
          customerId: invoice.customer.id,
          type: 'invoice_payment',
        },
        on_behalf_of: invoice.partner.stripeAccountId,
        transfer_data: {
          destination: invoice.partner.stripeAccountId,
        },
      }, {
        idempotencyKey: generateIdempotencyKey(`invoice-payment-${invoiceId}`),
      });

      // Update invoice with payment intent ID
      await prisma.invoice.update({
        where: { id: invoiceId },
        data: {
          stripePaymentIntentId: paymentIntent.id,
          status: 'sent', // Mark as sent when payment intent is created
        },
      });

      // Create invoice payment record
      await prisma.invoicePayment.create({
        data: {
          invoiceId: invoice.id,
          stripePaymentIntentId: paymentIntent.id,
          amount: invoice.amount,
          status: 'pending',
        },
      });

      logger.info('Payment intent created for invoice', {
        operation: 'stripe_invoices',
        invoiceId,
        paymentIntentId: paymentIntent.id,
        amount: invoice.amount,
        applicationFeeAmount
      });

      return {
        paymentIntentId: paymentIntent.id,
        clientSecret: paymentIntent.client_secret!,
        amount: invoice.amount,
        applicationFeeAmount,
        currency: invoice.currency,
      };
    } catch (error: any) {
      logger.error('Error creating payment intent for invoice', error as Error, {
        operation: 'stripe_invoices',
        invoiceId
      });

      if (error.type === 'StripeConnectError') {
        throw error;
      }

      if (error.type === 'StripeInvalidRequestError') {
        throw createStripeConnectError(
          getStripeErrorMessage(error),
          'STRIPE_ERROR',
          400,
          error.code
        );
      }

      throw createStripeConnectError(
        'Failed to create payment intent',
        'PAYMENT_INTENT_CREATION_FAILED',
        500
      );
    }
  }

  /**
   * Mark invoice as paid
   */
  static async markInvoiceAsPaid(
    invoiceId: string,
    paymentIntentId: string
  ): Promise<InvoiceWithDetails> {
    try {
      // Update invoice status
      const updatedInvoice = await prisma.invoice.update({
        where: { id: invoiceId },
        data: {
          status: 'paid',
          paidAt: new Date(),
        },
        include: {
          partner: {
            select: {
              id: true,
              businessName: true,
              emailAddress: true,
            },
          },
          customer: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
            },
          },
          payments: {
            select: {
              id: true,
              amount: true,
              status: true,
              paidAt: true,
            },
          },
        },
      });

      // Update payment record
      await prisma.invoicePayment.updateMany({
        where: {
          invoiceId,
          stripePaymentIntentId: paymentIntentId,
        },
        data: {
          status: 'succeeded',
          paidAt: new Date(),
        },
      });

      logger.info('Invoice marked as paid', {
        operation: 'stripe_invoices',
        invoiceId,
        paymentIntentId
      });

      return updatedInvoice as InvoiceWithDetails;
    } catch (error: any) {
      logger.error('Error marking invoice as paid', error as Error, {
        operation: 'stripe_invoices',
        invoiceId,
        paymentIntentId
      });
      throw createStripeConnectError(
        'Failed to update invoice payment status',
        'INVOICE_UPDATE_FAILED',
        500
      );
    }
  }

  /**
   * Cancel invoice
   */
  static async cancelInvoice(invoiceId: string): Promise<InvoiceWithDetails> {
    try {
      const invoice = await prisma.invoice.findUnique({
        where: { id: invoiceId },
        select: { id: true, status: true, stripePaymentIntentId: true },
      });

      if (!invoice) {
        throw createStripeConnectError(
          'Invoice not found',
          'INVOICE_NOT_FOUND',
          404
        );
      }

      if (invoice.status === 'paid') {
        throw createStripeConnectError(
          'Cannot cancel paid invoice',
          'INVOICE_ALREADY_PAID',
          400
        );
      }

      // Cancel Stripe payment intent if exists
      if (invoice.stripePaymentIntentId) {
        try {
          await stripe.paymentIntents.cancel(invoice.stripePaymentIntentId);
        } catch (stripeError: any) {
          logger.warn('Failed to cancel Stripe payment intent', {
            operation: 'stripe_invoices',
            paymentIntentId: invoice.stripePaymentIntentId,
            error: stripeError.message
          });
          // Continue with invoice cancellation even if Stripe cancellation fails
        }
      }

      // Update invoice status
      const cancelledInvoice = await prisma.invoice.update({
        where: { id: invoiceId },
        data: { status: 'cancelled' },
        include: {
          partner: {
            select: {
              id: true,
              businessName: true,
              emailAddress: true,
            },
          },
          customer: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
            },
          },
          payments: {
            select: {
              id: true,
              amount: true,
              status: true,
              paidAt: true,
            },
          },
        },
      });

      logger.info('Invoice cancelled', {
        operation: 'stripe_invoices',
        invoiceId
      });

      return cancelledInvoice as InvoiceWithDetails;
    } catch (error: any) {
      logger.error('Error cancelling invoice', error as Error, {
        operation: 'stripe_invoices',
        invoiceId
      });

      if (error.type === 'StripeConnectError') {
        throw error;
      }

      throw createStripeConnectError(
        'Failed to cancel invoice',
        'INVOICE_CANCELLATION_FAILED',
        500
      );
    }
  }

  /**
   * Attempt auto-charge for invoice
   */
  static async attemptAutoCharge(invoiceId: string): Promise<{
    success: boolean;
    paymentIntentId?: string;
    error?: string;
  }> {
    try {
      // Get invoice with payment method and partner details
      const invoice = await prisma.invoice.findUnique({
        where: { id: invoiceId },
        include: {
          partner: {
            select: {
              id: true,
              stripeAccountId: true,
              stripeChargesEnabled: true,
              applicationFeePercent: true,
              businessName: true,
            },
          },
          customer: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
              stripeCustomerId: true,
            },
          },
          paymentMethod: {
            select: {
              id: true,
              stripePaymentMethodId: true,
              type: true,
              isActive: true,
            },
          },
        },
      });

      if (!invoice) {
        throw createStripeConnectError(
          'Invoice not found',
          'INVOICE_NOT_FOUND',
          404
        );
      }

      if (!invoice.autoChargeEnabled) {
        return { success: false, error: 'Auto-charge not enabled for this invoice' };
      }

      if (invoice.status === 'paid') {
        return { success: false, error: 'Invoice is already paid' };
      }

      if (!invoice.paymentMethod || !invoice.paymentMethod.isActive) {
        return { success: false, error: 'No active payment method found' };
      }

      if (!invoice.partner.stripeAccountId || !invoice.partner.stripeChargesEnabled) {
        return { success: false, error: 'Partner Stripe account not ready' };
      }

      if (!invoice.customer.stripeCustomerId) {
        return { success: false, error: 'Customer not set up in Stripe' };
      }

      // Calculate application fee
      const applicationFeeAmount = calculateApplicationFee(
        invoice.amount,
        Number(invoice.partner.applicationFeePercent)
      );

      // Create and confirm payment intent with saved payment method
      const paymentIntent = await stripe.paymentIntents.create({
        amount: invoice.amount,
        currency: invoice.currency,
        customer: invoice.customer.stripeCustomerId,
        payment_method: invoice.paymentMethod.stripePaymentMethodId,
        application_fee_amount: applicationFeeAmount,
        description: `Auto-charge for invoice ${invoice.invoiceNumber}: ${invoice.title}`,
        receipt_email: invoice.customer.email,
        confirmation_method: 'automatic',
        confirm: true,
        off_session: true, // Indicates this is for a saved payment method
        metadata: {
          invoiceId: invoice.id,
          invoiceNumber: invoice.invoiceNumber,
          partnerId: invoice.partner.id,
          customerId: invoice.customer.id,
          type: 'auto_charge',
        },
        on_behalf_of: invoice.partner.stripeAccountId,
        transfer_data: {
          destination: invoice.partner.stripeAccountId,
        },
      }, {
        stripeAccount: invoice.partner.stripeAccountId,
        idempotencyKey: generateIdempotencyKey(`auto-charge-${invoiceId}`),
      });

      // Update invoice with auto-charge attempt
      await prisma.invoice.update({
        where: { id: invoiceId },
        data: {
          stripePaymentIntentId: paymentIntent.id,
          autoChargeAttemptedAt: new Date(),
          autoChargeRetryCount: { increment: 1 },
          status: paymentIntent.status === 'succeeded' ? 'paid' : 'sent',
          ...(paymentIntent.status === 'succeeded' && { paidAt: new Date() }),
        },
      });

      // Create payment record
      await prisma.invoicePayment.create({
        data: {
          invoiceId: invoice.id,
          stripePaymentIntentId: paymentIntent.id,
          amount: invoice.amount,
          status: paymentIntent.status,
          ...(paymentIntent.status === 'succeeded' && { paidAt: new Date() }),
        },
      });

      const success = paymentIntent.status === 'succeeded';

      logger.info('Auto-charge attempt completed', {
        operation: 'stripe_invoices',
        invoiceId,
        paymentIntentId: paymentIntent.id,
        status: paymentIntent.status,
        success
      });

      return {
        success,
        paymentIntentId: paymentIntent.id,
        ...(success ? {} : { error: `Payment ${paymentIntent.status}` }),
      };
    } catch (error: any) {
      logger.error('Error attempting auto-charge', error as Error, {
        operation: 'stripe_invoices',
        invoiceId
      });

      // Update invoice with failure information
      try {
        await prisma.invoice.update({
          where: { id: invoiceId },
          data: {
            autoChargeAttemptedAt: new Date(),
            autoChargeRetryCount: { increment: 1 },
            autoChargeFailureReason: getStripeErrorMessage(error),
          },
        });
      } catch (updateError) {
        logger.error('Failed to update invoice with auto-charge failure', updateError as Error, {
          operation: 'stripe_invoices',
          invoiceId
        });
      }

      return {
        success: false,
        error: getStripeErrorMessage(error),
      };
    }
  }

  /**
   * Create invoice with auto-charge attempt
   */
  static async createInvoiceWithAutoCharge(
    data: CreateInvoiceRequest
  ): Promise<{
    invoice: InvoiceWithDetails;
    autoChargeResult?: {
      success: boolean;
      paymentIntentId?: string;
      error?: string;
    };
  }> {
    try {
      // Create the invoice first
      const invoice = await this.createInvoice(data);

      // If auto-charge is enabled, attempt it
      let autoChargeResult;
      if (data.autoChargeEnabled && data.paymentMethodId) {
        // Update invoice with auto-charge settings
        await prisma.invoice.update({
          where: { id: invoice.id },
          data: {
            autoChargeEnabled: true,
            paymentMethodId: data.paymentMethodId,
            billingType: 'auto',
          },
        });

        // Attempt auto-charge
        autoChargeResult = await this.attemptAutoCharge(invoice.id);
      }

      // Get updated invoice
      const updatedInvoice = await this.getInvoice(invoice.id);

      return {
        invoice: updatedInvoice!,
        autoChargeResult,
      };
    } catch (error: any) {
      logger.error('Error creating invoice with auto-charge', error as Error, {
        operation: 'stripe_invoices',
        partnerId: data.partnerId,
        customerId: data.customerId
      });

      if (error.type === 'StripeConnectError') {
        throw error;
      }

      throw createStripeConnectError(
        'Failed to create invoice with auto-charge',
        'INVOICE_AUTO_CHARGE_FAILED',
        500
      );
    }
  }
}
