import { UsageTrackingService, UsageEvent } from './usageTracking';
import { StripeUsageReportingService } from './stripeUsageReporting';
import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';

/**
 * Integration service to connect existing analytics/webhook system with metered billing
 */
export class UsageIntegrationService {
  /**
   * Process call data from analytics webhook and record usage for metered billing
   */
  static async processCallUsageFromWebhook(
    partnerId: string,
    customerId: string,
    agentId: string,
    provider: string,
    callData: {
      callId: string;
      duration: number; // in seconds
      cost?: number; // in cents
      startTime: Date;
      endTime?: Date;
      metadata?: Record<string, any>;
    }
  ): Promise<void> {
    try {
      // Check if customer has active metered subscriptions
      const activeSubscriptions = await prisma.customerMeteredSubscription.findMany({
        where: {
          customerId,
          partnerId,
          status: 'active',
        },
        include: {
          plan: true,
        },
      });

      if (activeSubscriptions.length === 0) {
        logger.info('No active metered subscriptions for customer', {
          operation: 'usage_integration',
          customerId,
          partnerId
        });
        return;
      }

      // Create usage events for each relevant metric type
      const usageEvents: UsageEvent[] = [];

      for (const subscription of activeSubscriptions) {
        const plan = subscription.plan;
        
        // Record usage based on metric type
        switch (plan.metricType) {
          case 'calls':
            if (plan.metricName === 'total_calls') {
              usageEvents.push({
                customerId,
                partnerId,
                agentId,
                metricType: 'calls',
                metricName: 'total_calls',
                metricCategory: provider,
                quantity: 1, // One call
                unitPrice: (plan.pricingTiers as any)?.[0]?.price || 0,
                sourceReference: callData.callId,
                usageDate: callData.startTime,
                metadata: {
                  provider,
                  callId: callData.callId,
                  duration: callData.duration,
                  cost: callData.cost,
                  ...callData.metadata,
                },
              });
            }
            break;

          case 'minutes':
            if (plan.metricName === 'call_minutes') {
              const minutes = Math.ceil(callData.duration / 60); // Round up to next minute
              usageEvents.push({
                customerId,
                partnerId,
                agentId,
                metricType: 'minutes',
                metricName: 'call_minutes',
                metricCategory: provider,
                quantity: minutes,
                unitPrice: (plan.pricingTiers as any)?.[0]?.price || 0,
                sourceReference: callData.callId,
                usageDate: callData.startTime,
                metadata: {
                  provider,
                  callId: callData.callId,
                  duration: callData.duration,
                  actualMinutes: minutes,
                  cost: callData.cost,
                  ...callData.metadata,
                },
              });
            }
            break;

          case 'seconds':
            if (plan.metricName === 'call_seconds') {
              usageEvents.push({
                customerId,
                partnerId,
                agentId,
                metricType: 'seconds',
                metricName: 'call_seconds',
                metricCategory: provider,
                quantity: callData.duration,
                unitPrice: (plan.pricingTiers as any)?.[0]?.price || 0,
                sourceReference: callData.callId,
                usageDate: callData.startTime,
                metadata: {
                  provider,
                  callId: callData.callId,
                  duration: callData.duration,
                  cost: callData.cost,
                  ...callData.metadata,
                },
              });
            }
            break;

          case 'cost':
            if (plan.metricName === 'call_cost' && callData.cost) {
              usageEvents.push({
                customerId,
                partnerId,
                agentId,
                metricType: 'cost',
                metricName: 'call_cost',
                metricCategory: provider,
                quantity: callData.cost / 100, // Convert cents to dollars
                unitPrice: (plan.pricingTiers as any)?.[0]?.price || 0,
                sourceReference: callData.callId,
                usageDate: callData.startTime,
                metadata: {
                  provider,
                  callId: callData.callId,
                  duration: callData.duration,
                  costCents: callData.cost,
                  ...callData.metadata,
                },
              });
            }
            break;
        }
      }

      // Record all usage events
      if (usageEvents.length > 0) {
        await UsageTrackingService.recordUsageBatch(usageEvents);
        logger.info('Recorded usage events for call', {
          operation: 'usage_integration',
          eventCount: usageEvents.length,
          callId: callData.callId,
          customerId,
          partnerId
        });
      }

      // Check if we should report usage to Stripe for any subscriptions
      for (const subscription of activeSubscriptions) {
        if (subscription.stripeSubscriptionId) {
          try {
            const shouldReport = await this.shouldReportUsageToStripe(subscription);
            if (shouldReport) {
              await StripeUsageReportingService.reportUsageToStripe({
                subscriptionId: subscription.id,
                customerId,
                partnerId,
                planId: subscription.planId,
                metricName: subscription.plan.metricType || 'usage',
                billingPeriodStart: subscription.currentPeriodStart,
                billingPeriodEnd: subscription.currentPeriodEnd,
              });
            }
          } catch (stripeError) {
            logger.error('Error reporting usage to Stripe', stripeError as Error, {
              operation: 'usage_integration',
              customerId,
              partnerId
            });
            // Don't throw to avoid breaking the main flow
          }
        }
      }
    } catch (error) {
      logger.error('Error processing call usage for metered billing', error as Error, {
        operation: 'usage_integration',
        customerId,
        partnerId,
        callId: callData.callId
      });
      // Don't throw error to avoid breaking webhook processing
    }
  }

