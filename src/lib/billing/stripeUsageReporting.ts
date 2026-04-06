import { prisma } from '@/lib/prisma';
import Stripe from 'stripe';
import { UsageTrackingService } from './usageTracking';

import { billingLogger } from '@/lib/logger';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2023-10-16',
});

export interface UsageReportingOptions {
  subscriptionId: string;
  customerId: string;
  partnerId: string;
  planId: string;
  metricName: string;
  billingPeriodStart: Date;
  billingPeriodEnd: Date;
  idempotencyKey?: string;
}

export class StripeUsageReportingService {
  /**
   * Report usage to Stripe for a metered subscription
   */
  static async reportUsageToStripe(options: UsageReportingOptions): Promise<{ reported: boolean; reason?: string }> {
    // Input validation
    if (!options) {
      throw new Error('Usage reporting options are required');
    }

    const { subscriptionId, customerId, partnerId, planId, metricName, billingPeriodStart, billingPeriodEnd } = options;

    if (!subscriptionId || typeof subscriptionId !== 'string') {
      throw new Error('Valid subscription ID is required');
    }
    if (!customerId || typeof customerId !== 'string') {
      throw new Error('Valid customer ID is required');
    }
    if (!partnerId || typeof partnerId !== 'string') {
      throw new Error('Valid partner ID is required');
    }
    if (!planId || typeof planId !== 'string') {
      throw new Error('Valid plan ID is required');
    }
    if (!metricName || typeof metricName !== 'string') {
      throw new Error('Valid metric name is required');
    }
    if (!billingPeriodStart || !(billingPeriodStart instanceof Date)) {
      throw new Error('Valid billing period start date is required');
    }
    if (!billingPeriodEnd || !(billingPeriodEnd instanceof Date)) {
      throw new Error('Valid billing period end date is required');
    }
    if (billingPeriodStart >= billingPeriodEnd) {
      throw new Error('Billing period start must be before end date');
    }

    try {
      billingLogger.info('Reporting usage to Stripe with cross-verification', {
        operation: 'stripe_usage_reporting',
        subscriptionId: options.subscriptionId,
        customerId: options.customerId,
        partnerId: options.partnerId,
        planId: options.planId,
        metricName: options.metricName,
        billingPeriod: `${options.billingPeriodStart} to ${options.billingPeriodEnd}`
      });

      // STEP 1: Cross-verify subscription data from analytics with app database
      billingLogger.info('Step 1: Cross-verifying subscription data', {
        operation: 'stripe_usage_reporting',
        subscriptionId: options.subscriptionId
      });

      const subscription = await prisma.customerMeteredSubscription.findFirst({
        where: {
          id: subscriptionId,
          customerId,
          partnerId,
          planId,
          status: 'active',
        },
        include: {
          plan: true,
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
        throw new Error(`Cross-verification failed: No active subscription found with ID: ${subscriptionId}, Customer: ${customerId}, Partner: ${partnerId}, Plan: ${planId}`);
      }

      billingLogger.info('Subscription cross-verification passed', {
        operation: 'stripe_usage_reporting',
        subscriptionId: options.subscriptionId
      });

      // STEP 2: Verify plan metric matches
      if (subscription.plan.metricName !== metricName) {
        throw new Error(`Metric mismatch: Plan expects '${subscription.plan.metricName}' but analytics provided '${metricName}'`);
      }

      billingLogger.info('Plan metric verification passed', {
        operation: 'stripe_usage_reporting',
        planId: options.planId,
        metricName: options.metricName
      });

      // STEP 3: Verify Stripe Connect setup
      if (!subscription.stripeSubscriptionId) {
        throw new Error(`No Stripe subscription ID found for subscription: ${subscriptionId}`);
      }

      if (!subscription.partner.stripeAccountId ||
          !subscription.partner.stripeOnboardingCompleted ||
          !subscription.partner.stripeChargesEnabled) {
        throw new Error(`Partner Stripe Connect not ready for subscription: ${subscriptionId}`);
      }

      billingLogger.info('Stripe Connect verification passed', {
        operation: 'stripe_usage_reporting',
        stripeSubscriptionId: subscription.stripeSubscriptionId,
        stripeAccountId: subscription.partner.stripeAccountId
      });

      if (!subscription.partner.stripeAccountId ||
          !subscription.partner.stripeOnboardingCompleted ||
          !subscription.partner.stripeChargesEnabled) {
        billingLogger.warn('Partner Stripe account not ready, skipping usage reporting', {
          operation: 'stripe_usage_reporting',
          subscriptionId: options.subscriptionId
        });
        return { reported: false, reason: 'Partner Stripe account not ready' };
      }

      // Get usage for the billing period (aggregated data)
      const usageData = await UsageTrackingService.getUnbilledUsage(
        options.customerId,
        options.partnerId,
        options.metricName
      );

      if (!usageData || usageData.length === 0) {
        billingLogger.info('No usage data found for reporting', {
          operation: 'stripe_usage_reporting',
          subscriptionId: options.subscriptionId
        });
        return { reported: false, reason: 'No usage data found' };
      }

      billingLogger.info('Found usage data', {
        operation: 'stripe_usage_reporting',
        usageRecords: usageData.map(u => ({
          metricName: u.metricName,
          totalQuantity: u.totalQuantity,
          billingPeriod: `${u.billingPeriodStart} to ${u.billingPeriodEnd}`
        }))
      });

      // Aggregate usage by metric type
      const totalUsage = usageData.reduce((sum, usage) => {
        return sum + Number(usage.totalQuantity || 0);
      }, 0);

      if (totalUsage <= 0) {
        billingLogger.info('No usage to report to Stripe', {
          operation: 'stripe_usage_reporting',
          totalUsage
        });
        return { reported: false, reason: 'No usage quantity to report' };
      }

      billingLogger.info('Total usage to report', {
        operation: 'stripe_usage_reporting',
        totalUsage
      });

      // Get individual usage records to find the actual usage dates
      const individualUsageRecords = await prisma.usageMetric.findMany({
        where: {
          customerId: options.customerId,
          partnerId: options.partnerId,
          metricName: options.metricName,
          billingStatus: 'pending',
          usageDate: {
            gte: options.billingPeriodStart,
            lte: options.billingPeriodEnd
          }
        },
        select: {
          id: true,
          usageDate: true,
          quantity: true
        },
        orderBy: { usageDate: 'asc' }
      });

      billingLogger.info('Found individual usage records', {
        operation: 'stripe_usage_reporting',
        recordCount: individualUsageRecords.length
      });

      // Get the Stripe subscription to find the subscription item
      let stripeSubscription;
      try {
        stripeSubscription = await stripe.subscriptions.retrieve(
          subscription.stripeSubscriptionId,
          {
            stripeAccount: subscription.partner.stripeAccountId,
          }
        );
      } catch (stripeError: any) {
        billingLogger.error('Error retrieving Stripe subscription', stripeError as Error, {
          operation: 'stripe_usage_reporting',
          stripeSubscriptionId: subscription.stripeSubscriptionId
        });
        throw new Error(`Failed to retrieve Stripe subscription: ${stripeError.message || 'Unknown error'}`);
      }

      if (!stripeSubscription) {
        throw new Error('Stripe subscription not found');
      }

      if (!stripeSubscription.items || !stripeSubscription.items.data) {
        throw new Error('Stripe subscription has no items');
      }

      // Find the metered subscription item
      const meteredItem = stripeSubscription.items.data.find(item =>
        item.price && item.price.recurring && item.price.recurring.usage_type === 'metered'
      );

      if (!meteredItem) {
        throw new Error('No metered subscription item found in Stripe subscription');
      }

      if (!meteredItem.id) {
        throw new Error('Metered subscription item has no ID');
      }

      // Validate usage quantity
      const usageQuantity = Math.round(totalUsage);
      if (usageQuantity <= 0 || !Number.isFinite(usageQuantity)) {
        throw new Error(`Invalid usage quantity: ${usageQuantity}`);
      }

      // Use the actual usage date from analytics (when the metric was analyzed)
      // Get the earliest usage date from the individual records
      const earliestUsageDate = individualUsageRecords.length > 0
        ? individualUsageRecords[0].usageDate // Already sorted by usageDate asc
        : new Date(); // Use current time as fallback

      const usageTimestamp = Math.floor(earliestUsageDate.getTime() / 1000);

      // Ensure timestamp is not in the future
      const currentTimestamp = Math.floor(new Date().getTime() / 1000);
      const finalTimestamp = usageTimestamp > currentTimestamp ? currentTimestamp : usageTimestamp;

      billingLogger.info('Using usage timestamp', {
        operation: 'stripe_usage_reporting',
        earliestUsageDate: earliestUsageDate.toISOString(),
        originalTimestamp: usageTimestamp,
        finalTimestamp: finalTimestamp,
        humanReadable: new Date(finalTimestamp * 1000).toISOString(),
        currentTime: new Date().toISOString(),
        wasAdjusted: finalTimestamp !== usageTimestamp
      });

      // Detailed Stripe API call logging
      const stripeCallDetails = {
        subscriptionItemId: meteredItem.id,
        quantity: usageQuantity,
        timestamp: usageTimestamp,
        humanTimestamp: new Date(usageTimestamp * 1000).toISOString(),
        stripeAccount: subscription.partner.stripeAccountId,
        idempotencyKey: options.idempotencyKey || `usage-${subscription.id}-${usageTimestamp}`,
        subscriptionId: subscription.stripeSubscriptionId
      };

      billingLogger.info('Making Stripe API call', {
        operation: 'stripe_usage_reporting',
        ...stripeCallDetails
      });

      // Report usage to Stripe with accurate timestamp
      let usageRecord;
      try {
        billingLogger.info('Calling stripe.subscriptionItems.createUsageRecord', {
          operation: 'stripe_usage_reporting'
        });

        usageRecord = await stripe.subscriptionItems.createUsageRecord(
          meteredItem.id,
          {
            quantity: usageQuantity,
            timestamp: finalTimestamp, // Use final adjusted timestamp
            action: 'increment', // Increment usage (better for multiple reports)
          },
          {
            stripeAccount: subscription.partner.stripeAccountId,
            idempotencyKey: options.idempotencyKey ||
              `usage-${subscription.id}-${finalTimestamp}`, // Use final timestamp in key
          }
        );

        billingLogger.info('Stripe API call successful', {
          operation: 'stripe_usage_reporting',
          usageRecordId: usageRecord.id,
          quantity: usageRecord.quantity,
          timestamp: usageRecord.timestamp,
          subscriptionItem: usageRecord.subscription_item,
          livemode: usageRecord.livemode
        });
      } catch (stripeError: any) {
        billingLogger.error('Stripe API Error Details', stripeError as Error, {
          operation: 'stripe_usage_reporting',
          errorType: stripeError.type,
          errorCode: stripeError.code,
          statusCode: stripeError.statusCode,
          requestId: stripeError.requestId,
          stripeAccount: subscription.partner.stripeAccountId,
          subscriptionItemId: meteredItem.id,
          callDetails: stripeCallDetails
        });
        throw new Error(`Failed to create usage record in Stripe: ${stripeError.message || 'Unknown error'}`);
      }

      if (!usageRecord || !usageRecord.id) {
        throw new Error('Invalid usage record returned from Stripe');
      }

      billingLogger.info('Usage reported to Stripe successfully', {
        operation: 'stripe_usage_reporting',
        usageRecordId: usageRecord.id,
        quantity: totalUsage,
        subscriptionItem: meteredItem.id,
        stripeAccount: subscription.partner.stripeAccountId,
        subscriptionId: subscription.stripeSubscriptionId
      });

      // CRITICAL: Update billing status to prevent duplicate reporting
      billingLogger.info('Updating usage metrics billing status to prevent duplicates', {
        operation: 'stripe_usage_reporting'
      });

      // Get the specific metrics that were reported
      const metricsToUpdate = await prisma.usageMetric.findMany({
        where: {
          customerId: options.customerId,
          partnerId: options.partnerId,
          metricName: options.metricName,
          billingStatus: 'pending',
          // Only update metrics that were included in this usage report
          usageDate: {
            gte: options.billingPeriodStart,
            lte: options.billingPeriodEnd
          }
        }
      });

      billingLogger.info('Found metrics to update', {
        operation: 'stripe_usage_reporting',
        metricsCount: metricsToUpdate.length
      });

      // Update each metric individually to preserve existing metadata
      let updatedCount = 0;
      for (const metric of metricsToUpdate) {
        await prisma.usageMetric.update({
          where: { id: metric.id },
          data: {
            billingStatus: 'reported',
            metadata: {
              ...(metric.metadata as object || {}),
              stripeUsageRecordId: usageRecord.id,
              reportedAt: new Date().toISOString(),
              stripeTimestamp: finalTimestamp,
              reportedQuantity: totalUsage
            }
          }
        });
        updatedCount++;
      }

      billingLogger.info('Updated usage metrics to reported status', {
        operation: 'stripe_usage_reporting',
        updatedCount
      });

      // Note: Analytics records are already marked as processed during the sync phase
      // This prevents them from being re-synced in future cycles

      // Update subscription with current usage
      try {
        await prisma.customerMeteredSubscription.update({
          where: { id: subscription.id },
          data: {
            currentUsage: {
              [options.metricName]: totalUsage,
              lastReported: new Date().toISOString(),
              stripeUsageRecordId: usageRecord.id,
            },
          },
        });
      } catch (dbError: any) {
        billingLogger.error('Error updating subscription usage in database', dbError as Error, {
          operation: 'stripe_usage_reporting'
        });
        // Don't throw here as the usage was successfully reported to Stripe
        // This is a non-critical update
      }

      return { reported: true };

    } catch (error) {
      billingLogger.error('Error reporting usage to Stripe', error as Error, {
        operation: 'stripe_usage_reporting',
        subscriptionId: options.subscriptionId
      });
      throw error;
    }
  }

  /**
   * Report usage for all active metered subscriptions
   */
  static async reportAllUsage(billingDate?: Date): Promise<{ processed: number; errors: number }> {
    try {
      const targetDate = billingDate || new Date();
      billingLogger.info('Reporting usage for all subscriptions', {
        operation: 'stripe_usage_reporting',
        targetDate: targetDate.toISOString()
      });

      // Get all active metered subscriptions (don't filter by billing date for continuous reporting)
      const subscriptions = await prisma.customerMeteredSubscription.findMany({
        where: {
          status: 'active',
          stripeSubscriptionId: { not: null },
          usageTrackingEnabled: true,
        },
        include: {
          plan: true,
          partner: {
            select: {
              stripeAccountId: true,
              stripeOnboardingCompleted: true,
              stripeChargesEnabled: true,
            },
          },
        },
      });

      billingLogger.info('Found subscriptions to process', {
        operation: 'stripe_usage_reporting',
        subscriptionCount: subscriptions.length
      });

      // Debug: Log each subscription
      subscriptions.forEach(sub => {
        billingLogger.info('Processing subscription', {
          operation: 'stripe_usage_reporting',
          subscriptionId: sub.id,
          customer: sub.customerId,
          partner: sub.partnerId,
          plan: sub.plan?.name,
          metricName: sub.plan?.metricName,
          stripeSubId: sub.stripeSubscriptionId,
          usageTracking: sub.usageTrackingEnabled,
          partnerStripeReady: !!(sub.partner?.stripeAccountId && sub.partner?.stripeOnboardingCompleted && sub.partner?.stripeChargesEnabled)
        });
      });

      const results = {
        processed: 0,
        errors: 0,
        skipped: 0,
      };

      for (const subscription of subscriptions) {
        try {
          // Skip if partner doesn't have Stripe set up
          if (!subscription.partner.stripeAccountId ||
              !subscription.partner.stripeOnboardingCompleted ||
              !subscription.partner.stripeChargesEnabled) {
            billingLogger.info('Skipping subscription - partner Stripe not ready', {
              operation: 'stripe_usage_reporting',
              subscriptionId: subscription.id
            });
            results.skipped++;
            continue;
          }

          billingLogger.info('Processing subscription for metric', {
            operation: 'stripe_usage_reporting',
            subscriptionId: subscription.id,
            metricName: subscription.plan.metricName
          });

          const reportResult = await this.reportUsageToStripe({
            subscriptionId: subscription.id,
            customerId: subscription.customerId,
            partnerId: subscription.partnerId,
            planId: subscription.planId,
            metricName: subscription.plan.metricName,
            billingPeriodStart: subscription.currentPeriodStart,
            billingPeriodEnd: subscription.currentPeriodEnd,
            idempotencyKey: `batch-usage-${subscription.id}-${targetDate.getTime()}`,
          });

          if (reportResult.reported) {
            results.processed++;
            billingLogger.info('Successfully reported usage for subscription', {
              operation: 'stripe_usage_reporting',
              subscriptionId: subscription.id
            });
          } else {
            billingLogger.info('No usage to report for subscription', {
              operation: 'stripe_usage_reporting',
              subscriptionId: subscription.id,
              reason: reportResult.reason
            });
          }
        } catch (error) {
          billingLogger.error('Error processing subscription', error as Error, {
            operation: 'stripe_usage_reporting',
            subscriptionId: subscription.id
          });
          results.errors++;
        }
      }

      billingLogger.info('Usage reporting batch completed', {
        operation: 'stripe_usage_reporting',
        results
      });
      return results;
    } catch (error) {
      billingLogger.error('Error in batch usage reporting', error as Error, {
        operation: 'stripe_usage_reporting'
      });
      throw error;
    }
  }

  /**
   * Get usage records from Stripe for a subscription
   */
  static async getStripeUsageRecords(
    subscriptionId: string,
    startDate?: Date,
    endDate?: Date
  ): Promise<Stripe.UsageRecord[]> {
    try {
      const subscription = await prisma.customerMeteredSubscription.findFirst({
        where: { id: subscriptionId },
        include: {
          partner: {
            select: {
              stripeAccountId: true,
            },
          },
        },
      });

      if (!subscription || !subscription.stripeSubscriptionId) {
        throw new Error('Subscription not found or not connected to Stripe');
      }

      // Get the Stripe subscription
      const stripeSubscription = await stripe.subscriptions.retrieve(
        subscription.stripeSubscriptionId,
        {
          stripeAccount: subscription.partner.stripeAccountId!,
        }
      );

      // Find the metered subscription item
      const meteredItem = stripeSubscription.items.data.find(item => 
        item.price.recurring?.usage_type === 'metered'
      );

      if (!meteredItem) {
        throw new Error('No metered subscription item found');
      }

      // Get usage records
      const usageRecords = await stripe.subscriptionItems.listUsageRecordSummaries(
        meteredItem.id,
        {
          limit: 100,
          ...(startDate && { starting_after: Math.floor(startDate.getTime() / 1000).toString() }),
          ...(endDate && { ending_before: Math.floor(endDate.getTime() / 1000).toString() }),
        },
        {
          stripeAccount: subscription.partner.stripeAccountId!,
        }
      );

      return usageRecords.data as any;
    } catch (error) {
      billingLogger.error('Error getting Stripe usage records', error as Error, {
        operation: 'stripe_usage_reporting',
        subscriptionId
      });
      throw error;
    }
  }

  /**
   * Sync usage records between our database and Stripe
   */
  static async syncUsageRecords(subscriptionId: string): Promise<void> {
    try {
      billingLogger.info('Syncing usage records for subscription', {
        operation: 'stripe_usage_reporting',
        subscriptionId
      });

      const subscription = await prisma.customerMeteredSubscription.findFirst({
        where: { id: subscriptionId },
        include: { plan: true },
      });

      if (!subscription) {
        throw new Error('Subscription not found');
      }

      // Get usage records from Stripe
      const stripeUsageRecords = await this.getStripeUsageRecords(subscriptionId);

      // Get usage records from our database
      const dbUsageRecords = await UsageTrackingService.getUsageHistory(
        subscription.customerId,
        subscription.partnerId,
        subscription.currentPeriodStart,
        subscription.currentPeriodEnd,
        subscription.plan.metricType
      );

      // Compare and identify discrepancies
      const stripeTotal = stripeUsageRecords.reduce((sum, record) => sum + (record as any).total_usage, 0);
      const dbTotal = dbUsageRecords.data.reduce((sum: number, record: any) => sum + Number(record.quantity), 0);

      if (Math.abs(stripeTotal - dbTotal) > 0.01) { // Allow for small rounding differences
        billingLogger.warn('Usage discrepancy detected', {
          operation: 'stripe_usage_reporting',
          subscriptionId,
          stripeTotal,
          dbTotal,
          difference: stripeTotal - dbTotal
        });

        // Could trigger reconciliation process here
      }

      billingLogger.info('Usage sync completed', {
        operation: 'stripe_usage_reporting',
        subscriptionId,
        stripeRecords: stripeUsageRecords.length,
        dbRecords: dbUsageRecords.data.length,
        stripeTotal,
        dbTotal
      });
    } catch (error) {
      billingLogger.error('Error syncing usage records', error as Error, {
        operation: 'stripe_usage_reporting',
        subscriptionId
      });
      throw error;
    }
  }
}
