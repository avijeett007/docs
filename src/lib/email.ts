import sgMail from '@sendgrid/mail';
import { MailDataRequired } from '@sendgrid/mail';
import nodemailer from 'nodemailer';
import { prisma } from '@/lib/prisma';
import { decryptData } from '@/lib/encryption';
import {
  TEMPLATE_IDS,
  ContactVariables,
  processAllTemplateVariables
} from './emailTemplates';
import { generatePartnerTeamInviteHTML } from './emailTemplates/partnerTeamInvite';
import { generateCustomerTeamInviteHTML } from './emailTemplates/customerTeamInvite';
import { generateWelcomeEmailHTML } from './emailTemplates/welcomeEmail';
import { SESService } from './aws-ses';
import { CreditService } from '@/lib/services/creditService';
import { logger } from './logger';

// Initialize SendGrid with API key
if (!process.env.SENDGRID_API_KEY) {
  logger.error('SENDGRID_API_KEY environment variable is not set', new Error('Missing SENDGRID_API_KEY'), {
    operation: 'email_service_init'
  });
  throw new Error('SENDGRID_API_KEY environment variable is not set');
} else {
  logger.info('SENDGRID_API_KEY is configured', {
    operation: 'email_service_init',
    keyLength: process.env.SENDGRID_API_KEY.length
  });
}

// Check for other important email configuration
logger.info('Email configuration check', {
  operation: 'email_service_init',
  hasSendgridApiKey: !!process.env.SENDGRID_API_KEY,
  hasSendgridFromEmail: !!process.env.SENDGRID_FROM_EMAIL,
  sendgridFromEmail: process.env.SENDGRID_FROM_EMAIL || 'welcome@knotie-ai.pro',
  hasCustomerPortalTemplateId: !!process.env.SENDGRID_CUSTOMER_PORTAL_INVITE_TEMPLATE_ID
});

sgMail.setApiKey(process.env.SENDGRID_API_KEY || '');

// Legacy Email template IDs from SendGrid (for backward compatibility)
const PARTNER_WELCOME_TEMPLATE_ID = process.env.SENDGRID_PARTNER_WELCOME_TEMPLATE_ID || TEMPLATE_IDS.PARTNER_WELCOME;
const PARTNER_RESET_PASSWORD_TEMPLATE_ID = process.env.SENDGRID_PARTNER_RESET_PASSWORD_TEMPLATE_ID || TEMPLATE_IDS.PARTNER_RESET_PASSWORD;
const WAITLIST_TEMPLATE_ID = process.env.SENDGRID_WAITLIST_TEMPLATE_ID || 'd-175f16d72d044988b39e0ad5fa84b352';

// Log template IDs for debugging
logger.info('Email template configuration', {
  operation: 'email_service_init',
  PARTNER_WELCOME_TEMPLATE_ID,
  PARTNER_RESET_PASSWORD_TEMPLATE_ID,
  WAITLIST_TEMPLATE_ID,
  envWelcomeTemplateId: process.env.SENDGRID_PARTNER_WELCOME_TEMPLATE_ID,
  fallbackWelcomeTemplateId: TEMPLATE_IDS.PARTNER_WELCOME
});

export interface PartnerWelcomeEmailData {
  to: string;
  businessName: string;
  password?: string;
  isGoogleUser?: boolean;
}

export interface CustomerPortalInviteData {
  to: string;
  firstName: string;
  businessName: string;
  password: string;
  portalUrl: string;
  contactVariables?: ContactVariables;
  // Partner branding fields
  partnerLogo?: string;
  primaryColor?: string;
  secondaryColor?: string;
  fontFamily?: string;
  portalTitle?: string;
}

export interface PartnerResetPasswordEmailData {
  to: string;
  businessName: string;
  password: string;
  contactVariables?: ContactVariables;
}

export interface EmailData {
  to: string;
  subject: string;
  html?: string;
  text?: string;
  from?: string;
  fromName?: string;
  templateId?: string;
  dynamicTemplateData?: Record<string, any>;
  contactVariables?: ContactVariables;
  // Email tracking fields
  partnerId?: string;
  customerId?: string;
  emailType?: string;
}

// Interface for partner SMTP settings
export interface PartnerSmtpSettings {
  useCustomSmtp: boolean;
  smtpHost: string;
  smtpPort: number;
  smtpUsername: string;
  smtpPassword: string;
  smtpFromEmail: string;
  smtpFromName: string;
  // SES Domain Email Service settings
  sesDomainEnabled?: boolean;
  useSESDomain?: boolean;
  sesDomain?: string;
  sesDomainStatus?: string;
  sesFromEmail?: string;
  sesFromName?: string;
}

// Extended Partner type with SMTP and SES fields
interface PartnerWithSmtp {
  id: string;
  useCustomSmtp?: boolean;
  smtpHost?: string;
  smtpPort?: number;
  smtpUsername?: string;
  smtpPassword?: string;
  smtpFromEmail?: string;
  smtpFromName?: string;
  // SES Domain Email Service fields
  sesDomainEnabled?: boolean;
  useSESDomain?: boolean;
  sesDomain?: string;
  sesDomainStatus?: string;
  sesFromEmail?: string;
  sesFromName?: string;
  [key: string]: any; // Allow other fields
}

/**
 * Build partner SMTP/SES settings from an already-fetched partner record.
 * This avoids duplicating the SES → SMTP → undefined priority logic across
 * every auth route.  The caller is responsible for providing a partner object
 * that already has the SMTP / SES columns selected.
 *
 * @param partner  – a partner row (or subset) that contains the SMTP/SES fields
 * @param defaultFromName – optional fallback for the "from" display name
 * @returns PartnerSmtpSettings when SES or SMTP is configured, otherwise undefined (→ SendGrid)
 */
export async function buildPartnerEmailSettings(
  partner: PartnerWithSmtp,
  defaultFromName?: string
): Promise<PartnerSmtpSettings | undefined> {
  // Priority 1: SES Domain (verified)
  if (partner.sesDomainEnabled && partner.useSESDomain && partner.sesDomainStatus === 'verified') {
    logger.info('Using partner SES domain settings', { operation: 'email', partnerId: partner.id });
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
      sesDomain: partner.sesDomain,
      sesDomainStatus: partner.sesDomainStatus,
      sesFromEmail: partner.sesFromEmail || `noreply@${partner.sesDomain}`,
      sesFromName: partner.sesFromName || defaultFromName || ''
    };
  }

  // Priority 2: Custom SMTP
  // NOTE: We intentionally do NOT block SMTP when sesDomainEnabled is true
  // but useSESDomain is false – a partner may have an SES domain registered
  // but deliberately switched back to SMTP.
  if (partner.useCustomSmtp && partner.smtpHost && partner.smtpUsername && partner.smtpPassword) {
    logger.info('Using partner SMTP settings', { operation: 'email', partnerId: partner.id });
    const decryptedPassword = await decryptData(partner.smtpPassword);
    return {
      useCustomSmtp: true,
      smtpHost: partner.smtpHost,
      smtpPort: partner.smtpPort || 587,
      smtpUsername: partner.smtpUsername,
      smtpPassword: decryptedPassword,
      smtpFromEmail: partner.smtpFromEmail || '',
      smtpFromName: partner.smtpFromName || defaultFromName || '',
      sesDomainEnabled: partner.sesDomainEnabled || false,
      useSESDomain: false,
      sesDomain: partner.sesDomain,
      sesDomainStatus: partner.sesDomainStatus,
      sesFromEmail: partner.sesFromEmail,
      sesFromName: partner.sesFromName
    };
  }

  // Priority 3: No partner email config → caller falls through to SendGrid
  logger.info('Partner has no custom email settings, will use platform default', {
    operation: 'email',
    partnerId: partner.id
  });
  return undefined;
}

