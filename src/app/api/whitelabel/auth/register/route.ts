import { NextRequest, NextResponse } from 'next/server';

// This route uses dynamic features, so it must be server-rendered
export const dynamic = 'force-dynamic';

import { prisma } from '@/lib/prisma';
import bcrypt from 'bcrypt';
import crypto from 'crypto';
import { onboardCustomerTwilioSubaccount } from '@/lib/twilio-subaccount';
import { sendEmail } from '@/lib/email';
import { decrypt } from '@/lib/encryption';
import { applyPlanFeaturesToCustomer, getPartnerDefaultPlan } from '@/lib/services/planFeatureService';
import { logger } from '@/lib/logger';
import { sendPaymentConfirmationEmail } from '@/lib/emails/paymentConfirmationEmail';
import { z } from 'zod';

const registerSchema = z.object({
  name: z.string().min(1, 'Name is required').max(200),
  email: z.string().email('Invalid email address').max(320),
  password: z.string().min(8, 'Password must be at least 8 characters').max(128),
  planId: z.string().uuid().nullish(), // Accept null, undefined, or valid UUID
  referralId: z.string().nullish(), // Accept null, undefined, or string
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validationResult = registerSchema.safeParse(body);
    if (!validationResult.success) {
      return NextResponse.json(
        { error: validationResult.error.errors[0]?.message || 'Invalid input' },
        { status: 400 }
      );
    }
    const { name, email, password, planId } = validationResult.data;

    /**
     * Note: referralId may be sent from client but is not used in this route.
     * Referral tracking works as follows:
     * 1. Client-side: Rewardful JS automatically tracks leads when users visit ?via=referral-code
     * 2. Stripe checkout: referralId is passed as metadata for conversion tracking
     * 3. Webhook: Only paid conversions are tracked server-side via Stripe webhook
     * 4. Database: No referral data stored since Rewardful manages lead attribution
     */

    // Get the partner ID from the x-partner-id header (set by our middleware)
    const partnerId = request.headers.get('x-partner-id');

    logger.info('Whitelabel registration attempt', { operation: 'whitelabel-register', email, partnerId: partnerId || undefined });

    if (!partnerId) {
      logger.warn('Registration failed: No partner ID found in headers', { operation: 'whitelabel-register' });
      return NextResponse.json(
        { error: 'Partner not found' },
        { status: 404 }
      );
    }

    // Fetch partner settings (including AI Gateway auto-enable for new customers)
    const partner = await prisma.partner.findUnique({
      where: { id: partnerId },
      select: {
        customerGatewayEnabled: true,
        customerGatewayForNewCustomers: true,
      }
    });

    // Determine if AI Gateway should be auto-enabled for this new customer
    const autoEnableGateway = !!(partner?.customerGatewayEnabled && partner?.customerGatewayForNewCustomers);

    // Check if customer with this email already exists for this partner
    // @ts-ignore
    const existingCredential = await prisma.customerCredential.findUnique({
      where: {
        partnerId_email: {
          partnerId,
          email,
        },
      },
    });

    if (existingCredential) {
      return NextResponse.json(
        { error: 'An account with this email already exists' },
        { status: 409 }
      );
    }

    // Hash the password
    const passwordHash = await bcrypt.hash(password, 10);

    // Create a new customer if they don't exist
    // Note: Multiple partners can serve the same customer email, but with different credentials

    // First, check if a customer record with this email exists
    let customer = await prisma.customer.findFirst({
      where: { email }
    });

    // If not, create a new customer
    if (!customer) {
      logger.info('Creating new customer record', { operation: 'whitelabel-register', email });
      customer = await prisma.customer.create({
        data: {
          email,
          // Split name into firstName for compatibility
          firstName: name,
          status: 'active',
          userId: `usr_${crypto.randomUUID().replace(/-/g, '').substring(0, 12)}`, // Secure random user ID
          customerPortalEnabled: true, // Enable portal access for self-registered users
        },
      });
      logger.info('Created new customer', { operation: 'whitelabel-register', customerId: customer.id });
    } else {
      logger.info('Using existing customer', { operation: 'whitelabel-register', customerId: customer.id });
      // For existing customers, ensure portal access is enabled
      await prisma.customer.update({
        where: { id: customer.id },
        data: {
          customerPortalEnabled: true,
        },
      });
    }

    // IMPORTANT: Link any existing UserOnboarding records to this customer
    // This fixes the relationship issue where customers self-register but UserOnboarding records aren't linked
    const existingUserOnboarding = await prisma.userOnboarding.findMany({
      where: {
        partnerId,
        email,
        customerId: null, // Only update records that aren't already linked
      }
    });

    if (existingUserOnboarding.length > 0) {
      logger.info('Found existing UserOnboarding records, linking to customer', { operation: 'whitelabel-register', count: existingUserOnboarding.length, email, customerId: customer.id });

      // Update all matching UserOnboarding records to link to this customer
      await prisma.userOnboarding.updateMany({
        where: {
          partnerId,
          email,
          customerId: null,
        },
        data: {
          customerId: customer.id,
        }
      });

      logger.info('Successfully linked UserOnboarding records', { operation: 'whitelabel-register', count: existingUserOnboarding.length, customerId: customer.id });
    } else {
      logger.info('No existing UserOnboarding records found, creating new', { operation: 'whitelabel-register', email, partnerId });

      // Create a new UserOnboarding record for this customer registration
      // This ensures there's always a UserOnboarding record for partner-customer relationships
      await prisma.userOnboarding.create({
        data: {
          id: `uo_${crypto.randomUUID().replace(/-/g, '').substring(0, 12)}`,
          userId: customer.userId,
          email: customer.email,
          firstName: customer.firstName,
          lastName: customer.lastName || null,
          partnerId,
          customerId: customer.id,
          isOnboardingCompleted: true,
          customerPortalEnabled: true, // Since they're registering for portal access
          // Auto-enable AI Gateway if partner has new customer gateway enabled
          ...(autoEnableGateway && { showAiGateway: true }),
        }
      });

      // If auto-enabling AI Gateway, also enable AI Credits on the Customer record
      if (autoEnableGateway) {
        await prisma.customer.update({
          where: { id: customer.id },
          data: { aiCreditsEnabled: true }
        });
        logger.info('Auto-enabled AI Gateway and AI Credits for new customer', { operation: 'whitelabel-register', customerId: customer.id, partnerId });
      }

      logger.info('Created new UserOnboarding record', { operation: 'whitelabel-register', customerId: customer.id, partnerId });
    }

    // Check if payment is required before completing registration (pay-first flow)
    let planIdToApply: string | undefined = planId || undefined;
    
    if (!planIdToApply) {
      // No planId provided - get partner's default plan
      planIdToApply = (await getPartnerDefaultPlan(partnerId)) || undefined;
      
      if (planIdToApply) {
        logger.info('No planId provided during registration, using partner default plan', {
          operation: 'whitelabel-register',
          partnerId,
          customerId: customer.id,
          planId: planIdToApply
        });
      }
    }

    // Query plan details at outer scope so it's accessible in both payment and no-payment paths
    let plan: {
      id: string;
      name: string;
      trialPeriodDays: number | null;
      requireCardForTrial: boolean;
      amount: number;
      stripePriceId: string;
    } | null = null;
    if (planIdToApply) {
      // @ts-ignore - Prisma select narrowing
      plan = await prisma.subscriptionPlan.findUnique({
        where: { id: planIdToApply },
        select: {
          id: true,
          name: true,
          trialPeriodDays: true,
          requireCardForTrial: true,
          amount: true,
          stripePriceId: true
        }
      });
    }

    // Generate email verification token BEFORE payment check
    // so credentials exist regardless of payment flow
    const verificationToken = crypto.randomBytes(32).toString('hex');
    const verificationExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours from now

    // Create customer credentials BEFORE payment check
    // This ensures the customer can log in after payment completes
    // @ts-ignore
    const customerCredential = await prisma.customerCredential.create({
      data: {
        customerId: customer.id,
        partnerId,
        email,
        passwordHash,
        status: 'active',
        lastReset: new Date(), // Mark that user has set their own password
        emailVerified: false, // Require email verification
        magicLinkToken: verificationToken,
        magicLinkExpiry: verificationExpiry,
        magicLinkUsed: false,
        magicLinkType: 'email_verification',
      },
    });

    // Create Twilio subaccount for the customer (non-blocking)
    onboardCustomerTwilioSubaccount(customer.id, partnerId).catch(error => {
      logger.error('Failed to create Twilio subaccount for customer', error instanceof Error ? error : new Error(String(error)), { operation: 'whitelabel-register', customerId: customer.id, partnerId });
    });

    // If we have a plan, check if payment is required
    if (plan) {
      const hasTrialPeriod = plan.trialPeriodDays && plan.trialPeriodDays > 0;
      const requiresCardForTrial = plan.requireCardForTrial || false;
      const needsPayment = !hasTrialPeriod || requiresCardForTrial;

      if (needsPayment) {
        // Payment required - return checkout URL instead of completing registration
        logger.info('Payment required for registration, creating checkout session', {
          operation: 'whitelabel-register',
          customerId: customer.id,
          partnerId,
          planId: planIdToApply,
          hasTrialPeriod,
          requiresCardForTrial
        });

        // Create checkout session
        try {
          const Stripe = (await import('stripe')).default;
          const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
            apiVersion: '2023-10-16',
          });

          // Get partner Stripe account (with email fields for verification email)
          const partner = await prisma.partner.findUnique({
            where: { id: partnerId },
            select: {
              stripeAccountId: true,
              businessName: true,
              contactName: true,
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
              sesFromName: true,
            }
          });

          if (!partner?.stripeAccountId) {
            logger.error('Partner missing Stripe account for payment', new Error('No Stripe account'), {
              operation: 'whitelabel-register',
              partnerId
            });
            return NextResponse.json(
              { error: 'Payment processing not configured. Please contact support.' },
              { status: 400 }
            );
          }

          // Determine base URL - use request origin for local dev compatibility (BUG 11 fix)
          const requestOrigin = request.headers.get('origin');
          const baseUrl = requestOrigin 
            || (partner.customDomainVerified && partner.customDomain
              ? `https://${partner.customDomain}`
              : `https://${partner.subdomain}.knotie-ai.pro`);

          // Include partnerId in success URL for Stripe Connect session retrieval (BUG 12 fix)
          const successUrl = `${baseUrl}/whitelabel/payment-success?session_id={CHECKOUT_SESSION_ID}&partner_id=${partnerId}`;
          const cancelUrl = `${baseUrl}/whitelabel/register`;

          const checkoutParams: any = {
            mode: 'subscription',
            payment_method_types: ['card'],
            line_items: [
              {
                price: plan.stripePriceId,
                quantity: 1,
              }
            ],
            customer_email: email,
            client_reference_id: customer.id,
            success_url: successUrl,
            cancel_url: cancelUrl,
            metadata: {
              type: 'onboarding_subscription',
              customerId: customer.id,
              partnerId,
              planId: planIdToApply,
              partnerName: partner.businessName,
              isRegistrationFlow: 'true'
            },
            subscription_data: {
              metadata: {
                type: 'onboarding_subscription',
                customerId: customer.id,
                partnerId,
                planId: planIdToApply
              }
            }
          };

          // Add trial period if plan has one
          if (plan.trialPeriodDays && plan.trialPeriodDays > 0) {
            checkoutParams.subscription_data.trial_period_days = plan.trialPeriodDays;
          }

          checkoutParams.payment_method_collection = 'always';

          const session = await stripe.checkout.sessions.create(
            checkoutParams,
            { stripeAccount: partner.stripeAccountId }
          );

          logger.info('Checkout session created for registration', {
            operation: 'whitelabel-register',
            sessionId: session.id,
            customerId: customer.id
          });

          // Send verification email before redirecting to payment
          try {
            await sendEmailVerificationEmail(
              customerCredential,
              partner,
              verificationToken,
              name
            );
            logger.info('Email verification email sent before payment redirect', {
              operation: 'whitelabel-register',
              customerId: customer.id,
              email
            });
          } catch (emailError) {
            logger.error('Failed to send verification email before payment redirect',
              emailError instanceof Error ? emailError : new Error(String(emailError)),
              { operation: 'whitelabel-register', customerId: customer.id }
            );
          }

          return NextResponse.json({
            success: true,
            requiresPayment: true,
            checkoutUrl: session.url,
            plan: {
              name: plan.name,
              amount: plan.amount,
              trialPeriodDays: plan.trialPeriodDays
            },
            message: 'Payment required to complete registration'
          });
        } catch (stripeError) {
          logger.error(
            'Failed to create checkout session for registration',
            stripeError instanceof Error ? stripeError : new Error(String(stripeError)),
            {
              operation: 'whitelabel-register',
              customerId: customer.id,
              partnerId
            }
          );
          return NextResponse.json(
            { error: 'Failed to create payment session. Please try again.' },
            { status: 500 }
          );
        }
      }
    }

    // No payment required - continue with normal registration flow
    // Apply plan features to the customer
    try {
      if (planIdToApply) {
        logger.info('Applying plan features during customer registration', {
          operation: 'whitelabel-register',
          planId: planIdToApply,
          customerId: customer.id,
          partnerId
        });
        
        await applyPlanFeaturesToCustomer(planIdToApply, customer.id, partnerId);
        
        logger.info('Successfully applied plan features to customer', {
          operation: 'whitelabel-register',
          planId: planIdToApply,
          customerId: customer.id,
          partnerId
        });

        // Send payment confirmation email for trial-without-card flow
        try {
          await sendPaymentConfirmationEmail({
            customerId: customer.id,
            partnerId,
            planId: planIdToApply,
            trialEnd: plan?.trialPeriodDays 
              ? new Date(Date.now() + plan.trialPeriodDays * 24 * 60 * 60 * 1000)
              : null
          });
          logger.info('Payment confirmation email sent for trial registration', {
            operation: 'whitelabel-register',
            customerId: customer.id,
            email
          });
        } catch (emailError) {
          logger.error(
            'Failed to send payment confirmation email during registration',
            emailError instanceof Error ? emailError : new Error(String(emailError)),
            {
              operation: 'whitelabel-register',
              customerId: customer.id
            }
          );
        }
      }
    } catch (planError) {
      logger.error(
        'Failed to apply plan features during registration',
        planError instanceof Error ? planError : new Error(String(planError)),
        {
          operation: 'whitelabel-register',
          customerId: customer.id,
          partnerId,
          planId: planIdToApply
        }
      );
    }

    // Don't create JWT token yet - user needs to verify email first

    // Send email verification email to the new customer
    try {
      // Get partner details for branding the email and email configuration
      const partner = await prisma.partner.findUnique({
        where: { id: partnerId },
        select: {
          id: true,
          businessName: true,
          contactName: true,
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
          sesFromName: true,
        }
      });

      if (partner) {
        await sendEmailVerificationEmail(
          customerCredential,
          partner,
          verificationToken,
          name
        );

        logger.info('Email verification email sent to new customer', { operation: 'whitelabel-register', email });
      }
    } catch (emailError) {
      logger.error('Failed to send email verification email', emailError instanceof Error ? emailError : new Error(String(emailError)), { operation: 'whitelabel-register', email });
    }

    logger.info('Whitelabel registration completed successfully', {
      operation: 'whitelabel-register',
      customerId: customer.id,
      email,
      emailVerificationRequired: true
    });

    return NextResponse.json({
      success: true,
      emailVerificationRequired: true,
      message: 'Account created successfully! Please check your email and click the verification link to complete your registration.',
      customer: {
        id: customer.id,
        name: customer.firstName || 'Customer',
        email,
      },
    });
  } catch (error) {
    logger.error('Error during customer registration', error instanceof Error ? error : new Error(String(error)), { operation: 'whitelabel-register' });
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// Helper function to send email verification email
async function sendEmailVerificationEmail(
  customerCredential: any,
  partner: any,
  verificationToken: string,
  customerName: string
) {
  // Determine the portal URL - always use partner domain for emails
  const baseUrl = partner.customDomainVerified && partner.customDomain
    ? `https://${partner.customDomain}`
    : `https://${partner.subdomain}.knotie-ai.pro`;

  // Determine the correct URL prefix based on ENABLE_PLATFORM_URLS setting
  const enablePlatformUrls = process.env.ENABLE_PLATFORM_URLS !== 'false';
  const urlPrefix = enablePlatformUrls ? '/platform' : '/whitelabel';

  const verificationUrl = `${baseUrl}${urlPrefix}/verify-email?token=${verificationToken}`;

  // Prepare email settings - check SES first, then SMTP, similar to sendCustomerPortalInvite
  let partnerSmtpSettings;

  // Priority 1: Check for SES Domain Email Service first
  if (partner.sesDomainEnabled && partner.useSESDomain && partner.sesDomainStatus === 'verified') {
    logger.info('Using partner SES domain settings for email verification', { operation: 'whitelabel-register' });
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
      sesFromEmail: partner.sesFromEmail || `noreply@${partner.sesDomain}`,
      sesFromName: partner.sesFromName || partner.businessName
    };
  } else if (partner.useCustomSmtp && partner.smtpHost && partner.smtpUsername && partner.smtpPassword && !partner.sesDomainEnabled) {
    logger.info('Using partner SMTP settings for email verification', { operation: 'whitelabel-register' });
    // Decrypt the SMTP password
    const decryptedPassword = await decrypt(partner.smtpPassword);

    partnerSmtpSettings = {
      useCustomSmtp: true,
      smtpHost: partner.smtpHost,
      smtpPort: partner.smtpPort || 587,
      smtpUsername: partner.smtpUsername,
      smtpPassword: decryptedPassword,
      smtpFromEmail: partner.smtpFromEmail || 'noreply@knotie-ai.pro',
      smtpFromName: partner.smtpFromName || partner.businessName,
      // SES settings (disabled)
      sesDomainEnabled: partner.sesDomainEnabled || false,
      useSESDomain: false,
      sesDomain: partner.sesDomain || undefined,
      sesDomainStatus: partner.sesDomainStatus || undefined,
      sesFromEmail: partner.sesFromEmail || undefined,
      sesFromName: partner.sesFromName || undefined
    };
  } else {
    logger.info('Partner has no email service configured, using SendGrid for email verification', { operation: 'whitelabel-register' });
  }

  // Create HTML email content for verification
  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Verify Your Email - ${partner.businessName}</title>
    </head>
    <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="text-align: center; margin-bottom: 30px;">
        ${partner.logo ? `<img src="${partner.logo}" alt="${partner.businessName}" style="max-width: 150px; height: auto;">` : ''}
        <h1 style="color: ${partner.primaryColor || '#3B82F6'}; margin-top: 20px;">Welcome to ${partner.businessName}!</h1>
      </div>

      <div style="background-color: #f8f9fa; padding: 30px; border-radius: 10px; margin-bottom: 30px;">
        <h2 style="color: #333; margin-top: 0;">Verify Your Email Address</h2>
        <p>Hi ${customerName},</p>
        <p>Thank you for creating an account with ${partner.businessName}! To complete your registration and access your portal, please verify your email address by clicking the button below.</p>

        <div style="text-align: center; margin: 30px 0;">
          <a href="${verificationUrl}" style="background-color: ${partner.primaryColor || '#3B82F6'}; color: white; padding: 15px 30px; text-decoration: none; border-radius: 5px; font-weight: bold; display: inline-block;">Verify Email Address</a>
        </div>

        <p style="color: #666; font-size: 14px;">If the button doesn't work, you can also copy and paste this link into your browser:</p>
        <p style="word-break: break-all; color: #666; font-size: 14px;">${verificationUrl}</p>

        <p style="color: #666; font-size: 14px; margin-top: 30px;">This verification link will expire in 24 hours for security reasons.</p>
      </div>

      <div style="text-align: center; color: #666; font-size: 12px;">
        <p>This email was sent by ${partner.businessName}. If you didn't create an account, you can safely ignore this email.</p>
      </div>
    </body>
    </html>
  `;

  await sendEmail({
    to: customerCredential.email,
    subject: `Verify Your Email - ${partner.businessName} Portal`,
    html: htmlContent,
    from: partnerSmtpSettings?.smtpFromEmail,
    fromName: partnerSmtpSettings?.smtpFromName || partner.businessName,
    // Email tracking
    partnerId: partner.id,
    customerId: customerCredential.customerId,
    emailType: 'email_verification'
  }, partnerSmtpSettings);
}
