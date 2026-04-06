import nodemailer from 'nodemailer';
import { prisma } from '@/lib/prisma';
import { sendEmail } from '@/lib/email'; // Use main email system as fallback
import { decrypt } from '@/lib/encryption';
import { logger } from '../logger';

interface EmailConfig {
  host: string;
  port: number;
  username: string;
  password: string;
  fromEmail: string;
  fromName: string;
}

interface InvoiceEmailData {
  invoiceId: string;
  invoiceNumber: string;
  title: string;
  description?: string;
  amount: number;
  currency: string;
  dueDate?: Date;
  customerName: string;
  customerEmail: string;
  partnerBusinessName: string;
  partnerEmail: string;
  whitelabelUrl: string;
  type?: string;
  recurringInterval?: string;
  nextPaymentDate?: Date;
}

interface PaymentEmailData extends InvoiceEmailData {
  paidAt: Date;
  paymentAmount: number;
}

export class InvoiceEmailService {
  private async getPartnerEmailConfig(partnerId: string): Promise<EmailConfig | null> {
    try {
      const partner = await prisma.partner.findUnique({
        where: { id: partnerId },
        select: {
          smtpHost: true,
          smtpPort: true,
          smtpUsername: true,
          smtpPassword: true,
          smtpFromEmail: true,
          smtpFromName: true,
          useCustomSmtp: true,
          businessName: true,
          emailAddress: true,
          // SES configuration fields
          sesDomainEnabled: true,
          useSESDomain: true,
          sesDomain: true,
          sesDomainStatus: true,
          sesFromEmail: true,
          sesFromName: true,
        },
      });

      if (!partner) {
        logger.error('Partner not found for invoice email config', new Error('Partner not found'), {
          operation: 'invoice_email',
          partnerId
        });
        throw new Error('Partner not found');
      }

      // Store partner data for building partnerSmtpSettings later
      (this as any)._lastPartnerData = partner;

      // Use custom SMTP if configured, otherwise use default
      if (partner.useCustomSmtp && partner.smtpHost && partner.smtpUsername && !partner.sesDomainEnabled) {
        // Decrypt the SMTP password
        const decryptedPassword = partner.smtpPassword ? await decrypt(partner.smtpPassword) : '';

        return {
          host: partner.smtpHost,
          port: partner.smtpPort || 587,
          username: partner.smtpUsername,
          password: decryptedPassword,
          fromEmail: partner.smtpFromEmail || partner.emailAddress || '',
          fromName: partner.smtpFromName || partner.businessName || '',
        };
      }

      // If SES is configured, return null to use main email system with SES settings
      if (partner.sesDomainEnabled && partner.useSESDomain && partner.sesDomainStatus === 'verified') {
        logger.info('Partner has SES domain configured - using main email system with SES', {
          operation: 'invoice_email',
          partnerId
        });
        return null; // Return null to trigger fallback to main email system with SES settings
      }

      // Check if default SMTP is configured
      const hasDefaultSmtp = !!(process.env.SMTP_HOST && process.env.SMTP_USERNAME && process.env.SMTP_PASSWORD);

      if (!hasDefaultSmtp) {
        logger.info('No SMTP configuration available - using main email system as fallback', {
          operation: 'invoice_email',
          partnerId
        });
        return null; // Return null to trigger fallback to main email system
      }

      // Fallback to default SMTP configuration
      return {
        host: process.env.SMTP_HOST || 'smtp.gmail.com',
        port: parseInt(process.env.SMTP_PORT || '587'),
        username: process.env.SMTP_USERNAME || '',
        password: process.env.SMTP_PASSWORD || '',
        fromEmail: process.env.SMTP_FROM_EMAIL || partner.emailAddress || '',
        fromName: process.env.SMTP_FROM_NAME || partner.businessName || 'Knotie AI Pro',
      };
    } catch (error) {
      logger.error('Error getting partner email config', error as Error, {
        operation: 'invoice_email',
        partnerId
      });
      return null;
    }
  }