/**
 * Fetch partner email settings for sending customer emails
 * Returns the settings needed to use partner's SMTP or SES email service
 */
export async function getPartnerEmailSettings(partnerId: string, defaultFromName?: string): Promise<PartnerSmtpSettings | undefined> {
  try {
    const partner = await prisma.partner.findUnique({
      where: { id: partnerId }
    }) as PartnerWithSmtp | null;

    if (!partner) {
      logger.warn('Partner not found for email settings', {
        operation: 'email',
        partnerId
      });
      return undefined;
    }

    // Priority 1: Check for SES Domain Email Service
    if (partner.sesDomainEnabled && partner.useSESDomain && partner.sesDomainStatus === 'verified') {
      logger.info('Found partner SES domain settings', {
        operation: 'email',
        partnerId
      });
      return {
        useCustomSmtp: false,
        smtpHost: '',
        smtpPort: 587,
        smtpUsername: '',
        smtpPassword: '',
        smtpFromEmail: '',
        smtpFromName: '',
        // SES settings
        sesDomainEnabled: partner.sesDomainEnabled,
        useSESDomain: partner.useSESDomain,
        sesDomain: partner.sesDomain,
        sesDomainStatus: partner.sesDomainStatus,
        sesFromEmail: partner.sesFromEmail,
        sesFromName: partner.sesFromName || defaultFromName || ''
      };
    }

    // Priority 2: Check for custom SMTP settings
    if (partner.useCustomSmtp && partner.smtpHost && partner.smtpUsername && partner.smtpPassword) {
      logger.info('Found partner SMTP settings', {
        operation: 'email',
        partnerId
      });
      const decryptedPassword = await decryptData(partner.smtpPassword);
      return {
        useCustomSmtp: true,
        smtpHost: partner.smtpHost,
        smtpPort: partner.smtpPort || 587,
        smtpUsername: partner.smtpUsername,
        smtpPassword: decryptedPassword,
        smtpFromEmail: partner.smtpFromEmail || '',
        smtpFromName: partner.smtpFromName || defaultFromName || '',
        // SES settings (disabled)
        sesDomainEnabled: partner.sesDomainEnabled || false,
        useSESDomain: false,
        sesDomain: partner.sesDomain,
        sesDomainStatus: partner.sesDomainStatus,
        sesFromEmail: partner.sesFromEmail,
        sesFromName: partner.sesFromName
      };
    }

    // No custom email settings configured
    logger.info('Partner has no custom email settings, will use platform default', {
      operation: 'email',
      partnerId
    });
    return undefined;
  } catch (error) {
    logger.error('Failed to fetch partner email settings', error as Error, {
      operation: 'email',
      partnerId
    });
    return undefined;
  }
}

// Email logging function with credit deduction
export async function logEmailSend(
  data: EmailData,
  success: boolean,
  errorMessage?: string,
  emailSystem?: 'partner_smtp' | 'aws_ses' | 'sendgrid'
) {
  try {
    // Only log if we have partnerId (required for tracking)
    if (!data.partnerId) {
      return;
    }

    await prisma.emailLog.create({
      data: {
        partnerId: data.partnerId,
        customerId: data.customerId || null,
        emailType: data.emailType || 'unknown',
        emailTo: data.to,
        subject: data.subject,
        status: success ? 'sent' : 'failed',
        errorMessage: errorMessage || null,
      },
    });

    // Deduct credits if email was successfully sent and using Knotie's email systems
    if (success && data.partnerId && emailSystem && emailSystem !== 'partner_smtp') {
      try {
        logger.info('Deducting email credits for partner', {
          operation: 'email',
          partnerId: data.partnerId,
          emailSystem
        });

        const creditResult = await CreditService.deductCredits(
          data.partnerId,
          0.1, // 0.1 credits per email (100 credits for 1000 emails = $1.00)
          'email_notification',
          data.customerId,
          undefined, // agentId
          undefined, // sessionId
          undefined, // durationSeconds
          {
            emailSystem,
            emailType: data.emailType || 'unknown',
            emailTo: data.to
          },
          {
            emailSystem,
            emailType: data.emailType || 'unknown',
            subject: data.subject,
            timestamp: new Date().toISOString()
          }
        );

        if (!creditResult.success) {
          logger.error('Failed to deduct email credits', new Error(creditResult.error), {
            operation: 'email',
            partnerId: data.partnerId
          });
          // Don't throw error - email was already sent successfully
        } else {
          logger.info('Successfully deducted email credits', {
            operation: 'email',
            partnerId: data.partnerId,
            newBalance: creditResult.newBalance
          });
        }
      } catch (creditError) {
        logger.error('Error during email credit deduction', creditError as Error, {
          operation: 'email',
          partnerId: data.partnerId
        });
        // Don't throw error - email was already sent successfully
      }
    }
  } catch (logError) {
    // Don't throw errors for logging failures - just log them
    logger.error('Failed to log email send', logError as Error, {
      operation: 'email'
    });
  }
}

// General email sending function that can be used for any email
export async function sendEmail(data: EmailData, partnerSmtpSettings?: PartnerSmtpSettings) {
  try {
    // Priority 1: Check if we should use SES Domain Email Service
    // Only use SES if the environment flag is enabled AND partner has SES configured
    const sesEnabled = process.env.USE_SES_FOR_EMAILS === 'true';
    const useSESDomain = sesEnabled &&
                        partnerSmtpSettings &&
                        partnerSmtpSettings.sesDomainEnabled &&
                        partnerSmtpSettings.useSESDomain &&
                        partnerSmtpSettings.sesDomainStatus === 'verified';

    if (useSESDomain) {
      logger.info('Using AWS SES Domain Email Service', {
        operation: 'email',
        to: data.to
      });
      const result = await sendEmailWithSES(data, partnerSmtpSettings);

      // Log the email send with AWS SES system
      await logEmailSend(data, result.success, result.error?.message, 'aws_ses');

      return result;
    }

    // Priority 2: Check if we should use partner SMTP settings
    // Use SMTP if: partner has SMTP configured AND (SES is disabled via env OR partner doesn't have SES enabled)
    const usePartnerSmtp = partnerSmtpSettings &&
                          partnerSmtpSettings.useCustomSmtp &&
                          (!sesEnabled || !partnerSmtpSettings.sesDomainEnabled);

    if (usePartnerSmtp) {
      logger.info('Using partner SMTP settings', {
        operation: 'email',
        to: data.to
      });
      const result = await sendEmailWithPartnerSmtp(data, partnerSmtpSettings);

      // Log the email send with partner SMTP (no credit deduction)
      await logEmailSend(data, result.success, result.error?.message, 'partner_smtp');

      return result;
    }

    // Priority 3: Fallback to SendGrid (default)
    logger.info('Using SendGrid fallback', {
      operation: 'email',
      to: data.to
    });
    const msg: Partial<MailDataRequired> = {
      to: data.to,
      from: {
        email: data.from || process.env.SENDGRID_FROM_EMAIL || 'hello@knotie-ai.pro',
        name: data.fromName || "Knotie-AI Pro"
      },
      subject: data.subject,
    };

    // Process contact variables if provided
    if (data.contactVariables) {
      // Process subject with variables
      msg.subject = processAllTemplateVariables(data.subject, data.contactVariables);

      // Process dynamic template data with variables
      if (data.dynamicTemplateData) {
        msg.dynamicTemplateData = processAllTemplateVariables(
          {
            subject: msg.subject, // This will replace {{{subject}}} in the template
            ...data.dynamicTemplateData
          },
          data.contactVariables
        );
      }

      // Process HTML content with variables
      if (data.html) {
        data.html = processAllTemplateVariables(data.html, data.contactVariables);
      }
    }

    // Add template ID and dynamic data if provided
    if (data.templateId) {
      msg.templateId = data.templateId;

      if (!msg.dynamicTemplateData && data.dynamicTemplateData) {
        msg.dynamicTemplateData = {
          subject: msg.subject, // This will replace {{{subject}}} in the template
          ...data.dynamicTemplateData
        };
      }

      // When using templates, SendGrid still requires content
      // This is a workaround for the "content value must be a string" error
      msg.content = [
        {
          type: 'text/html',
          value: ' ' // Non-empty placeholder content
        }
      ];
    } else if (data.html) {
      // Only set html content when not using a template
      msg.html = data.html;
    }

    // Log the email being sent (without sensitive content)
    logger.info('Sending email via SendGrid', {
      operation: 'email',
      to: data.to,
      subject: msg.subject,
      emailConfig: {
        from: msg.from,
        templateId: msg.templateId || 'Using HTML content',
        hasHtml: !!msg.html,
        hasContent: !!msg.content,
        dynamicTemplateDataKeys: msg.dynamicTemplateData ? Object.keys(msg.dynamicTemplateData) : []
      }
    });

    try {
      const result = await sgMail.send(msg as MailDataRequired);
      logger.info('SendGrid email sent successfully', {
        operation: 'email',
        to: data.to,
        messageId: result[0]?.headers?.['x-message-id']
      });

      // Log successful email send with SendGrid system
      await logEmailSend(data, true, undefined, 'sendgrid');

      return { success: true };
    } catch (sendError: any) {
      logger.error('SendGrid send error', sendError as Error, {
        operation: 'email',
        to: data.to,
        emailData: {
          to: data.to,
          subject: data.subject,
          templateId: data.templateId,
          hasHtml: !!data.html,
          hasDynamicTemplateData: !!data.dynamicTemplateData
        }
      });

      if (sendError.response) {
        logger.error('SendGrid error details', sendError as Error, {
          operation: 'email',
          statusCode: sendError.response.statusCode,
          responseBody: sendError.response.body,
          hasHeaders: !!sendError.response.headers
        });
      }

      // Log failed email send with SendGrid system
      await logEmailSend(data, false, sendError.message || 'SendGrid send error', 'sendgrid');

      throw sendError;
    }
  } catch (error: any) {
    logger.error('SendGrid Error', error as Error, {
      operation: 'email',
      to: data.to
    });
    // Log more detailed error information if available
    if (error.response) {
      logger.error('SendGrid error response body', error as Error, {
        operation: 'email',
        responseBody: error.response.body
      });
    }

    // Log failed email send with SendGrid system
    await logEmailSend(data, false, error.message || 'SendGrid general error', 'sendgrid');

    return { success: false, error };
  }
}

