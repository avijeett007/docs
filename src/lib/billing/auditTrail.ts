import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';

export interface AuditLogEntry {
  action: string;
  entityType: 'plan' | 'subscription' | 'usage' | 'invoice' | 'payment' | 'impersonation';
  entityId: string;
  partnerId: string;
  customerId?: string;
  userId?: string; // Partner user who performed the action
  details: Record<string, any>;
  ipAddress?: string;
  userAgent?: string;
  timestamp?: Date;
}

export interface AuditQueryOptions {
  partnerId?: string;
  customerId?: string;
  entityType?: string;
  entityId?: string;
  action?: string;
  startDate?: Date;
  endDate?: Date;
  limit?: number;
  offset?: number;
}

export class AuditTrailService {
  /**
   * Log a billing operation for audit purposes
   */
  static async logBillingOperation(entry: AuditLogEntry): Promise<void> {
    try {
      // Validate required fields
      if (!entry.action || !entry.entityType || !entry.entityId || !entry.partnerId) {
        throw new Error('Missing required audit log fields');
      }

      // Create audit log entry
      await prisma.auditLog.create({
        data: {
          action: entry.action,
          entityType: entry.entityType,
          entityId: entry.entityId,
          partnerId: entry.partnerId,
          customerId: entry.customerId,
          userId: entry.userId,
          details: entry.details,
          ipAddress: entry.ipAddress,
          userAgent: entry.userAgent,
          timestamp: entry.timestamp || new Date(),
        },
      });

      logger.info('Audit log entry created', {
        operation: 'audit_trail',
        action: entry.action,
        entityType: entry.entityType,
        entityId: entry.entityId,
        partnerId: entry.partnerId,
      });
    } catch (error) {
      logger.error('Error creating audit log entry', error as Error, {
        operation: 'audit_trail',
        action: entry.action,
        entityType: entry.entityType,
        partnerId: entry.partnerId
      });
      // Don't throw error to avoid breaking the main operation
    }
  }

  /**
   * Log plan creation
   */
  static async logPlanCreated(
    planId: string,
    partnerId: string,
    userId: string,
    planData: any,
    ipAddress?: string,
    userAgent?: string
  ): Promise<void> {
    await this.logBillingOperation({
      action: 'plan_created',
      entityType: 'plan',
      entityId: planId,
      partnerId,
      userId,
      details: {
        planName: planData.name,
        pricingModel: planData.pricingModel,
        billingCycle: planData.billingCycle,
        metricType: planData.metricType,
        pricingTiers: planData.pricingTiers,
      },
      ipAddress,
      userAgent,
    });
  }

  /**
   * Log plan updates
   */
  static async logPlanUpdated(
    planId: string,
    partnerId: string,
    userId: string,
    changes: any,
    ipAddress?: string,
    userAgent?: string
  ): Promise<void> {
    await this.logBillingOperation({
      action: 'plan_updated',
      entityType: 'plan',
      entityId: planId,
      partnerId,
      userId,
      details: {
        changes,
      },
      ipAddress,
      userAgent,
    });
  }

  /**
   * Log subscription creation
   */
  static async logSubscriptionCreated(
    subscriptionId: string,
    partnerId: string,
    customerId: string,
    planId: string,
    userId?: string,
    ipAddress?: string,
    userAgent?: string
  ): Promise<void> {
    await this.logBillingOperation({
      action: 'subscription_created',
      entityType: 'subscription',
      entityId: subscriptionId,
      partnerId,
      customerId,
      userId,
      details: {
        planId,
      },
      ipAddress,
      userAgent,
    });
  }

  /**
   * Log subscription status changes
   */
  static async logSubscriptionStatusChanged(
    subscriptionId: string,
    partnerId: string,
    customerId: string,
    oldStatus: string,
    newStatus: string,
    reason?: string,
    userId?: string,
    ipAddress?: string,
    userAgent?: string
  ): Promise<void> {
    await this.logBillingOperation({
      action: 'subscription_status_changed',
      entityType: 'subscription',
      entityId: subscriptionId,
      partnerId,
      customerId,
      userId,
      details: {
        oldStatus,
        newStatus,
        reason,
      },
      ipAddress,
      userAgent,
    });
  }

  /**
   * Log usage recording
   */
  static async logUsageRecorded(
    usageId: string,
    partnerId: string,
    customerId: string,
    agentId: string,
    metricType: string,
    quantity: number,
    source: string,
    ipAddress?: string,
    userAgent?: string
  ): Promise<void> {
    await this.logBillingOperation({
      action: 'usage_recorded',
      entityType: 'usage',
      entityId: usageId,
      partnerId,
      customerId,
      details: {
        agentId,
        metricType,
        quantity,
        source,
      },
      ipAddress,
      userAgent,
    });
  }

  /**
   * Log usage reporting to Stripe
   */
  static async logUsageReportedToStripe(
    subscriptionId: string,
    partnerId: string,
    customerId: string,
    quantity: number,
    stripeUsageRecordId: string,
    ipAddress?: string,
    userAgent?: string
  ): Promise<void> {
    await this.logBillingOperation({
      action: 'usage_reported_to_stripe',
      entityType: 'usage',
      entityId: subscriptionId,
      partnerId,
      customerId,
      details: {
        quantity,
        stripeUsageRecordId,
      },
      ipAddress,
      userAgent,
    });
  }

  /**
   * Log invoice generation
   */
  static async logInvoiceGenerated(
    invoiceId: string,
    partnerId: string,
    customerId: string,
    amount: number,
    currency: string,
    ipAddress?: string,
    userAgent?: string
  ): Promise<void> {
    await this.logBillingOperation({
      action: 'invoice_generated',
      entityType: 'invoice',
      entityId: invoiceId,
      partnerId,
      customerId,
      details: {
        amount,
        currency,
      },
      ipAddress,
      userAgent,
    });
  }

