import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';

export interface BillingMetrics {
  activeSubscriptions: number;
  totalRevenue: number;
  averageRevenuePerUser: number;
  churnRate: number;
  usageVolume: number;
  errorRate: number;
  processingTime: number;
  pendingInvoices: number;
  failedPayments: number;
}

export interface AlertThresholds {
  highErrorRate: number; // percentage
  lowProcessingPerformance: number; // milliseconds
  highChurnRate: number; // percentage
  criticalFailedPayments: number; // count
  unusualUsageSpike: number; // percentage increase
}

export interface Alert {
  id: string;
  type: 'error_rate' | 'performance' | 'churn' | 'payment_failure' | 'usage_spike' | 'system_health';
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  details: Record<string, any>;
  timestamp: Date;
  resolved: boolean;
}

export class BillingMonitoringService {
  private static readonly DEFAULT_THRESHOLDS: AlertThresholds = {
    highErrorRate: 5, // 5%
    lowProcessingPerformance: 5000, // 5 seconds
    highChurnRate: 10, // 10%
    criticalFailedPayments: 10, // 10 failed payments
    unusualUsageSpike: 200, // 200% increase
  };

  /**
   * Get current billing system metrics
   */
  static async getBillingMetrics(partnerId?: string): Promise<BillingMetrics> {
    try {
      const now = new Date();
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

      const whereClause = partnerId ? { partnerId } : {};

      // Active subscriptions
      const activeSubscriptions = await prisma.customerMeteredSubscription.count({
        where: {
          ...whereClause,
          status: 'active',
        },
      });

      // Total revenue (last 30 days)
      const revenueData = await prisma.invoice.aggregate({
        where: {
          ...whereClause,
          status: 'paid',
          paidAt: {
            gte: thirtyDaysAgo,
          },
        },
        _sum: {
          amount: true,
        },
      });

      const totalRevenue = Number(revenueData._sum.amount || 0);

      // Average revenue per user
      const totalCustomers = await prisma.customer.count({
        where: partnerId ? {
          meteredSubscriptions: {
            some: {
              partnerId,
              status: 'active',
            },
          },
        } : {
          meteredSubscriptions: {
            some: {
              status: 'active',
            },
          },
        },
      });

      const averageRevenuePerUser = totalCustomers > 0 ? totalRevenue / totalCustomers : 0;

      // Churn rate (last 30 days)
      const cancelledSubscriptions = await prisma.customerMeteredSubscription.count({
        where: {
          ...whereClause,
          status: 'cancelled',
          cancelledAt: {
            gte: thirtyDaysAgo,
          },
        },
      });

      const totalSubscriptionsAtStart = activeSubscriptions + cancelledSubscriptions;
      const churnRate = totalSubscriptionsAtStart > 0 ? (cancelledSubscriptions / totalSubscriptionsAtStart) * 100 : 0;

      // Usage volume (last 7 days)
      const usageData = await prisma.usageMetric.aggregate({
        where: {
          ...whereClause,
          usageDate: {
            gte: sevenDaysAgo,
          },
        },
        _sum: {
          quantity: true,
        },
      });

      const usageVolume = Number(usageData._sum.quantity || 0);

      // Error rate (from audit logs - last 24 hours)
      const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

      // Build audit log where clause (audit logs might not have partnerId)
      const auditWhereClause: any = {
        timestamp: {
          gte: oneDayAgo,
        },
      };

      // Only add partnerId filter if audit logs support it
      if (partnerId) {
        auditWhereClause.partnerId = partnerId;
      }

      const totalOperations = await prisma.auditLog.count({
        where: auditWhereClause,
      });

      const errorOperations = await prisma.auditLog.count({
        where: {
          ...auditWhereClause,
          details: {
            path: ['error'],
            not: null,
          },
        },
      });

      const errorRate = totalOperations > 0 ? (errorOperations / totalOperations) * 100 : 0;

      // Processing time (placeholder - would need actual performance metrics)
      const processingTime = 1500; // milliseconds

      // Pending invoices
      const pendingInvoices = await prisma.invoice.count({
        where: {
          ...whereClause,
          status: 'pending',
        },
      });

      // Failed payments (last 7 days)
      const failedPayments = await prisma.invoice.count({
        where: {
          ...whereClause,
          status: 'failed',
          createdAt: {
            gte: sevenDaysAgo,
          },
        },
      });

      return {
        activeSubscriptions,
        totalRevenue,
        averageRevenuePerUser,
        churnRate,
        usageVolume,
        errorRate,
        processingTime,
        pendingInvoices,
        failedPayments,
      };
    } catch (error) {
      logger.error('Error getting billing metrics', error as Error, {
        operation: 'billing_monitoring',
        partnerId
      });
      throw error;
    }
  }