  /**
   * Build partnerSmtpSettings for the main email system from cached partner data
   */
  private buildPartnerSmtpSettings(partner: any) {
    // Priority 1: SES Domain
    if (partner.sesDomainEnabled && partner.useSESDomain && partner.sesDomainStatus === 'verified') {
      return {
        useCustomSmtp: false,
        smtpHost: '',
        smtpPort: 587,
        smtpUsername: '',
        smtpPassword: '',
        smtpFromEmail: '',
        smtpFromName: '',
        sesDomainEnabled: partner.sesDomainEnabled,
        useSESDomain: partner.useSESDomain,
        sesDomain: partner.sesDomain || undefined,
        sesDomainStatus: partner.sesDomainStatus || undefined,
        sesFromEmail: partner.sesFromEmail || `noreply@${partner.sesDomain}`,
        sesFromName: partner.sesFromName || partner.businessName
      };
    }
    // Priority 2: Custom SMTP
    if (partner.useCustomSmtp && partner.smtpHost && partner.smtpUsername && partner.smtpPassword) {
      return {
        useCustomSmtp: true,
        smtpHost: partner.smtpHost,
        smtpPort: partner.smtpPort || 587,
        smtpUsername: partner.smtpUsername,
        smtpPassword: partner.smtpPassword, // Will be decrypted by caller
        smtpFromEmail: partner.smtpFromEmail || '',
        smtpFromName: partner.smtpFromName || partner.businessName || '',
        sesDomainEnabled: partner.sesDomainEnabled || false,
        useSESDomain: false,
        sesDomain: partner.sesDomain || undefined,
        sesDomainStatus: partner.sesDomainStatus || undefined,
        sesFromEmail: partner.sesFromEmail || undefined,
        sesFromName: partner.sesFromName || undefined
      };
    }

    // Priority 3: No partner config — return undefined to use SendGrid
    return undefined;
  }

  private async createTransporter(config: EmailConfig) {
    return nodemailer.createTransport({
      host: config.host,
      port: config.port,
      secure: config.port === 465, // true for 465, false for other ports
      auth: {
        user: config.username,
        pass: config.password,
      },
      tls: {
        rejectUnauthorized: false, // Allow self-signed certificates
      },
    });
  }

