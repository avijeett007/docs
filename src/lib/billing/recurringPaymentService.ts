import { prisma } from '@/lib/prisma';
import { invoiceEmailService } from '@/lib/email/invoiceEmailService';
import { InvoiceService } from '@/lib/stripe/invoices';
import { logger } from '@/lib/logger';

export type RecurringInterval = 'weekly' | 'monthly' | 'quarterly' | 'yearly';

interface CreateRecurringInvoiceData {
  partnerId: string;
  customerId: string;
  title: string;
  description?: string;
  amount: number;
  currency: string;
  recurringInterval: RecurringInterval;
  recurringCount?: number; // null for infinite
  dueDate?: Date;
}

export class RecurringPaymentService {
  /**
   * Create a recurring invoice template
   */
  async createRecurringInvoice(data: CreateRecurringInvoiceData) {
    try {
      // Generate invoice number
      const invoiceCount = await prisma.invoice.count({
        where: { partnerId: data.partnerId },
      });
      const invoiceNumber = `INV-${String(invoiceCount + 1).padStart(4, '0')}`;

      // Calculate next payment date
      const nextPaymentDate = this.calculateNextPaymentDate(new Date(), data.recurringInterval);

      const invoice = await prisma.invoice.create({
        data: {
          partnerId: data.partnerId,
          customerId: data.customerId,
          invoiceNumber,
          title: data.title,
          description: data.description,
          amount: data.amount,
          currency: data.currency,
          status: 'draft',
          type: 'recurring',
          recurringInterval: data.recurringInterval,
          recurringCount: data.recurringCount,
          nextPaymentDate,
          dueDate: data.dueDate,
        },
      });

      return invoice;
    } catch (error) {
      logger.error('Error creating recurring invoice', error as Error, {
        operation: 'recurring_payment_service',
        partnerId: data.partnerId,
        customerId: data.customerId
      });
      throw error;
    }
  }

  /**
   * Process all due recurring invoices
   */
  async processRecurringInvoices() {
    try {
      const now = new Date();
      
      // Find all recurring invoices that are due
      const dueInvoices = await prisma.invoice.findMany({
        where: {
          type: 'recurring',
          status: 'sent',
          nextPaymentDate: {
            lte: now,
          },
          OR: [
            { recurringCount: null }, // Infinite recurring
            { recurringCount: { gt: 0 } }, // Still has remaining cycles
          ],
        },
        include: {
          customer: true,
          partner: true,
        },
      });

      logger.info('Found due recurring invoices', {
        operation: 'recurring_payment_service',
        dueCount: dueInvoices.length
      });

      for (const invoice of dueInvoices) {
        await this.createNextRecurringInvoice(invoice);
      }

      return dueInvoices.length;
    } catch (error) {
      logger.error('Error processing recurring invoices', error as Error, {
        operation: 'recurring_payment_service'
      });
      throw error;
    }
  }

