import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyRewardfulWebhook } from '@/lib/webhookSecurity';
import { logger } from '@/lib/logger';
import {
  RewardfulWebhookPayload,
  RewardfulAffiliate,
  RewardfulConversion,
  validateWebhookPayload,
  isRewardfulAffiliate,
  isRewardfulConversion,
  sanitizeRewardfulId,
  sanitizeEmail,
  sanitizeAmount
} from '@/types/rewardful';

export const dynamic = 'force-dynamic';

/**
 * Handle Rewardful webhook events
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.text();

    // Use centralized webhook verification
    const verification = await verifyRewardfulWebhook(request, body);
    if (!verification.isValid) {
      logger.warn('Rewardful webhook verification failed', {
        operation: 'webhook_processing',
        provider: 'rewardful',
        error: verification.error
      });
      return NextResponse.json(
        { error: verification.error || 'Invalid webhook signature' },
        { status: 401 }
      );
    }

    // Parse and validate webhook payload
    let payload: RewardfulWebhookPayload;
    try {
      const parsedPayload = JSON.parse(body);
      if (!validateWebhookPayload(parsedPayload)) {
        logger.warn('Invalid Rewardful webhook payload structure', {
          operation: 'webhook_processing',
          provider: 'rewardful',
          event: parsedPayload?.event || 'unknown'
        });
        return NextResponse.json(
          { error: 'Invalid webhook payload' },
          { status: 400 }
        );
      }
      payload = parsedPayload;
    } catch (parseError) {
      logger.error('Failed to parse Rewardful webhook payload', parseError as Error, {
        operation: 'webhook_processing',
        provider: 'rewardful'
      });
      return NextResponse.json(
        { error: 'Invalid JSON payload' },
        { status: 400 }
      );
    }

    const { event, data } = payload;
    logger.info(`Processing Rewardful webhook: ${event}`, {
      operation: 'webhook_processing',
      provider: 'rewardful',
      event
    });

    // Handle different event types with proper type safety
    switch (event) {
      case 'affiliate.created':
        if (isRewardfulAffiliate(data)) {
          await handleAffiliateCreated(data);
        } else {
          logger.warn('Invalid affiliate data in webhook', {
            operation: 'webhook_processing',
            provider: 'rewardful',
            event
          });
        }
        break;
      case 'affiliate.updated':
        if (isRewardfulAffiliate(data)) {
          await handleAffiliateUpdated(data);
        } else {
          logger.warn('Invalid affiliate data in webhook', {
            operation: 'webhook_processing',
            provider: 'rewardful',
            event
          });
        }
        break;
      case 'conversion.created':
        if (isRewardfulConversion(data)) {
          await handleConversionCreated(data);
        } else {
          logger.warn('Invalid conversion data in webhook', {
            operation: 'webhook_processing',
            provider: 'rewardful',
            event
          });
        }
        break;
      case 'conversion.updated':
        if (isRewardfulConversion(data)) {
          await handleConversionUpdated(data);
        } else {
          logger.warn('Invalid conversion data in webhook', {
            operation: 'webhook_processing',
            provider: 'rewardful',
            event
          });
        }
        break;
      default:
        logger.info(`Unhandled Rewardful event: ${event}`, {
          operation: 'webhook_processing',
          provider: 'rewardful',
          event
        });
    }

    return NextResponse.json({ success: true });

  } catch (error) {
    logger.error('Error processing Rewardful webhook', error as Error, {
      operation: 'webhook_processing',
      provider: 'rewardful'
    });
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * Handle affiliate created event
 */
async function handleAffiliateCreated(data: RewardfulAffiliate) {
  try {
    const sanitizedId = sanitizeRewardfulId(data.id);
    const sanitizedEmail = sanitizeEmail(data.email);

    if (!sanitizedId || !sanitizedEmail) {
      logger.warn('Invalid affiliate data in webhook', {
        operation: 'webhook_processing',
        provider: 'rewardful',
        event: 'affiliate.created',
        affiliateId: data.id,
        email: data.email
      });
      return;
    }

    logger.info('Processing affiliate.created event', {
      operation: 'webhook_processing',
      provider: 'rewardful',
      event: 'affiliate.created',
      affiliateId: sanitizedId
    });

    // Update partner record with Rewardful affiliate data
    const partner = await prisma.partner.findFirst({
      where: { emailAddress: sanitizedEmail }
    });

    if (partner) {
      await prisma.partner.update({
        where: { id: partner.id },
        data: {
          rewardfulAffiliateId: sanitizedId,
          rewardfulToken: data.token,
          affiliateStatus: data.status === 'active' ? 'ACTIVE' : 'INACTIVE',
        },
      });

      logger.info('Updated partner with Rewardful affiliate data', {
        operation: 'webhook_processing',
        provider: 'rewardful',
        event: 'affiliate.created',
        partnerId: partner.id,
        affiliateId: sanitizedId
      });
    } else {
      logger.warn('Partner not found for affiliate email', {
        operation: 'webhook_processing',
        provider: 'rewardful',
        event: 'affiliate.created',
        email: sanitizedEmail
      });
    }
  } catch (error) {
    logger.error('Error handling affiliate.created', error as Error, {
      operation: 'webhook_processing',
      provider: 'rewardful',
      event: 'affiliate.created',
      affiliateId: data.id
    });
  }
}

/**
 * Handle affiliate updated event
 */
