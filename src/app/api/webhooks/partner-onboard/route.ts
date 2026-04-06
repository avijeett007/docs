import { NextResponse, NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { generatePartnerCode } from '@/lib/server-utils';
import { isWebhookProcessed } from '@/lib/webhookSecurity';
import { validateMarketingWebhookApiKey, checkApiKeyRateLimit, getApiKeyRateLimitHeaders } from '@/lib/marketingWebhookAuth';
import { sendPartnerWelcomeEmail, sendMarketingWelcomeEmail } from '@/lib/email';
import { provisionPartnerInAnalytics } from '@/lib/analytics-service';
import { generateSecurePassword } from '@/lib/utils';
import { TierValidationService, MarketingTier } from '@/lib/services/tierValidationService';
import { logger } from '@/lib/logger';
import { obfuscateEmail, obfuscateId, obfuscatePhoneNumber } from '@/lib/pii-obfuscation';
import bcrypt from 'bcryptjs';

// This route uses dynamic features, so it must be server-rendered
export const dynamic = 'force-dynamic';

/**
 * Process metadata to create custom limits for partner provisioning
 * Supports both specific agent limits and total agent allocation
 *
 * @param metadata - Webhook metadata containing limit specifications
 * @returns Processed custom limits or null if no metadata provided
 *
 * Examples:
 * 1. Simple limits: { customers_allowed: 10, total_agents_allowed: 5 }
 * 2. Specific limits: { customers_allowed: 20, vapi_agents_allowed: 3, retell_agents_allowed: 2 }
 * 3. Mixed: { customers_allowed: 15, total_agents_allowed: 8, saas_mode_enabled: true }
 */
function processMetadataToLimits(metadata?: WebhookPartnerData['metadata']) {
  if (!metadata) return null;

  const limits: WebhookPartnerData['customLimits'] = {};

  // Set customer limit
  if (metadata.customers_allowed !== undefined) {
    limits.maxCustomers = metadata.customers_allowed;
  }

  // Handle agent limits - specific limits take precedence over total allocation
  const specificAgentLimits = {
    maxVapiAgents: metadata.vapi_agents_allowed,
    maxRetellAgents: metadata.retell_agents_allowed,
    maxUltravoxAgents: metadata.ultravox_agents_allowed,
    maxElevenlabsAgents: metadata.elevenlabs_agents_allowed,
    maxGhlAgents: metadata.ghl_agents_allowed,
    maxKnovaAgents: metadata.knova_agents_allowed,
  };

  // Check if any specific agent limits are provided
  const hasSpecificLimits = Object.values(specificAgentLimits).some(limit => limit !== undefined);

  if (hasSpecificLimits) {
    // Use specific agent limits
    Object.entries(specificAgentLimits).forEach(([key, value]) => {
      if (value !== undefined) {
        (limits as any)[key] = value;
      }
    });
  } else if (metadata.total_agents_allowed !== undefined) {
    // Distribute total agents equally across all providers
    const totalAgents = metadata.total_agents_allowed;
    const agentTypes = ['maxVapiAgents', 'maxRetellAgents', 'maxUltravoxAgents', 'maxElevenlabsAgents', 'maxGhlAgents', 'maxKnovaAgents'];
    const agentsPerType = Math.floor(totalAgents / agentTypes.length);
    const remainder = totalAgents % agentTypes.length;

    agentTypes.forEach((agentType, index) => {
      // Distribute remainder to first few agent types
      const extraAgent = index < remainder ? 1 : 0;
      (limits as any)[agentType] = agentsPerType + extraAgent;
    });
  }

  // Set SaaS mode
  if (metadata.saas_mode_enabled !== undefined) {
    limits.saasMode = metadata.saas_mode_enabled;
  }

  return Object.keys(limits).length > 0 ? limits : null;
}

interface WebhookPartnerData {
  businessName: string;
  emailAddress: string;
  phoneNumber: string;
  contactName?: string;
  businessAddress?: string;
  areaOfBusiness?: string;
  expertise?: string;
  partnershipType?: string;
  country?: string;
  couponCode?: string;
  planId?: string;
  billingInterval?: 'monthly' | 'yearly' | 'lifetime';
  // Marketing funnel specific fields
  funnelId?: string;
  campaignId?: string;
  source?: string;
  medium?: string;
  // Payment information (if payment was processed externally)
  externalPaymentId?: string;
  paymentAmount?: number;
  paymentStatus?: 'paid' | 'pending';
  // Tier configuration
  marketingTier?: MarketingTier;
  customLimits?: {
    maxCustomers?: number;
    maxVapiAgents?: number;
    maxRetellAgents?: number;
    maxUltravoxAgents?: number;
    maxElevenlabsAgents?: number;
    maxGhlAgents?: number;
    maxKnovaAgents?: number;
    saasMode?: boolean;
  };
  // Enhanced metadata for dynamic provisioning
  metadata?: {
    customers_allowed?: number;
    total_agents_allowed?: number;
    // Optional specific agent limits
    vapi_agents_allowed?: number;
    retell_agents_allowed?: number;
    ultravox_agents_allowed?: number;
    elevenlabs_agents_allowed?: number;
    ghl_agents_allowed?: number;
    knova_agents_allowed?: number;
    saas_mode_enabled?: boolean;
    // Credit provisioning
    credits?: number;
    credit_type?: 'one_time' | 'monthly';
    credit_duration_months?: number; // For monthly credits
  };
  // Webhook metadata
  webhookId: string;
  timestamp: number;
}

interface WebhookRequest {
  // Structured format
  action?: 'partner.onboard';
  data?: WebhookPartnerData;
  webhookId?: string;
  timestamp?: number;

  // Direct format (legacy) - allow all WebhookPartnerData fields at top level
  businessName?: string;
  emailAddress?: string;
  phoneNumber?: string;
  paymentStatus?: string;
  metadata?: {
    customers_allowed?: number;
    total_agents_allowed?: number;
    vapi_agents_allowed?: number;
    retell_agents_allowed?: number;
    ultravox_agents_allowed?: number;
    elevenlabs_agents_allowed?: number;
    ghl_agents_allowed?: number;
    knova_agents_allowed?: number;
    saas_mode_enabled?: boolean;
    // Credit provisioning
    credits?: number;
    credit_type?: 'one_time' | 'monthly';
    credit_duration_months?: number; // For monthly credits
  };
  customLimits?: any;
  marketingTier?: MarketingTier;
  couponCode?: string;
  source?: string;
  campaignId?: string;
}

function toError(error: unknown): Error {
  return error instanceof Error ? error : new Error(String(error));
}

/**
 * Process credit provisioning for newly onboarded partners
 */
async function processCreditProvisioning(
  partnerId: string,
  metadata: {
    credits?: number;
    credit_type?: 'one_time' | 'monthly';
    credit_duration_months?: number;
  }
) {
  try {
    const { credits, credit_type = 'one_time', credit_duration_months } = metadata;

    if (!credits || credits <= 0) {
      return;
    }

    logger.info('Processing marketing webhook credit provisioning', {
      operation: 'marketing_webhook_credit_provisioning',
      partnerId: obfuscateId(partnerId),
      credits,
      creditType: credit_type,
      creditDurationMonths: credit_duration_months
    });

    // For one-time credits, add them directly to the partner's balance
    if (credit_type === 'one_time') {
      await prisma.$transaction(async (tx) => {
        const updatedPartner = await tx.partner.update({
          where: { id: partnerId },
          data: {
            creditBalance: {
              increment: credits
            }
          },
          select: { creditBalance: true }
        });

        // Log the credit transaction
        await tx.creditTransaction.create({
          data: {
            partnerId,
            amount: credits,
            type: 'allocation',
            description: 'Marketing webhook onboarding - One-time credit grant',
            createdBy: 'system@knotie-ai.pro',
            balanceAfter: updatedPartner.creditBalance
          }
        });
      });

      logger.info('Added one-time credits for partner from marketing webhook', {
        operation: 'marketing_webhook_credit_provisioning',
        partnerId: obfuscateId(partnerId),
        credits,
        creditType: credit_type
      });
    }

    // For monthly recurring credits, set up monthly allocation
    else if (credit_type === 'monthly') {
      await prisma.$transaction(async (tx) => {
        // Set monthly allocation
        const updatedPartner = await tx.partner.update({
          where: { id: partnerId },
          data: {
            monthlyCreditAllocation: credits,
            lastCreditAllocationDate: new Date(),
            creditBalance: {
              increment: credits // Give first month immediately
            }
          },
          select: { creditBalance: true }
        });

        // Log the initial credit transaction
        await tx.creditTransaction.create({
          data: {
            partnerId,
            amount: credits,
            type: 'allocation',
            description: 'Marketing webhook onboarding - Monthly credit allocation (first month)',
            createdBy: 'system@knotie-ai.pro',
            balanceAfter: updatedPartner.creditBalance
          }
        });

        // If duration is specified, create a recurring grant
        if (credit_duration_months && credit_duration_months > 1) {
          const endDate = new Date();
          endDate.setMonth(endDate.getMonth() + credit_duration_months);

          await tx.adminCreditGrant.create({
            data: {
              partnerId,
              grantedBy: 'system@knotie-ai.pro',
              creditsGranted: credits,
              grantType: 'monthly_recurring',
              totalGranted: credits, // First month already granted
              nextGrantDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // Next month
              recurringEndDate: endDate,
              status: 'active',
              reason: 'Marketing webhook onboarding - Monthly recurring credits'
            }
          });
        }
      });

      if (credit_duration_months && credit_duration_months > 1) {
        logger.info('Configured monthly recurring credits from marketing webhook', {
          operation: 'marketing_webhook_credit_provisioning',
          partnerId: obfuscateId(partnerId),
          credits,
          creditType: credit_type,
          creditDurationMonths: credit_duration_months
        });
      } else {
        logger.info('Configured indefinite monthly credits from marketing webhook', {
          operation: 'marketing_webhook_credit_provisioning',
          partnerId: obfuscateId(partnerId),
          credits,
          creditType: credit_type
        });
      }
    }

  } catch (error) {
    logger.error('Error processing credit provisioning from marketing webhook', toError(error), {
      operation: 'marketing_webhook_credit_provisioning',
      partnerId: obfuscateId(partnerId)
    });
    // Don't throw error to avoid breaking partner creation
    // Credits can be manually added later if needed
  }
}

// POST /api/webhooks/partner-onboard - Secure webhook for external partner onboarding
export async function POST(req: NextRequest) {
  logger.info('Marketing webhook received for partner onboarding', {
    operation: 'marketing_partner_onboard_webhook'
  });

  try {
    // Read the raw body first
    const rawBody = await req.text();

    // Check for API key authentication
    const apiKey = req.headers.get('x-api-key') || req.headers.get('authorization')?.replace('Bearer ', '');

    if (!apiKey) {
      return NextResponse.json(
        { success: false, error: 'API key is required. Provide X-API-Key header or Authorization Bearer token.' },
        { status: 401 }
      );
    }

    // Validate API key against database
    const apiKeyValidation = await validateMarketingWebhookApiKey(apiKey);

    if (!apiKeyValidation.isValid) {
      logger.warn('Marketing webhook API key validation failed', {
        operation: 'marketing_partner_onboard_webhook',
        validationError: apiKeyValidation.error || 'Unknown API key validation error'
      });
      return NextResponse.json(
        { success: false, error: apiKeyValidation.error || 'Invalid API key' },
        { status: 401 }
      );
    }

    logger.info('Marketing webhook API key authentication successful', {
      operation: 'marketing_partner_onboard_webhook',
      keyId: apiKeyValidation.keyId ? obfuscateId(apiKeyValidation.keyId) : undefined
    });

    // Check per-minute rate limit if configured
    if (apiKeyValidation.rateLimit?.perMinute) {
      const rateLimitCheck = checkApiKeyRateLimit(apiKeyValidation.keyId!, apiKeyValidation.rateLimit.perMinute);
      if (!rateLimitCheck.allowed) {
        logger.warn('Marketing webhook per-minute rate limit exceeded', {
          operation: 'marketing_partner_onboard_webhook',
          keyId: apiKeyValidation.keyId ? obfuscateId(apiKeyValidation.keyId) : undefined
        });
        const headers = getApiKeyRateLimitHeaders(apiKeyValidation.keyId!, apiKeyValidation.rateLimit);
        return NextResponse.json(
          {
            success: false,
            error: 'Rate limit exceeded',
            retryAfter: rateLimitCheck.resetTime ? Math.ceil(rateLimitCheck.resetTime / 1000) : undefined
          },
          {
            status: 429,
            headers
          }
        );
      }
    }

    // Parse the JSON body
    let body: WebhookRequest;
    try {
      body = JSON.parse(rawBody);
    } catch (error) {
      logger.warn('Invalid JSON in marketing partner onboarding webhook body', {
        operation: 'marketing_partner_onboard_webhook'
      });
      return NextResponse.json(
        { success: false, error: 'Invalid JSON payload' },
        { status: 400 }
      );
    }

    // Handle both webhook formats for backward compatibility
    let partnerData: WebhookPartnerData;

    // Check if this is the new structured format with action wrapper
    if (body.action === 'partner.onboard' && body.data) {
      logger.debug('Processing structured marketing webhook payload format', {
        operation: 'marketing_partner_onboard_webhook'
      });
      partnerData = body.data;
    }
    // Handle direct partner data format (legacy/simplified)
    else if (body.businessName && body.emailAddress && body.phoneNumber) {
      logger.debug('Processing legacy direct marketing webhook payload format', {
        operation: 'marketing_partner_onboard_webhook'
      });
      partnerData = body as WebhookPartnerData;
    }
    // Invalid format
    else {
      logger.warn('Invalid marketing webhook payload format', {
        operation: 'marketing_partner_onboard_webhook',
        hasAction: !!body.action,
        hasData: !!body.data,
        hasBusinessName: !!body.businessName,
        hasEmailAddress: !!body.emailAddress,
        hasPhoneNumber: !!body.phoneNumber,
        bodyKeys: Object.keys(body)
      });
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid webhook format. Expected either structured format with "action" and "data" fields, or direct partner data with businessName, emailAddress, and phoneNumber'
        },
        { status: 400 }
      );
    }

    // Check for idempotency - prevent duplicate processing
    const idempotencyKey = `marketing_webhook_${body.webhookId}_${partnerData.emailAddress}`;
    const alreadyProcessed = await isWebhookProcessed(idempotencyKey);
    
    if (alreadyProcessed) {
      logger.info('Marketing webhook already processed (idempotent)', {
        operation: 'marketing_partner_onboard_webhook',
        idempotencyKey
      });
      return NextResponse.json({
        success: true,
        message: 'Webhook already processed',
        idempotencyKey
      });
    }

    // Validate required partner data
    if (!partnerData.businessName?.trim()) {
      logger.warn('Missing business name in marketing partner onboarding payload', {
        operation: 'marketing_partner_onboard_webhook',
        payloadKeys: Object.keys(partnerData)
      });
      return NextResponse.json(
        { success: false, error: 'Business Name is required' },
        { status: 400 }
      );
    }

    if (!partnerData.emailAddress?.trim()) {
      logger.warn('Missing email address in marketing partner onboarding payload', {
        operation: 'marketing_partner_onboard_webhook',
        payloadKeys: Object.keys(partnerData)
      });
      return NextResponse.json(
        { success: false, error: 'Email Address is required' },
        { status: 400 }
      );
    }

    if (!partnerData.phoneNumber?.trim()) {
      logger.warn('Missing phone number in marketing partner onboarding payload', {
        operation: 'marketing_partner_onboard_webhook',
        payloadKeys: Object.keys(partnerData)
      });
      return NextResponse.json(
        { success: false, error: 'Phone Number is required' },
        { status: 400 }
      );
    }

    // Email validation
    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    if (!emailRegex.test(partnerData.emailAddress)) {
      return NextResponse.json(
        { success: false, error: 'Invalid email address format' },
        { status: 400 }
      );
    }

    logger.info('Processing marketing partner onboarding payload', {
      operation: 'marketing_partner_onboard_webhook',
      emailAddress: obfuscateEmail(partnerData.emailAddress),
      phoneNumber: obfuscatePhoneNumber(partnerData.phoneNumber),
      couponCode: partnerData.couponCode,
      planId: partnerData.planId,
      billingInterval: partnerData.billingInterval,
      paymentStatus: partnerData.paymentStatus,
      source: partnerData.source
    });

    // Check if partner already exists
    const existingPartner = await prisma.partner.findUnique({
      where: { emailAddress: partnerData.emailAddress },
      select: {
        id: true,
        businessName: true,
        emailAddress: true,
        approvalStatus: true,
        planId: true,
        billingInterval: true
      }
    });

    let partner;
    let isNewPartner = false;

    if (existingPartner) {
      logger.info('Existing partner found; updating from marketing webhook payload', {
        operation: 'marketing_partner_onboard_webhook',
        partnerId: obfuscateId(existingPartner.id),
        emailAddress: obfuscateEmail(existingPartner.emailAddress)
      });
      
      // Update existing partner with new information
      partner = await prisma.partner.update({
        where: { id: existingPartner.id },
        data: {
          businessName: partnerData.businessName,
          phoneNumber: partnerData.phoneNumber,
          contactName: partnerData.contactName || partnerData.businessName,
          businessAddress: partnerData.businessAddress,
          areaOfBusiness: partnerData.areaOfBusiness || 'Marketing Funnel',
          expertise: partnerData.expertise || 'Voice AI',
          partnershipType: partnerData.partnershipType || 'reseller',
          country: partnerData.country || 'US',
          // Update plan information if provided
          ...(partnerData.planId && { planId: partnerData.planId }),
          ...(partnerData.billingInterval && { billingInterval: partnerData.billingInterval }),
          // Set approval status based on payment status
          approvalStatus: partnerData.paymentStatus === 'paid' ? 'ACTIVE' : 'PENDING'
        }
      });
    } else {
      logger.info('Creating new partner from marketing webhook payload', {
        operation: 'marketing_partner_onboard_webhook',
        emailAddress: obfuscateEmail(partnerData.emailAddress)
      });
      isNewPartner = true;

      // Generate a unique partner code
      const partnerCode = await generatePartnerCode();

      // Generate a random password for the partner
      const randomPassword = generateSecurePassword();
      const hashedPassword = await bcrypt.hash(randomPassword, 12);

      // Process metadata to create custom limits if provided
      const metadataLimits = processMetadataToLimits(partnerData.metadata);

      // Use metadata limits if available, otherwise fall back to customLimits
      const finalLimits = metadataLimits || partnerData.customLimits;

      logger.debug('Resolved partner limits for marketing webhook onboarding', {
        operation: 'marketing_partner_onboard_webhook',
        hasMetadata: !!partnerData.metadata,
        hasCustomLimits: !!partnerData.customLimits,
        finalLimits,
        originalMetadata: partnerData.metadata
      });

      // Create new partner record with transaction safety
      partner = await prisma.$transaction(async (tx) => {
        const newPartner = await tx.partner.create({
          data: {
            businessName: partnerData.businessName,
            contactName: partnerData.contactName || partnerData.businessName,
            businessAddress: partnerData.businessAddress || '',
            emailAddress: partnerData.emailAddress,
            phoneNumber: partnerData.phoneNumber,
            areaOfBusiness: partnerData.areaOfBusiness || 'Marketing Funnel',
            expertise: partnerData.expertise || 'Voice AI',
            partnershipType: partnerData.partnershipType || 'reseller',
            partnerCode,
            country: partnerData.country || 'US',
            planId: partnerData.planId || 'starter',
            billingInterval: partnerData.billingInterval || 'monthly',
            approvalStatus: partnerData.paymentStatus === 'paid' ? 'ACTIVE' : 'PENDING',
            hashedPassword: partnerData.paymentStatus === 'paid' ? hashedPassword : undefined,
            // Store marketing source information
            learningSource: partnerData.source || 'marketing_webhook',
            // Set marketing tier and limits (using processed metadata or custom limits)
            marketingTier: partnerData.marketingTier || 'marketing_offer',
            maxCustomers: finalLimits?.maxCustomers,
            maxVapiAgents: finalLimits?.maxVapiAgents,
            maxRetellAgents: finalLimits?.maxRetellAgents,
            maxUltravoxAgents: finalLimits?.maxUltravoxAgents,
            maxElevenlabsAgents: finalLimits?.maxElevenlabsAgents,
            maxGhlAgents: finalLimits?.maxGhlAgents,
            maxKnovaAgents: finalLimits?.maxKnovaAgents,
            saasMode: finalLimits?.saasMode ?? false
          }
        });

        // Set tier limits using the service if no custom limits were provided
        if (partnerData.marketingTier && !finalLimits) {
          await TierValidationService.setPartnerTier(
            newPartner.id,
            partnerData.marketingTier
          );
        }

        return newPartner;
      });

      // Store the password for email sending if partner is active
      if (partnerData.paymentStatus === 'paid') {
        (partner as any).tempPassword = randomPassword;
      }
    }

    logger.info('Partner record processed successfully from marketing webhook', {
      operation: 'marketing_partner_onboard_webhook',
      partnerId: obfuscateId(partner.id),
      emailAddress: obfuscateEmail(partner.emailAddress),
      isNewPartner,
      approvalStatus: partner.approvalStatus
    });

    // Process credit provisioning if specified in metadata
    if (partnerData.metadata?.credits && partnerData.metadata.credits > 0) {
      await processCreditProvisioning(partner.id, partnerData.metadata);
    }

    // Handle coupon validation and usage if provided
    let validatedCoupon = null;
    let shouldTriggerLifetimeOffer = false;

    if (partnerData.couponCode) {
      try {
        const coupon = await prisma.coupon.findFirst({
          where: {
            code: partnerData.couponCode.toUpperCase(),
            isActive: true,
            validFrom: { lte: new Date() },
            validUntil: { gte: new Date() }
          }
        });

        if (coupon) {
          // Check if coupon was already used by this partner
          const existingUsage = await prisma.couponUsage.findFirst({
            where: {
              couponId: coupon.id,
              partnerId: partner.id
            }
          });

          if (!existingUsage) {
            validatedCoupon = coupon;

            // Record coupon usage with transaction safety
            await prisma.$transaction(async (tx) => {
              await tx.couponUsage.create({
                data: {
                  couponId: coupon.id,
                  partnerId: partner.id,
                  usedAt: new Date(),
                  metadata: {
                    source: 'marketing_webhook',
                    webhookId: body.webhookId,
                    externalPaymentId: partnerData.externalPaymentId
                  }
                }
              });

              // Update coupon usage count if needed
              await tx.coupon.update({
                where: { id: coupon.id },
                data: {
                  usedCount: { increment: 1 }
                }
              });
            });

            // Check if this is a lifetime offer coupon
            if (coupon.type === 'lifetime_offer' && coupon.lifetimeOfferPrice) {
              shouldTriggerLifetimeOffer = true;
            }

            logger.info('Coupon applied successfully for marketing partner onboarding', {
              operation: 'marketing_partner_onboard_coupon',
              partnerId: obfuscateId(partner.id),
              couponCode: coupon.code
            });
          } else {
            logger.info('Coupon already used by partner during marketing onboarding', {
              operation: 'marketing_partner_onboard_coupon',
              partnerId: obfuscateId(partner.id),
              couponCode: coupon.code
            });
            validatedCoupon = coupon; // Still return coupon info for response
          }
        } else {
          logger.warn('Invalid or expired coupon code in marketing onboarding payload', {
            operation: 'marketing_partner_onboard_coupon',
            partnerId: obfuscateId(partner.id),
            couponCode: partnerData.couponCode
          });
        }
      } catch (error) {
        logger.error('Error processing coupon for marketing onboarding', toError(error), {
          operation: 'marketing_partner_onboard_coupon',
          partnerId: obfuscateId(partner.id)
        });
        // Continue processing even if coupon fails
      }
    }

    // Record idempotency to prevent duplicate processing using webhook events
    await prisma.webhookEvent.create({
      data: {
        provider: 'marketing_webhook',
        eventType: 'partner.onboard',
        resourceId: partner.id,
        payload: {
          idempotencyKey,
          webhookId: body.webhookId,
          action: body.action,
          processedAt: new Date().toISOString()
        },
        processed: true,
        processedAt: new Date()
      }
    });

    // If partner is active (payment completed), provision in analytics and send welcome email
    if (partner.approvalStatus === 'ACTIVE') {
      logger.info('Active partner onboarding: provisioning analytics and welcome email', {
        operation: 'marketing_partner_onboard_post_activation',
        partnerId: obfuscateId(partner.id)
      });

      // Provision partner in analytics service
      try {
        const analyticsResult = await provisionPartnerInAnalytics(
          partner as any, // Cast to any to match the expected type
          null, // vapiApiKey - not provided in webhook
          null, // retellApiKey - not provided in webhook
          null  // elevenLabsApiKey - not provided in webhook
        );

        if (!analyticsResult || !analyticsResult.success) {
          logger.warn('Partner provisioning in analytics service failed during marketing onboarding', {
            operation: 'marketing_partner_onboard_post_activation',
            partnerId: obfuscateId(partner.id),
            analyticsError: analyticsResult?.error || 'Unknown error'
          });
        } else {
          logger.info('Successfully provisioned partner in analytics service', {
            operation: 'marketing_partner_onboard_post_activation',
            partnerId: obfuscateId(partner.id)
          });
        }
      } catch (error) {
        logger.error('Error provisioning partner in analytics during marketing onboarding', toError(error), {
          operation: 'marketing_partner_onboard_post_activation',
          partnerId: obfuscateId(partner.id)
        });
        // Continue processing even if analytics fails
      }

      // Send marketing welcome email (enhanced version for funnel signups)
      if ((partner as any).tempPassword || isNewPartner) {
        try {
          await sendMarketingWelcomeEmail({
            to: partner.emailAddress,
            businessName: partner.businessName,
            password: (partner as any).tempPassword,
            couponCode: validatedCoupon?.code,
            couponName: validatedCoupon?.name,
            lifetimeOffer: shouldTriggerLifetimeOffer,
            lifetimeOfferPrice: validatedCoupon?.lifetimeOfferPrice ? Number(validatedCoupon.lifetimeOfferPrice) : undefined,
            originalPrice: validatedCoupon?.originalPrice ? Number(validatedCoupon.originalPrice) : undefined,
            nextSteps: [],
            redirectUrl: undefined,
            source: partnerData.source,
            campaignId: partnerData.campaignId
          });

          logger.info('Marketing welcome email sent successfully', {
            operation: 'marketing_partner_onboard_post_activation',
            partnerId: obfuscateId(partner.id),
            emailAddress: obfuscateEmail(partner.emailAddress)
          });
        } catch (error) {
          logger.error('Error sending marketing welcome email', toError(error), {
            operation: 'marketing_partner_onboard_post_activation',
            partnerId: obfuscateId(partner.id),
            emailAddress: obfuscateEmail(partner.emailAddress)
          });
          // Fallback to regular welcome email if marketing email fails
          if ((partner as any).tempPassword) {
            try {
              await sendPartnerWelcomeEmail({
                to: partner.emailAddress,
                businessName: partner.businessName,
                password: (partner as any).tempPassword,
              });
              logger.info('Fallback welcome email sent successfully', {
                operation: 'marketing_partner_onboard_post_activation',
                partnerId: obfuscateId(partner.id),
                emailAddress: obfuscateEmail(partner.emailAddress)
              });
            } catch (fallbackError) {
              logger.error('Error sending fallback welcome email', toError(fallbackError), {
                operation: 'marketing_partner_onboard_post_activation',
                partnerId: obfuscateId(partner.id),
                emailAddress: obfuscateEmail(partner.emailAddress)
              });
            }
          }
        }
      }
    }

    // Prepare response data
    const responseData = {
      partnerId: partner.id,
      businessName: partner.businessName,
      emailAddress: partner.emailAddress,
      approvalStatus: partner.approvalStatus,
      planId: partner.planId,
      billingInterval: partner.billingInterval,
      isNewPartner,
      couponApplied: !!validatedCoupon,
      couponCode: validatedCoupon?.code,
      // Additional information for marketing funnels
      nextSteps: [] as string[],
      redirectUrl: null as string | null
    };

    // Determine next steps based on partner status and coupon
    if (partner.approvalStatus === 'ACTIVE') {
      responseData.nextSteps.push('Partner account is active and ready to use');
      responseData.nextSteps.push('Welcome email sent with login credentials');
      responseData.nextSteps.push('Analytics service provisioned');
      responseData.redirectUrl = '/partner/login';
    } else if (shouldTriggerLifetimeOffer && validatedCoupon) {
      responseData.nextSteps.push('Lifetime offer available');
      responseData.nextSteps.push('Partner can complete payment for lifetime access');
      responseData.redirectUrl = `/lifetime-offer?partnerId=${partner.id}&couponId=${validatedCoupon.id}`;
    } else if (partnerData.planId && partnerData.paymentStatus !== 'paid') {
      responseData.nextSteps.push('Partner account created, payment required');
      responseData.nextSteps.push('Redirect to payment flow');
      // Note: In a real scenario, you'd generate a payment link here
    } else {
      responseData.nextSteps.push('Partner account created, pending approval');
      responseData.nextSteps.push('Manual review may be required');
    }

    // Return success response with rate limit headers
    const rateLimitHeaders = apiKeyValidation.rateLimit
      ? getApiKeyRateLimitHeaders(apiKeyValidation.keyId!, apiKeyValidation.rateLimit)
      : {};

    return NextResponse.json({
      success: true,
      message: `Partner ${isNewPartner ? 'created' : 'updated'} successfully`,
      data: responseData,
      idempotencyKey
    }, {
      headers: rateLimitHeaders
    });

  } catch (error) {
    logger.error('Error processing marketing partner onboarding webhook', toError(error), {
      operation: 'marketing_partner_onboard_webhook'
    });
    return NextResponse.json(
      { 
        success: false, 
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

// GET method for webhook verification/health check
export async function GET() {
  // Simple health check endpoint
  return NextResponse.json({
    success: true,
    message: 'Marketing partner onboarding webhook is active',
    timestamp: new Date().toISOString()
  });
}