  /**
   * Create the next invoice in a recurring series
   */
  private async createNextRecurringInvoice(originalInvoice: any) {
    try {
      // Calculate next payment date for the template
      // Use current date as base for next payment calculation (when invoice is paid)
      const baseDate = new Date();
      const nextPaymentDate = this.calculateNextPaymentDate(
        baseDate,
        originalInvoice.recurringInterval
      );

      // Calculate due date for the new invoice
      const dueDate = this.calculateDueDate(new Date(), originalInvoice.recurringInterval);

      // Create new invoice using InvoiceService to ensure Stripe Connect integration
      // IMPORTANT: New invoice should be 'one_time', not 'recurring'
      // Only the template should be 'recurring' - instances are one-time invoices
      const newInvoice = await InvoiceService.createInvoice({
        partnerId: originalInvoice.partnerId,
        customerId: originalInvoice.customerId,
        title: originalInvoice.title,
        description: originalInvoice.description,
        amount: originalInvoice.amount,
        currency: originalInvoice.currency,
        type: 'one_time', // ✅ FIXED: Instance invoices should be one_time, not recurring
        // ✅ Clear recurring fields for instance - omit them for one_time invoices
        dueDate: dueDate,
        metadata: {
          originalRecurringInvoiceId: originalInvoice.id,
          isRecurringInstance: 'true',
        },
      });

      // Automatically send the recurring invoice
      if (newInvoice.stripeInvoiceId && originalInvoice.partner?.stripeAccountId) {
        try {
          const Stripe = require('stripe');
          const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
            apiVersion: '2023-10-16',
          });

          // Finalize and send the Stripe invoice
          await stripe.invoices.finalizeInvoice(newInvoice.stripeInvoiceId, {}, {
            stripeAccount: originalInvoice.partner.stripeAccountId,
          });

          await stripe.invoices.sendInvoice(newInvoice.stripeInvoiceId, {}, {
            stripeAccount: originalInvoice.partner.stripeAccountId,
          });

          // Update invoice status to sent
          await prisma.invoice.update({
            where: { id: newInvoice.id },
            data: { status: 'sent' },
          });

          logger.info('Recurring Stripe invoice finalized and sent', {
            operation: 'recurring_payment_service',
            stripeInvoiceId: newInvoice.stripeInvoiceId,
            invoiceNumber: newInvoice.invoiceNumber
          });
        } catch (stripeError) {
          logger.error('Error finalizing/sending recurring Stripe invoice', stripeError as Error, {
            operation: 'recurring_payment_service',
            stripeInvoiceId: newInvoice.stripeInvoiceId,
            invoiceNumber: newInvoice.invoiceNumber
          });
          // Still mark as sent in database even if Stripe fails
          await prisma.invoice.update({
            where: { id: newInvoice.id },
            data: { status: 'sent' },
          });
        }
      } else {
        // No Stripe integration, just mark as sent
        await prisma.invoice.update({
          where: { id: newInvoice.id },
          data: { status: 'sent' },
        });
      }

      // Update the original invoice's next payment date and decrement count
      const updateData: any = {
        nextPaymentDate,
      };

      if (originalInvoice.recurringCount && originalInvoice.recurringCount > 0) {
        updateData.recurringCount = originalInvoice.recurringCount - 1;
        
        // If this was the last recurring payment, mark as completed
        if (originalInvoice.recurringCount === 1) {
          updateData.status = 'completed';
          updateData.nextPaymentDate = null;
        }
      }

      await prisma.invoice.update({
        where: { id: originalInvoice.id },
        data: updateData,
      });

      // Send email notification for the new invoice
      try {
        await invoiceEmailService.sendInvoiceNotification(newInvoice.id);
        logger.info('Recurring invoice notification sent', {
          operation: 'recurring_payment_service',
          invoiceNumber: newInvoice.invoiceNumber
        });
      } catch (error) {
        logger.error('Failed to send recurring invoice notification', error as Error, {
          operation: 'recurring_payment_service',
          invoiceNumber: newInvoice.invoiceNumber
        });
      }

