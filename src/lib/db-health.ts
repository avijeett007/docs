import { prisma } from '@/lib/prisma';
import { logger } from './logger';

export interface DatabaseHealthStatus {
  isHealthy: boolean;
  connectionCount?: number;
  lastError?: string;
  responseTime?: number;
}

/**
 * Check database health and connection status
 *
 * NOTE: Do NOT call $connect() explicitly - Prisma uses lazy connection
 * and connects automatically on first query. Explicit $connect() adds overhead.
 */
export async function checkDatabaseHealth(): Promise<DatabaseHealthStatus> {
  const startTime = Date.now();

  try {
    // Simple query to test connection - Prisma will connect automatically if needed
    await prisma.$queryRaw`SELECT 1`;

    const responseTime = Date.now() - startTime;

    return {
      isHealthy: true,
      responseTime,
    };
  } catch (error: any) {
    logger.error('Database health check failed', error as Error, {
      operation: 'db_health_check'
    });

    return {
      isHealthy: false,
      lastError: error.message || 'Unknown database error',
      responseTime: Date.now() - startTime,
    };
  }
}

/**
 * Retry database operation with exponential backoff
 * FIXED: Removed circular dependency with health check
 */
export async function retryDatabaseOperation<T>(
  operation: () => Promise<T>,
  maxRetries = 3,
  baseDelay = 1000
): Promise<T> {
  let lastError: Error;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      // FIXED: Direct operation execution without health check
      // The operation itself will fail if connection is bad, triggering retry
      return await operation();
    } catch (error: any) {
      lastError = error;
      logger.error('Database operation attempt failed', error as Error, {
        operation: 'db_operation_with_retry',
        attempt,
        maxRetries,
        errorCode: error.code
      });

      // Check if this is a recoverable connection error
      const isRecoverableError =
        error.message?.includes('Engine is not yet connected') ||
        error.message?.includes('Connection closed') ||
        error.message?.includes('Connection lost') ||
        error.code === 'P1017' || // Database connection closed
        error.code === 'P1001' || // Can't reach database server
        error.code === 'P1008';   // Operations timed out

      // Don't retry on non-recoverable errors
      if (!isRecoverableError) {
        throw error;
      }

      if (attempt < maxRetries) {
        const delay = baseDelay * Math.pow(2, attempt - 1);
        logger.info('Retrying database operation', {
          operation: 'db_operation_with_retry',
          delay,
          nextAttempt: attempt + 1,
          maxRetries,
          errorType: isRecoverableError ? 'recoverable' : 'non-recoverable'
        });

        // Wait before retry - Prisma will automatically reconnect on next query
        // Do NOT call $disconnect()/$connect() - it slows down the app
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  throw lastError!;
}

/**
 * Safe database query wrapper with automatic retry
 */
export async function safeDatabaseQuery<T>(
  queryFn: () => Promise<T>,
  context = 'database query'
): Promise<T> {
  return retryDatabaseOperation(async () => {
    try {
      return await queryFn();
    } catch (error: any) {
      logger.error('Database operation failed', error as Error, {
        operation: 'db_operation_with_health_check',
        context
      });
      throw error;
    }
  });
}