// Function to send email using partner's SMTP settings
async function sendEmailWithPartnerSmtp(data: EmailData, smtpSettings: PartnerSmtpSettings) {
  try {
    logger.info('Setting up SMTP transport with partner settings', {
      operation: 'email',
      host: smtpSettings.smtpHost,
      port: smtpSettings.smtpPort
    });

    // Create a transporter with partner SMTP settings
    const transporter = nodemailer.createTransport({
      host: smtpSettings.smtpHost,
      port: smtpSettings.smtpPort,
      secure: smtpSettings.smtpPort === 465, // true for 465, false for other ports
      auth: {
        user: smtpSettings.smtpUsername,
        pass: smtpSettings.smtpPassword
      }
    });

    // Process contact variables if provided
    let processedHtml = data.html || '';
    let processedSubject = data.subject;

    if (data.contactVariables) {
      if (data.html) {
        processedHtml = processAllTemplateVariables(data.html, data.contactVariables);
      }
      processedSubject = processAllTemplateVariables(data.subject, data.contactVariables);
    }

    // Prepare email message
    const mailOptions = {
      from: `"${data.fromName || smtpSettings.smtpFromName}" <${data.from || smtpSettings.smtpFromEmail}>`,
      to: data.to,
      subject: processedSubject,
      html: processedHtml
    };

    logger.info('Sending email via SMTP', {
      operation: 'email',
      mailOptions: {
        from: mailOptions.from,
        to: mailOptions.to,
        subject: mailOptions.subject,
        htmlLength: mailOptions.html?.length || 0
      }
    });

    // Send the email
    const info = await transporter.sendMail(mailOptions);

    logger.info('Email sent successfully via SMTP', {
      operation: 'email',
      messageId: info.messageId
    });
    return { success: true, messageId: info.messageId };
  } catch (error: any) {
    logger.error('SMTP Email Error', error as Error, {
      operation: 'email'
    });
    return { success: false, error: error.message };
  }
}

// Function to send email via AWS SES
export async function sendEmailWithSES(data: EmailData, partnerSettings: PartnerSmtpSettings) {
  try {
    if (!partnerSettings.sesDomain || !partnerSettings.sesFromEmail || !partnerSettings.sesFromName) {
      throw new Error('SES domain configuration is incomplete');
    }

    if (partnerSettings.sesDomainStatus !== 'verified') {
      throw new Error(`SES domain is not verified. Status: ${partnerSettings.sesDomainStatus}`);
    }

    logger.info('Sending email via AWS SES', {
      operation: 'email',
      sesConfig: {
        to: data.to,
        from: partnerSettings.sesFromEmail,
        domain: partnerSettings.sesDomain,
        subject: data.subject
      }
    });

    const sesService = new SESService();

    // Ensure we have HTML content
    if (!data.html) {
      throw new Error('HTML content is required for SES email sending');
    }

    const sesParams = {
      to: data.to,
      from: partnerSettings.sesFromEmail,
      fromName: partnerSettings.sesFromName,
      subject: data.subject,
      html: data.html,
      text: data.text
    };

    const result = await sesService.sendEmail(sesParams);

    logger.info('Email sent successfully via AWS SES', {
      operation: 'email',
      messageId: result.messageId
    });
    return { success: true, messageId: result.messageId };
  } catch (error: any) {
    logger.error('AWS SES Email Error', error as Error, {
      operation: 'email'
    });
    return { success: false, error: error.message };
  }
}

export async function sendPartnerWelcomeEmail(data: PartnerWelcomeEmailData) {
  // Prepare dynamic template data
  const dynamicTemplateData: Record<string, any> = {
    business_name: data.businessName,
    subject: `Welcome to Knotie-AI Pro Partners, ${data.businessName}!`,
  };

  // Only include password for non-Google users
  if (!data.isGoogleUser && data.password) {
    dynamicTemplateData.password = data.password;
    dynamicTemplateData.login_method = 'email_password';
  } else {
    dynamicTemplateData.login_method = 'google_oauth';
  }

  return await sendEmail({
    to: data.to,
    subject: dynamicTemplateData.subject,
    templateId: PARTNER_WELCOME_TEMPLATE_ID,
    dynamicTemplateData,
  });
}

export interface MarketingWelcomeEmailData {
  to: string;
  businessName: string;
  password?: string;
  couponCode?: string;
  couponName?: string;
  lifetimeOffer?: boolean;
  lifetimeOfferPrice?: number;
  originalPrice?: number;
  nextSteps: string[];
  redirectUrl?: string;
  source?: string;
  campaignId?: string;
}