      logger.info('Created recurring invoice from template', {
        operation: 'recurring_payment_service',
        newInvoiceNumber: newInvoice.invoiceNumber,
        templateInvoiceNumber: originalInvoice.invoiceNumber
      });
      return newInvoice;
    } catch (error) {
      logger.error('Error creating next recurring invoice', error as Error, {
        operation: 'recurring_payment_service',
        originalInvoiceId: originalInvoice.id
      });
      throw error;
    }
  }

  /**
   * Calculate the next payment date based on interval
   */
  private calculateNextPaymentDate(currentDate: Date, interval: RecurringInterval): Date {
    const nextDate = new Date(currentDate);

    switch (interval) {
      case 'weekly':
        nextDate.setDate(nextDate.getDate() + 7);
        break;
      case 'monthly':
        nextDate.setMonth(nextDate.getMonth() + 1);
        break;
      case 'quarterly':
        nextDate.setMonth(nextDate.getMonth() + 3);
        break;
      case 'yearly':
        nextDate.setFullYear(nextDate.getFullYear() + 1);
        break;
    }

    return nextDate;
  }

  /**
   * Calculate due date (typically 30 days from creation for recurring)
   */
  private calculateDueDate(creationDate: Date, interval: RecurringInterval): Date {
    const dueDate = new Date(creationDate);
    
    // Set due date based on interval
    switch (interval) {
      case 'weekly':
        dueDate.setDate(dueDate.getDate() + 14); // 2 weeks
        break;
      case 'monthly':
        dueDate.setDate(dueDate.getDate() + 30); // 30 days
        break;
      case 'quarterly':
        dueDate.setDate(dueDate.getDate() + 45); // 45 days
        break;
      case 'yearly':
        dueDate.setDate(dueDate.getDate() + 60); // 60 days
        break;
    }

    return dueDate;
  }

  /**
   * Handle payment of a recurring invoice (create next invoice in series)
   */
  async handleRecurringInvoicePayment(invoiceId: string) {
    try {
      const invoice = await prisma.invoice.findUnique({
        where: { id: invoiceId },
        include: {
          customer: true,
          partner: true,
        },
      });

      if (!invoice) {
        throw new Error('Invoice not found');
      }

      if (invoice.type !== 'recurring') {
        logger.info('Invoice is not recurring, skipping', {
          operation: 'recurring_payment_service',
          invoiceNumber: invoice.invoiceNumber
        });
        return;
      }

      if (invoice.status !== 'paid') {
        logger.info('Invoice is not paid, skipping', {
          operation: 'recurring_payment_service',
          invoiceNumber: invoice.invoiceNumber
        });
        return;
      }

      // Check if this recurring invoice should generate the next one
      if (invoice.recurringCount === null || invoice.recurringCount > 0) {
        await this.createNextRecurringInvoice(invoice);
        logger.info('Created next recurring invoice', {
          operation: 'recurring_payment_service',
          originalInvoiceNumber: invoice.invoiceNumber
        });
      } else {
        logger.info('Recurring invoice completed (no more cycles)', {
          operation: 'recurring_payment_service',
          invoiceNumber: invoice.invoiceNumber
        });
      }

      return true;
    } catch (error) {
      logger.error('Error handling recurring invoice payment', error as Error, {
        operation: 'recurring_payment_service',
        invoiceId
      });
      throw error;
    }
  }

  /**
   * Cancel a recurring invoice series
   */
  async cancelRecurringInvoice(invoiceId: string, partnerId: string) {
    try {
      const invoice = await prisma.invoice.findFirst({
        where: {
          id: invoiceId,
          partnerId,
          type: 'recurring',
        },
      });

      if (!invoice) {
        throw new Error('Recurring invoice not found');
      }

      await prisma.invoice.update({
        where: { id: invoiceId },
        data: {
          status: 'cancelled',
          nextPaymentDate: null,
          recurringCount: 0,
        },
      });

      logger.info('Cancelled recurring invoice', {
        operation: 'recurring_payment_service',
        invoiceNumber: invoice.invoiceNumber
      });
      return true;
    } catch (error) {
      logger.error('Error cancelling recurring invoice', error as Error, {
        operation: 'recurring_payment_service',
        invoiceId
      });
      throw error;
    }
  }

  /**
   * Get recurring invoice statistics for a partner
   */
  async getRecurringStats(partnerId: string) {
    try {
      const stats = await prisma.invoice.groupBy({
        by: ['status'],
        where: {
          partnerId,
          type: 'recurring',
        },
        _count: {
          id: true,
        },
        _sum: {
          amount: true,
        },
      });

      const totalRecurring = await prisma.invoice.count({
        where: {
          partnerId,
          type: 'recurring',
        },
      });

      const activeRecurring = await prisma.invoice.count({
        where: {
          partnerId,
          type: 'recurring',
          status: 'sent',
          nextPaymentDate: {
            not: null,
          },
        },
      });

      return {
        totalRecurring,
        activeRecurring,
        statusBreakdown: stats,
      };
    } catch (error) {
      logger.error('Error getting recurring stats', error as Error, {
        operation: 'recurring_payment_service',
        partnerId
      });
      throw error;
    }
  }
}

export const recurringPaymentService = new RecurringPaymentService();
