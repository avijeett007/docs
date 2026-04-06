import { sendEmail, getPartnerEmailSettings } from '@/lib/email';
import { generateReceiptHTML } from '../email-templates/receipt-template';
import { logger } from '@/lib/logger';

interface ReceiptEmailData {
  customerName: string;
  customerEmail: string;
  businessName: string;
  amount: number;
  couponCode: string;
  couponName: string;
  transactionId: string;
  invoiceNumber?: string;
  date: string;
  receiptUrl?: string;
  invoiceUrl?: string;
}

class EmailService {
  constructor() {
    // Validate required environment variables
    if (!process.env.SENDGRID_API_KEY) {
      throw new Error('SENDGRID_API_KEY is required for email service');
    }

    if (!process.env.SENDGRID_FROM_EMAIL) {
      logger.warn('SENDGRID_FROM_EMAIL not set, using default fallback', {
        operation: 'email_service'
      });
    }

    // Use existing SendGrid configuration from src/lib/email.ts
    logger.info('EmailService initialized using existing SendGrid setup', {
      operation: 'email_service'
    });
  }

  async sendReceiptEmail(data: ReceiptEmailData): Promise<boolean> {
    try {
      const htmlContent = generateReceiptHTML(data);

      // Use your existing sendEmail function
      await sendEmail({
        to: data.customerEmail,
        from: process.env.SENDGRID_FROM_EMAIL || 'noreply@knotie-ai.pro',
        fromName: 'Knotie AI Pro',
        subject: `🎉 Payment Confirmed - Your Knotie AI Pro Lifetime Access is Ready!`,
        html: htmlContent,
      });

      logger.info('Receipt email sent successfully', {
        operation: 'email_service',
        emailType: 'receipt',
        to: data.customerEmail
      });
      return true;
    } catch (error) {
      logger.error('Failed to send receipt email', error as Error, {
        operation: 'email_service',
        emailType: 'receipt',
        to: data.customerEmail
      });
      return false;
    }
  }

