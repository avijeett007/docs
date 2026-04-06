/**
 * Metered Analytics Synchronization Service
 *
 * This service bridges the analytics service (Supabase) with the app billing system (NeonDB).
 * It syncs billable metrics from metered_analytics table to usage_metrics table for billing processing.
 */

import { createClient } from '@supabase/supabase-js';
import { prisma } from '@/lib/prisma';
import { billingLogger } from '@/lib/logger';
import crypto from 'crypto';

// Supabase client for analytics service
// SECURITY: Use server-side only environment variables (NOT NEXT_PUBLIC_)
const supabaseUrl = process.env.ANALYTICS_SUPABASE_URL!;
const supabaseKey = process.env.ANALYTICS_SUPABASE_SERVICE_KEY!; // Use service key for server-side operations
const supabase = createClient(supabaseUrl, supabaseKey);

interface MeteredAnalyticsRecord {
  id: string;
  call_id: string;
  agent_id: string;
  agent_name?: string;
  partner_id: string;
  customer_id: string;
  metric_name: string;
  metric_type: string;
  metric_value: any;
  detected_by: string;
  confidence_score?: number;
  billing_status: string;
  provider: string;
  webhook_data?: any;
  ai_analysis?: any;
  call_timestamp: string;
  selected_plan_id?: string;
  subscription_id?: string;
  created_at: string;
  updated_at: string;
}

interface SyncResult {
  success: boolean;
  processed: number;
  errors: number;
  duplicates: number;
  details: string[];
}



export class MeteredAnalyticsSyncService {
  /**
   * Sync pending billable metrics from Supabase to NeonDB
   */
  static async syncPendingMetrics(limit: number = 100): Promise<SyncResult> {
    const result: SyncResult = {
      success: true,
      processed: 0,
      errors: 0,
      duplicates: 0,
      details: []
    };

    try {
      billingLogger.billingOperation('sync_pending_metrics_started', { limit });

      // Query billable metrics from Supabase analytics service
      const { data: pendingMetrics, error } = await supabase
        .from('metered_analytics')
        .select('*')
        .eq('billing_status', 'billable')
        .eq('is_processed', false)
        .order('call_timestamp', { ascending: true })
        .limit(limit);

      if (error) {
        throw new Error(`Failed to fetch pending metrics: ${error.message}`);
      }

      if (!pendingMetrics || pendingMetrics.length === 0) {
        billingLogger.billingOperation('sync_pending_metrics_completed', {
          processed: 0,
          message: 'No pending metrics found'
        });
        return result;
      }

      billingLogger.billingOperation('sync_pending_metrics_fetched', {
        count: pendingMetrics.length
      });

      // Process each metric
      for (const metric of pendingMetrics) {
        try {
          const processed = await this.processMetricRecord(metric);
          if (processed.isDuplicate) {
            result.duplicates++;
            result.details.push(`Duplicate: ${metric.id} - ${metric.call_id}`);
          } else {
            result.processed++;
            result.details.push(`Processed: ${metric.id} - ${metric.call_id}`);
          }
        } catch (error) {
          result.errors++;
          result.success = false;
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          result.details.push(`Error processing ${metric.id}: ${errorMessage}`);

          billingLogger.error('sync_metric_processing_error', new Error(errorMessage), {
            metricId: metric.id,
            callId: metric.call_id
          });
        }
      }

      billingLogger.billingOperation('sync_pending_metrics_completed', {
        processed: result.processed,
        errors: result.errors,
        duplicates: result.duplicates
      });

      return result;

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      billingLogger.error('sync_pending_metrics_failed', new Error(errorMessage), {});

      return {
        success: false,
        processed: 0,
        errors: 1,
        duplicates: 0,
        details: [`Fatal error: ${errorMessage}`]
      };
    }
  }

