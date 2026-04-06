import { prisma } from '@/lib/prisma';
import { sendEmail, EmailData } from '@/lib/email';
import { CreditService } from '@/lib/services/creditService';
import { logger } from '../logger';

interface Customer {
  id: string;
  email: string;
  firstName?: string | null;
  lastName?: string | null;
  creditBalance: number;
  lowCreditThreshold?: number | null;
  lowCreditNotificationsEnabled: boolean;
  userOnboarding?: {
    partnerId: string | null;
    partner: Partner | null;
  }[];
}

interface Partner {
  id: string;
  businessName: string;
  customDomain?: string | null;
  customDomainVerified?: boolean;
  subdomain?: string | null;
  // Credit settings
  creditBalance: number;
  fractionalCredits?: number | null;
  lowCreditNotificationsEnabled?: boolean;
  emailAddress?: string | null;
  // SMTP settings
  useCustomSmtp?: boolean;
  smtpHost?: string | null;
  smtpPort?: number | null;
  smtpUsername?: string | null;
  smtpPassword?: string | null;
  smtpFromEmail?: string | null;
  smtpFromName?: string | null;
  // SES Domain Email Service settings
  sesDomain?: string | null;
  sesDomainStatus?: string | null;
  sesDomainEnabled?: boolean;
  useSESDomain?: boolean;
  sesFromEmail?: string | null;
  sesFromName?: string | null;
}

/**
 * Check if customer's credit balance is at or below threshold and send notification if needed
 */
export async function checkAndSendLowCreditNotification(
  customerId: string,
  newCreditBalance: number
): Promise<{ sent: boolean; reason?: string }> {
  try {
    // Get customer with notification settings
    const customer = await prisma.customer.findUnique({
      where: { id: customerId },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        creditBalance: true,
        lowCreditThreshold: true,
        lowCreditNotificationsEnabled: true,
        userOnboarding: {
          select: {
            partnerId: true,
            partner: {
              select: {
                id: true,
                businessName: true,
                customDomain: true,
                customDomainVerified: true,
                subdomain: true,
                // Credit settings for partner notifications
                creditBalance: true,
                fractionalCredits: true,
                lowCreditNotificationsEnabled: true,
                emailAddress: true,
                // SMTP/SES settings for email sending
                useCustomSmtp: true,
                smtpHost: true,
                smtpPort: true,
                smtpUsername: true,
                smtpPassword: true,
                smtpFromEmail: true,
                smtpFromName: true,
                // SES Domain Email Service settings
                sesDomain: true,
                sesDomainStatus: true,
                sesDomainEnabled: true,
                useSESDomain: true,
                sesFromEmail: true,
                sesFromName: true,
              }
            }
          }
        }
      }
    });

    if (!customer) {
      return { sent: false, reason: 'Customer not found' };
    }

    // Get partner info from userOnboarding relationship
    const userOnboarding = customer.userOnboarding?.[0];
    if (!userOnboarding) {
      return { sent: false, reason: 'No partner relationship found' };
    }

    const partner = userOnboarding.partner;
    if (!partner) {
      return { sent: false, reason: 'Partner not found' };
    }

    // Check partner credit balance before sending customer notification
    const partnerCreditCheck = await checkPartnerCreditBalance(partner);
    if (!partnerCreditCheck.canSendEmails) {
      return { sent: false, reason: partnerCreditCheck.reason };
    }

    // Check if notifications are enabled
    if (!customer.lowCreditNotificationsEnabled) {
      return { sent: false, reason: 'Low credit notifications disabled' };
    }

    // Check if threshold is set
    const threshold = customer.lowCreditThreshold;
    if (!threshold || threshold <= 0) {
      return { sent: false, reason: 'No low credit threshold set' };
    }

    // Check if balance is at or below threshold
    if (newCreditBalance > threshold) {
      return { sent: false, reason: `Balance ${newCreditBalance} is above threshold ${threshold}` };
    }

    // Check if we've already sent 5 notifications today (daily limit)
    const today = new Date();
    today.setHours(0, 0, 0, 0); // Start of today

    const notificationsToday = await prisma.emailLog.count({
      where: {
        partnerId: userOnboarding.partnerId || '',
        customerId: customer.id,
        emailType: 'low_credit_notification',
        sentAt: {
          gte: today
        }
      }
    });

    if (notificationsToday >= 5) {
      return { sent: false, reason: `Daily notification limit reached (${notificationsToday}/5 notifications sent today)` };
    }

    // Send the notification
    if (!userOnboarding.partnerId || !partner) {
      return { sent: false, reason: 'Partner information missing' };
    }

    await sendLowCreditNotificationEmail(customer, partner, userOnboarding.partnerId, newCreditBalance);

    // After sending customer notification, check if partner needs notification due to credit deduction
    await checkAndSendPartnerLowCreditNotification(userOnboarding.partnerId, partner);

    return { sent: true };

  } catch (error) {
    logger.error('Error checking/sending low credit notification', error as Error, {
      operation: 'low_credit_notification',
      customerId
    });
    return { sent: false, reason: `Error: ${error instanceof Error ? error.message : 'Unknown error'}` };
  }
}

