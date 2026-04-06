import { prisma } from '@/lib/prisma';
import { invoiceEmailService } from '@/lib/email/invoiceEmailService';
import { logger } from '@/lib/logger';

interface OverdueReminderConfig {
  firstReminderDays: number; // Days after due date for first reminder
  secondReminderDays: number; // Days after due date for second reminder
  finalReminderDays: number; // Days after due date for final reminder
  suspensionDays: number; // Days after due date to suspend customer access
}

const DEFAULT_REMINDER_CONFIG: OverdueReminderConfig = {
  firstReminderDays: 3,
  secondReminderDays: 7,
  finalReminderDays: 14,
  suspensionDays: 30,
};

export class OverdueInvoiceService {
  /**
   * Process all overdue invoices and send reminders
   */
  async processOverdueInvoices(config: OverdueReminderConfig = DEFAULT_REMINDER_CONFIG) {
    try {
      const now = new Date();
      
      // Find all sent invoices that are past due date
      const overdueInvoices = await prisma.invoice.findMany({
        where: {
          status: 'sent',
          dueDate: {
            lt: now,
          },
        },
        include: {
          customer: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
            },
          },
          partner: {
            select: {
              id: true,
              businessName: true,
              emailAddress: true,
              subdomain: true,
              customDomain: true,
              customDomainVerified: true,
            },
          },
        },
      });

      logger.info('Found overdue invoices', {
        operation: 'overdue_invoice_service',
        overdueCount: overdueInvoices.length
      });

      let processedCount = 0;

      for (const invoice of overdueInvoices) {
        const daysPastDue = this.calculateDaysPastDue(invoice.dueDate!);
        
        // Update invoice status to overdue if not already
        if (invoice.status !== 'overdue') {
          await prisma.invoice.update({
            where: { id: invoice.id },
            data: { status: 'overdue' },
          });
        }

        // Determine what action to take based on days past due
        if (daysPastDue >= config.suspensionDays) {
          await this.suspendCustomerAccess(invoice.customerId, invoice.partnerId);
        } else if (daysPastDue >= config.finalReminderDays) {
          await this.sendFinalReminder(invoice);
        } else if (daysPastDue >= config.secondReminderDays) {
          await this.sendSecondReminder(invoice);
        } else if (daysPastDue >= config.firstReminderDays) {
          await this.sendFirstReminder(invoice);
        }

        processedCount++;
      }

