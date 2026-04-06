import { prisma } from '@/lib/prisma';
import { sendEmail } from '@/lib/email';
import { decrypt } from '@/lib/encryption';
import { logger } from '@/lib/logger';

interface PaymentConfirmationParams {
  customerId: string;
  partnerId: string;
  planId: string;
  subscriptionId?: string;
  trialEnd?: Date | null;
}

/**
 * Send payment confirmation email with login credentials and plan details
 * Includes partner branding and handles different email providers (SES/SMTP/SendGrid)
 */
export async function sendPaymentConfirmationEmail(params: PaymentConfirmationParams): Promise<boolean> {
  try {
    const { customerId, partnerId, planId, subscriptionId, trialEnd } = params;

    logger.info('Sending payment confirmation email', {
      operation: 'send-payment-confirmation-email',
      customerId,
      partnerId,
      planId
    });

    // Get customer, partner, and plan details
    const [customer, partner, plan] = await Promise.all([
      prisma.customer.findUnique({
        where: { id: customerId },
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true
        }
      }),
      prisma.partner.findUnique({
        where: { id: partnerId },
        select: {
          id: true,
          businessName: true,
          logo: true,
          primaryColor: true,
          customDomain: true,
          customDomainVerified: true,
          subdomain: true,
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
          sesFromName: true
        }
      }),
      prisma.subscriptionPlan.findUnique({
        where: { id: planId },
        select: {
          id: true,
          name: true,
          amount: true,
          currency: true,
          interval: true,
          trialPeriodDays: true
        }
      })
    ]);

    if (!customer || !partner || !plan) {
      logger.error('Missing required data for payment confirmation email', new Error('Data not found'), {
        operation: 'send-payment-confirmation-email',
        hasCustomer: !!customer,
        hasPartner: !!partner,
        hasPlan: !!plan,
        customerId,
        partnerId,
        planId
      });
      return false;
    }

    // Get customer credentials for login URL
    const customerCredential = await prisma.customerCredential.findFirst({
      where: {
        customerId,
        partnerId
      },
      select: {
        email: true
      }
    });

    if (!customerCredential) {
      logger.error('Customer credentials not found', new Error('Credentials not found'), {
        operation: 'send-payment-confirmation-email',
        customerId,
        partnerId
      });
      return false;
    }

    // Determine the portal URL
    const baseUrl = partner.customDomainVerified && partner.customDomain
      ? `https://${partner.customDomain}`
      : `https://${partner.subdomain}.knotie-ai.pro`;

    // Build login URL - respect ENABLE_PLATFORM_URLS for consistent user experience (BUG 10 fix)
    const enablePlatformUrls = process.env.ENABLE_PLATFORM_URLS === 'true';
    const loginPath = enablePlatformUrls ? '/platform/login' : '/whitelabel/login';
    const loginUrl = `${baseUrl}${loginPath}`;

    // Format amount
    const formattedAmount = (plan.amount / 100).toFixed(2);
    const currencySymbols: Record<string, string> = {
      usd: '$',
      eur: '€',
      gbp: '£',
      cad: '$',
      aud: '$'
    };
    const currencySymbol = currencySymbols[plan.currency.toLowerCase()] || plan.currency.toUpperCase();

    // Determine if this is a trial
    const isTrial = trialEnd && new Date(trialEnd) > new Date();
    const trialEndDate = trialEnd ? new Date(trialEnd).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    }) : null;

    // Prepare email settings
    let partnerSmtpSettings;

    if (partner.sesDomainEnabled && partner.useSESDomain && partner.sesDomainStatus === 'verified') {
      partnerSmtpSettings = {
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
    } else if (partner.useCustomSmtp && partner.smtpHost && partner.smtpUsername && partner.smtpPassword) {
      const decryptedPassword = await decrypt(partner.smtpPassword);
      partnerSmtpSettings = {
        useCustomSmtp: true,
        smtpHost: partner.smtpHost,
        smtpPort: partner.smtpPort || 587,
        smtpUsername: partner.smtpUsername,
        smtpPassword: decryptedPassword,
        smtpFromEmail: partner.smtpFromEmail || 'noreply@knotie-ai.pro',
        smtpFromName: partner.smtpFromName || partner.businessName,
        sesDomainEnabled: false,
        useSESDomain: false,
        sesDomain: undefined,
        sesDomainStatus: undefined,
        sesFromEmail: undefined,
        sesFromName: undefined
      };
    }

    // Create HTML email content
    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${isTrial ? 'Trial Started' : 'Payment Confirmed'} - ${partner.businessName}</title>
      </head>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f4f4f4;">
        <div style="background-color: white; border-radius: 10px; overflow: hidden; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
          <!-- Header -->
          <div style="background: linear-gradient(135deg, ${partner.primaryColor || '#3B82F6'}, ${partner.primaryColor || '#3B82F6'}dd); padding: 40px 30px; text-align: center;">
            ${partner.logo ? `<img src="${partner.logo}" alt="${partner.businessName}" style="max-width: 120px; height: auto; margin-bottom: 20px;">` : ''}
            <h1 style="color: white; margin: 0; font-size: 28px;">${isTrial ? '🎉 Trial Started!' : '✓ Payment Confirmed'}</h1>
          </div>

          <!-- Content -->
          <div style="padding: 40px 30px;">
            <p style="font-size: 16px; margin-bottom: 20px;">
              Hi ${customer.firstName || 'there'},
            </p>

            ${isTrial ? `
              <p style="font-size: 16px; margin-bottom: 20px;">
                Great news! Your <strong>${plan.trialPeriodDays}-day trial</strong> for <strong>${plan.name}</strong> has started successfully.
              </p>
              
              <div style="background-color: #fef3c7; border-left: 4px solid #f59e0b; padding: 20px; margin: 25px 0; border-radius: 5px;">
                <p style="margin: 0; color: #92400e; font-size: 14px;">
                  <strong>Trial ends on ${trialEndDate}</strong><br>
                  Your card will be charged ${currencySymbol}${formattedAmount} ${plan.interval}ly after the trial period.
                </p>
              </div>
            ` : `
              <p style="font-size: 16px; margin-bottom: 20px;">
                Thank you for subscribing to <strong>${plan.name}</strong>! Your payment has been processed successfully.
              </p>
            `}

            <!-- Subscription Details -->
            <div style="background-color: #f8f9fa; padding: 25px; border-radius: 8px; margin: 25px 0;">
              <h2 style="margin-top: 0; color: ${partner.primaryColor || '#3B82F6'}; font-size: 20px;">Subscription Details</h2>
              <table style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td style="padding: 10px 0; border-bottom: 1px solid #e5e7eb; color: #666;">Plan:</td>
                  <td style="padding: 10px 0; border-bottom: 1px solid #e5e7eb; font-weight: bold; text-align: right;">${plan.name}</td>
                </tr>
                <tr>
                  <td style="padding: 10px 0; border-bottom: 1px solid #e5e7eb; color: #666;">Amount:</td>
                  <td style="padding: 10px 0; border-bottom: 1px solid #e5e7eb; font-weight: bold; text-align: right;">${currencySymbol}${formattedAmount}/${plan.interval}</td>
                </tr>
                ${isTrial ? `
                <tr>
                  <td style="padding: 10px 0; border-bottom: 1px solid #e5e7eb; color: #666;">Trial Period:</td>
                  <td style="padding: 10px 0; border-bottom: 1px solid #e5e7eb; font-weight: bold; text-align: right;">${plan.trialPeriodDays} days</td>
                </tr>
                <tr>
                  <td style="padding: 10px 0; color: #666;">Trial Ends:</td>
                  <td style="padding: 10px 0; font-weight: bold; text-align: right;">${trialEndDate}</td>
                </tr>
                ` : ''}
              </table>
            </div>

            <!-- Login Credentials -->
            <div style="background-color: #e0f2fe; padding: 25px; border-radius: 8px; margin: 25px 0;">
              <h2 style="margin-top: 0; color: #0369a1; font-size: 20px;">Access Your Dashboard</h2>
              <p style="margin-bottom: 20px; color: #0c4a6e;">
                You can now log in to your dashboard using the credentials below:
              </p>
              <div style="background-color: white; padding: 15px; border-radius: 5px; margin-bottom: 20px;">
                <p style="margin: 5px 0; color: #666; font-size: 14px;"><strong>Email:</strong> ${customerCredential.email}</p>
                <p style="margin: 5px 0; color: #666; font-size: 14px;"><strong>Password:</strong> [Your chosen password]</p>
              </div>
              <div style="text-align: center;">
                <a href="${loginUrl}" style="display: inline-block; background-color: ${partner.primaryColor || '#3B82F6'}; color: white; padding: 15px 35px; text-decoration: none; border-radius: 5px; font-weight: bold; font-size: 16px;">Login to Dashboard</a>
              </div>
            </div>

            <!-- Next Steps -->
            <div style="margin: 30px 0;">
              <h3 style="color: #333; font-size: 18px; margin-bottom: 15px;">What's Next?</h3>
              <ul style="color: #666; line-height: 1.8; padding-left: 20px;">
                <li>Log in to your dashboard to get started</li>
                <li>Explore all the features included in your plan</li>
                <li>Contact support if you need any assistance</li>
                ${isTrial ? '<li>Remember to cancel before the trial ends if you don\'t want to continue</li>' : ''}
              </ul>
            </div>

            <p style="font-size: 16px; margin-top: 30px;">
              If you have any questions, feel free to reach out to our support team.
            </p>

            <p style="font-size: 16px; margin-top: 20px;">
              Best regards,<br>
              <strong>${partner.businessName} Team</strong>
            </p>
          </div>

          <!-- Footer -->
          <div style="background-color: #f8f9fa; padding: 20px 30px; text-align: center; border-top: 1px solid #e5e7eb;">
            <p style="margin: 0; color: #666; font-size: 12px;">
              This email was sent by ${partner.businessName}
            </p>
          </div>
        </div>
      </body>
      </html>
    `;

    // Send email
    await sendEmail({
      to: customer.email,
      subject: isTrial 
        ? `Your ${plan.trialPeriodDays}-Day Trial Has Started - ${partner.businessName}`
        : `Payment Confirmed - Welcome to ${plan.name}!`,
      html: htmlContent,
      from: partnerSmtpSettings?.smtpFromEmail || partnerSmtpSettings?.sesFromEmail,
      fromName: partnerSmtpSettings?.smtpFromName || partnerSmtpSettings?.sesFromName || partner.businessName,
      partnerId,
      customerId,
      emailType: 'payment_confirmation'
    }, partnerSmtpSettings);

    logger.info('Payment confirmation email sent successfully', {
      operation: 'send-payment-confirmation-email',
      customerId,
      partnerId,
      email: customer.email
    });

    return true;
  } catch (error) {
    logger.error(
      'Failed to send payment confirmation email',
      error instanceof Error ? error : new Error(String(error)),
      {
        operation: 'send-payment-confirmation-email',
        customerId: params.customerId,
        partnerId: params.partnerId
      }
    );
    return false;
  }
}
