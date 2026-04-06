import { logger } from './logger';

type JobFunction = () => Promise<any>;

interface Job {
  id: string;
  fn: JobFunction;
  retryAt: number;
  maxRetries: number;
  currentRetry: number;
}

class BackgroundJobQueue {
  private static instance: BackgroundJobQueue;
  private jobs: Map<string, Job> = new Map();
  private isProcessing: boolean = false;

  private constructor() {
    // Start processing jobs
    this.processJobs();
  }

  public static getInstance(): BackgroundJobQueue {
    if (!BackgroundJobQueue.instance) {
      BackgroundJobQueue.instance = new BackgroundJobQueue();
    }
    return BackgroundJobQueue.instance;
  }

  public addJob(id: string, fn: JobFunction, delaySeconds: number = 60, maxRetries: number = 3): void {
    const job: Job = {
      id,
      fn,
      retryAt: Date.now() + (delaySeconds * 1000),
      maxRetries,
      currentRetry: 0,
    };
    this.jobs.set(id, job);
    logger.info('Job scheduled for retry', {
      operation: 'background_job_schedule',
      jobId: id,
      delaySeconds,
      maxRetries
    });
  }

  private async processJobs(): Promise<void> {
    if (this.isProcessing) return;
    this.isProcessing = true;

    while (true) {
      const now = Date.now();
      const jobsToProcess: Job[] = [];

      // Find jobs that are ready to be processed
      Array.from(this.jobs.entries()).forEach(([id, job]) => {
        if (job.retryAt <= now) {
          jobsToProcess.push(job);
          this.jobs.delete(id);
        }
      });

      // Process ready jobs
      for (const job of jobsToProcess) {
        try {
          logger.info('Retrying background job', {
            operation: 'background_job_retry',
            jobId: job.id,
            attempt: job.currentRetry + 1,
            maxRetries: job.maxRetries
          });
          await job.fn();
          logger.info('Background job completed successfully', {
            operation: 'background_job_complete',
            jobId: job.id,
            attempt: job.currentRetry + 1
          });
        } catch (error) {
          logger.error('Error in background job', error as Error, {
            operation: 'background_job_error',
            jobId: job.id,
            attempt: job.currentRetry + 1,
            maxRetries: job.maxRetries
          });
          
          if (job.currentRetry < job.maxRetries - 1) {
            // Schedule next retry with exponential backoff
            const nextRetryDelay = Math.pow(2, job.currentRetry + 1) * 60; // exponential backoff in seconds
            job.currentRetry++;
            job.retryAt = Date.now() + (nextRetryDelay * 1000);
            this.jobs.set(job.id, job);
            logger.info('Background job scheduled for next retry', {
              operation: 'background_job_reschedule',
              jobId: job.id,
              nextRetryDelay,
              nextAttempt: job.currentRetry + 2,
              maxRetries: job.maxRetries
            });
          } else {
            logger.error('Background job failed after all attempts', new Error('Job failed permanently'), {
              operation: 'background_job_failed',
              jobId: job.id,
              maxRetries: job.maxRetries
            });
          }
        }
      }

      // Wait a bit before checking for more jobs
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
}

export const backgroundQueue = BackgroundJobQueue.getInstance();