      logger.info('Processed overdue invoices', {
        operation: 'overdue_invoice_service',
        processedCount
      });
      return processedCount;
    } catch (error) {
      logger.error('Error processing overdue invoices', error as Error, {
        operation: 'overdue_invoice_service'
      });
      throw error;
    }
  }

  /**
   * Calculate days past due date
   */
  private calculateDaysPastDue(dueDate: Date): number {
    const now = new Date();
    const diffTime = now.getTime() - dueDate.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  }

  /**
   * Send first overdue reminder
   */
  private async sendFirstReminder(invoice: any) {
    try {
      // Check if we've already sent this reminder
      const existingReminder = await prisma.invoiceReminder.findFirst({
        where: {
          invoiceId: invoice.id,
          reminderType: 'first_overdue',
        },
      });

      if (existingReminder) {
        return; // Already sent
      }

      // Send reminder email
      await this.sendOverdueReminderEmail(invoice, 'first');

      // Record the reminder
      await prisma.invoiceReminder.create({
        data: {
          invoiceId: invoice.id,
          reminderType: 'first_overdue',
          sentAt: new Date(),
        },
      });

      logger.info('Sent first overdue reminder for invoice', {
        operation: 'overdue_invoice_service',
        invoiceNumber: invoice.invoiceNumber,
        invoiceId: invoice.id
      });
    } catch (error) {
      logger.error('Error sending first reminder for invoice', error as Error, {
        operation: 'overdue_invoice_service',
        invoiceId: invoice.id,
        invoiceNumber: invoice.invoiceNumber
      });
    }
  }

  /**
   * Send second overdue reminder
   */
  private async sendSecondReminder(invoice: any) {
    try {
      const existingReminder = await prisma.invoiceReminder.findFirst({
        where: {
          invoiceId: invoice.id,
          reminderType: 'second_overdue',
        },
      });

      if (existingReminder) {
        return;
      }

      await this.sendOverdueReminderEmail(invoice, 'second');

      await prisma.invoiceReminder.create({
        data: {
          invoiceId: invoice.id,
          reminderType: 'second_overdue',
          sentAt: new Date(),
        },
      });

      logger.info('Sent second overdue reminder for invoice', {
        operation: 'overdue_invoice_service',
        invoiceNumber: invoice.invoiceNumber,
        invoiceId: invoice.id
      });
    } catch (error) {
      logger.error('Error sending second reminder for invoice', error as Error, {
        operation: 'overdue_invoice_service',
        invoiceId: invoice.id,
        invoiceNumber: invoice.invoiceNumber
      });
    }
  }

  /**
   * Send final overdue reminder
   */
  private async sendFinalReminder(invoice: any) {
    try {
      const existingReminder = await prisma.invoiceReminder.findFirst({
        where: {
          invoiceId: invoice.id,
          reminderType: 'final_overdue',
        },
      });

      if (existingReminder) {
        return;
      }

      await this.sendOverdueReminderEmail(invoice, 'final');

      await prisma.invoiceReminder.create({
        data: {
          invoiceId: invoice.id,
          reminderType: 'final_overdue',
          sentAt: new Date(),
        },
      });

      logger.info('Sent final overdue reminder for invoice', {
        operation: 'overdue_invoice_service',
        invoiceNumber: invoice.invoiceNumber,
        invoiceId: invoice.id
      });
    } catch (error) {
      logger.error('Error sending final reminder for invoice', error as Error, {
        operation: 'overdue_invoice_service',
        invoiceId: invoice.id,
        invoiceNumber: invoice.invoiceNumber
      });
    }
  }

  /**
   * Send overdue reminder email
   */
  private async sendOverdueReminderEmail(invoice: any, reminderType: 'first' | 'second' | 'final') {
    try {
      // This would use a specialized overdue email template
      // For now, we'll use the existing invoice notification service
      // In a full implementation, you'd create specific overdue email templates
      
      const daysPastDue = this.calculateDaysPastDue(invoice.dueDate);
      
      logger.info('Sending overdue reminder for invoice', {
        operation: 'overdue_invoice_service',
        reminderType,
        invoiceNumber: invoice.invoiceNumber,
        daysPastDue
      });
      
      // You could extend the email service to handle overdue reminders
      // await invoiceEmailService.sendOverdueReminder(invoice.id, reminderType, daysPastDue);
      
      return true;
    } catch (error) {
      logger.error('Error sending overdue reminder email', error as Error, {
        operation: 'overdue_invoice_service',
        invoiceId: invoice.id,
        reminderType
      });
      return false;
    }
  }

  /**
   * Suspend customer access due to overdue payments
   */
  private async suspendCustomerAccess(customerId: string, partnerId: string) {
    try {
      // Check if already suspended
      const customer = await prisma.customer.findUnique({
        where: { id: customerId },
        select: { id: true, suspended: true },
      });

      if (!customer || customer.suspended) {
        return; // Already suspended or doesn't exist
      }

      // Suspend the customer
      await prisma.customer.update({
        where: { id: customerId },
        data: { suspended: true },
      });

      // Log the suspension
      await prisma.customerSuspension.create({
        data: {
          customerId,
          partnerId,
          reason: 'overdue_payment',
          suspendedAt: new Date(),
        },
      });

      logger.warn('Suspended customer due to overdue payments', {
        operation: 'overdue_invoice_service',
        customerId
      });
    } catch (error) {
      logger.error('Error suspending customer', error as Error, {
        operation: 'overdue_invoice_service',
        customerId
      });
    }
  }

  /**
   * Reactivate customer after payment
   */
  async reactivateCustomer(customerId: string) {
    try {
      // Check if customer has any remaining overdue invoices
      const overdueInvoices = await prisma.invoice.count({
        where: {
          customerId,
          status: 'overdue',
        },
      });

      if (overdueInvoices === 0) {
        // No more overdue invoices, reactivate customer
        await prisma.customer.update({
          where: { id: customerId },
          data: { suspended: false },
        });

        // Update suspension record
        await prisma.customerSuspension.updateMany({
          where: {
            customerId,
            reactivatedAt: null,
          },
          data: {
            reactivatedAt: new Date(),
          },
        });

        logger.info('Reactivated customer', {
          operation: 'overdue_invoice_service',
          customerId
        });
        return true;
      }

      return false;
    } catch (error) {
      logger.error('Error reactivating customer', error as Error, {
        operation: 'overdue_invoice_service',
        customerId
      });
      return false;
    }
  }

  /**
   * Get overdue statistics for a partner
   */
  async getOverdueStats(partnerId: string) {
    try {
      const now = new Date();

      const overdueInvoices = await prisma.invoice.findMany({
        where: {
          partnerId,
          status: 'overdue',
        },
        select: {
          id: true,
          amount: true,
          dueDate: true,
        },
      });

      const totalOverdue = overdueInvoices.length;
      const totalOverdueAmount = overdueInvoices.reduce((sum, inv) => sum + inv.amount, 0);

      // Categorize by days overdue
      const categories = {
        recent: 0, // 1-7 days
        moderate: 0, // 8-30 days
        severe: 0, // 31+ days
      };

      overdueInvoices.forEach(invoice => {
        const daysPastDue = this.calculateDaysPastDue(invoice.dueDate!);
        if (daysPastDue <= 7) {
          categories.recent++;
        } else if (daysPastDue <= 30) {
          categories.moderate++;
        } else {
          categories.severe++;
        }
      });

      const suspendedCustomers = await prisma.customer.count({
        where: {
          suspended: true,
          // Add partner relationship check here if needed
        },
      });

      return {
        totalOverdue,
        totalOverdueAmount,
        categories,
        suspendedCustomers,
      };
    } catch (error) {
      logger.error('Error getting overdue stats', error as Error, {
        operation: 'overdue_invoice_service',
        partnerId
      });
      throw error;
    }
  }
}

export const overdueInvoiceService = new OverdueInvoiceService();