export async function sendMarketingWelcomeEmail(data: MarketingWelcomeEmailData) {
  // Generate HTML content using our custom template
  const htmlContent = generateMarketingWelcomeHTML({
    businessName: data.businessName,
    password: data.password,
    couponCode: data.couponCode,
    couponName: data.couponName,
    lifetimeOffer: data.lifetimeOffer,
    lifetimeOfferPrice: data.lifetimeOfferPrice,
    originalPrice: data.originalPrice,
    nextSteps: data.nextSteps,
    redirectUrl: data.redirectUrl,
    source: data.source,
    campaignId: data.campaignId
  });

  // Subject line
  const subject = data.lifetimeOffer
    ? `🎉 Lifetime Offer Unlocked - Welcome to Knotie AI Pro, ${data.businessName}!`
    : `Welcome to Knotie AI Pro - ${data.businessName}!`;

  const fromEmail = process.env.SENDGRID_FROM_EMAIL || 'welcome@knotie-ai.pro';

  // Send the email with custom HTML
  return await sendEmail({
    to: data.to,
    subject: subject,
    from: fromEmail,
    fromName: "Knotie AI Pro",
    html: htmlContent,
  });
}

import { generateCustomerPortalInviteHTML } from './emailTemplates/customerPortalInvite';
import { generateMarketingWelcomeHTML } from './emailTemplates/marketingWelcome';

export async function sendCustomerPortalInvite(data: CustomerPortalInviteData, partnerId?: string) {
  try {
    logger.info('Starting customer portal invite email process', {
      operation: 'email',
      to: data.to
    });

    // Get partner branding from the database
    const partnerBranding = {
      businessName: data.businessName,
      logo: data.partnerLogo,
      primaryColor: data.primaryColor,
      secondaryColor: data.secondaryColor,
      fontFamily: data.fontFamily,
      portalTitle: data.portalTitle
    };

    logger.info('Using partner branding for customer invite', {
      operation: 'email',
      branding: {
        businessName: partnerBranding.businessName,
        hasLogo: !!partnerBranding.logo,
        primaryColor: partnerBranding.primaryColor,
        secondaryColor: partnerBranding.secondaryColor,
        fontFamily: partnerBranding.fontFamily,
        portalTitle: partnerBranding.portalTitle
      }
    });

    // Generate HTML content using our custom template
    const htmlContent = generateCustomerPortalInviteHTML({
      firstName: data.firstName,
      password: data.password,
      portalUrl: data.portalUrl,
      branding: partnerBranding
    });

    logger.debug('Generated HTML content for customer invite', {
      operation: 'email',
      htmlLength: htmlContent.length,
      htmlPreview: htmlContent.substring(0, 100)
    });

    // Subject line
    const subject = `Your Portal Access for ${data.businessName}`;

    const fromEmail = process.env.SENDGRID_FROM_EMAIL || 'welcome@knotie-ai.pro';
    logger.info('Sending customer invite email', {
      operation: 'email',
      fromEmail,
      fromName: data.businessName
    });

    // Check if we should use partner SMTP settings
    let partnerSmtpSettings: PartnerSmtpSettings | undefined;

    if (partnerId) {
      try {
        logger.debug('Checking for partner SMTP settings', {
          operation: 'email',
          partnerId
        });
        // Get partner with SMTP settings
        const partner = await prisma.partner.findUnique({
          where: { id: partnerId }
        }) as PartnerWithSmtp | null;

        if (partner) {
          // Check for SES Domain Email Service first
          if (partner.sesDomainEnabled && partner.useSESDomain && partner.sesDomainStatus === 'verified') {
            logger.info('Found partner SES domain settings, using AWS SES', {
              operation: 'email',
              partnerId
            });
            partnerSmtpSettings = {
              useCustomSmtp: false,
              smtpHost: '',
              smtpPort: 587,
              smtpUsername: '',
              smtpPassword: '',
              smtpFromEmail: '',
              smtpFromName: '',
              // SES settings
              sesDomainEnabled: partner.sesDomainEnabled,
              useSESDomain: partner.useSESDomain,
              sesDomain: partner.sesDomain || undefined,
              sesDomainStatus: partner.sesDomainStatus || undefined,
              sesFromEmail: partner.sesFromEmail || fromEmail,
              sesFromName: partner.sesFromName || data.businessName
            };
          } else if (partner.useCustomSmtp && partner.smtpHost && partner.smtpUsername && partner.smtpPassword && !partner.sesDomainEnabled) {
            logger.info('Found partner SMTP settings, using custom SMTP', {
              operation: 'email',
              partnerId
            });

            // Decrypt the SMTP password
            const decryptedPassword = await decryptData(partner.smtpPassword);

            partnerSmtpSettings = {
              useCustomSmtp: true,
              smtpHost: partner.smtpHost,
              smtpPort: partner.smtpPort || 587,
              smtpUsername: partner.smtpUsername,
              smtpPassword: decryptedPassword,
              smtpFromEmail: partner.smtpFromEmail || fromEmail,
              smtpFromName: partner.smtpFromName || data.businessName,
              // SES settings (disabled)
              sesDomainEnabled: partner.sesDomainEnabled || false,
              useSESDomain: false,
              sesDomain: partner.sesDomain || undefined,
              sesDomainStatus: partner.sesDomainStatus || undefined,
              sesFromEmail: partner.sesFromEmail || undefined,
              sesFromName: partner.sesFromName || undefined
            };
          } else {
            logger.info('Partner has no email service configured, using SendGrid', {
              operation: 'email',
              partnerId
            });
          }
        } else {
          logger.info('Partner not found, using SendGrid', {
            operation: 'email',
            partnerId
          });
        }
      } catch (dbError) {
        logger.error('Error fetching partner SMTP settings', dbError as Error, {
          operation: 'email',
          partnerId
        });
        // Continue with SendGrid if there's an error
      }
    }

    // Send the email with custom HTML
    try {
      const result = await sendEmail({
        to: data.to,
        subject: subject,
        from: partnerSmtpSettings?.smtpFromEmail || fromEmail,
        fromName: partnerSmtpSettings?.smtpFromName || data.businessName,
        html: htmlContent, // Use our custom HTML instead of a template
        contactVariables: data.contactVariables,
        // Email tracking
        partnerId: partnerId,
        emailType: 'customer_portal_invite'
      }, partnerSmtpSettings);

      logger.info('Customer portal invite email sent', {
        operation: 'email',
        success: result.success
      });
      return result;
    } catch (sendError) {
      logger.error('Failed to send customer portal invite email', sendError as Error, {
        operation: 'email'
      });
      throw sendError;
    }
  } catch (error) {
    logger.error('Error in sendCustomerPortalInvite function', error as Error, {
      operation: 'email'
    });
    throw error;
  }
}

export async function sendPartnerResetPasswordEmail(data: PartnerResetPasswordEmailData) {
  // Prepare dynamic template data
  // Note: We don't need to escape the business_name in the template data object as SendGrid will handle that
  // but we do need to be careful with the subject line which might be displayed differently
  const businessNameSafe = data.businessName.replace(/[&<>"']/g, (c) => {
    return {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;'
    }[c] || c;
  });

  const dynamicTemplateData: Record<string, any> = {
    business_name: data.businessName, // SendGrid handles HTML-escaping in template variables
    password: data.password,
    subject: `Password Reset for Knotie-AI Pro Partners, ${businessNameSafe}!`,
  };

  // Process variables if provided
  if (data.contactVariables) {
    // Merge business name into contact variables
    const variables = {
      ...data.contactVariables,
      businessName: data.businessName,
    };

    // Process all template data with variables
    Object.keys(dynamicTemplateData).forEach(key => {
      if (typeof dynamicTemplateData[key] === 'string') {
        dynamicTemplateData[key] = processAllTemplateVariables(dynamicTemplateData[key], variables);
      }
    });
  }

  // Use the general email sending function
  return sendEmail({
    to: data.to,
    subject: dynamicTemplateData.subject,
    from: process.env.SENDGRID_FROM_EMAIL || 'welcome@knotie-ai.pro',
    fromName: "Knotie-AI Pro Partners",
    templateId: PARTNER_RESET_PASSWORD_TEMPLATE_ID,
    dynamicTemplateData,
    contactVariables: data.contactVariables
  });
}