  /**
   * Log payment processing
   */
  static async logPaymentProcessed(
    paymentId: string,
    partnerId: string,
    customerId: string,
    amount: number,
    status: string,
    paymentMethod: string,
    ipAddress?: string,
    userAgent?: string
  ): Promise<void> {
    await this.logBillingOperation({
      action: 'payment_processed',
      entityType: 'payment',
      entityId: paymentId,
      partnerId,
      customerId,
      details: {
        amount,
        status,
        paymentMethod,
      },
      ipAddress,
      userAgent,
    });
  }

  /**
   * Query audit logs
   */
  static async queryAuditLogs(options: AuditQueryOptions): Promise<any[]> {
    try {
      const where: any = {};

      if (options.partnerId) where.partnerId = options.partnerId;
      if (options.customerId) where.customerId = options.customerId;
      if (options.entityType) where.entityType = options.entityType;
      if (options.entityId) where.entityId = options.entityId;
      if (options.action) where.action = options.action;

      if (options.startDate || options.endDate) {
        where.timestamp = {};
        if (options.startDate) where.timestamp.gte = options.startDate;
        if (options.endDate) where.timestamp.lte = options.endDate;
      }

      const logs = await prisma.auditLog.findMany({
        where,
        orderBy: {
          timestamp: 'desc',
        },
        take: options.limit || 100,
        skip: options.offset || 0,
      });

      return logs;
    } catch (error) {
      logger.error('Error querying audit logs', error as Error, {
        operation: 'audit_trail',
        partnerId: options.partnerId,
        entityType: options.entityType
      });
      throw error;
    }
  }

  /**
   * Get audit summary for a partner
   */
  static async getAuditSummary(
    partnerId: string,
    startDate?: Date,
    endDate?: Date
  ): Promise<Record<string, number>> {
    try {
      const where: any = { partnerId };

      if (startDate || endDate) {
        where.timestamp = {};
        if (startDate) where.timestamp.gte = startDate;
        if (endDate) where.timestamp.lte = endDate;
      }

      const summary = await prisma.auditLog.groupBy({
        by: ['action'],
        where,
        _count: {
          action: true,
        },
      });

      const result: Record<string, number> = {};
      summary.forEach(item => {
        result[item.action] = item._count.action;
      });

      return result;
    } catch (error) {
      logger.error('Error getting audit summary', error as Error, {
        operation: 'audit_trail',
        partnerId
      });
      throw error;
    }
  }

  /**
   * Clean up old audit logs (for data retention)
   */
  static async cleanupOldLogs(retentionDays: number = 365): Promise<number> {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

      const result = await prisma.auditLog.deleteMany({
        where: {
          timestamp: {
            lt: cutoffDate,
          },
        },
      });

      logger.info('Cleaned up old audit log entries', {
        operation: 'audit_trail',
        cleanedCount: result.count
      });
      return result.count;
    } catch (error) {
      logger.error('Error cleaning up old audit logs', error as Error, {
        operation: 'audit_trail'
      });
      throw error;
    }
  }

  /**
   * Log impersonation session start
   */
  static async logImpersonationStart(
    sessionId: string,
    partnerId: string,
    customerId: string,
    customerEmail: string,
    portalUrl: string,
    ipAddress?: string,
    userAgent?: string
  ): Promise<void> {
    await this.logBillingOperation({
      action: 'impersonation_started',
      entityType: 'impersonation',
      entityId: sessionId,
      partnerId,
      customerId,
      details: {
        sessionId,
        customerEmail,
        portalUrl,
        startTime: new Date().toISOString(),
      },
      ipAddress,
      userAgent,
    });
  }

  /**
   * Log impersonation session activation (when token is processed)
   */
  static async logImpersonationActivation(
    sessionId: string,
    partnerId: string,
    customerId: string,
    customerEmail: string,
    ipAddress?: string,
    userAgent?: string
  ): Promise<void> {
    await this.logBillingOperation({
      action: 'impersonation_activated',
      entityType: 'impersonation',
      entityId: sessionId,
      partnerId,
      customerId,
      details: {
        sessionId,
        customerEmail,
        activationTime: new Date().toISOString(),
      },
      ipAddress,
      userAgent,
    });
  }

  /**
   * Log impersonation session end
   */
  static async logImpersonationEnd(
    sessionId: string,
    partnerId: string,
    customerId: string,
    reason: 'manual_exit' | 'token_expired' | 'logout',
    ipAddress?: string,
    userAgent?: string
  ): Promise<void> {
    await this.logBillingOperation({
      action: 'impersonation_ended',
      entityType: 'impersonation',
      entityId: sessionId,
      partnerId,
      customerId,
      details: {
        sessionId,
        endTime: new Date().toISOString(),
        reason,
      },
      ipAddress,
      userAgent,
    });
  }

  /**
   * Log actions taken during impersonation
   */
  static async logImpersonationAction(
    sessionId: string,
    partnerId: string,
    customerId: string,
    action: string,
    details: Record<string, any>,
    ipAddress?: string,
    userAgent?: string
  ): Promise<void> {
    await this.logBillingOperation({
      action: `impersonation_action_${action}`,
      entityType: 'impersonation',
      entityId: sessionId,
      partnerId,
      customerId,
      details: {
        sessionId,
        impersonationAction: action,
        actionTime: new Date().toISOString(),
        ...details,
      },
      ipAddress,
      userAgent,
    });
  }
}
