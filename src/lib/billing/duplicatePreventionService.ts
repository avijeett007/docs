import { prisma } from '@/lib/prisma';
import { createHash } from 'crypto';
import { logger } from '@/lib/logger';

export interface UsageRecordIdentifier {
  partnerId: string;
  customerId: string;
  agentId: string;
  sourceReference: string; // e.g., call_id, conversation_id
  metricType: string;
  usageDate: Date;
  quantity: number;
}

export class DuplicatePreventionService {
  /**
   * Generate a unique hash for a usage record to prevent duplicates
   */
  static generateUsageHash(identifier: UsageRecordIdentifier): string {
    const hashInput = [
      identifier.partnerId,
      identifier.customerId,
      identifier.agentId,
      identifier.sourceReference,
      identifier.metricType,
      identifier.usageDate.toISOString(),
      identifier.quantity.toString(),
    ].join('|');

    return createHash('sha256').update(hashInput).digest('hex');
  }

  /**
   * Check if a usage record already exists
   */
  static async isUsageRecordDuplicate(identifier: UsageRecordIdentifier): Promise<boolean> {
    try {
      const usageHash = this.generateUsageHash(identifier);

      // Check if a usage record with this hash already exists
      const existingRecord = await prisma.usageMetric.findFirst({
        where: {
          partnerId: identifier.partnerId,
          customerId: identifier.customerId,
          agentId: identifier.agentId,
          sourceReference: identifier.sourceReference,
          metricType: identifier.metricType,
          // Check for records within a small time window (to account for minor timestamp differences)
          usageDate: {
            gte: new Date(identifier.usageDate.getTime() - 60000), // 1 minute before
            lte: new Date(identifier.usageDate.getTime() + 60000), // 1 minute after
          },
          quantity: identifier.quantity,
        },
      });

      if (existingRecord) {
        logger.warn('Duplicate usage record detected', {
          operation: 'duplicate_prevention',
          existingId: existingRecord.id,
          sourceReference: identifier.sourceReference,
          usageHash
        });
        return true;
      }

      return false;
    } catch (error) {
      logger.error('Error checking for duplicate usage record', error as Error, {
        operation: 'duplicate_prevention',
        sourceReference: identifier.sourceReference
      });
      // In case of error, allow the record to be created (fail open)
      return false;
    }
  }

  /**
   * Check if a Stripe usage record has already been reported
   */
  static async isStripeUsageReported(
    subscriptionId: string,
    billingPeriodStart: Date,
    billingPeriodEnd: Date
  ): Promise<boolean> {
    try {
      // Check if usage has already been reported for this billing period
      const subscription = await prisma.customerMeteredSubscription.findUnique({
        where: { id: subscriptionId },
        select: { currentUsage: true },
      });

      if (!subscription) {
        return false;
      }

      const currentUsage = subscription.currentUsage as any;
      if (!currentUsage || !currentUsage.lastReported) {
        return false;
      }

      const lastReported = new Date(currentUsage.lastReported);
      
      // Check if the last reported date is within the current billing period
      return lastReported >= billingPeriodStart && lastReported <= billingPeriodEnd;
    } catch (error) {
      logger.error('Error checking Stripe usage reporting status', error as Error, {
        operation: 'duplicate_prevention',
        subscriptionId
      });
      return false;
    }
  }

  /**
   * Create an idempotency key for Stripe operations
   */
  static generateStripeIdempotencyKey(
    operation: string,
    subscriptionId: string,
    billingPeriodStart: Date,
    additionalData?: string
  ): string {
    const keyInput = [
      operation,
      subscriptionId,
      billingPeriodStart.toISOString(),
      additionalData || '',
    ].join('|');

    return createHash('sha256').update(keyInput).digest('hex').substring(0, 32);
  }

  /**
   * Check if a webhook event has already been processed
   */
  static async isWebhookProcessed(
    webhookId: string,
    eventType: string,
    partnerId: string
  ): Promise<boolean> {
    try {
      // Check if this webhook has already been processed
      const existingProcessing = await prisma.usageMetric.findFirst({
        where: {
          partnerId,
          metadata: {
            path: ['webhookId'],
            equals: webhookId,
          },
        },
      });

      if (existingProcessing) {
        logger.warn('Webhook already processed', {
          operation: 'duplicate_prevention',
          webhookId,
          eventType,
          partnerId,
          existingRecordId: existingProcessing.id
        });
        return true;
      }

      return false;
    } catch (error) {
      logger.error('Error checking webhook processing status', error as Error, {
        operation: 'duplicate_prevention',
        webhookId,
        eventType
      });
      return false;
    }
  }

