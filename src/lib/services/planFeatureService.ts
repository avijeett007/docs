import { prisma } from '@/lib/prisma';
import { PlanFeatures } from '@/types/partner';
import { logger } from '@/lib/logger';

const planFeatureLogger = logger.child({ operation: 'plan-features' });

/**
 * Apply plan features to a customer's UserOnboarding record
 * This service is called when:
 * 1. A customer subscribes to a plan via Stripe
 * 2. A customer self-registers and selects a plan
 * 3. A partner creates a customer with a plan assigned
 */
export async function applyPlanFeaturesToCustomer(
  planId: string,
  customerId: string,
  partnerId: string
): Promise<void> {
  const ctx = { planId, customerId, partnerId };
  try {
    planFeatureLogger.info('Applying plan features', ctx);

    // 1. Fetch the subscription plan with its features
    const plan = await prisma.subscriptionPlan.findFirst({
      where: {
        id: planId,
        partnerId: partnerId,
      },
      select: {
        id: true,
        name: true,
        planFeatures: true,
      },
    });

    if (!plan) {
      planFeatureLogger.error('Subscription plan not found', undefined, ctx);
      throw new Error('Subscription plan not found');
    }

    planFeatureLogger.info(`Found plan: ${plan.name}`, { ...ctx, planName: plan.name });

    // If plan has no features configured, skip
    if (!plan.planFeatures || typeof plan.planFeatures !== 'object') {
      planFeatureLogger.info('Plan has no features configured, skipping', ctx);
      return;
    }

    const planFeatures = plan.planFeatures as PlanFeatures;

    // 2. Get the customer record
    const customer = await prisma.customer.findUnique({
      where: { id: customerId },
      select: {
        id: true,
        email: true,
        userId: true,
        aiCreditsEnabled: true,
      },
    });

    if (!customer) {
      planFeatureLogger.error('Customer not found', undefined, ctx);
      throw new Error('Customer not found');
    }

    planFeatureLogger.debug(`Found customer: ${customer.email}`, ctx);

    // 3. Find or create UserOnboarding record
    let userOnboarding = await prisma.userOnboarding.findFirst({
      where: {
        email: customer.email,
        partnerId: partnerId,
      },
    });

    // Prepare the feature data to apply
    const featureData: Record<string, boolean | number | string> = {};

    // Analytics Features
    if (planFeatures.enableAdvancedAnalytics !== undefined) {
      featureData.enableAdvancedAnalytics = planFeatures.enableAdvancedAnalytics;
    }
    if (planFeatures.enableDetailedCallAnalysis !== undefined) {
      featureData.enableDetailedCallAnalysis = planFeatures.enableDetailedCallAnalysis;
    }
    if (planFeatures.enableActionPointAnalysis !== undefined) {
      featureData.enableActionPointAnalysis = planFeatures.enableActionPointAnalysis;
    }

    // Menu Visibility Features
    if (planFeatures.showIntegration !== undefined) {
      featureData.showIntegration = planFeatures.showIntegration;
    }
    if (planFeatures.showDocsAndMedia !== undefined) {
      featureData.showDocsAndMedia = planFeatures.showDocsAndMedia;
    }
    if (planFeatures.showPhoneNumbers !== undefined) {
      featureData.showPhoneNumbers = planFeatures.showPhoneNumbers;
    }

    // Integration Apps (stored as JSON string)
    if (planFeatures.allowedApps !== undefined) {
      featureData.allowedApps = JSON.stringify(planFeatures.allowedApps);
    }

    planFeatureLogger.debug('Feature data to apply', { ...ctx, featureCount: Object.keys(featureData).length });

    if (userOnboarding) {
      planFeatureLogger.info(`Updating existing UserOnboarding record: ${userOnboarding.id}`, ctx);
      await prisma.userOnboarding.update({
        where: { id: userOnboarding.id },
        data: featureData,
      });
      planFeatureLogger.info('UserOnboarding record updated successfully', ctx);
    } else {
      planFeatureLogger.info('Creating new UserOnboarding record', ctx);
      await prisma.userOnboarding.create({
        data: {
          id: `uo_${Math.random().toString(36).substr(2, 9)}`,
          userId: customer.userId,
          email: customer.email,
          partnerId: partnerId,
          customerId: customer.id,
          isOnboardingCompleted: true,
          ...featureData,
        },
      });
      planFeatureLogger.info('UserOnboarding record created successfully', ctx);
    }

    // 4. Handle AI Credits on Customer model if enabled
    const customerUpdateData: Record<string, boolean | number> = {};
    
    if (planFeatures.aiCreditsEnabled !== undefined) {
      customerUpdateData.aiCreditsEnabled = planFeatures.aiCreditsEnabled;
    }
    
    if (planFeatures.lowCreditNotificationsEnabled !== undefined) {
      customerUpdateData.lowCreditNotificationsEnabled = planFeatures.lowCreditNotificationsEnabled;
    }
    
    if (planFeatures.lowCreditThreshold !== undefined) {
      customerUpdateData.lowCreditThreshold = planFeatures.lowCreditThreshold;
    }
    
    if (Object.keys(customerUpdateData).length > 0) {
      planFeatureLogger.info('Updating Customer model with AI Credits settings', { ...ctx, fields: Object.keys(customerUpdateData) });
      await prisma.customer.update({
        where: { id: customerId },
        data: customerUpdateData,
      });
      planFeatureLogger.info('Customer AI Credits settings updated', ctx);
    }

    // 5. Grant initial AI credits if configured (one-time, idempotent)
    if (planFeatures.aiCreditsEnabled && planFeatures.initialAiCredits && planFeatures.initialAiCredits > 0) {
      planFeatureLogger.info('Checking if initial AI credits should be granted', { 
        ...ctx, 
        initialAiCredits: planFeatures.initialAiCredits 
      });

      // Check if credits have already been granted for this plan onboarding
      const existingGrant = await prisma.creditTransaction.findFirst({
        where: {
          customerId: customerId,
          partnerId: partnerId,
          metadata: {
            path: ['source'],
            equals: 'plan_onboarding',
          },
        },
        select: { id: true, amount: true, createdAt: true },
      });

      if (existingGrant) {
        planFeatureLogger.info('Initial AI credits already granted, skipping duplicate', {
          ...ctx,
          existingTransactionId: existingGrant.id,
          existingAmount: existingGrant.amount,
          grantedAt: existingGrant.createdAt,
        });
      } else {
        // Grant initial credits in a transaction
        await prisma.$transaction(async (tx) => {
          // Re-fetch customer for current credit balance
          const currentCustomer = await tx.customer.findUnique({
            where: { id: customerId },
            select: { creditBalance: true, totalCreditsAllocated: true },
          });

          if (!currentCustomer) {
            throw new Error('Customer not found during credit grant');
          }

          const creditsToGrant = planFeatures.initialAiCredits!;
          const newBalance = currentCustomer.creditBalance + creditsToGrant;
          const newTotalAllocated = (currentCustomer.totalCreditsAllocated || 0) + creditsToGrant;

          // Update customer credit balance
          await tx.customer.update({
            where: { id: customerId },
            data: {
              creditBalance: newBalance,
              totalCreditsAllocated: newTotalAllocated,
            },
          });

          // Create credit transaction record
          await tx.creditTransaction.create({
            data: {
              customerId: customerId,
              partnerId: partnerId,
              type: 'credit',
              amount: creditsToGrant,
              balanceAfter: newBalance,
              description: `Initial AI Credits - ${plan.name}`,
              metadata: {
                source: 'plan_onboarding',
                planId: planId,
                planName: plan.name,
                grantType: 'one_time',
                reason: 'Automatic credit grant when customer onboards with subscription plan',
              },
            },
          });

          planFeatureLogger.info('Successfully granted initial AI credits', {
            ...ctx,
            creditsGranted: creditsToGrant,
            newBalance,
            previousBalance: currentCustomer.creditBalance,
          });
        });
      }
    }

    planFeatureLogger.info(`Successfully applied plan features from plan ${plan.name} to customer ${customer.email}`, ctx);
  } catch (error) {
    planFeatureLogger.error('Error applying plan features to customer', error instanceof Error ? error : new Error(String(error)), ctx);
    throw error;
  }
}