  /**
   * Process a single metric record from analytics service
   */
  private static async processMetricRecord(
    metric: MeteredAnalyticsRecord
  ): Promise<{ isDuplicate: boolean; usageMetricId?: string }> {
    try {
      // Generate billing hash for duplicate prevention
      const billingHash = this.generateBillingHash(metric);

      // Check for existing usage metric with same source reference (call_id + metric_name)
      const existingMetric = await prisma.usageMetric.findFirst({
        where: {
          sourceReference: `analytics_${metric.id}`,
          customerId: metric.customer_id,
          partnerId: metric.partner_id,
          metricName: metric.metric_name
        }
      });

      if (existingMetric) {
        billingLogger.billingOperation('duplicate_metric_detected', {
          metricId: metric.id,
          existingId: existingMetric.id,
          callId: metric.call_id
        });
        return { isDuplicate: true };
      }

      // Get subscription details for billing period calculation
      const subscription = await this.getSubscriptionDetails(
        metric.subscription_id,
        metric.customer_id,
        metric.partner_id
      );

      if (!subscription) {
        throw new Error(`Subscription not found: ${metric.subscription_id}`);
      }

      // Calculate quantity based on metric type and value
      const quantity = this.calculateMetricQuantity(metric);

      // Simple duplicate prevention using source reference
      // No additional service needed - just check if we already processed this metric

      // Create usage metric record with standard schema
      const usageMetricData = {
        customerId: metric.customer_id,
        partnerId: metric.partner_id,
        agentId: metric.agent_id,
        metricType: metric.metric_type,
        metricName: metric.metric_name,
        metricCategory: 'custom_metrics',
        quantity,
        billingPeriodStart: subscription.currentPeriodStart,
        billingPeriodEnd: subscription.currentPeriodEnd,
        usageDate: metric.call_timestamp ? new Date(metric.call_timestamp) : new Date(),
        billingStatus: 'pending',
        sourceReference: `analytics_${metric.id}`,
        metadata: {
          analyticsMetricId: metric.id,
          callId: metric.call_id,
          subscriptionId: metric.subscription_id,
          planId: metric.selected_plan_id,
          provider: metric.provider,
          agentName: metric.agent_name,
          confidenceScore: metric.confidence_score,
          detectedBy: metric.detected_by,
          billingHash,
          // Store analytics data for cross-verification
          analyticsData: {
            customerId: metric.customer_id,
            partnerId: metric.partner_id,
            planId: metric.selected_plan_id,
            subscriptionId: metric.subscription_id,
            agentId: metric.agent_id,
            metricName: metric.metric_name
          },
          disputeMetadata: {
            webhookData: metric.webhook_data,
            aiAnalysis: metric.ai_analysis,
            confidenceScore: metric.confidence_score,
            detectedBy: metric.detected_by,
            originalTimestamp: metric.call_timestamp
          }
        }
      };

      // Create usage metric in NeonDB
      const createdMetric = await prisma.usageMetric.create({
        data: usageMetricData
      });

      // Mark as processed in analytics service ONLY after successful creation
      await this.markMetricAsProcessed(metric.id);

      billingLogger.billingOperation('metric_synced_successfully', {
        analyticsMetricId: metric.id,
        usageMetricId: createdMetric.id,
        callId: metric.call_id,
        quantity
      });

      return { isDuplicate: false, usageMetricId: createdMetric.id };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      billingLogger.error('process_metric_record_failed', new Error(errorMessage), {
        metricId: metric.id,
        callId: metric.call_id
      });
      throw error;
    }
  }

  /**
   * Generate a unique billing hash for duplicate prevention
   */
  private static generateBillingHash(metric: MeteredAnalyticsRecord): string {
    const hashInput = [
      metric.call_id,
      metric.agent_id,
      metric.customer_id,
      metric.partner_id,
      metric.metric_name,
      metric.detected_by,
      new Date(metric.call_timestamp).toISOString().split('T')[0] // Date only
    ].join('|');

    return crypto.createHash('sha256').update(hashInput).digest('hex');
  }

  /**
   * Calculate metric quantity based on type and value
   */
  private static calculateMetricQuantity(metric: MeteredAnalyticsRecord): number {
    try {
      const value = typeof metric.metric_value === 'string'
        ? JSON.parse(metric.metric_value)
        : metric.metric_value;

      switch (metric.metric_type) {
        case 'boolean':
          return value === true ? 1 : 0;
        case 'number':
          return Number(value) || 0;
        case 'string':
          return value ? 1 : 0;
        default:
          return value ? 1 : 0;
      }
    } catch (error) {
      billingLogger.error('calculate_metric_quantity_failed', error as Error, {
        metricId: metric.id,
        metricType: metric.metric_type,
        metricValue: metric.metric_value
      });
      return 0;
    }
  }

  /**
   * Get subscription details for billing period calculation
   */
  private static async getSubscriptionDetails(
    subscriptionId?: string,
    customerId?: string,
    partnerId?: string
  ) {
    if (subscriptionId) {
      return await prisma.customerMeteredSubscription.findUnique({
        where: { id: subscriptionId },
        include: { plan: true }
      });
    }

    // Fallback: find active subscription for customer/partner
    if (customerId && partnerId) {
      return await prisma.customerMeteredSubscription.findFirst({
        where: {
          customerId,
          partnerId,
          status: 'active'
        },
        include: { plan: true },
        orderBy: { createdAt: 'desc' }
      });
    }

    return null;
  }

  /**
   * Mark metric as processed in analytics service
   */
  private static async markMetricAsProcessed(metricId: string): Promise<void> {
    try {
      const { error } = await supabase
        .from('metered_analytics')
        .update({
          is_processed: true,
          processed_at: new Date().toISOString(),
          billing_status: 'billed'
        })
        .eq('id', metricId);

      if (error) {
        throw new Error(`Failed to mark metric as processed: ${error.message}`);
      }
    } catch (error) {
      billingLogger.error('mark_metric_processed_failed', error as Error, {
        metricId
      });
      // Don't throw here as the main sync was successful
    }
  }