async function handleAffiliateUpdated(data: RewardfulAffiliate) {
  try {
    const sanitizedId = sanitizeRewardfulId(data.id);

    if (!sanitizedId) {
      logger.warn('Invalid affiliate ID in webhook', {
        operation: 'webhook_processing',
        provider: 'rewardful',
        event: 'affiliate.updated',
        affiliateId: data.id
      });
      return;
    }

    logger.info('Processing affiliate.updated event', {
      operation: 'webhook_processing',
      provider: 'rewardful',
      event: 'affiliate.updated',
      affiliateId: sanitizedId
    });

    // Update partner affiliate status
    const updateResult = await prisma.partner.updateMany({
      where: { rewardfulAffiliateId: sanitizedId },
      data: {
        affiliateStatus: data.status === 'active' ? 'ACTIVE' : 'INACTIVE',
      },
    });

    logger.info('Updated affiliate status', {
      operation: 'webhook_processing',
      provider: 'rewardful',
      event: 'affiliate.updated',
      affiliateId: sanitizedId,
      status: data.status,
      updatedCount: updateResult.count
    });
  } catch (error) {
    logger.error('Error handling affiliate.updated', error as Error, {
      operation: 'webhook_processing',
      provider: 'rewardful',
      event: 'affiliate.updated',
      affiliateId: data.id
    });
  }
}

/**
 * Handle conversion created event
 */
async function handleConversionCreated(data: RewardfulConversion) {
  try {
    const sanitizedId = sanitizeRewardfulId(data.id);
    const sanitizedAffiliateId = sanitizeRewardfulId(data.affiliate_id);
    const sanitizedAmount = sanitizeAmount(data.amount);
    const sanitizedCommissionAmount = sanitizeAmount(data.commission_amount);

    if (!sanitizedId || !sanitizedAffiliateId || sanitizedAmount === null || sanitizedCommissionAmount === null) {
      logger.warn('Invalid conversion data in webhook', {
        operation: 'webhook_processing',
        provider: 'rewardful',
        event: 'conversion.created',
        conversionId: data.id,
        affiliateId: data.affiliate_id,
        amount: data.amount
      });
      return;
    }

    logger.info('Processing conversion.created event', {
      operation: 'webhook_processing',
      provider: 'rewardful',
      event: 'conversion.created',
      conversionId: sanitizedId,
      affiliateId: sanitizedAffiliateId,
      amount: sanitizedAmount
    });

    // Store conversion in our database
    await prisma.affiliateConversion.create({
      data: {
        referralId: sanitizedAffiliateId,
        stripeCustomerId: data.customer_email || '',
        amount: sanitizedAmount,
        currency: data.currency,
        orderId: data.order_id || sanitizedId,
        metadata: {
          rewardfulConversionId: sanitizedId,
          affiliateId: sanitizedAffiliateId,
          commissionAmount: sanitizedCommissionAmount,
          commissionRate: data.commission_rate,
          status: data.status
        },
      },
    });

    logger.info('Stored conversion in database', {
      operation: 'webhook_processing',
      provider: 'rewardful',
      event: 'conversion.created',
      conversionId: sanitizedId,
      amount: sanitizedAmount
    });
  } catch (error) {
    logger.error('Error handling conversion.created', error as Error, {
      operation: 'webhook_processing',
      provider: 'rewardful',
      event: 'conversion.created',
      conversionId: data.id
    });
  }
}

/**
 * Handle conversion updated event
 */
async function handleConversionUpdated(data: RewardfulConversion) {
  try {
    const sanitizedId = sanitizeRewardfulId(data.id);
    const sanitizedAffiliateId = sanitizeRewardfulId(data.affiliate_id);
    const sanitizedAmount = sanitizeAmount(data.amount);
    const sanitizedCommissionAmount = sanitizeAmount(data.commission_amount);

    if (!sanitizedId || !sanitizedAffiliateId || sanitizedAmount === null || sanitizedCommissionAmount === null) {
      logger.warn('Invalid conversion update data in webhook', {
        operation: 'webhook_processing',
        provider: 'rewardful',
        event: 'conversion.updated',
        conversionId: data.id,
        affiliateId: data.affiliate_id,
        amount: data.amount
      });
      return;
    }

    logger.info('Processing conversion.updated event', {
      operation: 'webhook_processing',
      provider: 'rewardful',
      event: 'conversion.updated',
      conversionId: sanitizedId,
      affiliateId: sanitizedAffiliateId,
      amount: sanitizedAmount
    });

    // Update existing conversion record using sanitized data
    const updateResult = await prisma.affiliateConversion.updateMany({
      where: {
        metadata: {
          path: ['rewardfulConversionId'],
          equals: sanitizedId // Use sanitized ID for database query
        }
      },
      data: {
        amount: sanitizedAmount,
        metadata: {
          rewardfulConversionId: sanitizedId,
          affiliateId: sanitizedAffiliateId,
          commissionAmount: sanitizedCommissionAmount,
          commissionRate: data.commission_rate,
          status: data.status
        },
      },
    });

    logger.info('Updated conversion in database', {
      operation: 'webhook_processing',
      provider: 'rewardful',
      event: 'conversion.updated',
      conversionId: sanitizedId,
      amount: sanitizedAmount,
      updatedCount: updateResult.count
    });
  } catch (error) {
    logger.error('Error handling conversion.updated', error as Error, {
      operation: 'webhook_processing',
      provider: 'rewardful',
      event: 'conversion.updated',
      conversionId: data.id
    });
  }
}

/**
 * Health check endpoint
 */
export async function GET() {
  return NextResponse.json({
    message: 'Rewardful webhook endpoint is active',
    timestamp: new Date().toISOString(),
  });
}
