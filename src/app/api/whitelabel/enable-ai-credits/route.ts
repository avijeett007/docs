import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyOnboardingAuth } from '@/lib/onboardingAuth';
import { logger } from '@/lib/logger';
import { getPartnerDefaultPlan, getPlanFeatures } from '@/lib/services/planFeatureService';
import { getLiteLLMClient } from '@/lib/litellm';
import { decryptData } from '@/lib/encryption';

/**
 * Re-enable any suspended AI Gateway keys for a customer.
 * Fire-and-forget: failures are logged but never propagate to the caller.
 */
async function reEnableCustomerGatewayKeys(customerId: string): Promise<void> {
  try {
    const suspendedKeys = await prisma.aiGatewayKey.findMany({
      where: { customerId, status: 'suspended' },
      select: { id: true, encryptedVirtualKey: true },
    });
    if (suspendedKeys.length === 0) return;

    const litellm = getLiteLLMClient();
    for (const key of suspendedKeys) {
      try {
        const rawVirtualKey = await decryptData(key.encryptedVirtualKey);
        await litellm.unblockKey(rawVirtualKey);
        await prisma.aiGatewayKey.update({
          where: { id: key.id },
          data: { status: 'active' },
        });
        logger.info(`[EnableAiCredits] Re-enabled AI Gateway key ${key.id} for customer ${customerId}`, {
          operation: 'enable-ai-credits',
          customerId,
          keyId: key.id,
        });
      } catch (err) {
        logger.error(`[EnableAiCredits] Failed to re-enable key ${key.id}`, err instanceof Error ? err : new Error(String(err)), {
          operation: 'enable-ai-credits',
          customerId,
          keyId: key.id,
        });
      }
    }
  } catch (err) {
    logger.error('[EnableAiCredits] reEnableCustomerGatewayKeys error', err instanceof Error ? err : new Error(String(err)), {
      operation: 'enable-ai-credits',
      customerId,
    });
  }
}

export async function POST(request: NextRequest) {
  try {
    // Verify authentication (supports both prospect and customer tokens for onboarding)
    const authResult = await verifyOnboardingAuth(request);
    if (!authResult) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { customerId, partnerId } = authResult;

    const body = await request.json();
    const { freeAiCredits } = body;

    // Get the customer record to find the userOnboarding ID
    const customer = await prisma.customer.findUnique({
      where: { id: customerId },
      select: {
        id: true,
        email: true,
        aiCreditsEnabled: true,
        creditBalance: true
      }
    });

    if (!customer) {
      return NextResponse.json(
        { error: 'Customer not found' },
        { status: 404 }
      );
    }

    // Phase 1: Idempotency guard — skip if already enabled (prevents double-crediting
    // when applyPlanFeaturesToCustomer already ran and granted initialAiCredits)
    if (customer.aiCreditsEnabled) {
      logger.info('AI Credits already enabled for customer, skipping duplicate grant', {
        operation: 'enable-ai-credits',
        customerId,
        partnerId,
      });
      return NextResponse.json({
        success: true,
        message: 'AI Credits already enabled',
        data: { customerId, creditsAdded: 0, newBalance: customer.creditBalance, alreadyEnabled: true }
      });
    }

    // Phase 2: Sync lowCreditThreshold from partner's active plan when enabling for the first time
    let planLowCreditThreshold: number | undefined;
    let planLowCreditNotificationsEnabled: boolean | undefined;
    try {
      const defaultPlanId = await getPartnerDefaultPlan(partnerId);
      if (defaultPlanId) {
        const planFeatures = await getPlanFeatures(defaultPlanId, partnerId);
        if (planFeatures?.lowCreditThreshold !== undefined) {
          planLowCreditThreshold = planFeatures.lowCreditThreshold;
          planLowCreditNotificationsEnabled = planFeatures.lowCreditNotificationsEnabled;
          logger.info('Syncing low credit threshold from partner plan', {
            operation: 'enable-ai-credits',
            customerId,
            partnerId,
            planId: defaultPlanId,
            lowCreditThreshold: planLowCreditThreshold,
          });
        }
      }
    } catch (planError) {
      // Non-fatal — proceed without plan threshold sync
      logger.warn('Could not sync plan threshold during enable-ai-credits', {
        operation: 'enable-ai-credits',
        customerId,
        partnerId,
        error: planError instanceof Error ? planError.message : String(planError),
      });
    }

    // Find the userOnboarding record using email and partnerId
    const userOnboarding = await prisma.userOnboarding.findFirst({
      where: {
        email: customer.email,
        partnerId: partnerId
      },
      select: {
        id: true,
        showPricingInformation: true
      }
    });

    if (!userOnboarding) {
      return NextResponse.json(
        { error: 'User onboarding record not found' },
        { status: 404 }
      );
    }

    // Start a transaction to enable AI credits and add credits
    const result = await prisma.$transaction(async (tx) => {
      // 1. Enable AI credits and set deployment status in customer record
      await tx.customer.update({
        where: { id: customerId },
        data: {
          aiCreditsEnabled: true,
          creditBalance: {
            increment: freeAiCredits || 50
          },
          // Set deployment status to indicate deployment request has been submitted
          deploymentStatus: 'not_started', // Keep as not_started until phone is actually provisioned
          deploymentRequestedAt: new Date(),
          // Sync low credit threshold from partner plan if available
          ...(planLowCreditThreshold !== undefined && { lowCreditThreshold: planLowCreditThreshold }),
          ...(planLowCreditNotificationsEnabled !== undefined && { lowCreditNotificationsEnabled: planLowCreditNotificationsEnabled }),
        }
      });

      // 2. Disable pricing info in userOnboarding record (AI credits are managed at customer level)
      await tx.userOnboarding.update({
        where: { id: userOnboarding.id },
        data: {
          showPricingInformation: false
        }
      });

      // 3. Create a credit transaction record
      await tx.creditTransaction.create({
        data: {
          customerId: customerId,
          partnerId: partnerId,
          type: 'credit',
          amount: freeAiCredits || 50,
          balanceAfter: (customer.creditBalance || 0) + (freeAiCredits || 50),
          description: 'Free AI Credits - SAAS Onboarding Completion',
          metadata: {
            source: 'saas_onboarding',
            grantType: 'one_time',
            reason: 'Automatic credit grant after completing SAAS onboarding'
          }
        }
      });

      return {
        customerId,
        creditsAdded: freeAiCredits || 50,
        newBalance: (customer.creditBalance || 0) + (freeAiCredits || 50)
      };
    });

    // Re-enable any suspended AI Gateway keys now that credits have been granted (fire-and-forget)
    reEnableCustomerGatewayKeys(customerId);

    return NextResponse.json({
      success: true,
      message: 'AI Credits enabled and credits added successfully',
      data: result
    });

  } catch (error) {
    logger.error(
      'Error enabling AI credits',
      error instanceof Error ? error : new Error(String(error)),
      { operation: 'enable-ai-credits', customerId: 'unknown' }
    );
    return NextResponse.json(
      { error: 'Failed to enable AI credits' },
      { status: 500 }
    );
  }
}
