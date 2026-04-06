import { sendEmail } from '@/lib/email';
import { logger } from '../logger';

export interface QueuedEmail {
  id: string;
  to: string;
  subject: string;
  html: string;
  priority: 'high' | 'normal' | 'low';
  attempts: number;
  maxAttempts: number;
  scheduledAt: Date;
  createdAt: Date;
  lastAttemptAt?: Date;
  error?: string;
  status: 'pending' | 'processing' | 'sent' | 'failed';
}

/**
 * Simple in-memory email queue service
 * In production, this should be replaced with a proper queue system like Bull/BullMQ with Redis
 */
class EmailQueueService {
  private queue: QueuedEmail[] = [];
  private processing = false;
  private readonly BATCH_SIZE = 5;
  private readonly RETRY_DELAYS = [1000, 5000, 15000, 60000]; // 1s, 5s, 15s, 1m
  private processingInterval?: NodeJS.Timeout;

  constructor() {
    // Start processing queue every 2 seconds
    this.startProcessing();
  }

  /**
   * Add email to queue
   */
  async queueEmail(
    to: string,
    subject: string,
    html: string,
    options: {
      priority?: 'high' | 'normal' | 'low';
      delay?: number; // Delay in milliseconds
      maxAttempts?: number;
    } = {}
  ): Promise<string> {
    const emailId = `email_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const now = new Date();
    const scheduledAt = options.delay ? new Date(now.getTime() + options.delay) : now;

    const queuedEmail: QueuedEmail = {
      id: emailId,
      to,
      subject,
      html,
      priority: options.priority || 'normal',
      attempts: 0,
      maxAttempts: options.maxAttempts || 3,
      scheduledAt,
      createdAt: now,
      status: 'pending',
    };

    // Insert based on priority
    this.insertByPriority(queuedEmail);

    logger.info('Email queued', {
      operation: 'email_queue',
      emailId,
      to,
      priority: queuedEmail.priority
    });
    return emailId;
  }

  /**
   * Insert email into queue based on priority
   */
  private insertByPriority(email: QueuedEmail): void {
    const priorityOrder = { high: 0, normal: 1, low: 2 };
    
    let insertIndex = this.queue.length;
    for (let i = 0; i < this.queue.length; i++) {
      if (priorityOrder[email.priority] < priorityOrder[this.queue[i].priority]) {
        insertIndex = i;
        break;
      }
    }
    
    this.queue.splice(insertIndex, 0, email);
  }

  /**
   * Start processing the queue
   */
  private startProcessing(): void {
    if (this.processingInterval) {
      return;
    }

    this.processingInterval = setInterval(async () => {
      if (!this.processing) {
        await this.processQueue();
      }
    }, 2000);
  }

  /**
   * Stop processing the queue
   */
  stopProcessing(): void {
    if (this.processingInterval) {
      clearInterval(this.processingInterval);
      this.processingInterval = undefined;
    }
  }

  /**
   * Process queued emails
   */
  private async processQueue(): Promise<void> {
    if (this.processing || this.queue.length === 0) {
      return;
    }

    this.processing = true;
    const now = new Date();

    try {
      // Get emails ready to be sent
      const readyEmails = this.queue
        .filter(email => 
          email.status === 'pending' && 
          email.scheduledAt <= now &&
          email.attempts < email.maxAttempts
        )
        .slice(0, this.BATCH_SIZE);

      if (readyEmails.length === 0) {
        return;
      }

      logger.info('Processing emails from queue', {
        operation: 'email_queue',
        emailCount: readyEmails.length
      });

      // Process emails in parallel
      const promises = readyEmails.map(email => this.processEmail(email));
      await Promise.allSettled(promises);

      // Clean up sent and failed emails
      this.cleanupQueue();

    } catch (error) {
      logger.error('Error processing email queue', error as Error, {
        operation: 'email_queue'
      });
    } finally {
      this.processing = false;
    }
  }

  /**
   * Process a single email
   */
  private async processEmail(email: QueuedEmail): Promise<void> {
    email.status = 'processing';
    email.attempts++;
    email.lastAttemptAt = new Date();

    try {
      const result = await sendEmail({
        to: email.to,
        subject: email.subject,
        html: email.html,
      });

      if (result.success) {
        email.status = 'sent';
        logger.info('Email sent successfully', {
          operation: 'email_queue',
          emailId: email.id
        });
      } else {
        throw new Error('error' in result ? result.error : 'Email sending failed');
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      email.error = errorMessage;
      
      if (email.attempts >= email.maxAttempts) {
        email.status = 'failed';
        logger.error('Email failed permanently', new Error(errorMessage), {
          operation: 'email_queue',
          emailId: email.id,
          attempts: email.attempts,
          maxAttempts: email.maxAttempts
        });
      } else {
        email.status = 'pending';
        // Schedule retry with exponential backoff
        const retryDelay = this.RETRY_DELAYS[email.attempts - 1] || this.RETRY_DELAYS[this.RETRY_DELAYS.length - 1];
        email.scheduledAt = new Date(Date.now() + retryDelay);
        logger.warn('Email retry scheduled', {
          operation: 'email_queue',
          emailId: email.id,
          attempts: email.attempts,
          maxAttempts: email.maxAttempts
        });
      }
    }
  }

  /**
   * Clean up completed emails from queue
   */
  private cleanupQueue(): void {
    const initialLength = this.queue.length;
    
    // Remove sent emails and permanently failed emails older than 1 hour
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    this.queue = this.queue.filter(email => {
      if (email.status === 'sent' || 
          (email.status === 'failed' && email.lastAttemptAt && email.lastAttemptAt < oneHourAgo)) {
        return false;
      }
      return true;
    });

    const removedCount = initialLength - this.queue.length;
    if (removedCount > 0) {
      logger.info('Cleaned up completed emails from queue', {
        operation: 'email_queue',
        removedCount
      });
    }
  }

  /**
   * Get queue statistics
   */
  getStats(): {
    total: number;
    pending: number;
    processing: number;
    sent: number;
    failed: number;
    byPriority: Record<string, number>;
  } {
    const stats = {
      total: this.queue.length,
      pending: 0,
      processing: 0,
      sent: 0,
      failed: 0,
      byPriority: { high: 0, normal: 0, low: 0 },
    };

    for (const email of this.queue) {
      stats[email.status]++;
      stats.byPriority[email.priority]++;
    }

    return stats;
  }

  /**
   * Get email by ID
   */
  getEmail(id: string): QueuedEmail | undefined {
    return this.queue.find(email => email.id === id);
  }

  /**
   * Cancel email by ID
   */
  cancelEmail(id: string): boolean {
    const index = this.queue.findIndex(email => email.id === id);
    if (index !== -1 && this.queue[index].status === 'pending') {
      this.queue.splice(index, 1);
      logger.info('Email cancelled', {
        operation: 'email_queue',
        emailId: id
      });
      return true;
    }
    return false;
  }

  /**
   * Clear all emails from queue
   */
  clearQueue(): void {
    const count = this.queue.length;
    this.queue = [];
    logger.info('Cleared emails from queue', {
      operation: 'email_queue',
      count
    });
  }
}

// Singleton instance
export const emailQueueService = new EmailQueueService();

/**
 * Helper function to queue emails easily
 */
export async function queueEmail(
  to: string,
  subject: string,
  html: string,
  options?: {
    priority?: 'high' | 'normal' | 'low';
    delay?: number;
    maxAttempts?: number;
  }
): Promise<string> {
  return emailQueueService.queueEmail(to, subject, html, options);
}

export default emailQueueService;
