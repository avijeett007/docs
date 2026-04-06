import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';

/**
 * Session Replay Protection for Payment Success Routes
 * Prevents the same Stripe session from being processed multiple times
 */

interface ProcessedSession {
  sessionId: string;
  partnerId: string;
  processedAt: Date;
  clientIP: string;
}

/**
 * Check if a Stripe session has already been processed
 */
export async function isSessionAlreadyProcessed(
  sessionId: string,
  partnerId: string
): Promise<boolean> {
  try {
    // Check if we have a record of this session being processed
    const existingRecord = await prisma.processedStripeSession.findUnique({
      where: {
        sessionId_partnerId: {
          sessionId,
          partnerId
        }
      }
    });

    return !!existingRecord;
  } catch (error) {
    logger.error('Error checking session replay protection', error as Error, {
      operation: 'session_replay_protection',
      sessionId,
      partnerId
    });
    // Fail safe - allow processing if we can't check
    return false;
  }
}

/**
 * Mark a Stripe session as processed
 */
export async function markSessionAsProcessed(
  sessionId: string,
  partnerId: string,
  clientIP: string
): Promise<void> {
  try {
    await prisma.processedStripeSession.create({
      data: {
        sessionId,
        partnerId,
        clientIP,
        processedAt: new Date()
      }
    });
  } catch (error) {
    // If this fails due to unique constraint, that's actually good
    // It means another request already processed this session
    if (error && typeof error === 'object' && 'code' in error && error.code === 'P2002') {
      logger.warn('Session already processed by another request', {
        operation: 'session_replay_protection',
        sessionId,
        partnerId
      });
      return;
    }

    logger.error('Error marking session as processed', error as Error, {
      operation: 'session_replay_protection',
      sessionId,
      partnerId
    });
    throw error;
  }
}

/**
 * Clean up old processed sessions (older than 24 hours)
 * This should be run periodically to prevent the table from growing too large
 */
export async function cleanupOldProcessedSessions(): Promise<number> {
  try {
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    
    const result = await prisma.processedStripeSession.deleteMany({
      where: {
        processedAt: {
          lt: twentyFourHoursAgo
        }
      }
    });

    logger.info('Cleaned up old processed sessions', {
      operation: 'session_replay_protection',
      cleanedCount: result.count
    });
    return result.count;
  } catch (error) {
    logger.error('Error cleaning up old processed sessions', error as Error, {
      operation: 'session_replay_protection'
    });
    return 0;
  }
}

/**
 * Get processing statistics for monitoring
 */
export async function getSessionProcessingStats(): Promise<{
  totalProcessed: number;
  processedToday: number;
  uniquePartners: number;
}> {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [totalProcessed, processedToday, uniquePartners] = await Promise.all([
      prisma.processedStripeSession.count(),
      prisma.processedStripeSession.count({
        where: {
          processedAt: {
            gte: today
          }
        }
      }),
      prisma.processedStripeSession.groupBy({
        by: ['partnerId'],
        _count: true
      }).then(results => results.length)
    ]);

    return {
      totalProcessed,
      processedToday,
      uniquePartners
    };
  } catch (error) {
    logger.error('Error getting session processing stats', error as Error, {
      operation: 'session_replay_protection'
    });
    return {
      totalProcessed: 0,
      processedToday: 0,
      uniquePartners: 0
    };
  }
}