  private generateInvoiceSentEmailHtml(data: InvoiceEmailData): string {
    // Convert cents to dollars for display
    const amountInDollars = data.amount / 100;
    const formattedAmount = new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: data.currency.toUpperCase(),
    }).format(amountInDollars);

    const formattedDueDate = data.dueDate
      ? new Intl.DateTimeFormat('en-US', {
          year: 'numeric',
          month: 'long',
          day: 'numeric',
        }).format(new Date(data.dueDate))
      : 'No due date specified';

    // Format recurring information
    const isRecurring = data.type === 'recurring';
    const recurringInfo = isRecurring ? {
      interval: data.recurringInterval,
      nextPayment: data.nextPaymentDate ? new Intl.DateTimeFormat('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      }).format(new Date(data.nextPaymentDate)) : null
    } : null;

    return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>New Invoice - ${data.invoiceNumber}</title>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: #f8f9fa; padding: 20px; border-radius: 8px; margin-bottom: 20px; }
            .invoice-details { background: #fff; border: 1px solid #e9ecef; border-radius: 8px; padding: 20px; margin: 20px 0; }
            .amount { font-size: 24px; font-weight: bold; color: #28a745; }
            .button { display: inline-block; background: #007bff; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 20px 0; }
            .footer { margin-top: 30px; padding-top: 20px; border-top: 1px solid #e9ecef; font-size: 14px; color: #6c757d; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>New Invoice from ${data.partnerBusinessName}</h1>
              <p>Hello ${data.customerName},</p>
              <p>You have received a new invoice that requires your attention.</p>
            </div>

            <div class="invoice-details">
              <h2>Invoice Details</h2>
              <p><strong>Invoice Number:</strong> ${data.invoiceNumber}</p>
              <p><strong>Title:</strong> ${data.title}</p>
              ${data.description ? `<p><strong>Description:</strong> ${data.description}</p>` : ''}
              <p><strong>Amount:</strong> <span class="amount">${formattedAmount}</span></p>
              <p><strong>Due Date:</strong> ${formattedDueDate}</p>
              ${isRecurring ? `
                <div style="background: #f8f9fa; padding: 15px; border-radius: 6px; margin: 15px 0; border-left: 4px solid #6f42c1;">
                  <p style="margin: 0; color: #6f42c1; font-weight: bold;">🔄 Recurring Invoice</p>
                  <p style="margin: 5px 0 0 0; font-size: 14px;">This invoice will automatically repeat ${recurringInfo?.interval || 'periodically'}.</p>
                  ${recurringInfo?.nextPayment ? `<p style="margin: 5px 0 0 0; font-size: 14px;">Next payment due: ${recurringInfo.nextPayment}</p>` : ''}
                </div>
              ` : ''}
            </div>

            <div style="text-align: center;">
              <a href="${data.whitelabelUrl}/billing" class="button">View & Pay Invoice</a>
            </div>

            <div class="footer">
              <p>If you have any questions about this invoice, please contact us at ${data.partnerEmail}</p>
              <p>This is an automated message from ${data.partnerBusinessName}</p>
            </div>
          </div>
        </body>
      </html>
    `;
  }

  private generatePaymentConfirmationEmailHtml(data: PaymentEmailData): string {
    // Convert cents to dollars for display
    const paymentAmountInDollars = data.paymentAmount / 100;
    const formattedAmount = new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: data.currency.toUpperCase(),
    }).format(paymentAmountInDollars);

    const formattedDate = new Intl.DateTimeFormat('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(data.paidAt));

    // Format recurring information
    const isRecurring = data.type === 'recurring';
    const recurringInfo = isRecurring ? {
      interval: data.recurringInterval,
      nextPayment: data.nextPaymentDate ? new Intl.DateTimeFormat('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      }).format(new Date(data.nextPaymentDate)) : null
    } : null;

    return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Payment Confirmation - ${data.invoiceNumber}</title>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: #d4edda; padding: 20px; border-radius: 8px; margin-bottom: 20px; border: 1px solid #c3e6cb; }
            .payment-details { background: #fff; border: 1px solid #e9ecef; border-radius: 8px; padding: 20px; margin: 20px 0; }
            .amount { font-size: 24px; font-weight: bold; color: #28a745; }
            .success-icon { color: #28a745; font-size: 48px; text-align: center; margin-bottom: 20px; }
            .footer { margin-top: 30px; padding-top: 20px; border-top: 1px solid #e9ecef; font-size: 14px; color: #6c757d; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="success-icon">✓</div>
            <div class="header">
              <h1>Payment Received - Thank You!</h1>
              <p>Hello ${data.customerName},</p>
              <p>We have successfully received your payment for invoice ${data.invoiceNumber}.</p>
            </div>

            <div class="payment-details">
              <h2>Payment Details</h2>
              <p><strong>Invoice Number:</strong> ${data.invoiceNumber}</p>
              <p><strong>Title:</strong> ${data.title}</p>
              <p><strong>Amount Paid:</strong> <span class="amount">${formattedAmount}</span></p>
              <p><strong>Payment Date:</strong> ${formattedDate}</p>
              <p><strong>Status:</strong> <span style="color: #28a745; font-weight: bold;">PAID</span></p>
              ${isRecurring ? `
                <div style="background: #f8f9fa; padding: 15px; border-radius: 6px; margin: 15px 0; border-left: 4px solid #6f42c1;">
                  <p style="margin: 0; color: #6f42c1; font-weight: bold;">🔄 Recurring Payment</p>
                  <p style="margin: 5px 0 0 0; font-size: 14px;">This was a recurring payment that will automatically repeat ${recurringInfo?.interval || 'periodically'}.</p>
                  ${recurringInfo?.nextPayment ? `<p style="margin: 5px 0 0 0; font-size: 14px;">Your next payment is scheduled for: ${recurringInfo.nextPayment}</p>` : ''}
                </div>
              ` : ''}
            </div>

            <div class="footer">
              <p>Thank you for your business! If you need a receipt or have any questions, please contact us at ${data.partnerEmail}</p>
              <p>This is an automated confirmation from ${data.partnerBusinessName}</p>
            </div>
          </div>
        </body>
      </html>
    `;
  }

  async sendInvoiceNotification(invoiceId: string): Promise<boolean> {
    try {
      // Get invoice details with customer and partner information
      const invoice = await prisma.invoice.findUnique({
        where: { id: invoiceId },
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

      if (!invoice) {
        throw new Error('Invoice not found');
      }

      // Get email configuration for the partner
      const emailConfig = await this.getPartnerEmailConfig(invoice.partnerId);

      // Determine whitelabel URL
      const whitelabelUrl = invoice.partner.customDomainVerified && invoice.partner.customDomain
        ? `https://${invoice.partner.customDomain}`
        : `https://${invoice.partner.subdomain}.knotie-ai.pro`;

      // Prepare email data
      const emailData: InvoiceEmailData = {
        invoiceId: invoice.id,
        invoiceNumber: invoice.invoiceNumber,
        title: invoice.title,
        description: invoice.description || undefined,
        amount: invoice.amount,
        currency: invoice.currency,
        dueDate: invoice.dueDate || undefined,
        customerName: `${invoice.customer.firstName || ''} ${invoice.customer.lastName || ''}`.trim() || 'Customer',
        customerEmail: invoice.customer.email,
        partnerBusinessName: invoice.partner.businessName || 'Business',
        partnerEmail: invoice.partner.emailAddress || '',
        whitelabelUrl,
        type: invoice.type || undefined,
        recurringInterval: invoice.recurringInterval || undefined,
        nextPaymentDate: invoice.nextPaymentDate || undefined,
      };

      // Try SMTP first, fallback to main email system
      if (emailConfig) {
        // Use SMTP
        const transporter = await this.createTransporter(emailConfig);
        const mailOptions = {
          from: `"${emailConfig.fromName}" <${emailConfig.fromEmail}>`,
          to: emailData.customerEmail,
          subject: `New Invoice ${emailData.invoiceNumber} from ${emailData.partnerBusinessName}`,
          html: this.generateInvoiceSentEmailHtml(emailData),
        };
        await transporter.sendMail(mailOptions);
        logger.info('Invoice notification sent via SMTP', {
          operation: 'invoice_email',
          customerEmail: emailData.customerEmail,
          invoiceNumber: emailData.invoiceNumber
        });
      } else {
        // Fallback to main email system (SendGrid/AWS SES) with partner settings
        const partnerData = (this as any)._lastPartnerData;
        const partnerSmtpSettings = partnerData ? this.buildPartnerSmtpSettings(partnerData) : undefined;

        logger.info('Using main email system for invoice notification', {
          operation: 'invoice_email',
          customerEmail: emailData.customerEmail,
          partnerBusinessName: emailData.partnerBusinessName,
          invoiceNumber: emailData.invoiceNumber,
          hasSESConfig: !!partnerSmtpSettings?.sesDomainEnabled
        });

        const emailResult = await sendEmail({
          to: emailData.customerEmail,
          subject: `New Invoice ${emailData.invoiceNumber} from ${emailData.partnerBusinessName}`,
          html: this.generateInvoiceSentEmailHtml(emailData),
          from: partnerSmtpSettings?.sesFromEmail || partnerSmtpSettings?.smtpFromEmail,
          fromName: partnerSmtpSettings?.sesFromName || partnerSmtpSettings?.smtpFromName || emailData.partnerBusinessName,
          partnerId: invoice.partnerId,
          customerId: invoice.customer.id,
          emailType: 'invoice_notification'
        }, partnerSmtpSettings);

        logger.info('Invoice notification sent via main email system', {
          operation: 'invoice_email',
          customerEmail: emailData.customerEmail,
          emailResult
        });
      }

      return true;
    } catch (error) {
      logger.error('Error sending invoice notification', error as Error, {
        operation: 'invoice_email',
        invoiceId
      });
      return false;
    }
  }

  async sendPaymentConfirmation(invoiceId: string, paymentAmount: number): Promise<boolean> {
    try {
      // Get invoice details with customer and partner information
      const invoice = await prisma.invoice.findUnique({
        where: { id: invoiceId },
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
              // Email configuration for SES/SMTP priority
              useCustomSmtp: true,
              smtpHost: true,
              smtpPort: true,
              smtpUsername: true,
              smtpPassword: true,
              smtpFromEmail: true,
              smtpFromName: true,
              sesDomainEnabled: true,
              useSESDomain: true,
              sesDomain: true,
              sesDomainStatus: true,
              sesFromEmail: true,
              sesFromName: true,
            },
          },
        },
      });

      if (!invoice) {
        throw new Error('Invoice not found');
      }

      // Determine whitelabel URL
      const whitelabelUrl = invoice.partner.customDomainVerified && invoice.partner.customDomain
        ? `https://${invoice.partner.customDomain}`
        : `https://${invoice.partner.subdomain}.knotie-ai.pro`;

      // Prepare email data for centralized email service
      const emailData = {
        partnerId: invoice.partnerId,
        customerId: invoice.customer.id,
        to: invoice.customer.email,
        subject: `Payment Confirmation - Invoice ${invoice.invoiceNumber}`,
        html: this.generatePaymentConfirmationEmailHtml({
          invoiceId: invoice.id,
          invoiceNumber: invoice.invoiceNumber,
          title: invoice.title,
          description: invoice.description || undefined,
          amount: invoice.amount,
          currency: invoice.currency,
          dueDate: invoice.dueDate || undefined,
          customerName: `${invoice.customer.firstName || ''} ${invoice.customer.lastName || ''}`.trim() || 'Customer',
          customerEmail: invoice.customer.email,
          partnerBusinessName: invoice.partner.businessName || 'Business',
          partnerEmail: invoice.partner.emailAddress || '',
          whitelabelUrl,
          paidAt: invoice.paidAt || new Date(),
          paymentAmount,
          type: invoice.type || undefined,
          recurringInterval: invoice.recurringInterval || undefined,
          nextPaymentDate: invoice.nextPaymentDate || undefined,
        }),
        emailType: 'payment_confirmation'
      };

      // Build partner SMTP settings for SES → SMTP → SendGrid priority
      const partnerSmtpSettings = this.buildPartnerSmtpSettings(invoice.partner);

      // If partner has SMTP configured (not SES), decrypt password
      if (partnerSmtpSettings?.useCustomSmtp && invoice.partner.smtpPassword) {
        partnerSmtpSettings.smtpPassword = await decrypt(invoice.partner.smtpPassword);
      }

      // Use centralized email service that handles credit deduction
      const { sendEmail } = await import('../email');
      const result = await sendEmail({
        ...emailData,
        from: partnerSmtpSettings?.sesFromEmail || partnerSmtpSettings?.smtpFromEmail,
        fromName: partnerSmtpSettings?.sesFromName || partnerSmtpSettings?.smtpFromName || invoice.partner.businessName,
      }, partnerSmtpSettings);

      if (result.success) {
        logger.info('Payment confirmation sent successfully', {
          operation: 'invoice_email',
          customerEmail: invoice.customer.email,
          invoiceId: invoice.id
        });
        return true;
      } else {
        const errorMessage = 'error' in result ? result.error : 'Unknown error occurred';
        logger.error('Failed to send payment confirmation', new Error(errorMessage), {
          operation: 'invoice_email',
          invoiceId: invoice.id
        });
        return false;
      }
    } catch (error) {
      logger.error('Error sending payment confirmation', error as Error, {
        operation: 'invoice_email',
        invoiceId
      });
      return false;
    }
  }
}

export const invoiceEmailService = new InvoiceEmailService();