  /**
   * Process lead/appointment data for metered billing
   */
  static async processLeadUsage(
    partnerId: string,
    customerId: string,
    agentId: string,
    leadData: {
      leadId: string;
      type: 'lead' | 'appointment' | 'qualified_lead';
      value?: number; // lead value in cents
      source: string;
      createdAt: Date;
      metadata?: Record<string, any>;
    }
  ): Promise<void> {
    try {
      // Check for active lead-based metered subscriptions
      const activeSubscriptions = await prisma.customerMeteredSubscription.findMany({
        where: {
          customerId,
          partnerId,
          status: 'active',
          plan: {
            metricType: 'leads',
          },
        },
        include: {
          plan: true,
        },
      });

      if (activeSubscriptions.length === 0) {
        return;
      }

      const usageEvents: UsageEvent[] = [];

      for (const subscription of activeSubscriptions) {
        const plan = subscription.plan;
        
        // Record usage based on lead type and plan configuration
        if (plan.metricName === 'total_leads' || 
            plan.metricName === leadData.type ||
            plan.metricName === 'all_leads') {
          
          usageEvents.push({
            customerId,
            partnerId,
            agentId,
            metricType: 'leads',
            metricName: plan.metricName,
            metricCategory: leadData.type,
            quantity: 1,
            unitPrice: (plan.pricingTiers as any)?.[0]?.price || 0,
            sourceReference: leadData.leadId,
            usageDate: leadData.createdAt,
            metadata: {
              leadType: leadData.type,
              leadId: leadData.leadId,
              leadValue: leadData.value,
              source: leadData.source,
              ...leadData.metadata,
            },
          });
        }
      }

      if (usageEvents.length > 0) {
        await UsageTrackingService.recordUsageBatch(usageEvents);
        logger.info('Recorded lead usage events', {
          operation: 'usage_integration',
          eventCount: usageEvents.length,
          leadId: leadData.leadId,
          customerId,
          partnerId
        });
      }
    } catch (error) {
      logger.error('Error processing lead usage for metered billing', error as Error, {
        operation: 'usage_integration',
        customerId,
        partnerId,
        leadId: leadData.leadId
      });
    }
  }

  /**
   * Process custom metric usage (for partner-defined metrics)
   */
  static async processCustomMetricUsage(
    partnerId: string,
    customerId: string,
    agentId: string,
    metricData: {
      metricType: string;
      metricName: string;
      quantity: number;
      unitPrice?: number;
      sourceReference?: string;
      metadata?: Record<string, any>;
    }
  ): Promise<void> {
    try {
      // Check for active custom metric subscriptions
      const activeSubscriptions = await prisma.customerMeteredSubscription.findMany({
        where: {
          customerId,
          partnerId,
          status: 'active',
          plan: {
            metricType: metricData.metricType,
            metricName: metricData.metricName,
          },
        },
        include: {
          plan: true,
        },
      });

      if (activeSubscriptions.length === 0) {
        return;
      }

      const usageEvents: UsageEvent[] = [];

      for (const subscription of activeSubscriptions) {
        const plan = subscription.plan;
        
        usageEvents.push({
          customerId,
          partnerId,
          agentId,
          metricType: metricData.metricType,
          metricName: metricData.metricName,
          quantity: metricData.quantity,
          unitPrice: metricData.unitPrice || (plan.pricingTiers as any)?.[0]?.price || 0,
          sourceReference: metricData.sourceReference,
          usageDate: new Date(),
          metadata: metricData.metadata,
        });
      }

      if (usageEvents.length > 0) {
        await UsageTrackingService.recordUsageBatch(usageEvents);
        logger.info('Recorded custom metric usage events', {
          operation: 'usage_integration',
          eventCount: usageEvents.length,
          customerId,
          partnerId
        });
      }
    } catch (error) {
      logger.error('Error processing custom metric usage', error as Error, {
        operation: 'usage_integration',
        customerId,
        partnerId
      });
    }
  }