export interface PartnerTeamInviteEmailData {
  to: string;
  inviteeName: string;
  partnerBusinessName: string;
  partnerContactName?: string;
  inviteToken: string;
  expiryHours: number;
  contactVariables?: ContactVariables;
}

export interface CustomerTeamInviteEmailData {
  to: string;
  inviteeName: string;
  customerName: string;
  inviteToken: string;
  expiryHours: number;
  partnerId: string;
  contactVariables?: ContactVariables;
}

export interface CustomerTeamPasswordResetData {
  to: string;
  name: string;
  resetToken: string;
  expiryHours: number;
  partnerId: string;
  partnerName: string;
  partnerLogo?: string;
  partnerColor?: string;
  contactVariables?: ContactVariables;
}

export interface WelcomeEmailData {
  to: string;
  customerName: string;
  partnerName: string;
  partnerContactName: string;
  partnerId: string;
  contactVariables?: ContactVariables;
}

export interface WaitlistEmailData {
  to: string;
  name: string;
  position: number;
  referralCode: string;
}

export interface InsufficientTelephonyCreditEmailData {
  partnerEmail: string;
  partnerBusinessName: string;
  customerName: string;
  customerEmail: string;
  requiredCredits: number;
  currentCredits: number;
  phoneNumber?: string;
  contactVariables?: Record<string, string>;
}

