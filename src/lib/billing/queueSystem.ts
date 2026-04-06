import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';

export interface QueueJob {
  id: string;
  type: 'usage_reporting' | 'invoice_generation' | 'payment_processing' | 'subscription_processing' | 'cleanup';
  priority: 'low' | 'normal' | 'high' | 'critical';
  payload: Record<string, any>;
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'retrying';
  attempts: number;
  maxAttempts: number;
  scheduledFor: Date;
  createdAt: Date;
  updatedAt: Date;
  completedAt?: Date;
  error?: string;
  result?: Record<string, any>;
}

export interface QueueStats {
  pending: number;
  processing: number;
  completed: number;
  failed: number;
  totalJobs: number;
  averageProcessingTime: number;
}

export class BillingQueueService {
  private static readonly MAX_CONCURRENT_JOBS = 5;
  private static readonly DEFAULT_MAX_ATTEMPTS = 3;
  private static readonly RETRY_DELAYS = [60000, 300000, 900000]; // 1min, 5min, 15min

  /**
   * Add a job to the queue
   */
  static async addJob(
    type: QueueJob['type'],
    payload: Record<string, any>,
    options: {
      priority?: QueueJob['priority'];
      maxAttempts?: number;
      scheduledFor?: Date;
    } = {}
  ): Promise<string> {
    try {
      const jobId = `job_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      // Store job in database (using a simple table approach)
      // In production, you might want to use Redis or a dedicated queue system
      await prisma.queueJob.create({
        data: {
          id: jobId,
          type,
          priority: options.priority || 'normal',
          payload,
          status: 'pending',
          attempts: 0,
          maxAttempts: options.maxAttempts || this.DEFAULT_MAX_ATTEMPTS,
          scheduledFor: options.scheduledFor || new Date(),
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      });

      logger.info('Job added to queue', {
        operation: 'billing_queue',
        jobId,
        jobType: type,
        priority: options.priority || 'normal'
      });
      return jobId;
    } catch (error) {
      logger.error('Error adding job to queue', error as Error, {
        operation: 'billing_queue',
        jobType: type
      });
      throw error;
    }
  }

  /**
   * Process pending jobs
   */
  static async processJobs(): Promise<{ processed: number; failed: number }> {
    try {
      let processed = 0;
      let failed = 0;

      // Get pending jobs ordered by priority and scheduled time
      const jobs = await prisma.queueJob.findMany({
        where: {
          status: 'pending',
          scheduledFor: {
            lte: new Date(),
          },
        },
        orderBy: [
          { priority: 'desc' }, // high priority first
          { scheduledFor: 'asc' }, // oldest first
        ],
        take: this.MAX_CONCURRENT_JOBS,
      });

      logger.info('Processing jobs from queue', {
        operation: 'billing_queue',
        jobCount: jobs.length
      });

      for (const job of jobs) {
        try {
          // Mark job as processing
          await prisma.queueJob.update({
            where: { id: job.id },
            data: {
              status: 'processing',
              updatedAt: new Date(),
            },
          });

          // Process the job
          const result = await this.executeJob(job as QueueJob);

          // Mark job as completed
          await prisma.queueJob.update({
            where: { id: job.id },
            data: {
              status: 'completed',
              result,
              completedAt: new Date(),
              updatedAt: new Date(),
            },
          });

          processed++;
          logger.info('Job completed successfully', {
            operation: 'billing_queue',
            jobId: job.id,
            jobType: job.type
          });
        } catch (error) {
          logger.error('Job failed', error as Error, {
            operation: 'billing_queue',
            jobId: job.id,
            jobType: job.type
          });
          await this.handleJobFailure(job as QueueJob, error);
          failed++;
        }
      }

      return { processed, failed };
    } catch (error) {
      logger.error('Error processing jobs', error as Error, {
        operation: 'billing_queue'
      });
      throw error;
    }
  }

  /**
   * Execute a specific job based on its type
   */
  private static async executeJob(job: QueueJob): Promise<Record<string, any>> {
    const startTime = Date.now();

    try {
      let result: any = {};

      switch (job.type) {
        case 'usage_reporting':
          result = await this.processUsageReporting(job.payload);
          break;

        case 'invoice_generation':
          result = await this.processInvoiceGeneration(job.payload);
          break;

        case 'payment_processing':
          result = await this.processPaymentProcessing(job.payload);
          break;

        case 'subscription_processing':
          result = await this.processSubscriptionProcessing(job.payload);
          break;

        case 'cleanup':
          result = await this.processCleanup(job.payload);
          break;

        default:
          throw new Error(`Unknown job type: ${job.type}`);
      }

      const processingTime = Date.now() - startTime;
      return {
        ...result,
        processingTime,
        executedAt: new Date().toISOString(),
      };
    } catch (error) {
      const processingTime = Date.now() - startTime;
      throw new Error(`Job execution failed after ${processingTime}ms: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Handle job failure and retry logic
   */
  private static async handleJobFailure(job: QueueJob, error: any): Promise<void> {
    try {
      const attempts = job.attempts + 1;
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      if (attempts >= job.maxAttempts) {
        // Max attempts reached, mark as failed
        await prisma.queueJob.update({
          where: { id: job.id },
          data: {
            status: 'failed',
            attempts,
            error: errorMessage,
            updatedAt: new Date(),
          },
        });

        logger.warn('Job failed permanently', {
          operation: 'billing_queue',
          jobId: job.id,
          jobType: job.type,
          attempts,
          maxAttempts: job.maxAttempts
        });
      } else {
        // Schedule retry
        const retryDelay = this.RETRY_DELAYS[attempts - 1] || this.RETRY_DELAYS[this.RETRY_DELAYS.length - 1];
        const scheduledFor = new Date(Date.now() + retryDelay);

        await prisma.queueJob.update({
          where: { id: job.id },
          data: {
            status: 'retrying',
            attempts,
            error: errorMessage,
            scheduledFor,
            updatedAt: new Date(),
          },
        });

        logger.info('Job scheduled for retry', {
          operation: 'billing_queue',
          jobId: job.id,
          jobType: job.type,
          attempts,
          maxAttempts: job.maxAttempts,
          scheduledFor
        });

        // Reset to pending for next processing cycle
        setTimeout(async () => {
          try {
            await prisma.queueJob.update({
              where: { id: job.id },
              data: {
                status: 'pending',
                updatedAt: new Date(),
              },
            });
          } catch (updateError) {
            logger.error('Error updating job for retry', updateError as Error, {
              operation: 'billing_queue',
              jobId: job.id,
              jobType: job.type
            });
          }
        }, retryDelay);
      }
    } catch (error) {
      logger.error('Error handling job failure', error as Error, {
        operation: 'billing_queue',
        jobId: job.id,
        jobType: job.type
      });
    }
  }

  /**
   * Process usage reporting job
   */
  private static async processUsageReporting(payload: any): Promise<any> {
    const { StripeUsageReportingService } = await import('./stripeUsageReporting');
    
    if (payload.subscriptionId) {
      // Report usage for specific subscription
      await StripeUsageReportingService.reportUsageToStripe(payload);
      return { subscriptionId: payload.subscriptionId, reported: true };
    } else {
      // Report usage for all subscriptions
      const results = await StripeUsageReportingService.reportAllUsage();
      return results;
    }
  }

  /**
   * Process invoice generation job
   */
  private static async processInvoiceGeneration(payload: any): Promise<any> {
    const { MeteredBillingService } = await import('./meteredBilling');
    
    if (payload.subscriptionId) {
      await MeteredBillingService.processMeteredBilling(payload.subscriptionId);
      return { subscriptionId: payload.subscriptionId, processed: true };
    }
    
    return { message: 'Invoice generation completed' };
  }

  /**
   * Process payment processing job
   */
  private static async processPaymentProcessing(payload: any): Promise<any> {
    // Implement payment processing logic
    logger.info('Processing payment job', {
      operation: 'billing_queue',
      payload
    });
    return { paymentId: payload.paymentId, processed: true };
  }

  /**
   * Process subscription processing job
   */
  private static async processSubscriptionProcessing(payload: any): Promise<any> {
    const { MeteredBillingService } = await import('./meteredBilling');
    
    if (payload.action === 'process_pending_cancellations') {
      const count = await MeteredBillingService.processPendingCancellations();
      return { pendingCancellationsProcessed: count };
    }
    
    return { message: 'Subscription processing completed' };
  }

  /**
   * Process cleanup job
   */
  private static async processCleanup(payload: any): Promise<any> {
    const { DuplicatePreventionService } = await import('./duplicatePreventionService');
    const { AuditTrailService } = await import('./auditTrail');
    
    const results: any = {};
    
    if (payload.cleanupType === 'old_usage_records') {
      await DuplicatePreventionService.cleanupOldRecords(payload.retentionDays || 30);
      results.oldUsageRecordsCleanup = true;
    }
    
    if (payload.cleanupType === 'old_audit_logs') {
      const count = await AuditTrailService.cleanupOldLogs(payload.retentionDays || 365);
      results.oldAuditLogsCleanup = count;
    }
    
    return results;
  }

  /**
   * Get queue statistics
   */
  static async getQueueStats(): Promise<QueueStats> {
    try {
      const stats = await prisma.queueJob.groupBy({
        by: ['status'],
        _count: {
          id: true,
        },
      });

      const statusCounts = stats.reduce((acc, stat) => {
        acc[stat.status] = stat._count.id;
        return acc;
      }, {} as Record<string, number>);

      // Calculate average processing time for completed jobs
      // Note: We filter for completed jobs and then check processingTime in JS
      // because JSON path filters require scalar comparisons
      const completedJobs = await prisma.queueJob.findMany({
        where: {
          status: 'completed',
        },
        select: {
          result: true,
        },
        take: 100, // Last 100 completed jobs
        orderBy: {
          completedAt: 'desc',
        },
      });

      const processingTimes = completedJobs
        .map(job => (job.result as any)?.processingTime)
        .filter(time => typeof time === 'number');

      const averageProcessingTime = processingTimes.length > 0
        ? processingTimes.reduce((sum, time) => sum + time, 0) / processingTimes.length
        : 0;

      return {
        pending: statusCounts.pending || 0,
        processing: statusCounts.processing || 0,
        completed: statusCounts.completed || 0,
        failed: statusCounts.failed || 0,
        totalJobs: Object.values(statusCounts).reduce((sum, count) => sum + count, 0),
        averageProcessingTime,
      };
    } catch (error) {
      logger.error('Error getting queue stats', error as Error, {
        operation: 'billing_queue'
      });
      throw error;
    }
  }

  /**
   * Clean up old completed and failed jobs
   */
  static async cleanupOldJobs(retentionDays: number = 7): Promise<number> {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

      const result = await prisma.queueJob.deleteMany({
        where: {
          status: {
            in: ['completed', 'failed'],
          },
          updatedAt: {
            lt: cutoffDate,
          },
        },
      });

      logger.info('Cleaned up old queue jobs', {
        operation: 'billing_queue',
        cleanedCount: result.count
      });
      return result.count;
    } catch (error) {
      logger.error('Error cleaning up old jobs', error as Error, {
        operation: 'billing_queue'
      });
      throw error;
    }
  }
}