  /**
   * Check for alerts based on current metrics
   */
  static async checkAlerts(
    partnerId?: string,
    thresholds: Partial<AlertThresholds> = {}
  ): Promise<Alert[]> {
    try {
      const alerts: Alert[] = [];
      const metrics = await this.getBillingMetrics(partnerId);
      const activeThresholds = { ...this.DEFAULT_THRESHOLDS, ...thresholds };

      // Check error rate
      if (metrics.errorRate > activeThresholds.highErrorRate) {
        alerts.push({
          id: `error_rate_${Date.now()}`,
          type: 'error_rate',
          severity: metrics.errorRate > activeThresholds.highErrorRate * 2 ? 'critical' : 'high',
          message: `High error rate detected: ${metrics.errorRate.toFixed(2)}%`,
          details: {
            currentRate: metrics.errorRate,
            threshold: activeThresholds.highErrorRate,
            partnerId,
          },
          timestamp: new Date(),
          resolved: false,
        });
      }

      // Check processing performance
      if (metrics.processingTime > activeThresholds.lowProcessingPerformance) {
        alerts.push({
          id: `performance_${Date.now()}`,
          type: 'performance',
          severity: metrics.processingTime > activeThresholds.lowProcessingPerformance * 2 ? 'critical' : 'medium',
          message: `Slow processing time detected: ${metrics.processingTime}ms`,
          details: {
            currentTime: metrics.processingTime,
            threshold: activeThresholds.lowProcessingPerformance,
            partnerId,
          },
          timestamp: new Date(),
          resolved: false,
        });
      }

      // Check churn rate
      if (metrics.churnRate > activeThresholds.highChurnRate) {
        alerts.push({
          id: `churn_${Date.now()}`,
          type: 'churn',
          severity: metrics.churnRate > activeThresholds.highChurnRate * 1.5 ? 'high' : 'medium',
          message: `High churn rate detected: ${metrics.churnRate.toFixed(2)}%`,
          details: {
            currentRate: metrics.churnRate,
            threshold: activeThresholds.highChurnRate,
            partnerId,
          },
          timestamp: new Date(),
          resolved: false,
        });
      }

      // Check failed payments
      if (metrics.failedPayments > activeThresholds.criticalFailedPayments) {
        alerts.push({
          id: `payment_failure_${Date.now()}`,
          type: 'payment_failure',
          severity: 'critical',
          message: `Critical number of failed payments: ${metrics.failedPayments}`,
          details: {
            failedCount: metrics.failedPayments,
            threshold: activeThresholds.criticalFailedPayments,
            partnerId,
          },
          timestamp: new Date(),
          resolved: false,
        });
      }

      // Check for unusual usage spikes
      const previousWeekUsage = await this.getPreviousWeekUsage(partnerId);
      if (previousWeekUsage > 0) {
        const usageIncrease = ((metrics.usageVolume - previousWeekUsage) / previousWeekUsage) * 100;
        if (usageIncrease > activeThresholds.unusualUsageSpike) {
          alerts.push({
            id: `usage_spike_${Date.now()}`,
            type: 'usage_spike',
            severity: usageIncrease > activeThresholds.unusualUsageSpike * 1.5 ? 'high' : 'medium',
            message: `Unusual usage spike detected: ${usageIncrease.toFixed(2)}% increase`,
            details: {
              currentUsage: metrics.usageVolume,
              previousUsage: previousWeekUsage,
              increasePercentage: usageIncrease,
              threshold: activeThresholds.unusualUsageSpike,
              partnerId,
            },
            timestamp: new Date(),
            resolved: false,
          });
        }
      }

      return alerts;
    } catch (error) {
      logger.error('Error checking alerts', error as Error, {
        operation: 'billing_monitoring',
        partnerId
      });
      return [{
        id: `system_error_${Date.now()}`,
        type: 'system_health',
        severity: 'critical',
        message: 'Error in monitoring system',
        details: { error: error instanceof Error ? error.message : 'Unknown error' },
        timestamp: new Date(),
        resolved: false,
      }];
    }
  }