export async function sendInsufficientTelephonyCreditNotification(data: InsufficientTelephonyCreditEmailData) {
  try {
    logger.info('Starting insufficient telephony credit notification email process', {
      operation: 'email',
      to: data.partnerEmail,
      customerEmail: data.customerEmail
    });

    const subject = `🚨 Urgent: Customer waiting for phone number - Telephony credits needed`;

    // Generate HTML content
    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
          <meta charset="UTF-8">
          <title>Telephony Credits Needed</title>
          <style>
              body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
              .container { background: white; border-radius: 12px; padding: 40px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1); }
              .header { text-align: center; margin-bottom: 30px; }
              .logo { font-size: 28px; font-weight: bold; color: #3b82f6; margin-bottom: 10px; }
              .alert { background: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; padding: 20px; margin: 20px 0; }
              .alert-title { color: #dc2626; font-weight: bold; font-size: 18px; margin-bottom: 10px; }
              .customer-info { background: #f8fafc; border-radius: 8px; padding: 20px; margin: 20px 0; }
              .credit-info { background: #fffbeb; border: 1px solid #fbbf24; border-radius: 8px; padding: 20px; margin: 20px 0; }
              .button { display: inline-block; background: #3b82f6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; margin: 10px 0; }
              .footer { margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb; font-size: 14px; color: #6b7280; }
          </style>
      </head>
      <body>
          <div class="container">
              <div class="header">
                  <div class="logo">Knotie AI Pro</div>
                  <h2>Telephony Credits Needed</h2>
              </div>

              <div class="alert">
                  <div class="alert-title">🚨 Customer Waiting for Phone Number</div>
                  <p>One of your customers tried to get a phone number but the purchase failed due to insufficient telephony credits in your account.</p>
              </div>

              <div class="customer-info">
                  <h3>Customer Details:</h3>
                  <p><strong>Name:</strong> ${data.customerName}</p>
                  <p><strong>Email:</strong> ${data.customerEmail}</p>
                  ${data.phoneNumber ? `<p><strong>Requested Number:</strong> ${data.phoneNumber}</p>` : ''}
              </div>

              <div class="credit-info">
                  <h3>Credit Information:</h3>
                  <p><strong>Required Credits:</strong> ${(data.requiredCredits / 100).toFixed(2)} credits</p>
                  <p><strong>Current Balance:</strong> ${(data.currentCredits / 100).toFixed(2)} credits</p>
                  <p><strong>Shortfall:</strong> ${((data.requiredCredits - data.currentCredits) / 100).toFixed(2)} credits</p>
              </div>

              <p><strong>What you need to do:</strong></p>
              <ol>
                  <li>Add telephony credits to your account</li>
                  <li>Contact your customer to retry the phone number purchase</li>
                  <li>Or manually assign a phone number from your partner portal</li>
              </ol>

              <div style="text-align: center; margin: 30px 0;">
                  <a href="${process.env.NEXT_PUBLIC_BASE_URL}/partner/billing" class="button">Add Telephony Credits</a>
              </div>

              <p><strong>Need Help?</strong></p>
              <p>Contact our support team at <a href="mailto:support@knotie-ai.pro">support@knotie-ai.pro</a> if you need assistance with adding credits or managing phone numbers.</p>

              <div class="footer">
                  <p>This is an automated notification from Knotie AI Pro.</p>
                  <p>You're receiving this because a customer in your whitelabel portal needs assistance.</p>
              </div>
          </div>
      </body>
      </html>
    `;

    // Send the email
    const result = await sendEmail({
      to: data.partnerEmail,
      subject: subject,
      from: 'notification@knotie-ai.pro',
      fromName: 'Knotie AI Pro Notifications',
      html: htmlContent,
      contactVariables: data.contactVariables
    });

    logger.info('Insufficient telephony credit notification email sent', {
      operation: 'email',
      success: result.success,
      partnerEmail: data.partnerEmail,
      customerEmail: data.customerEmail
    });
    return result;
  } catch (error) {
    logger.error('Error in sendInsufficientTelephonyCreditNotification function', error as Error, {
      operation: 'email',
      partnerEmail: data.partnerEmail,
      customerEmail: data.customerEmail
    });
    throw error;
  }
}

export async function sendPartnerTeamInvite(data: PartnerTeamInviteEmailData) {
  try {
    logger.info('Starting partner team invite email process', {
      operation: 'email',
      to: data.to
    });

    // Generate the invite URL
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://knotie-ai.pro';
    const inviteUrl = `${baseUrl}/partner/accept-invite?token=${data.inviteToken}`;

    // Generate HTML content using our custom template
    const htmlContent = generatePartnerTeamInviteHTML({
      inviteeName: data.inviteeName,
      partnerBusinessName: data.partnerBusinessName,
      partnerContactName: data.partnerContactName,
      inviteUrl,
      expiryHours: data.expiryHours
    });

    logger.debug('Generated HTML content for partner team invite', {
      operation: 'email',
      htmlLength: htmlContent.length
    });

    // Subject line
    const subject = `${data.partnerBusinessName} has invited you to join their Knotie AI Pro team`;

    const fromEmail = process.env.SENDGRID_FROM_EMAIL || 'welcome@knotie-ai.pro';
    logger.info('Sending partner team invite email', {
      operation: 'email',
      fromEmail,
      fromName: 'Knotie AI Pro'
    });

    // Check if we should use partner SMTP settings
    let partnerSmtpSettings: PartnerSmtpSettings | undefined;

    try {
      // Get partner with SMTP settings using business name
      const partner = await prisma.partner.findFirst({
        where: { businessName: data.partnerBusinessName }
      }) as PartnerWithSmtp | null;

      if (partner && partner.useCustomSmtp && partner.smtpHost && partner.smtpUsername && partner.smtpPassword) {
        logger.info('Found partner SMTP settings for team invite, using custom SMTP', {
          operation: 'email'
        });

        // Decrypt the SMTP password
        const decryptedPassword = await decryptData(partner.smtpPassword);

        partnerSmtpSettings = {
          useCustomSmtp: true,
          smtpHost: partner.smtpHost,
          smtpPort: partner.smtpPort || 587,
          smtpUsername: partner.smtpUsername,
          smtpPassword: decryptedPassword,
          smtpFromEmail: partner.smtpFromEmail || fromEmail,
          smtpFromName: "Knotie AI Pro" // Always use Knotie AI Pro as the from name for partner team invites
        };
      } else {
        logger.info('Partner has no custom SMTP settings, using SendGrid for team invite', {
          operation: 'email'
        });
      }
    } catch (dbError) {
      logger.error('Error fetching partner SMTP settings for team invite', dbError as Error, {
        operation: 'email'
      });
      // Continue with SendGrid if there's an error
    }

    // Send the email with custom HTML
    try {
      const result = await sendEmail({
        to: data.to,
        subject: subject,
        from: partnerSmtpSettings?.smtpFromEmail || fromEmail,
        fromName: "Knotie AI Pro", // Always use Knotie AI Pro as the from name for partner team invites
        html: htmlContent,
        contactVariables: data.contactVariables
      }, partnerSmtpSettings);

      logger.info('Partner team invite email sent', {
        operation: 'email',
        success: result.success
      });
      return result;
    } catch (sendError) {
      logger.error('Failed to send partner team invite email', sendError as Error, {
        operation: 'email'
      });
      throw sendError;
    }
  } catch (error) {
    logger.error('Error in sendPartnerTeamInvite function', error as Error, {
      operation: 'email'
    });
    throw error;
  }
}

export async function sendCustomerTeamInvite(data: CustomerTeamInviteEmailData) {
  try {
    logger.info('Starting customer team invite email process', {
      operation: 'email',
      to: data.to
    });

    // Generate the invite URL with the correct whitelabel portal URL
    let baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://knotie-ai.pro';

    // Get partner information for branding, URL and SMTP/SES settings
    const partner = await prisma.partner.findUnique({
      where: { id: data.partnerId },
      select: {
        id: true,
        businessName: true,
        logo: true,
        primaryColor: true,
        secondaryColor: true,
        fontFamily: true,
        portalTitle: true,
        subdomain: true,
        customDomain: true,
        customDomainVerified: true,
        useCustomSmtp: true,
        smtpHost: true,
        smtpPort: true,
        smtpUsername: true,
        smtpPassword: true,
        smtpFromEmail: true,
        smtpFromName: true,
        // SES Domain Email Service fields
        sesDomainEnabled: true,
        useSESDomain: true,
        sesDomain: true,
        sesDomainStatus: true,
        sesFromEmail: true,
        sesFromName: true
      }
    });

    if (partner) {
      // Determine the portal URL - always use partner domain for emails
      baseUrl = partner.customDomainVerified && partner.customDomain
        ? `https://${partner.customDomain}`
        : `https://${partner.subdomain}.knotie-ai.pro`;
    }

    // Determine the correct URL prefix based on ENABLE_PLATFORM_URLS setting
    const enablePlatformUrls = process.env.ENABLE_PLATFORM_URLS !== 'false';
    const urlPrefix = enablePlatformUrls ? '/platform' : '/whitelabel';

    const inviteUrl = `${baseUrl}${urlPrefix}/accept-invite?token=${data.inviteToken}`;

    if (!partner) {
      throw new Error(`Partner not found with ID: ${data.partnerId}`);
    }

    // Prepare partner branding
    const partnerBranding = {
      businessName: partner.businessName || 'Your Service Provider',
      logo: partner.logo || undefined,
      primaryColor: partner.primaryColor || '#3B82F6',
      secondaryColor: partner.secondaryColor || undefined,
      fontFamily: partner.fontFamily || undefined,
      portalTitle: partner.portalTitle || `${partner.businessName} Portal`
    };

    // Generate HTML content using our custom template
    const htmlContent = generateCustomerTeamInviteHTML({
      inviteeName: data.inviteeName,
      customerName: data.customerName,
      inviteUrl,
      expiryHours: data.expiryHours,
      branding: partnerBranding
    });

    logger.debug('Generated HTML content for customer team invite', {
      operation: 'email',
      htmlLength: htmlContent.length
    });

    // Subject line
    const subject = `${data.customerName} has invited you to join their team on ${partnerBranding.portalTitle}`;

    const fromEmail = process.env.SENDGRID_FROM_EMAIL || 'welcome@knotie-ai.pro';
    logger.info('Sending customer team invite email', {
      operation: 'email',
      fromEmail,
      fromName: partnerBranding.businessName
    });

    // Check for email service settings (SES Domain first, then SMTP)
    let partnerSmtpSettings: PartnerSmtpSettings | undefined;

    // Priority 1: SES Domain Email Service
    if (partner.sesDomainEnabled && partner.useSESDomain && partner.sesDomainStatus === 'verified') {
      logger.info('Found partner SES domain settings for customer team invite, using AWS SES', {
        operation: 'email'
      });
      partnerSmtpSettings = {
        useCustomSmtp: false,
        smtpHost: '',
        smtpPort: 587,
        smtpUsername: '',
        smtpPassword: '',
        smtpFromEmail: '',
        smtpFromName: '',
        // SES settings
        sesDomainEnabled: partner.sesDomainEnabled,
        useSESDomain: partner.useSESDomain,
        sesDomain: partner.sesDomain || undefined,
        sesDomainStatus: partner.sesDomainStatus || undefined,
        sesFromEmail: partner.sesFromEmail || fromEmail,
        sesFromName: partner.sesFromName || partnerBranding.businessName
      };
    } else if (partner.useCustomSmtp && partner.smtpHost && partner.smtpUsername && partner.smtpPassword && !partner.sesDomainEnabled) {
      logger.info('Found partner SMTP settings for customer team invite, using custom SMTP', {
        operation: 'email'
      });

      // Decrypt the SMTP password
      const decryptedPassword = await decryptData(partner.smtpPassword);

      partnerSmtpSettings = {
        useCustomSmtp: true,
        smtpHost: partner.smtpHost,
        smtpPort: partner.smtpPort || 587,
        smtpUsername: partner.smtpUsername,
        smtpPassword: decryptedPassword,
        smtpFromEmail: partner.smtpFromEmail || fromEmail,
        smtpFromName: partner.smtpFromName || partnerBranding.businessName,
        // SES settings (disabled)
        sesDomainEnabled: partner.sesDomainEnabled || false,
        useSESDomain: false,
        sesDomain: partner.sesDomain || undefined,
        sesDomainStatus: partner.sesDomainStatus || undefined,
        sesFromEmail: partner.sesFromEmail || undefined,
        sesFromName: partner.sesFromName || undefined
      };
    } else {
      logger.info('Partner has no custom SMTP settings for customer team invite, using SendGrid', {
        operation: 'email'
      });
    }

    // Send the email with custom HTML
    try {
      const result = await sendEmail({
        to: data.to,
        subject: subject,
        from: partnerSmtpSettings?.smtpFromEmail || fromEmail,
        fromName: partnerSmtpSettings?.smtpFromName || partnerBranding.businessName,
        html: htmlContent,
        contactVariables: data.contactVariables,
        // Email tracking
        partnerId: data.partnerId,
        emailType: 'customer_team_invite'
      }, partnerSmtpSettings);

      logger.info('Customer team invite email sent', {
        operation: 'email',
        success: result.success
      });
      return result;
    } catch (sendError) {
      logger.error('Failed to send customer team invite email', sendError as Error, {
        operation: 'email'
      });
      throw sendError;
    }
  } catch (error) {
    logger.error('Error in sendCustomerTeamInvite function', error as Error, {
      operation: 'email'
    });
    throw error;
  }
}

export async function sendWelcomeEmail(data: WelcomeEmailData) {
  try {
    logger.info('Starting welcome email process', {
      operation: 'email',
      to: data.to
    });

    // Get partner information for branding and email settings
    const partner = await prisma.partner.findUnique({
      where: { id: data.partnerId },
      select: {
        id: true,
        businessName: true,
        logo: true,
        primaryColor: true,
        secondaryColor: true,
        fontFamily: true,
        portalTitle: true,
        useCustomSmtp: true,
        smtpHost: true,
        smtpPort: true,
        smtpUsername: true,
        smtpPassword: true,
        smtpFromEmail: true,
        smtpFromName: true,
        subdomain: true,
        customDomain: true,
        customDomainVerified: true,
        // SES Domain Email Service fields
        sesDomainEnabled: true,
        useSESDomain: true,
        sesDomain: true,
        sesDomainStatus: true,
        sesFromEmail: true,
        sesFromName: true
      }
    });

    if (!partner) {
      throw new Error(`Partner not found with ID: ${data.partnerId}`);
    }

    // Determine the portal URL - always use partner domain for emails
    const baseUrl = partner.customDomainVerified && partner.customDomain
      ? `https://${partner.customDomain}`
      : `https://${partner.subdomain}.knotie-ai.pro`;

    // Determine the correct URL prefix based on ENABLE_PLATFORM_URLS setting
    const enablePlatformUrls = process.env.ENABLE_PLATFORM_URLS !== 'false';
    const urlPrefix = enablePlatformUrls ? '/platform' : '/whitelabel';

    const customPortalUrl = `${baseUrl}${urlPrefix}/login`;

    // Prepare partner branding
    const partnerBranding = {
      businessName: partner.businessName || 'Your Service Provider',
      logo: partner.logo || undefined,
      primaryColor: partner.primaryColor || '#3B82F6',
      secondaryColor: partner.secondaryColor || undefined,
      fontFamily: partner.fontFamily || undefined,
      portalTitle: partner.portalTitle || `${partner.businessName} Portal`
    };

    // Generate HTML content using our custom template
    const htmlContent = generateWelcomeEmailHTML({
      customerName: data.customerName,
      partnerName: data.partnerName,
      partnerContactName: data.partnerContactName,
      portalUrl: customPortalUrl,
      branding: partnerBranding
    });

    logger.debug('Generated HTML content for welcome email', {
      operation: 'email',
      htmlLength: htmlContent.length
    });

    // Subject line
    const subject = `Welcome to ${partnerBranding.portalTitle}!`;

    const fromEmail = process.env.SENDGRID_FROM_EMAIL || 'welcome@knotie-ai.pro';
    logger.info('Sending welcome email', {
      operation: 'email',
      fromEmail,
      fromName: partnerBranding.businessName
    });

    // Check for email service settings (SES Domain first, then SMTP)
    let partnerSmtpSettings: PartnerSmtpSettings | undefined;

    // Priority 1: SES Domain Email Service
    if (partner.sesDomainEnabled && partner.useSESDomain && partner.sesDomainStatus === 'verified') {
      logger.info('Found partner SES domain settings for welcome email, using AWS SES', {
        operation: 'email'
      });
      partnerSmtpSettings = {
        useCustomSmtp: false,
        smtpHost: '',
        smtpPort: 587,
        smtpUsername: '',
        smtpPassword: '',
        smtpFromEmail: '',
        smtpFromName: '',
        // SES settings
        sesDomainEnabled: partner.sesDomainEnabled,
        useSESDomain: partner.useSESDomain,
        sesDomain: partner.sesDomain || undefined,
        sesDomainStatus: partner.sesDomainStatus || undefined,
        sesFromEmail: partner.sesFromEmail || fromEmail,
        sesFromName: partner.sesFromName || partnerBranding.businessName
      };
    } else if (partner.useCustomSmtp && partner.smtpHost && partner.smtpUsername && partner.smtpPassword && !partner.sesDomainEnabled) {
      logger.info('Found partner SMTP settings for welcome email, using custom SMTP', {
        operation: 'email'
      });

      // Decrypt the SMTP password
      const decryptedPassword = await decryptData(partner.smtpPassword);

      partnerSmtpSettings = {
        useCustomSmtp: true,
        smtpHost: partner.smtpHost,
        smtpPort: partner.smtpPort || 587,
        smtpUsername: partner.smtpUsername,
        smtpPassword: decryptedPassword,
        smtpFromEmail: partner.smtpFromEmail || fromEmail,
        smtpFromName: partner.smtpFromName || partnerBranding.businessName,
        // SES settings (disabled)
        sesDomainEnabled: partner.sesDomainEnabled || false,
        useSESDomain: false,
        sesDomain: partner.sesDomain || undefined,
        sesDomainStatus: partner.sesDomainStatus || undefined,
        sesFromEmail: partner.sesFromEmail || undefined,
        sesFromName: partner.sesFromName || undefined
      };
    } else {
      logger.info('Partner has no email service configured for welcome email, using SendGrid', {
        operation: 'email'
      });
    }

    // Send the email with custom HTML
    try {
      const result = await sendEmail({
        to: data.to,
        subject: subject,
        from: partnerSmtpSettings?.smtpFromEmail || fromEmail,
        fromName: partnerSmtpSettings?.smtpFromName || partnerBranding.businessName,
        html: htmlContent,
        contactVariables: data.contactVariables,
        // Email tracking
        partnerId: data.partnerId,
        emailType: 'welcome_email'
      }, partnerSmtpSettings);

      logger.info('Welcome email sent', {
        operation: 'email',
        success: result.success
      });
      return result;
    } catch (sendError) {
      logger.error('Failed to send welcome email', sendError as Error, {
        operation: 'email'
      });
      throw sendError;
    }
  } catch (error) {
    logger.error('Error in sendWelcomeEmail function', error as Error, {
      operation: 'email'
    });
    throw error;
  }
}

export async function sendCustomerTeamPasswordReset(data: CustomerTeamPasswordResetData) {
  try {
    logger.info('Starting customer team password reset email process', {
      operation: 'email',
      to: data.to
    });

    // For team password reset, use the main knotie-ai.pro domain (not partner domain)
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://knotie-ai.pro';

    // Determine the correct URL prefix based on ENABLE_PLATFORM_URLS setting
    const enablePlatformUrls = process.env.ENABLE_PLATFORM_URLS !== 'false';
    const urlPrefix = enablePlatformUrls ? '/platform' : '/whitelabel';

    const resetUrl = `${baseUrl}${urlPrefix}/accept-invite?token=${data.resetToken}`;

    // Prepare partner branding
    const partnerBranding = {
      businessName: data.partnerName || 'Your Service Provider',
      logo: data.partnerLogo || undefined,
      primaryColor: data.partnerColor || '#3B82F6'
    };

    // Generate HTML content
    const htmlContent = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #333;">
        <div style="text-align: center; margin-bottom: 20px;">
          ${partnerBranding.logo ?
            `<img src="${partnerBranding.logo}" alt="${partnerBranding.businessName} Logo" style="max-width: 150px; height: auto;" />` :
            `<div style="background-color: ${partnerBranding.primaryColor}; color: white; font-size: 24px; font-weight: bold; padding: 15px; border-radius: 8px;">${partnerBranding.businessName.substring(0, 1)}</div>`
          }
        </div>

        <h1 style="color: ${partnerBranding.primaryColor}; margin-top: 0;">Password Reset Request</h1>

        <p>Hello ${data.name},</p>

        <p>We received a request to reset your password for your team member account at ${partnerBranding.businessName}.</p>

        <p>To reset your password, please click the button below:</p>

        <div style="text-align: center; margin: 30px 0;">
          <a href="${resetUrl}" style="background-color: ${partnerBranding.primaryColor}; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; font-weight: bold; display: inline-block; font-family: Arial, sans-serif;">Reset Your Password</a>
        </div>

        <!-- Fallback text link in case the button doesn't work -->
        <p style="text-align: center; margin-top: 10px; margin-bottom: 20px;">
          If the button doesn't work, copy and paste this link into your browser:
          <br>
          <a href="${resetUrl}" style="color: ${partnerBranding.primaryColor}; text-decoration: underline; word-break: break-all;">${resetUrl}</a>
        </p>

        <p>This link will expire in ${data.expiryHours} hours.</p>

        <p>If you didn't request a password reset, you can safely ignore this email.</p>

        <p>Best regards,<br>${partnerBranding.businessName} Team</p>

        <div style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #eee; font-size: 12px; color: #666; text-align: center;">
          <p>This email was sent by ${partnerBranding.businessName} using Knotie AI Pro</p>
        </div>
      </div>
    `;

    // Subject line
    const subject = `Password Reset for ${partnerBranding.businessName}`;

    const fromEmail = process.env.SENDGRID_FROM_EMAIL || 'welcome@knotie-ai.pro';
    logger.info('Sending customer team password reset email', {
      operation: 'email',
      fromEmail,
      fromName: partnerBranding.businessName
    });

    // Check if we should use partner SMTP settings
    let partnerSmtpSettings: PartnerSmtpSettings | undefined;

    if (data.partnerId) {
      try {
        logger.debug('Checking for partner SMTP settings for password reset', {
          operation: 'email',
          partnerId: data.partnerId
        });
        // Get partner with SMTP settings
        const partner = await prisma.partner.findUnique({
          where: { id: data.partnerId }
        }) as PartnerWithSmtp | null;

        if (partner) {
          // Check for SES Domain Email Service first
          if (partner.sesDomainEnabled && partner.useSESDomain && partner.sesDomainStatus === 'verified') {
            logger.info('Found partner SES domain settings for password reset, using AWS SES', {
              operation: 'email',
              partnerId: data.partnerId
            });
            partnerSmtpSettings = {
              useCustomSmtp: false,
              smtpHost: '',
              smtpPort: 587,
              smtpUsername: '',
              smtpPassword: '',
              smtpFromEmail: '',
              smtpFromName: '',
              // SES settings
              sesDomainEnabled: partner.sesDomainEnabled,
              useSESDomain: partner.useSESDomain,
              sesDomain: partner.sesDomain || undefined,
              sesDomainStatus: partner.sesDomainStatus || undefined,
              sesFromEmail: partner.sesFromEmail || fromEmail,
              sesFromName: partner.sesFromName || partnerBranding.businessName
            };
          } else if (partner.useCustomSmtp && partner.smtpHost && partner.smtpUsername && partner.smtpPassword && !partner.sesDomainEnabled) {
            logger.info('Found partner SMTP settings for password reset, using custom SMTP', {
              operation: 'email',
              partnerId: data.partnerId
            });

            // Decrypt the SMTP password
            const decryptedPassword = await decryptData(partner.smtpPassword);

            partnerSmtpSettings = {
              useCustomSmtp: true,
              smtpHost: partner.smtpHost,
              smtpPort: partner.smtpPort || 587,
              smtpUsername: partner.smtpUsername,
              smtpPassword: decryptedPassword,
              smtpFromEmail: partner.smtpFromEmail || fromEmail,
              smtpFromName: partner.smtpFromName || partnerBranding.businessName,
              // SES settings (disabled)
              sesDomainEnabled: partner.sesDomainEnabled || false,
              useSESDomain: false,
              sesDomain: partner.sesDomain || undefined,
              sesDomainStatus: partner.sesDomainStatus || undefined,
              sesFromEmail: partner.sesFromEmail || undefined,
              sesFromName: partner.sesFromName || undefined
            };
          } else {
            logger.info('Partner has no email service configured for password reset, using SendGrid', {
              operation: 'email',
              partnerId: data.partnerId
            });
          }
        } else {
          logger.info('Partner not found for password reset, using SendGrid', {
            operation: 'email',
            partnerId: data.partnerId
          });
        }
      } catch (dbError) {
        logger.error('Error fetching partner SMTP settings for password reset', dbError as Error, {
          operation: 'email',
          partnerId: data.partnerId
        });
        // Continue with SendGrid if there's an error
      }
    }

    // Send the email with custom HTML
    try {
      const result = await sendEmail({
        to: data.to,
        subject: subject,
        from: partnerSmtpSettings?.smtpFromEmail || fromEmail,
        fromName: partnerSmtpSettings?.smtpFromName || partnerBranding.businessName,
        html: htmlContent,
        contactVariables: data.contactVariables,
        // Email tracking
        partnerId: data.partnerId,
        emailType: 'customer_password_reset'
      }, partnerSmtpSettings);

      logger.info('Customer team password reset email sent', {
        operation: 'email',
        success: result.success
      });
      return result;
    } catch (sendError) {
      logger.error('Failed to send customer team password reset email', sendError as Error, {
        operation: 'email'
      });
      throw sendError;
    }
  } catch (error) {
    logger.error('Error in sendCustomerTeamPasswordReset function', error as Error, {
      operation: 'email'
    });
    throw error;
  }
}

export async function sendWaitlistEmail(data: WaitlistEmailData) {
  // Use the template if available, otherwise fall back to a simple email
  if (WAITLIST_TEMPLATE_ID) {
    return await sendEmail({
      to: data.to,
      subject: 'Welcome to the Knotie-AI Pro Waitlist!',
      html: '', // Not used when using a template
      templateId: WAITLIST_TEMPLATE_ID,
      dynamicTemplateData: {
        name: data.name,
        email: data.to,
        position: data.position,
        referral_code: data.referralCode,
        unsubscribe: 'https://knotie-ai.pro/unsubscribe'
      }
    });
  } else {
    // Enhanced fallback HTML email with better styling
    return await sendEmail({
      to: data.to,
      subject: 'Welcome to the Knotie-AI Pro Waitlist!',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #333; background-color: #f9f9f9; border-radius: 10px;">
          <div style="text-align: center; margin-bottom: 20px;">
            <img src="${process.env.NEXT_PUBLIC_APP_URL || 'https://knotie-ai.pro'}/Knotie_logo.svg" alt="Knotie-AI Pro Logo" style="max-width: 150px; height: auto;" />
          </div>

          <div style="background-color: #ffffff; padding: 30px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
            <h1 style="color: #2563eb; margin-top: 0; font-size: 24px;">Welcome to the Knotie-AI Pro Waitlist!</h1>

            <p style="font-size: 16px; line-height: 1.5;">Hi ${data.name},</p>

            <p style="font-size: 16px; line-height: 1.5;">Thank you for joining our waitlist for Knotie-AI Pro! We're building the ultimate platform for voice AI agencies, and we're thrilled to have you on board.</p>

            <div style="background-color: #f0f7ff; padding: 15px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #2563eb;">
              <p style="margin: 0; font-size: 16px;">Your current position: <strong style="color: #2563eb; font-size: 18px;">#${data.position}</strong></p>
            </div>

            <p style="font-size: 16px; line-height: 1.5;"><strong>Want to move up in the queue?</strong> Share your unique referral link with others who might be interested:</p>

            <div style="background-color: #f5f5f5; padding: 12px; border-radius: 6px; margin: 15px 0; word-break: break-all; font-family: monospace;">
              https://knotie-ai.pro/waitlist?ref=${data.referralCode}
            </div>

            <p style="font-size: 16px; line-height: 1.5;">For each person who joins using your link, you'll move up 5 spots in the queue!</p>

            <p style="font-size: 16px; line-height: 1.5;">We'll keep you updated on our progress and let you know when you're granted access.</p>

            <p style="font-size: 16px; line-height: 1.5; margin-bottom: 0;">Best regards,<br><strong>The Knotie-AI Pro Team</strong></p>
          </div>

          <div style="text-align: center; margin-top: 20px; color: #666; font-size: 12px;">
            <p> 2025 Knotie-AI Pro. All rights reserved.</p>
            <p>If you didn't sign up for our waitlist, please ignore this email.</p>
          </div>
        </div>
      `,
    });
  }
}