/**
 * Get plan features by plan ID
 * Useful for displaying what features a plan includes
 */
export async function getPlanFeatures(
  planId: string,
  partnerId: string
): Promise<PlanFeatures | null> {
  try {
    const plan = await prisma.subscriptionPlan.findFirst({
      where: {
        id: planId,
        partnerId: partnerId,
      },
      select: {
        planFeatures: true,
      },
    });

    if (!plan || !plan.planFeatures) {
      return null;
    }

    return plan.planFeatures as PlanFeatures;
  } catch (error) {
    planFeatureLogger.error('Error fetching plan features', error instanceof Error ? error : new Error(String(error)), { planId, partnerId });
    return null;
  }
}

/**
 * Get plan features by Stripe Price ID
 * Useful when processing Stripe webhooks
 */
export async function getPlanFeaturesByStripePriceId(
  stripePriceId: string
): Promise<{ planId: string; partnerId: string; features: PlanFeatures } | null> {
  try {
    const plan = await prisma.subscriptionPlan.findUnique({
      where: {
        stripePriceId: stripePriceId,
      },
      select: {
        id: true,
        partnerId: true,
        planFeatures: true,
      },
    });

    if (!plan || !plan.planFeatures) {
      return null;
    }

    return {
      planId: plan.id,
      partnerId: plan.partnerId,
      features: plan.planFeatures as PlanFeatures,
    };
  } catch (error) {
    planFeatureLogger.error('Error fetching plan features by Stripe Price ID', error instanceof Error ? error : new Error(String(error)), { stripePriceId });
    return null;
  }
}