  /**
   * Process metrics for a specific subscription
   */
  static async processSubscriptionMetrics(subscriptionId: string): Promise<SyncResult> {
    const result: SyncResult = {
      success: true,
      processed: 0,
      errors: 0,
      duplicates: 0,
      details: []
    };

    try {
      billingLogger.billingOperation('process_subscription_metrics_started', { subscriptionId });

      // Get subscription details
      const subscription = await prisma.customerMeteredSubscription.findUnique({
        where: { id: subscriptionId },
        include: { plan: true, customer: true, partner: true }
      });

      if (!subscription) {
        throw new Error(`Subscription not found: ${subscriptionId}`);
      }

      // Query metrics for this subscription from analytics service
      const { data: subscriptionMetrics, error } = await supabase
        .from('metered_analytics')
        .select('*')
        .eq('subscription_id', subscriptionId)
        .eq('billing_status', 'billable')
        .eq('is_processed', false)
        .gte('call_timestamp', subscription.currentPeriodStart.toISOString())
        .lte('call_timestamp', subscription.currentPeriodEnd.toISOString())
        .order('call_timestamp', { ascending: true });

      if (error) {
        throw new Error(`Failed to fetch subscription metrics: ${error.message}`);
      }

      if (!subscriptionMetrics || subscriptionMetrics.length === 0) {
        billingLogger.billingOperation('process_subscription_metrics_completed', {
          subscriptionId,
          processed: 0,
          message: 'No pending metrics found for subscription'
        });
        return result;
      }

      // Process each metric
      for (const metric of subscriptionMetrics) {
        try {
          const processed = await this.processMetricRecord(metric);
          if (processed.isDuplicate) {
            result.duplicates++;
            result.details.push(`Duplicate: ${metric.id}`);
          } else {
            result.processed++;
            result.details.push(`Processed: ${metric.id}`);
          }
        } catch (error) {
          result.errors++;
          result.success = false;
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          result.details.push(`Error processing ${metric.id}: ${errorMessage}`);
        }
      }

      billingLogger.billingOperation('process_subscription_metrics_completed', {
        subscriptionId,
        processed: result.processed,
        errors: result.errors,
        duplicates: result.duplicates
      });

      return result;

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      billingLogger.error('process_subscription_metrics_failed', new Error(errorMessage), {
        subscriptionId
      });

      return {
        success: false,
        processed: 0,
        errors: 1,
        duplicates: 0,
        details: [`Fatal error: ${errorMessage}`]
      };
    }
  }

  /**
   * Get sync statistics
   */
  static async getSyncStatistics(partnerId?: string): Promise<{
    pendingInAnalytics: number;
    syncedToUsageMetrics: number;
    processingErrors: number;
    lastSyncTime?: Date;
  }> {
    try {
      // Count pending metrics in analytics service
      let pendingQuery = supabase
        .from('metered_analytics')
        .select('id', { count: 'exact', head: true })
        .eq('billing_status', 'billable')
        .eq('is_processed', false);

      if (partnerId) {
        pendingQuery = pendingQuery.eq('partner_id', partnerId);
      }

      const { count: pendingInAnalytics } = await pendingQuery;

      // Count synced metrics in usage_metrics (using sourceReference pattern)
      const syncedQuery = prisma.usageMetric.count({
        where: {
          ...(partnerId && { partnerId }),
          sourceReference: { startsWith: 'analytics_' },
          metricCategory: 'custom_metrics'
        }
      });

      const syncedToUsageMetrics = await syncedQuery;

      // Count processing errors (metrics that failed to sync)
      let errorQuery = supabase
        .from('metered_analytics')
        .select('id', { count: 'exact', head: true })
        .eq('billing_status', 'error');

      if (partnerId) {
        errorQuery = errorQuery.eq('partner_id', partnerId);
      }

      const { count: processingErrors } = await errorQuery;

      // Get last sync time from most recent usage metric
      const lastSyncedMetric = await prisma.usageMetric.findFirst({
        where: {
          ...(partnerId && { partnerId }),
          sourceReference: { startsWith: 'analytics_' },
          metricCategory: 'custom_metrics'
        },
        orderBy: { createdAt: 'desc' },
        select: { createdAt: true }
      });

      return {
        pendingInAnalytics: pendingInAnalytics || 0,
        syncedToUsageMetrics,
        processingErrors: processingErrors || 0,
        lastSyncTime: lastSyncedMetric?.createdAt
      };

    } catch (error) {
      billingLogger.error('get_sync_statistics_failed', error as Error, {
        partnerId
      });

      return {
        pendingInAnalytics: 0,
        syncedToUsageMetrics: 0,
        processingErrors: 0
      };
    }
  }
}