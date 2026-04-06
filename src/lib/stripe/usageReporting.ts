import Stripe from 'stripe';
import { prisma } from '@/lib/prisma';
import { createStripeConnectError, getStripeErrorMessage } from './utils';
import { logger } from '@/lib/logger';

// Initialize Stripe with secret key
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2023-10-16',
});

export interface UsageRecord {
  subscriptionId: string;
  customerId: string;
  partnerId: string;
  planId: string;
  quantity: number;
  timestamp: Date;
  action?: 'increment' | 'set';
  idempotencyKey?: string;
}

export class StripeUsageReportingService {
  /**
   * Report usage to Stripe for metered billing
   */
  static async reportUsage(usageRecord: UsageRecord): Promise<void> {
    try {
      // Get subscription details with Stripe integration
      const subscription = await prisma.customerMeteredSubscription.findUnique({
        where: { id: usageRecord.subscriptionId },
        include: {
          plan: {
            select: {
              stripeProductId: true,
              stripePriceIds: true,
              partnerId: true,
            },
          },
          partner: {
            select: {
              stripeAccountId: true,
              stripeOnboardingCompleted: true,
              stripeChargesEnabled: true,
            },
          },
        },
      });

      if (!subscription) {
        throw new Error('Subscription not found');
      }

      // Check if subscription has Stripe integration
      if (
        !subscription.stripeSubscriptionId ||
        !subscription.plan.stripeProductId ||
        !subscription.plan.stripePriceIds ||
        !Array.isArray(subscription.plan.stripePriceIds) ||
        subscription.plan.stripePriceIds.length === 0
      ) {
        logger.info('Subscription does not have Stripe integration, skipping usage reporting', {
          operation: 'stripe_usage_reporting',
          subscriptionId: usageRecord.subscriptionId
        });
        return;
      }

      // Check if partner has Stripe Connect account set up
      if (
        !subscription.partner.stripeAccountId ||
        !subscription.partner.stripeOnboardingCompleted ||
        !subscription.partner.stripeChargesEnabled
      ) {
        logger.info('Partner Stripe account not ready, skipping usage reporting', {
          operation: 'stripe_usage_reporting',
          partnerId: subscription.plan.partnerId,
          subscriptionId: usageRecord.subscriptionId
        });
        return;
      }

      // Get the Stripe subscription
      const stripeSubscription = await stripe.subscriptions.retrieve(
        subscription.stripeSubscriptionId,
        {
          expand: ['items'],
        },
        {
          stripeAccount: subscription.partner.stripeAccountId,
        }
      );

      // Report usage for each subscription item (price)
      for (const item of stripeSubscription.items.data) {
        if (subscription.plan.stripePriceIds.includes(item.price.id)) {
          await stripe.subscriptionItems.createUsageRecord(
            item.id,
            {
              quantity: Math.round(usageRecord.quantity),
              timestamp: Math.floor(usageRecord.timestamp.getTime() / 1000),
              action: usageRecord.action || 'increment',
            },
            {
              idempotencyKey: usageRecord.idempotencyKey || 
                `${usageRecord.subscriptionId}-${usageRecord.timestamp.getTime()}`,
              stripeAccount: subscription.partner.stripeAccountId,
            }
          );
        }
      }

      logger.info('Usage reported to Stripe for subscription', {
        operation: 'stripe_usage_reporting',
        subscriptionId: usageRecord.subscriptionId,
        quantity: usageRecord.quantity
      });
    } catch (error: any) {
      logger.error('Error reporting usage to Stripe', error as Error, {
        operation: 'stripe_usage_reporting',
        subscriptionId: usageRecord.subscriptionId
      });
      
      // Don't throw error for Stripe reporting failures to avoid breaking the main flow
      // Log the error and continue with local usage tracking
      if (error.type === 'StripeInvalidRequestError') {
        logger.warn('Stripe usage reporting failed (invalid request)', {
          operation: 'stripe_usage_reporting',
          subscriptionId: usageRecord.subscriptionId,
          errorMessage: error.message
        });
      } else {
        logger.error('Stripe usage reporting failed', error as Error, {
          operation: 'stripe_usage_reporting',
          subscriptionId: usageRecord.subscriptionId,
          stripeError: getStripeErrorMessage(error)
        });
      }
    }
  }