  /**
   * Get usage from previous week for comparison
   */
  private static async getPreviousWeekUsage(partnerId?: string): Promise<number> {
    try {
      const now = new Date();
      const twoWeeksAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
      const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

      const whereClause = partnerId ? { partnerId } : {};

      const usageData = await prisma.usageMetric.aggregate({
        where: {
          ...whereClause,
          usageDate: {
            gte: twoWeeksAgo,
            lt: oneWeekAgo,
          },
        },
        _sum: {
          quantity: true,
        },
      });

      return Number(usageData._sum.quantity || 0);
    } catch (error) {
      logger.error('Error getting previous week usage', error as Error, {
        operation: 'billing_monitoring',
        partnerId
      });
      return 0;
    }
  }

  /**
   * Send alert notifications (placeholder for actual notification system)
   */
  static async sendAlertNotifications(alerts: Alert[]): Promise<void> {
    try {
      for (const alert of alerts) {
        logger.warn('Billing alert triggered', {
          operation: 'billing_monitoring',
          alertType: alert.type,
          severity: alert.severity,
          message: alert.message,
          details: alert.details
        });
        
        // Here you would integrate with your notification system:
        // - Email notifications
        // - Slack/Discord webhooks
        // - SMS alerts
        // - PagerDuty integration
        // - Custom webhook endpoints
        
        // Example webhook call (commented out):
        /*
        if (process.env.ALERT_WEBHOOK_URL) {
          await fetch(process.env.ALERT_WEBHOOK_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(alert),
          });
        }
        */
      }
    } catch (error) {
      logger.error('Error sending alert notifications', error as Error, {
        operation: 'billing_monitoring'
      });
    }
  }

  /**
   * Generate health check report
   */
  static async getHealthCheck(partnerId?: string): Promise<{
    status: 'healthy' | 'warning' | 'critical';
    metrics: BillingMetrics;
    alerts: Alert[];
    timestamp: Date;
  }> {
    try {
      const metrics = await this.getBillingMetrics(partnerId);
      const alerts = await this.checkAlerts(partnerId);

      let status: 'healthy' | 'warning' | 'critical' = 'healthy';

      if (alerts.some(alert => alert.severity === 'critical')) {
        status = 'critical';
      } else if (alerts.some(alert => alert.severity === 'high' || alert.severity === 'medium')) {
        status = 'warning';
      }

      return {
        status,
        metrics,
        alerts,
        timestamp: new Date(),
      };
    } catch (error) {
      logger.error('Error generating health check', error as Error, {
        operation: 'billing_monitoring'
      });
      return {
        status: 'critical',
        metrics: {} as BillingMetrics,
        alerts: [{
          id: `health_check_error_${Date.now()}`,
          type: 'system_health',
          severity: 'critical',
          message: 'Health check failed',
          details: { error: error instanceof Error ? error.message : 'Unknown error' },
          timestamp: new Date(),
          resolved: false,
        }],
        timestamp: new Date(),
      };
    }
  }
}
