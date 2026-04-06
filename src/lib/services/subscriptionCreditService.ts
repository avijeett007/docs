import { prisma } from '@/lib/prisma';
import { CreditService } from './creditService';
import { logger } from '@/lib/logger';

/**
 * Subscription Credit Tier Mapping
 * Maps subscription plan IDs to monthly credit allocations
 */
export const SUBSCRIPTION_CREDIT_TIERS = {
  // Free and Trial Plans
  free_forever: 0,
  free_forever_trial: 500, // During trial period
  starter_tier_trial: 500, // During trial period

  // Regular Plans
  starter: 500,
  starter_special: 500, // Same credits as regular starter
  pro: 3000,
  enterprise: 5000,

  // Legacy plan names (if any exist)
  'Free Forever': 0,
  'Solo Agency Owner': 500,
  'Professional Agency Owner': 3000,
  'Ultimate Scaleup Agency': 5000,
} as const;

/**
 * Get credit allocation for a subscription plan
 */
export function getCreditAllocationForPlan(planName: string, planId?: string): number {
  // First try by plan ID
  if (planId && planId in SUBSCRIPTION_CREDIT_TIERS) {
    return SUBSCRIPTION_CREDIT_TIERS[planId as keyof typeof SUBSCRIPTION_CREDIT_TIERS];
  }
  
  // Then try by plan name
  if (planName in SUBSCRIPTION_CREDIT_TIERS) {
    return SUBSCRIPTION_CREDIT_TIERS[planName as keyof typeof SUBSCRIPTION_CREDIT_TIERS];
  }
  
  // Check for partial matches in plan names
  const lowerPlanName = planName.toLowerCase();
  if (lowerPlanName.includes('starter') || lowerPlanName.includes('solo')) {
    return SUBSCRIPTION_CREDIT_TIERS.starter;
  }
  if (lowerPlanName.includes('pro') || lowerPlanName.includes('professional')) {
    return SUBSCRIPTION_CREDIT_TIERS.pro;
  }
  if (lowerPlanName.includes('enterprise') || lowerPlanName.includes('ultimate')) {
    return SUBSCRIPTION_CREDIT_TIERS.enterprise;
  }
  
  // Default to starter tier if no match found
  logger.warn('Unknown subscription plan, defaulting to starter tier', {
    operation: 'subscription_credits',
    planName,
    planId
  });
  return SUBSCRIPTION_CREDIT_TIERS.starter;
}