  /**
   * Get customer's current usage for all active metered plans
   */
  static async getCurrentUsageForCustomer(
    customerId: string,
    partnerId: string
  ): Promise<Array<{
    subscriptionId: string;
    planName: string;
    metricType: string;
    metricName: string;
    currentUsage: number;
    includedUnits: number;
    billingPeriodStart: Date;
    billingPeriodEnd: Date;
    projectedCost: number;
  }>> {
    try {
      const activeSubscriptions = await prisma.customerMeteredSubscription.findMany({
        where: {
          customerId,
          partnerId,
          status: 'active',
        },
        include: {
          plan: true,
        },
      });

      const results = [];

      for (const subscription of activeSubscriptions) {
        // Get current usage for this subscription's billing period
        const usageAggregation = await UsageTrackingService.getUsageAggregation(
          customerId,
          partnerId,
          subscription.currentPeriodStart,
          subscription.currentPeriodEnd,
          subscription.plan.metricType
        );

        const relevantUsage = usageAggregation.find(
          usage => usage.metricName === subscription.plan.metricName
        );

        const currentUsage = relevantUsage?.totalQuantity || 0;
        const includedUnits = Number(subscription.plan.includedUnits);
        
        // Calculate projected cost (simplified)
        const billableUsage = Math.max(0, currentUsage - includedUnits);
        const unitPrice = (subscription.plan.pricingTiers as any)?.[0]?.price || 0;
        const projectedCost = Math.max(
          billableUsage * (unitPrice / 100),
          Number(subscription.plan.minimumCharge)
        );

        results.push({
          subscriptionId: subscription.id,
          planName: subscription.plan.name,
          metricType: subscription.plan.metricType,
          metricName: subscription.plan.metricName,
          currentUsage,
          includedUnits,
          billingPeriodStart: subscription.currentPeriodStart,
          billingPeriodEnd: subscription.currentPeriodEnd,
          projectedCost,
        });
      }

      return results;
    } catch (error) {
      logger.error('Error getting current usage for customer', error as Error, {
        operation: 'usage_integration',
        customerId,
        partnerId
      });
      return [];
    }
  }

  /**
   * Webhook integration helper - call this from existing webhook processors
   */
  static async integrateWithWebhook(
    partnerId: string,
    customerId: string,
    agentId: string,
    provider: string,
    eventType: string,
    eventData: any
  ): Promise<void> {
    try {
      // Only process call_ended events for now
      if (eventType === 'call_ended' && eventData.duration) {
        await this.processCallUsageFromWebhook(
          partnerId,
          customerId,
          agentId,
          provider,
          {
            callId: eventData.call_id || eventData.id,
            duration: eventData.duration || eventData.duration_seconds,
            cost: eventData.cost || eventData.total_cost,
            startTime: new Date(eventData.start_time || eventData.created_at),
            endTime: eventData.end_time ? new Date(eventData.end_time) : undefined,
            metadata: {
              provider,
              eventType,
              rawData: eventData,
            },
          }
        );
      }
    } catch (error) {
      logger.error('Error integrating webhook with metered billing', error as Error, {
        operation: 'usage_integration',
        partnerId,
        customerId,
        agentId,
        provider,
        eventType
      });
      // Don't throw to avoid breaking webhook processing
    }
  }

  /**
   * Determine if usage should be reported to Stripe
   */
  private static async shouldReportUsageToStripe(subscription: any): Promise<boolean> {
    try {
      // For now, report usage daily
      // In production, you might want more sophisticated logic
      const lastReported = subscription.currentUsage?.lastReported;
      if (!lastReported) {
        return true; // Never reported before
      }

      const lastReportedDate = new Date(lastReported);
      const now = new Date();
      const hoursSinceLastReport = (now.getTime() - lastReportedDate.getTime()) / (1000 * 60 * 60);

      // Report if it's been more than 24 hours
      return hoursSinceLastReport >= 24;
    } catch (error) {
      logger.error('Error determining if should report usage', error as Error, {
        operation: 'usage_integration',
        subscriptionId: subscription?.id
      });
      return false;
    }
  }
}