  /**
   * Mark a webhook as processed by including its ID in the usage record metadata
   */
  static addWebhookIdToMetadata(metadata: Record<string, any>, webhookId: string): Record<string, any> {
    return {
      ...metadata,
      webhookId,
      processedAt: new Date().toISOString(),
    };
  }

  /**
   * Check for potential duplicate billing operations
   */
  static async isDuplicateBillingOperation(
    operationType: string,
    entityId: string,
    partnerId: string,
    timeWindowMinutes: number = 5
  ): Promise<boolean> {
    try {
      const cutoffTime = new Date(Date.now() - timeWindowMinutes * 60 * 1000);

      // Check audit logs for recent similar operations
      const recentOperation = await prisma.auditLog.findFirst({
        where: {
          action: operationType,
          entityId,
          partnerId,
          timestamp: {
            gte: cutoffTime,
          },
        },
        orderBy: {
          timestamp: 'desc',
        },
      });

      if (recentOperation) {
        logger.warn('Duplicate billing operation detected', {
          operation: 'duplicate_prevention',
          operationType,
          entityId,
          partnerId,
          recentOperationId: recentOperation.id,
          recentOperationTime: recentOperation.timestamp
        });
        return true;
      }

      return false;
    } catch (error) {
      logger.error('Error checking for duplicate billing operation', error as Error, {
        operation: 'duplicate_prevention',
        operationType,
        entityId
      });
      return false;
    }
  }

  /**
   * Clean up old duplicate prevention records
   */
  static async cleanupOldRecords(retentionDays: number = 30): Promise<void> {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

      // Clean up old usage metrics that are no longer needed for duplicate prevention
      const result = await prisma.usageMetric.deleteMany({
        where: {
          usageDate: {
            lt: cutoffDate,
          },
          // Only delete records that have been billed
          metadata: {
            path: ['billed'],
            equals: true,
          },
        },
      });

      logger.info('Cleaned up old usage records for duplicate prevention', {
        operation: 'duplicate_prevention',
        cleanedCount: result.count
      });
    } catch (error) {
      logger.error('Error cleaning up old duplicate prevention records', error as Error, {
        operation: 'duplicate_prevention'
      });
    }
  }

  /**
   * Validate usage record data integrity
   */
  static validateUsageRecord(identifier: UsageRecordIdentifier): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!identifier.partnerId || typeof identifier.partnerId !== 'string') {
      errors.push('Invalid partner ID');
    }

    if (!identifier.customerId || typeof identifier.customerId !== 'string') {
      errors.push('Invalid customer ID');
    }

    if (!identifier.agentId || typeof identifier.agentId !== 'string') {
      errors.push('Invalid agent ID');
    }

    if (!identifier.sourceReference || typeof identifier.sourceReference !== 'string') {
      errors.push('Invalid source reference');
    }

    if (!identifier.metricType || typeof identifier.metricType !== 'string') {
      errors.push('Invalid metric type');
    }

    if (!identifier.usageDate || !(identifier.usageDate instanceof Date) || isNaN(identifier.usageDate.getTime())) {
      errors.push('Invalid usage date');
    }

    if (typeof identifier.quantity !== 'number' || isNaN(identifier.quantity) || identifier.quantity < 0) {
      errors.push('Invalid quantity (must be a non-negative number)');
    }

    // Check for reasonable date range (not too far in the past or future)
    if (identifier.usageDate) {
      const now = new Date();
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      const oneDayFromNow = new Date(now.getTime() + 24 * 60 * 60 * 1000);

      if (identifier.usageDate < thirtyDaysAgo || identifier.usageDate > oneDayFromNow) {
        errors.push('Usage date is outside reasonable range (30 days ago to 1 day from now)');
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Get duplicate prevention statistics
   */
  static async getDuplicatePreventionStats(partnerId: string, days: number = 7): Promise<{
    totalUsageRecords: number;
    duplicatesDetected: number;
    duplicateRate: number;
  }> {
    try {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      const totalRecords = await prisma.usageMetric.count({
        where: {
          partnerId,
          usageDate: {
            gte: startDate,
          },
        },
      });

      // This is a simplified approach - in a real implementation,
      // you might want to track duplicates in a separate table
      const duplicatesDetected = 0; // Placeholder

      const duplicateRate = totalRecords > 0 ? (duplicatesDetected / totalRecords) * 100 : 0;

      return {
        totalUsageRecords: totalRecords,
        duplicatesDetected,
        duplicateRate,
      };
    } catch (error) {
      logger.error('Error getting duplicate prevention stats', error as Error, {
        operation: 'duplicate_prevention',
        partnerId
      });
      return {
        totalUsageRecords: 0,
        duplicatesDetected: 0,
        duplicateRate: 0,
      };
    }
  }
}