export class SubscriptionCreditService {
  /**
   * Allocate monthly credits to a partner based on their subscription
   */
  static async allocateMonthlyCredits(
    partnerId: string,
    subscriptionPlanName: string,
    subscriptionPlanId?: string,
    force: boolean = false
  ): Promise<{ success: boolean; creditsAllocated?: number; error?: string }> {
    try {
      const partner = await prisma.partner.findUnique({
        where: { id: partnerId },
        select: {
          id: true,
          businessName: true,
          lastCreditAllocationDate: true,
          monthlyCreditAllocation: true,
          creditBalance: true,
        }
      });

      if (!partner) {
        return { success: false, error: 'Partner not found' };
      }

      const now = new Date();
      const lastAllocation = partner.lastCreditAllocationDate;
      
      // Check if allocation is needed (unless forced)
      if (!force && lastAllocation) {
        const daysSinceLastAllocation = Math.floor(
          (now.getTime() - lastAllocation.getTime()) / (1000 * 60 * 60 * 24)
        );
        
        // Only allocate if it's been more than 25 days (to handle monthly billing cycles)
        if (daysSinceLastAllocation < 25) {
          return { 
            success: false, 
            error: `Credits already allocated ${daysSinceLastAllocation} days ago. Next allocation in ${30 - daysSinceLastAllocation} days.` 
          };
        }
      }

      // Get credit allocation for this plan
      const creditsToAllocate = getCreditAllocationForPlan(subscriptionPlanName, subscriptionPlanId);

      // Update partner's monthly allocation and last allocation date
      await prisma.partner.update({
        where: { id: partnerId },
        data: {
          monthlyCreditAllocation: creditsToAllocate,
          lastCreditAllocationDate: now,
        }
      });

      // Add credits to partner's balance
      const result = await CreditService.addCredits(
        partnerId,
        creditsToAllocate,
        'allocation',
        `Monthly credit allocation for ${subscriptionPlanName} subscription`,
        `monthly-allocation-${now.getFullYear()}-${now.getMonth() + 1}`,
        'system',
        {
          subscriptionPlan: subscriptionPlanName,
          subscriptionPlanId,
          allocationType: 'monthly',
          allocationDate: now.toISOString(),
        }
      );

      if (!result.success) {
        return { success: false, error: result.error };
      }

      logger.info('Allocated monthly credits to partner', {
        operation: 'subscription_credits',
        partnerId,
        partnerName: partner.businessName,
        creditsAllocated: creditsToAllocate,
        subscriptionPlan: subscriptionPlanName
      });

      return {
        success: true,
        creditsAllocated: creditsToAllocate,
      };

    } catch (error) {
      logger.error('Error allocating monthly credits', error as Error, {
        operation: 'subscription_credits',
        partnerId
      });
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Handle subscription renewal - allocate credits for new billing period
   */
  static async handleSubscriptionRenewal(
    partnerId: string,
    subscriptionPlanName: string,
    subscriptionPlanId?: string,
    _billingPeriodStart?: Date
  ): Promise<{ success: boolean; creditsAllocated?: number; error?: string }> {
    try {
      // Force allocation for renewals
      const result = await this.allocateMonthlyCredits(
        partnerId,
        subscriptionPlanName,
        subscriptionPlanId,
        true // force allocation
      );

      if (result.success) {
        logger.info('Subscription renewal credits allocated', {
          operation: 'subscription_credits',
          partnerId,
          creditsAllocated: result.creditsAllocated
        });
      }

      return result;
    } catch (error) {
      logger.error('Error handling subscription renewal', error as Error, {
        operation: 'subscription_credits',
        partnerId
      });
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Handle subscription plan changes (upgrades/downgrades)
   */
  static async handleSubscriptionPlanChange(
    partnerId: string,
    oldPlanName: string,
    newPlanName: string,
    newPlanId?: string,
    prorationDate?: Date
  ): Promise<{ success: boolean; creditsAdjusted?: number; error?: string }> {
    try {
      const oldCredits = getCreditAllocationForPlan(oldPlanName);
      const newCredits = getCreditAllocationForPlan(newPlanName, newPlanId);
      const creditDifference = newCredits - oldCredits;

      // Update partner's monthly allocation
      await prisma.partner.update({
        where: { id: partnerId },
        data: {
          monthlyCreditAllocation: newCredits,
        }
      });

      // If upgrading, add the difference in credits
      if (creditDifference > 0) {
        const result = await CreditService.addCredits(
          partnerId,
          creditDifference,
          'allocation',
          `Plan upgrade from ${oldPlanName} to ${newPlanName} - additional credits`,
          `plan-upgrade-${Date.now()}`,
          'system',
          {
            oldPlan: oldPlanName,
            newPlan: newPlanName,
            newPlanId,
            creditDifference,
            upgradeDate: (prorationDate || new Date()).toISOString(),
          }
        );

        if (!result.success) {
          return { success: false, error: result.error };
        }

        logger.info('Plan upgrade credits added', {
          operation: 'subscription_credits',
          partnerId,
          creditsAdded: creditDifference,
          oldPlan: oldPlanName,
          newPlan: newPlanName
        });
        return { success: true, creditsAdjusted: creditDifference };
      }

      // If downgrading, just update the allocation (don't remove existing credits)
      if (creditDifference < 0) {
        logger.info('Plan downgrade allocation updated', {
          operation: 'subscription_credits',
          partnerId,
          oldPlan: oldPlanName,
          newPlan: newPlanName,
          note: 'Existing credits retained'
        });
        return { success: true, creditsAdjusted: 0 };
      }

      // Same tier
      logger.info('Plan change completed with no credit adjustment', {
        operation: 'subscription_credits',
        partnerId,
        oldPlan: oldPlanName,
        newPlan: newPlanName
      });
      return { success: true, creditsAdjusted: 0 };

    } catch (error) {
      logger.error('Error handling subscription plan change', error as Error, {
        operation: 'subscription_credits',
        partnerId,
        oldPlan: oldPlanName,
        newPlan: newPlanName
      });
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Get all partners who need monthly credit allocation
   */
  static async getPartnersNeedingAllocation(): Promise<Array<{
    id: string;
    businessName: string;
    lastCreditAllocationDate: Date | null;
    monthlyCreditAllocation: number;
    subscriptionPlan?: string;
  }>> {
    try {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      // Find partners who haven't received credits in the last 30 days
      // and have active subscriptions
      const partners = await prisma.partner.findMany({
        where: {
          OR: [
            { lastCreditAllocationDate: null },
            { lastCreditAllocationDate: { lt: thirtyDaysAgo } }
          ],
          // Only include partners with active subscriptions
          // This would need to be adjusted based on how subscriptions are tracked
        },
        select: {
          id: true,
          businessName: true,
          lastCreditAllocationDate: true,
          monthlyCreditAllocation: true,
        }
      });

      return partners;
    } catch (error) {
      logger.error('Error getting partners needing allocation', error as Error, {
        operation: 'subscription_credits'
      });
      return [];
    }
  }

  /**
   * Bulk allocate credits to all eligible partners with expiration logic
   */
  static async bulkAllocateCredits(): Promise<{
    success: boolean;
    processed: number;
    allocated: number;
    expired: number;
    errors: Array<{ partnerId: string; error: string }>;
  }> {
    try {
      const partners = await this.getPartnersNeedingAllocation();
      const results = {
        success: true,
        processed: 0,
        allocated: 0,
        expired: 0,
        errors: [] as Array<{ partnerId: string; error: string }>
      };

      for (const partner of partners) {
        results.processed++;

        if (partner.monthlyCreditAllocation > 0) {
          try {
            // Handle credit expiration and allocation in a transaction
            await prisma.$transaction(async (tx) => {
              // Get current partner data
              const currentPartner = await tx.partner.findUnique({
                where: { id: partner.id },
                select: {
                  id: true,
                  creditBalance: true,
                  creditRolloverEnabled: true,
                  monthlyCreditAllocation: true,
                  businessName: true
                }
              });

              if (!currentPartner) {
                throw new Error('Partner not found');
              }

              let newBalance = currentPartner.creditBalance;
              let creditsExpired = 0;

              // Handle credit expiration (default: no rollover for partners)
              const rolloverEnabled = currentPartner.creditRolloverEnabled ?? false;

              if (!rolloverEnabled && currentPartner.creditBalance > 0) {
                // Calculate how many allocated credits can expire (preserve purchased credits)
                const allocatedCreditsToExpire = await this.calculateExpirableAllocatedCredits(tx, partner.id);

                if (allocatedCreditsToExpire > 0) {
                  creditsExpired = allocatedCreditsToExpire;
                  newBalance = currentPartner.creditBalance - creditsExpired;

                  // Create expiration transaction
                  await tx.creditTransaction.create({
                    data: {
                      partnerId: partner.id,
                      type: 'forfeiture',
                      amount: -creditsExpired,
                      balanceAfter: newBalance,
                      description: 'Monthly allocated credit expiration (purchased credits preserved)',
                      referenceId: `monthly-expiration-${Date.now()}`,
                      createdBy: 'system',
                      metadata: {
                        source: 'monthly_allocation_cron',
                        expiredAmount: creditsExpired,
                        rolloverEnabled: false,
                        allocationDate: new Date().toISOString(),
                        preservedPurchasedCredits: true
                      }
                    }
                  });

                  logger.info('Expired allocated credits for partner', {
                    operation: 'subscription_credits',
                    partnerId: currentPartner.id,
                    partnerName: currentPartner.businessName,
                    creditsExpired,
                    note: 'Preserved purchased credits'
                  });
                  results.expired++;
                } else {
                  logger.info('No allocated credits to expire for partner', {
                    operation: 'subscription_credits',
                    partnerId: currentPartner.id,
                    partnerName: currentPartner.businessName,
                    note: 'Only purchased credits remaining'
                  });
                }
              }

              // Add new monthly allocation
              newBalance += currentPartner.monthlyCreditAllocation;

              // Update partner balance and last allocation date
              await tx.partner.update({
                where: { id: partner.id },
                data: {
                  creditBalance: newBalance,
                  lastCreditAllocationDate: new Date()
                }
              });

              // Create allocation transaction
              await tx.creditTransaction.create({
                data: {
                  partnerId: partner.id,
                  type: 'allocation',
                  amount: currentPartner.monthlyCreditAllocation,
                  balanceAfter: newBalance,
                  description: 'Monthly credit allocation',
                  referenceId: `bulk-allocation-${Date.now()}`,
                  createdBy: 'system',
                  metadata: {
                    source: 'monthly_allocation_cron',
                    allocationDate: new Date().toISOString(),
                    rolloverEnabled: rolloverEnabled,
                    previousBalance: currentPartner.creditBalance,
                    creditsExpired: creditsExpired
                  }
                }
              });

              logger.info('Allocated monthly credits to partner', {
                operation: 'subscription_credits',
                partnerId: currentPartner.id,
                partnerName: currentPartner.businessName,
                creditsAllocated: currentPartner.monthlyCreditAllocation,
                newBalance
              });
            });

            results.allocated++;

          } catch (error) {
            results.errors.push({
              partnerId: partner.id,
              error: error instanceof Error ? error.message : 'Unknown error'
            });
          }
        }
      }

      logger.info('Bulk credit allocation completed', {
        operation: 'subscription_credits',
        partnersProcessed: results.processed,
        partnersAllocated: results.allocated,
        partnersExpired: results.expired
      });
      return results;

    } catch (error) {
      logger.error('Error in bulk credit allocation', error as Error, {
        operation: 'subscription_credits'
      });
      return {
        success: false,
        processed: 0,
        allocated: 0,
        expired: 0,
        errors: [{ partnerId: 'system', error: error instanceof Error ? error.message : 'Unknown error' }]
      };
    }
  }

  /**
   * Calculate how many allocated credits can expire (preserving purchased credits)
   */
  private static async calculateExpirableAllocatedCredits(
    tx: any,
    partnerId: string
  ): Promise<number> {
    try {
      // Get all credit transactions for this partner, ordered by date
      const transactions = await tx.creditTransaction.findMany({
        where: { partnerId },
        orderBy: { createdAt: 'asc' },
        select: {
          type: true,
          amount: true,
          createdAt: true
        }
      });

      // Calculate running balance and track credit sources
      let purchasedCredits = 0;
      let allocatedCredits = 0;

      for (const transaction of transactions) {
        if (transaction.amount > 0) {
          // Credits added
          if (transaction.type === 'purchase') {
            purchasedCredits += transaction.amount;
          } else if (transaction.type === 'allocation' || transaction.type === 'adjustment' || transaction.type === 'refund') {
            allocatedCredits += transaction.amount;
          }
        } else {
          // Credits used - deduct from allocated first, then purchased
          const creditsUsed = Math.abs(transaction.amount);

          if (allocatedCredits >= creditsUsed) {
            allocatedCredits -= creditsUsed;
          } else {
            const remainingToDeduct = creditsUsed - allocatedCredits;
            allocatedCredits = 0;
            purchasedCredits = Math.max(0, purchasedCredits - remainingToDeduct);
          }
        }
      }

      // Return the amount of allocated credits that can expire
      return Math.max(0, allocatedCredits);

    } catch (error) {
      logger.error('Error calculating expirable allocated credits', error as Error, {
        operation: 'subscription_credits'
      });
      return 0;
    }
  }
}