/**
 * Send low credit notification email to customer
 */
async function sendLowCreditNotificationEmail(
  customer: Customer,
  partner: Partner,
  partnerId: string,
  currentBalance: number
): Promise<void> {
  const customerName = `${customer.firstName || ''} ${customer.lastName || ''}`.trim() || 'Valued Customer';
  const partnerName = partner.businessName || 'Your AI Provider';
  const threshold = customer.lowCreditThreshold || 0;

  // Construct whitelabel portal URL for recharge button
  let rechargeUrl = 'https://custom.knotie-ai.pro/whitelabel/billing';
  if (partner.customDomain && partner.customDomainVerified) {
    rechargeUrl = `https://${partner.customDomain}/whitelabel/billing`;
  } else if (partner.subdomain) {
    rechargeUrl = `https://${partner.subdomain}.knotie-ai.pro/whitelabel/billing`;
  } else {
    rechargeUrl = `https://knotie-ai.pro/whitelabel/billing?partner=${partnerId}`;
  }

  // Construct unsubscribe URL
  let unsubscribeUrl = 'https://custom.knotie-ai.pro/unsubscribe';
  if (partner.customDomain && partner.customDomainVerified) {
    unsubscribeUrl = `https://${partner.customDomain}/unsubscribe`;
  } else if (partner.subdomain) {
    unsubscribeUrl = `https://${partner.subdomain}.knotie-ai.pro/unsubscribe`;
  }

  // Create whitelabel email content
  const subject = `⚠️ Low AI Credit Alert - ${partnerName}`;

  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Low AI Credit Alert</title>
        <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
            .content { background: #f8f9fa; padding: 30px; border-radius: 0 0 8px 8px; }
            .alert-box { background: #fff3cd; border: 1px solid #ffeaa7; border-radius: 6px; padding: 20px; margin: 20px 0; }
            .credit-info { background: white; border-radius: 6px; padding: 20px; margin: 20px 0; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
            .button { display: inline-block; background: #667eea; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 10px 0; }
            .footer { text-align: center; color: #666; font-size: 12px; margin-top: 30px; }
            .urgent { color: #e74c3c; font-weight: bold; }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h1>⚠️ Low AI Credit Alert</h1>
                <p>Your AI credits are running low</p>
            </div>

            <div class="content">
                <p>Hello ${customerName},</p>

                <div class="alert-box">
                    <h3 style="margin-top: 0; color: #856404;">⚠️ Action Required</h3>
                    <p>Your AI credit balance has reached the low threshold. Your system may stop working if credits run out.</p>
                </div>

                <div class="credit-info">
                    <h3 style="margin-top: 0;">Current Credit Status</h3>
                    <p><strong>Current Balance:</strong> <span class="urgent">${currentBalance} credits</span></p>
                    <p><strong>Alert Threshold:</strong> ${threshold} credits</p>
                    <p><strong>Status:</strong> <span class="urgent">Low Credits - Recharge Needed</span></p>
                </div>

                <h3>What happens next?</h3>
                <ul>
                    <li>Your AI agents will continue working while you have credits</li>
                    <li>When credits reach zero, your AI system will stop responding</li>
                    <li>Recharge your credits to ensure uninterrupted service</li>
                </ul>

                <p style="text-align: center; margin: 30px 0;">
                    <a href="${rechargeUrl}" class="button">Recharge Credits Now</a>
                </p>

                <p>If you have any questions or need assistance, please contact our support team.</p>

                <p>Best regards,<br>
                <strong>${partnerName} Team</strong></p>
            </div>

            <div class="footer">
                <p>This is an automated notification from ${partnerName}.<br>
                You received this email because low credit notifications are enabled for your account.</p>
                <p style="margin-top: 15px;">
                    <a href="${unsubscribeUrl}" style="color: #666; text-decoration: none; font-size: 11px;">Unsubscribe from notifications</a> |
                    <a href="https://knotie-ai.pro/privacy-policy" style="color: #666; text-decoration: none; font-size: 11px;">Privacy Policy</a>
                </p>
            </div>
        </div>
    </body>
    </html>
  `;

  const textContent = `
Low AI Credit Alert - ${partnerName}

Hello ${customerName},

Your AI credit balance has reached the low threshold and requires immediate attention.

Current Credit Status:
- Current Balance: ${currentBalance} credits
- Alert Threshold: ${threshold} credits
- Status: Low Credits - Recharge Needed

What happens next?
- Your AI agents will continue working while you have credits
- When credits reach zero, your AI system will stop responding
- Recharge your credits to ensure uninterrupted service

Please recharge your credits as soon as possible to avoid service interruption.

If you have any questions or need assistance, please contact our support team.

Best regards,
${partnerName} Team

---
This is an automated notification from ${partnerName}.
You received this email because low credit notifications are enabled for your account.
  `;

  // Prepare partner SMTP/SES settings for email sending
  let partnerSmtpSettings;
  if (partner.useCustomSmtp && partner.smtpHost && partner.smtpUsername && partner.smtpPassword) {
    // Decrypt the SMTP password
    const { decrypt } = await import('@/lib/encryption');
    const decryptedPassword = await decrypt(partner.smtpPassword);

    partnerSmtpSettings = {
      useCustomSmtp: true,
      smtpHost: partner.smtpHost!,
      smtpPort: partner.smtpPort || 587,
      smtpUsername: partner.smtpUsername!,
      smtpPassword: decryptedPassword,
      smtpFromEmail: partner.smtpFromEmail || 'noreply@knotie-ai.pro',
      smtpFromName: partner.smtpFromName || partner.businessName,
      // SES Domain Email Service settings
      sesDomainEnabled: partner.sesDomainEnabled || false,
      useSESDomain: partner.useSESDomain || false,
      sesDomain: partner.sesDomain || undefined,
      sesDomainStatus: partner.sesDomainStatus || undefined,
      sesFromEmail: partner.sesFromEmail || undefined,
      sesFromName: partner.sesFromName || undefined,
    };
  } else if (partner.useSESDomain && partner.sesDomainEnabled && partner.sesDomainStatus === 'verified') {
    // Use SES only if configured and verified
    partnerSmtpSettings = {
      useCustomSmtp: false,
      smtpHost: '',
      smtpPort: 587,
      smtpUsername: '',
      smtpPassword: '',
      smtpFromEmail: '',
      smtpFromName: '',
      sesDomainEnabled: true,
      useSESDomain: true,
      sesDomain: partner.sesDomain || undefined,
      sesDomainStatus: partner.sesDomainStatus || undefined,
      sesFromEmail: partner.sesFromEmail || undefined,
      sesFromName: partner.sesFromName || undefined,
    };
  }

  // Send the email (this will also log and deduct Knotie credits from partner)
  const emailData: EmailData = {
    partnerId: partnerId,
    customerId: customer.id,
    to: customer.email,
    subject,
    html: htmlContent,
    text: textContent,
    emailType: 'low_credit_notification'
  };

  const result = await sendEmail(emailData, partnerSmtpSettings);

  if (!result.success) {
    const errorMessage = 'error' in result ? result.error : 'Unknown error occurred';
    throw new Error(`Failed to send low credit notification: ${errorMessage}`);
  }

  logger.info('Low credit notification sent to customer', {
    operation: 'low_credit_notification',
    customerEmail: customer.email,
    currentBalance,
    threshold
  });
}

/**
 * Check partner credit balance and determine if emails can be sent
 */
async function checkPartnerCreditBalance(partner: Partner): Promise<{
  canSendEmails: boolean;
  reason?: string;
  currentBalance?: number;
}> {
  try {
    // Calculate combined partner credit balance
    const fractionalCredits = partner.fractionalCredits || 0;
    const combinedBalance = partner.creditBalance - (fractionalCredits / 100);

    // Grace period limit is -100 credits
    const GRACE_PERIOD_LIMIT = -100;

    if (combinedBalance < GRACE_PERIOD_LIMIT) {
      return {
        canSendEmails: false,
        reason: `Partner credit balance (${combinedBalance}) is below grace period limit (${GRACE_PERIOD_LIMIT})`,
        currentBalance: combinedBalance
      };
    }

    return {
      canSendEmails: true,
      currentBalance: combinedBalance
    };
  } catch (error) {
    logger.error('Error checking partner credit balance', error as Error, {
      operation: 'low_credit_notification',
      partnerId: partner.id
    });
    // On error, allow sending to avoid blocking critical notifications
    return { canSendEmails: true };
  }
}

/**
 * Check if partner needs low credit notification and send if needed
 */
async function checkAndSendPartnerLowCreditNotification(
  partnerId: string,
  partner: Partner
): Promise<void> {
  try {
    // Check if partner has low credit notifications enabled
    if (!partner.lowCreditNotificationsEnabled || !partner.emailAddress) {
      return;
    }

    // Calculate current balance
    const fractionalCredits = partner.fractionalCredits || 0;
    const currentBalance = partner.creditBalance - (fractionalCredits / 100);

    // Determine if notification is needed
    const LOW_CREDIT_THRESHOLD = 100;
    const GRACE_PERIOD_LIMIT = -100;

    let shouldSendEmail = false;
    let emailType: 'urgent' | 'extremely_urgent' | null = null;

    if (currentBalance < 0 && currentBalance >= GRACE_PERIOD_LIMIT) {
      shouldSendEmail = true;
      emailType = 'extremely_urgent';
    } else if (currentBalance < LOW_CREDIT_THRESHOLD && currentBalance >= 0) {
      shouldSendEmail = true;
      emailType = 'urgent';
    }

    if (!shouldSendEmail || !emailType) {
      return;
    }

    // Check throttling (5 emails per day)
    const shouldSend = await shouldSendPartnerEmailNotification(partnerId, emailType);
    if (!shouldSend) {
      logger.info('Partner credit notification throttled due to daily limit', {
        operation: 'low_credit_notification',
        partnerId
      });
      return;
    }

    // Send partner notification
    await sendPartnerLowCreditNotificationEmail(
      partnerId,
      partner.emailAddress,
      partner.businessName || 'Partner',
      currentBalance,
      emailType
    );

    logger.info('Partner low credit notification sent', {
      operation: 'low_credit_notification',
      partnerEmail: partner.emailAddress,
      currentBalance
    });
  } catch (error) {
    logger.error('Error checking/sending partner low credit notification', error as Error, {
      operation: 'low_credit_notification',
      partnerId
    });
    // Don't throw error - customer notification was already sent successfully
  }
}

/**
 * Check if we should send partner email notification (throttling logic)
 */
async function shouldSendPartnerEmailNotification(
  partnerId: string,
  emailType: 'urgent' | 'extremely_urgent'
): Promise<boolean> {
  try {
    // Check if we've already sent 5 notifications today (daily limit)
    const today = new Date();
    today.setHours(0, 0, 0, 0); // Start of today

    const notificationsToday = await prisma.emailLog.count({
      where: {
        partnerId: partnerId,
        customerId: null, // Partner notifications don't have customerId
        emailType: 'partner_low_credit_notification',
        sentAt: {
          gte: today
        }
      }
    });

    if (notificationsToday >= 5) {
      return false;
    }

    return true;
  } catch (error) {
    logger.error('Error checking partner email notification throttling', error as Error, {
      operation: 'low_credit_notification',
      partnerId
    });
    // On error, allow sending to avoid blocking critical notifications
    return true;
  }
}

/**
 * Send low credit notification email to partner
 */
async function sendPartnerLowCreditNotificationEmail(
  partnerId: string,
  partnerEmail: string,
  partnerName: string,
  currentBalance: number,
  emailType: 'urgent' | 'extremely_urgent'
): Promise<void> {
  const isGracePeriod = currentBalance < 0;
  const balanceDisplay = isGracePeriod ? `${Math.abs(currentBalance)} credits overdrawn` : `${currentBalance} credits remaining`;

  const subject = emailType === 'extremely_urgent'
    ? `🚨 URGENT: Your Knotie AI Pro account is in grace period`
    : `⚠️ Low Credit Alert: Your Knotie AI Pro account needs attention`;

  try {
    // Create email content
    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${subject}</title>
      </head>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
          <h1 style="color: white; margin: 0; font-size: 28px;">Knotie AI Pro</h1>
          <p style="color: #f0f0f0; margin: 10px 0 0 0; font-size: 16px;">Credit Alert Notification</p>
        </div>

        <div style="background: #ffffff; padding: 30px; border: 1px solid #e0e0e0; border-top: none;">
          <h2 style="color: ${emailType === 'extremely_urgent' ? '#dc3545' : '#ff6b35'}; margin-top: 0;">
            ${emailType === 'extremely_urgent' ? '🚨 Urgent: Grace Period Active' : '⚠️ Low Credit Alert'}
          </h2>

          <p>Hello ${partnerName},</p>

          <p>This is an automated notification regarding your Knotie AI Pro account credit balance.</p>

          <div style="background: ${emailType === 'extremely_urgent' ? '#fff5f5' : '#fff8f0'}; border-left: 4px solid ${emailType === 'extremely_urgent' ? '#dc3545' : '#ff6b35'}; padding: 15px; margin: 20px 0;">
            <p style="margin: 0; font-weight: bold; color: ${emailType === 'extremely_urgent' ? '#dc3545' : '#ff6b35'};">
              Current Balance: ${balanceDisplay}
            </p>
          </div>

          ${emailType === 'extremely_urgent' ? `
            <p><strong>Your account is currently in grace period.</strong> You can continue using Knotie AI Pro services, but please add credits soon to avoid any service interruption.</p>
            <p>Grace period allows up to 100 credits overdrawn before services are suspended.</p>
          ` : `
            <p>Your credit balance is running low. To ensure uninterrupted service for your AI agents and customers, please consider adding more credits to your account.</p>
          `}

          <div style="text-align: center; margin: 30px 0;">
            <a href="https://app.knotie-ai.pro/dashboard"
               style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; font-weight: bold; display: inline-block;">
              Add Credits Now
            </a>
          </div>

          <p>If you have any questions or need assistance, please don't hesitate to contact our support team.</p>

          <p>Best regards,<br>The Knotie AI Pro Team</p>
        </div>

        <div style="background: #f8f9fa; padding: 20px; text-align: center; border-radius: 0 0 10px 10px; border: 1px solid #e0e0e0; border-top: none;">
          <p style="margin: 0; font-size: 12px; color: #666;">
            This is an automated notification from Knotie AI Pro.<br>
            You're receiving this because you have low credit notifications enabled.
          </p>
        </div>
      </body>
      </html>
    `;

    const textContent = `
${subject}

Hello ${partnerName},

This is an automated notification regarding your Knotie AI Pro account credit balance.

Current Balance: ${balanceDisplay}

${emailType === 'extremely_urgent' ?
  'Your account is currently in grace period. You can continue using Knotie AI Pro services, but please add credits soon to avoid any service interruption. Grace period allows up to 100 credits overdrawn before services are suspended.' :
  'Your credit balance is running low. To ensure uninterrupted service for your AI agents and customers, please consider adding more credits to your account.'
}

Add credits at: https://app.knotie-ai.pro/dashboard

If you have any questions or need assistance, please don't hesitate to contact our support team.

Best regards,
The Knotie AI Pro Team

---
This is an automated notification from Knotie AI Pro.
You're receiving this because you have low credit notifications enabled.
    `;

    // Send the email
    const emailData: EmailData = {
      partnerId: partnerId,
      customerId: undefined, // Partner notifications don't have customerId
      to: partnerEmail,
      subject,
      html: htmlContent,
      text: textContent,
      emailType: 'partner_low_credit_notification'
    };

    const result = await sendEmail(emailData);

    if (!result.success) {
      const errorMessage = 'error' in result ? result.error : 'Unknown error occurred';
      throw new Error(`Failed to send partner low credit notification: ${errorMessage}`);
    }

  } catch (error) {
    logger.error('Error sending partner low credit notification', error as Error, {
      operation: 'low_credit_notification',
      partnerId
    });

    // Log failed email attempt to database
    try {
      await prisma.emailLog.create({
        data: {
          partnerId: partnerId,
          customerId: null,
          emailType: 'partner_low_credit_notification',
          emailTo: partnerEmail,
          subject: subject,
          status: 'failed',
          errorMessage: error instanceof Error ? error.message : String(error),
        },
      });
    } catch (logError) {
      logger.error('Failed to log partner email error to database', logError as Error, {
        operation: 'low_credit_notification',
        partnerId
      });
    }

    throw error;
  }
}


/**
 * Public helper — check whether a partner's Knotie Credit balance is running low
 * and send a notification email if needed.
 *
 * Fetches all required partner fields internally so callers only need the partnerId.
 * Safe to call fire-and-forget: all errors are caught and logged.
 */
export async function checkAndNotifyPartnerLowBalance(partnerId: string): Promise<void> {
  try {
    const partner = await prisma.partner.findUnique({
      where: { id: partnerId },
      select: {
        id: true,
        businessName: true,
        customDomain: true,
        customDomainVerified: true,
        subdomain: true,
        creditBalance: true,
        fractionalCredits: true,
        lowCreditNotificationsEnabled: true,
        emailAddress: true,
        useCustomSmtp: true,
        smtpHost: true,
        smtpPort: true,
        smtpUsername: true,
        smtpPassword: true,
        smtpFromEmail: true,
        smtpFromName: true,
        sesDomain: true,
        sesDomainStatus: true,
        sesDomainEnabled: true,
        useSESDomain: true,
        sesFromEmail: true,
        sesFromName: true,
      },
    });

    if (!partner) {
      logger.warn('[checkAndNotifyPartnerLowBalance] Partner not found', { partnerId });
      return;
    }

    await checkAndSendPartnerLowCreditNotification(partnerId, partner as Partner);
  } catch (error) {
    logger.error('[checkAndNotifyPartnerLowBalance] Error checking partner low balance', error as Error, { partnerId });
  }
}