  async sendWelcomeEmail(data: {
    customerEmail: string;
    businessName: string;
    loginUrl: string;
  }): Promise<boolean> {
    try {
      const htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <title>Welcome to Knotie AI Pro</title>
            <style>
                body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
                .container { background: white; border-radius: 12px; padding: 40px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1); }
                .header { text-align: center; margin-bottom: 30px; }
                .logo { font-size: 28px; font-weight: bold; color: #3b82f6; margin-bottom: 10px; }
                .button { display: inline-block; background: linear-gradient(135deg, #3b82f6, #1d4ed8); color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; font-weight: 600; margin: 20px 0; }
                .features { background: #f8fafc; padding: 20px; border-radius: 8px; margin: 20px 0; }
                .feature-list { list-style: none; padding: 0; }
                .feature-list li { padding: 8px 0; }
                .feature-list li:before { content: "🚀"; margin-right: 10px; }
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <div class="logo">🎯 Knotie AI Pro</div>
                    <h1>Welcome to Your Lifetime Access!</h1>
                </div>
                
                <p>Hi ${data.businessName},</p>
                
                <p>🎉 <strong>Congratulations!</strong> Your Knotie AI Pro lifetime access is now active and ready to use.</p>
                
                <div style="text-align: center;">
                    <a href="${data.loginUrl}" class="button">🎯 Access Your Dashboard</a>
                </div>
                
                <div class="features">
                    <h3>🚀 What You Can Do Now:</h3>
                    <ul class="feature-list">
                        <li>Create unlimited AI voice agents</li>
                        <li>Connect with VAPI, Retell, and Ultravox</li>
                        <li>Set up your white-label partner portal</li>
                        <li>Manage customers and track analytics</li>
                        <li>Access our comprehensive API</li>
                    </ul>
                </div>
                
                <p><strong>Need Help Getting Started?</strong></p>
                <p>Our team is here to help you succeed. Contact us at <a href="mailto:support@knotie-ai.pro">support@knotie-ai.pro</a> for any questions.</p>
                
                <p>Welcome to the future of AI voice technology!</p>
                
                <p>Best regards,<br>The Knotie AI Pro Team</p>
            </div>
        </body>
        </html>
      `;

      // Use your existing sendEmail function
      await sendEmail({
        to: data.customerEmail,
        from: process.env.SENDGRID_FROM_EMAIL || 'noreply@knotie-ai.pro',
        fromName: 'Knotie AI Pro',
        subject: `🚀 Welcome to Knotie AI Pro - Your Lifetime Access is Ready!`,
        html: htmlContent,
      });

      logger.info('Welcome email sent successfully', {
        operation: 'email_service',
        emailType: 'welcome',
        to: data.customerEmail
      });
      return true;
    } catch (error) {
      logger.error('Failed to send welcome email', error as Error, {
        operation: 'email_service',
        emailType: 'welcome',
        to: data.customerEmail
      });
      return false;
    }
  }

  async testConnection(): Promise<boolean> {
    try {
      // SendGrid doesn't have a direct connection test, but we can check if API key is set
      if (!process.env.SENDGRID_API_KEY) {
        throw new Error('SENDGRID_API_KEY not configured');
      }

      logger.info('SendGrid email service configured', {
        operation: 'email_service'
      });
      return true;
    } catch (error) {
      logger.error('SendGrid email service configuration failed', error as Error, {
        operation: 'email_service'
      });
      return false;
    }
  }

  /**
   * Send whitelabel signup email to customer
   * Uses partner's email settings (SMTP → SES → Platform default)
   */
  async sendWhitelabelSignupEmail(data: {
    to: string;
    firstName: string;
    businessName: string;
    temporaryPassword: string;
    loginUrl: string;
    partnerId?: string; // Added to fetch partner email settings
    partnerBranding?: {
      logo?: string;
      primaryColor?: string;
      secondaryColor?: string;
      businessName: string;
    };
  }): Promise<boolean> {
    try {
      const branding = data.partnerBranding;
      const primaryColor = branding?.primaryColor || '#3b82f6';
      const secondaryColor = branding?.secondaryColor || '#1d4ed8';

      // Fetch partner email settings if partnerId is provided
      const partnerEmailSettings = data.partnerId
        ? await getPartnerEmailSettings(data.partnerId, branding?.businessName || 'AI Voice Assistant')
        : undefined;

      const htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <title>Welcome to ${branding?.businessName || 'AI Voice Assistant'}</title>
            <style>
                body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; background: #f8fafc; }
                .container { background: white; border-radius: 12px; padding: 40px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1); }
                .header { text-align: center; margin-bottom: 30px; }
                .logo { max-width: 150px; height: auto; margin-bottom: 20px; }
                .title { font-size: 28px; font-weight: bold; color: ${primaryColor}; margin-bottom: 10px; }
                .button { display: inline-block; background: linear-gradient(135deg, ${primaryColor}, ${secondaryColor}); color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; font-weight: 600; margin: 20px 0; }
                .credentials { background: #f8fafc; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid ${primaryColor}; }
                .password { font-family: monospace; font-size: 18px; font-weight: bold; color: ${primaryColor}; background: white; padding: 10px; border-radius: 4px; border: 2px solid ${primaryColor}; }
                .warning { background: #fef3cd; padding: 15px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #f59e0b; }
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    ${branding?.logo ? `<img src="${branding.logo}" alt="${branding.businessName}" class="logo">` : ''}
                    <div class="title">Welcome to ${branding?.businessName || 'AI Voice Assistant'}!</div>
                    <h2>Your Account is Ready</h2>
                </div>

                <p>Hi ${data.firstName},</p>

                <p>🎉 Great news! Your AI voice assistant account has been created and is ready to use.</p>

                <div class="credentials">
                    <h3>🔐 Your Login Credentials:</h3>
                    <p><strong>Email:</strong> ${data.to}</p>
                    <p><strong>Temporary Password:</strong></p>
                    <div class="password">${data.temporaryPassword}</div>
                </div>

                <div style="text-align: center;">
                    <a href="${data.loginUrl}" class="button">🚀 Login to Your Dashboard</a>
                </div>

                <div class="warning">
                    <p><strong>⚠️ Important Security Notice:</strong></p>
                    <p>This is a temporary password. You'll be prompted to create a new, secure password when you first log in.</p>
                </div>

                <p><strong>What's Next?</strong></p>
                <p>Once you log in, you can:</p>
                <ul>
                    <li>✅ Complete your AI voice assistant setup</li>
                    <li>✅ Continue your onboarding journey</li>
                    <li>✅ Access your personalized dashboard</li>
                    <li>✅ Start using your AI assistant</li>
                </ul>

                <p><strong>Need Help?</strong></p>
                <p>If you have any questions or need assistance, don't hesitate to reach out to our support team.</p>

                <p>Welcome aboard!</p>

                <p>Best regards,<br>The ${branding?.businessName || 'AI Voice Assistant'} Team</p>
            </div>
        </body>
        </html>
      `;

      // Use partner email settings if available, otherwise fall back to platform default
      await sendEmail({
        to: data.to,
        from: partnerEmailSettings?.smtpFromEmail || partnerEmailSettings?.sesFromEmail || process.env.SENDGRID_FROM_EMAIL || 'noreply@knotie-ai.pro',
        fromName: partnerEmailSettings?.smtpFromName || partnerEmailSettings?.sesFromName || branding?.businessName || 'AI Voice Assistant',
        subject: `🎉 Welcome to ${branding?.businessName || 'AI Voice Assistant'} - Your Account is Ready!`,
        html: htmlContent,
        partnerId: data.partnerId,
        emailType: 'whitelabel_signup',
      }, partnerEmailSettings);

      const emailSystem = partnerEmailSettings?.useCustomSmtp
        ? 'partner_smtp'
        : (partnerEmailSettings?.useSESDomain ? 'partner_ses' : 'platform_default');

      logger.info('Whitelabel signup email sent successfully', {
        operation: 'email_service',
        emailType: 'whitelabel_signup',
        to: data.to,
        emailSystem
      });
      return true;
    } catch (error) {
      logger.error('Failed to send whitelabel signup email', error as Error, {
        operation: 'email_service',
        emailType: 'whitelabel_signup',
        to: data.to
      });
      return false;
    }
  }
}

export const emailService = new EmailService();

// Export the function for direct use
export const sendWhitelabelSignupEmail = (data: {
  to: string;
  firstName: string;
  businessName: string;
  temporaryPassword: string;
  loginUrl: string;
  partnerId?: string; // Added to fetch partner email settings
  partnerBranding?: {
    logo?: string;
    primaryColor?: string;
    secondaryColor?: string;
    businessName: string;
  };
}) => emailService.sendWhitelabelSignupEmail(data);

export type { ReceiptEmailData };