/**
 * Get partner's default subscription plan
 * Useful when planId is not explicitly provided during customer creation
 * 
 * Logic:
 * - If partner has exactly 1 active plan → return it as default
 * - If partner has multiple active plans → return the most recently created one
 * - If partner has 0 active plans → return null
 * 
 * @param partnerId - The partner ID to look up plans for
 * @returns The default plan ID, or null if no plans exist
 */
export async function getPartnerDefaultPlan(partnerId: string): Promise<string | null> {
  const ctx = { partnerId, operation: 'get-default-plan' };
  
  try {
    planFeatureLogger.debug('Looking up partner default plan', ctx);

    // Get all active subscription plans for this partner, ordered by most recently created
    const plans = await prisma.subscriptionPlan.findMany({
      where: {
        partnerId: partnerId,
        isActive: true,
      },
      select: {
        id: true,
        name: true,
        createdAt: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    if (plans.length === 0) {
      planFeatureLogger.info('No active subscription plans found for partner', ctx);
      return null;
    }

    if (plans.length === 1) {
      planFeatureLogger.info(`Found 1 active plan: ${plans[0].name}`, { ...ctx, planId: plans[0].id, planName: plans[0].name });
      return plans[0].id;
    }

    // Multiple plans exist - return the most recent one (first in the list due to desc ordering)
    const defaultPlan = plans[0];
    planFeatureLogger.info(
      `Found ${plans.length} active plans, using most recent: ${defaultPlan.name}`,
      { ...ctx, planId: defaultPlan.id, planName: defaultPlan.name, totalPlans: plans.length }
    );
    return defaultPlan.id;
  } catch (error) {
    planFeatureLogger.error(
      'Error fetching partner default plan',
      error instanceof Error ? error : new Error(String(error)),
      ctx
    );
    return null;
  }
}