  /**
   * Batch report usage records to Stripe
   */
  static async batchReportUsage(usageRecords: UsageRecord[]): Promise<void> {
    const promises = usageRecords.map(record => this.reportUsage(record));
    
    // Use Promise.allSettled to continue even if some reports fail
    const results = await Promise.allSettled(promises);
    
    const failed = results.filter(result => result.status === 'rejected');
    if (failed.length > 0) {
      logger.warn('Usage reports failed', {
        operation: 'stripe_usage_reporting',
        failedCount: failed.length,
        totalCount: usageRecords.length
      });
    }
  }

  /**
   * Sync pending usage records to Stripe
   */
  static async syncPendingUsage(partnerId?: string): Promise<void> {
    try {
      // Get subscriptions with pending usage that have Stripe integration
      const subscriptions = await prisma.customerMeteredSubscription.findMany({
        where: {
          ...(partnerId && { partnerId }),
          stripeSubscriptionId: { not: null },
          usageTrackingEnabled: true,
        },
        include: {
          plan: {
            select: {
              stripeProductId: true,
              stripePriceIds: true,
              metricName: true,
              billingCycle: true,
            },
          },
          partner: {
            select: {
              stripeAccountId: true,
              stripeOnboardingCompleted: true,
              stripeChargesEnabled: true,
            },
          },
        },
      });

      for (const subscription of subscriptions) {
        // Check if partner has Stripe ready
        if (
          !subscription.partner.stripeAccountId ||
          !subscription.partner.stripeOnboardingCompleted ||
          !subscription.partner.stripeChargesEnabled
        ) {
          continue;
        }

        // Get current usage from subscription record
        const currentUsage = subscription.currentUsage as Record<string, number>;
        const metricName = subscription.plan.metricName;
        
        if (currentUsage[metricName] && currentUsage[metricName] > 0) {
          await this.reportUsage({
            subscriptionId: subscription.id,
            customerId: subscription.customerId,
            partnerId: subscription.partnerId,
            planId: subscription.planId,
            quantity: currentUsage[metricName],
            timestamp: new Date(),
            action: 'set', // Set the total usage for the period
            idempotencyKey: `sync-${subscription.id}-${subscription.currentPeriodStart.getTime()}`,
          });
        }
      }
    } catch (error) {
      logger.error('Error syncing pending usage to Stripe', error as Error, {
        operation: 'stripe_usage_reporting'
      });
      throw error;
    }
  }

  /**
   * Get usage summary from Stripe for a subscription
   */
  static async getStripeUsageSummary(
    subscriptionId: string,
    periodStart: Date,
    periodEnd: Date
  ): Promise<Record<string, number>> {
    try {
      const subscription = await prisma.customerMeteredSubscription.findUnique({
        where: { id: subscriptionId },
        include: {
          partner: {
            select: {
              stripeAccountId: true,
            },
          },
        },
      });

      if (!subscription?.stripeSubscriptionId || !subscription.partner.stripeAccountId) {
        return {};
      }

      const stripeSubscription = await stripe.subscriptions.retrieve(
        subscription.stripeSubscriptionId,
        {
          expand: ['items'],
        },
        {
          stripeAccount: subscription.partner.stripeAccountId,
        }
      );

      const usageSummary: Record<string, number> = {};

      for (const item of stripeSubscription.items.data) {
        const usageRecords = await stripe.subscriptionItems.listUsageRecordSummaries(
          item.id,
          {
            limit: 100,
          },
          {
            stripeAccount: subscription.partner.stripeAccountId,
          }
        );

        const totalUsage = usageRecords.data.reduce((sum, record) => sum + record.total_usage, 0);
        usageSummary[item.price.id] = totalUsage;
      }

      return usageSummary;
    } catch (error: any) {
      logger.error('Error getting Stripe usage summary', error as Error, {
        operation: 'stripe_usage_reporting',
        subscriptionId
      });
      return {};
    }
  }
}
