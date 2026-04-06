/**
 * Prisma Client Singleton - Industry Best Practice for Next.js
 *
 * ARCHITECTURE:
 * - Single PrismaClient instance using official Prisma recommendation
 * - Lazy connection: Prisma connects on first query (not on instantiation)
 * - Simple auto-recovery for connection errors
 * - Works with NeonDB pooler (PgBouncer-based)
 *
 * ⚠️ WARNING: This module is Node.js only and should NOT be imported in Edge Runtime contexts
 * (such as middleware.ts). Edge Runtime cannot use Node.js APIs like Prisma.
 *
 * References:
 * - https://www.prisma.io/docs/orm/more/help-and-troubleshooting/nextjs-help
 * - https://www.prisma.io/docs/orm/prisma-client/setup-and-configuration/databases-connections
 */

import { PrismaClient } from '@prisma/client';

// Initialize OpenTelemetry for monitoring
import './otel-init';
import { trace } from '@opentelemetry/api';

// Import safe metrics module that works in both Node.js and Edge Runtime
import { metrics } from './otel-metrics-safe';
import { logger } from './logger';

// CRITICAL: Use globalThis for singleton pattern (official Prisma recommendation)
// This survives Next.js HMR in development and works in production
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
  prismaCreatedAt: number | undefined;
};

/**
 * Build database URL with appropriate connection pool parameters
 * NeonDB pooler handles connection pooling, so we use conservative settings
 */
function buildDatabaseUrl(): string {
  const baseUrl = process.env.DATABASE_URL;
  if (!baseUrl) {
    throw new Error('DATABASE_URL environment variable is required');
  }

  const url = new URL(baseUrl);
  const isPooledConnection = url.hostname.includes('pooler') || url.searchParams.has('pgbouncer');

  // For NeonDB pooler: use conservative connection_limit since pooler handles pooling
  // For direct connections: use slightly higher limit
  const connectionLimit = process.env.PRISMA_CONNECTION_LIMIT ||
    (isPooledConnection ? '5' : (process.env.NODE_ENV === 'production' ? '10' : '20'));

  // Pool timeout: how long to wait for a connection from the pool
  const poolTimeout = process.env.PRISMA_POOL_TIMEOUT || '10';

  url.searchParams.set('connection_limit', connectionLimit);
  url.searchParams.set('pool_timeout', poolTimeout);

  // For NeonDB pooler, add pgbouncer=true for proper transaction mode handling
  if (isPooledConnection && !url.searchParams.has('pgbouncer')) {
    url.searchParams.set('pgbouncer', 'true');
  }

  return url.toString();
}

/**
 * Create a new Prisma client instance with appropriate configuration
 */
function createPrismaClient(): PrismaClient {
  logger.info('Creating new Prisma client instance', {
    operation: 'database_connection',
    environment: process.env.NODE_ENV,
    hasPooler: process.env.DATABASE_URL?.includes('pooler') || false
  });

  return new PrismaClient({
    log: process.env.NODE_ENV === 'development'
      ? (process.env.PRISMA_LOG_QUERIES === 'true' ? ['query', 'info', 'warn', 'error'] : ['warn', 'error'])
      : ['error'],
    datasources: {
      db: {
        url: buildDatabaseUrl(),
      },
    },
    errorFormat: 'pretty',
  });
}

/**
 * SINGLETON PATTERN - Official Prisma Recommendation for Next.js
 *
 * - In production: Creates one instance that lives for the process lifetime
 * - In development: Uses globalThis to survive Next.js HMR (Hot Module Replacement)
 *
 * Prisma uses LAZY CONNECTION - it connects on first query, not on instantiation.
 * This is the recommended approach per Prisma docs.
 */
export const prisma = globalForPrisma.prisma ?? createPrismaClient();

// Store in global for development HMR survival
if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}
globalForPrisma.prismaCreatedAt = Date.now();

/**
 * Check if an error is a recoverable connection error
 */
function isRecoverableError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const message = error.message;
  const code = (error as { code?: string })?.code;

  return (
    message.includes('Engine is not yet connected') ||
    message.includes('Response from the Engine was empty') ||
    message.includes('Connection closed') ||
    message.includes('Connection lost') ||
    message.includes('Connection terminated') ||
    message.includes('Connection reset') ||
    message.includes('Connection refused') ||
    message.includes('Connection timeout') ||
    message.includes('Connection pool timeout') ||
    message.includes('Client has already been connected') ||
    message.includes('Client was closed and is not queryable') ||
    message.includes('Connection ended unexpectedly') ||
    message.includes('engine panicked') ||
    message.includes('Query engine exited') ||
    code === 'P1017' || // Database connection closed
    code === 'P1001' || // Can't reach database server
    code === 'P1008' || // Operations timed out
    code === 'P1002'    // Database server unreachable
  );
}

// ============================================================================
// AUTO-RECOVERY WRAPPER
// Simple retry logic for recoverable connection errors
// ============================================================================

/**
 * Auto-recovery wrapper for database operations with retry on connection errors.
 *
 * ⚠️ IMPORTANT: Only use this for IDEMPOTENT/READ operations!
 *
 * This wrapper retries operations on transient connection errors (engine disconnected,
 * connection timeout, etc.) with exponential backoff. This is SAFE for:
 * - findMany, findFirst, findUnique
 * - count, aggregate
 * - $queryRaw (SELECT only)
 * - Any read-only operation
 *
 * ❌ DO NOT USE for non-idempotent operations:
 * - create, createMany (could create duplicates)
 * - update, updateMany (could apply updates multiple times)
 * - delete, deleteMany (could fail after partial deletion)
 * - $transaction with writes (could partially commit)
 * - Operations with external side effects
 *
 * For write operations, let them fail and handle errors at the application level,
 * or implement idempotency keys in your business logic.
 *
 * @param operation - The database operation to execute (should be idempotent)
 * @param operationName - Name for logging/metrics purposes
 * @param maxRetries - Maximum retry attempts (default: 3)
 * @returns The result of the operation
 * @throws The last error if all retries fail
 *
 * @example
 * // ✅ SAFE - Read operation
 * const users = await withAutoRecovery(() => prisma.user.findMany(), 'findAllUsers');
 *
 * // ✅ SAFE - Count operation
 * const count = await withAutoRecovery(() => prisma.order.count(), 'countOrders');
 *
 * // ❌ UNSAFE - Do NOT wrap create/update/delete
 * // const user = await withAutoRecovery(() => prisma.user.create({...})); // BAD!
 */
export async function withAutoRecovery<T>(
  operation: () => Promise<T>,
  operationName: string = 'database_operation',
  maxRetries: number = 3
): Promise<T> {
  const startTime = Date.now();
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const result = await operation();

      // Log successful recovery if this was a retry
      if (attempt > 1) {
        const duration = Date.now() - startTime;
        logger.info('Auto-recovery successful', {
          operation: 'auto_recovery',
          operationName,
          attempt,
          duration,
          totalRetries: attempt - 1
        });
        autoRecoverySuccesses++;
        metrics.recordDbQuery('auto_recovery_success', operationName, duration, true);
      }

      return result;

    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      if (isRecoverableError(error) && attempt < maxRetries) {
        autoRecoveryAttempts++;

        // Exponential backoff: 100ms, 200ms, 400ms (max 1s)
        const delay = Math.min(100 * Math.pow(2, attempt - 1), 1000);

        logger.warn('Database operation failed, attempting auto-recovery', {
          operation: 'auto_recovery',
          operationName,
          attempt,
          maxRetries,
          error: lastError.message,
          errorCode: (error as { code?: string })?.code,
          retryDelay: delay
        });

        metrics.recordError('auto_recovery_attempt', lastError.message, {
          operation: operationName,
          attempt,
          maxRetries
        });

        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }

      // Non-recoverable error or exhausted retries
      break;
    }
  }

  // All retries failed
  const totalDuration = Date.now() - startTime;
  logger.error('Auto-recovery failed after all attempts', lastError!, {
    operation: 'auto_recovery',
    operationName,
    maxRetries,
    totalDuration
  });

  metrics.recordError('auto_recovery_failed', lastError?.message || 'Unknown error', {
    operation: operationName,
    maxRetries,
    totalDuration
  });

  throw lastError;
}

/**
 * Convenience alias for withAutoRecovery.
 *
 * ⚠️ IMPORTANT: Only use for READ/IDEMPOTENT operations!
 * See withAutoRecovery() JSDoc for full safety guidelines.
 *
 * @example
 * // ✅ SAFE - Read operations only
 * const users = await prismaWithRecovery(() => prisma.user.findMany());
 */
export async function prismaWithRecovery<T>(
  operation: () => Promise<T>,
  operationName?: string
): Promise<T> {
  const detectedName = operationName ||
    operation.toString().match(/prisma\.(\w+)\.(\w+)/)?.[0] ||
    'unknown_operation';

  return withAutoRecovery(operation, detectedName);
}

// ============================================================================
// BACKWARD COMPATIBILITY EXPORTS
// These functions maintain API compatibility with existing code
// ============================================================================

/**
 * @deprecated Use prisma directly - Prisma connects lazily on first query
 */
export async function ensurePrismaReady(): Promise<PrismaClient> {
  return prisma;
}

/**
 * @deprecated Use prisma directly with withAutoRecovery if needed
 */
export async function withPrismaReady<T>(
  operation: (client: PrismaClient) => Promise<T>,
  _operationName: string = 'database_operation'
): Promise<T> {
  return operation(prisma);
}

/**
 * @deprecated Use prisma directly - connection is managed automatically
 */
export async function ensureConnectionReady(): Promise<void> {
  // No-op: Prisma manages connections automatically
  isConnected = true;
  lastHealthCheck = Date.now();
}

/**
 * @deprecated Use prisma directly - connection is managed automatically
 */
export async function ensurePrismaConnection(): Promise<void> {
  // Simple connection test
  try {
    await prisma.$queryRaw`SELECT 1`;
    isConnected = true;
    lastHealthCheck = Date.now();
  } catch (error) {
    isConnected = false;
    throw error;
  }
}

// ============================================================================
// HEALTH CHECK AND MONITORING
// ============================================================================

// Connection state tracking
let isConnected = false;
let lastHealthCheck = 0;
const HEALTH_CHECK_INTERVAL = process.env.NODE_ENV === 'production'
  ? 10 * 60 * 1000  // 10 minutes in production
  : 24 * 60 * 60 * 1000; // 24 hours in development

// Metrics for monitoring
let connectionAttempts = 0;
let connectionFailures = 0;
let autoRecoveryAttempts = 0;
let autoRecoverySuccesses = 0;
let clientRecreations = 0;
let lastConnectionError: string | null = null;

/**
 * Check if connection is ready (for backward compatibility)
 */
export function isConnectionReady(): boolean {
  return isConnected && (Date.now() - lastHealthCheck) < HEALTH_CHECK_INTERVAL;
}

/**
 * Simple health check using a lightweight query
 */
export async function checkPrismaHealth(): Promise<{ healthy: boolean; error?: string }> {
  const startTime = Date.now();
  const serviceName = process.env.SIGNOZ_SERVICE_NAME ||
    (process.env.NODE_ENV === 'production' ? 'knotie-ai-pro-app-prod' : 'knotie-ai-pro-dev');
  const tracer = trace.getTracer(serviceName);
  const span = tracer.startSpan('prisma.health_check');

  try {
    span.setAttributes({
      'db.system': 'postgresql',
      'db.operation': 'health_check',
    });

    // Simple query to test connection
    await prisma.$queryRaw`SELECT 1`;

    const duration = Date.now() - startTime;
    lastHealthCheck = Date.now();
    isConnected = true;

    span.setStatus({ code: 1 });
    span.setAttributes({
      'db.health_check.duration': duration,
      'db.health_check.success': true,
    });

    metrics.recordDbQuery('health_check', 'prisma', duration, true);

    return { healthy: true };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const duration = Date.now() - startTime;

    logger.warn('Health check failed', {
      operation: 'database_health_check',
      error: errorMessage,
      duration
    });

    isConnected = false;
    lastConnectionError = errorMessage;
    connectionFailures++;

    span.setStatus({ code: 2, message: errorMessage });
    metrics.recordDbQuery('health_check', 'prisma', duration, false);
    metrics.recordError('health_check_failed', errorMessage);

    return { healthy: false, error: errorMessage };
  } finally {
    span.end();
  }
}

/**
 * Get connection metrics for monitoring
 */
export function getPrismaConnectionMetrics() {
  const memUsage = process.memoryUsage();

  return {
    isConnected,
    lastHealthCheck: lastHealthCheck ? new Date(lastHealthCheck).toISOString() : null,
    lastConnectionError,
    connectionAttempts,
    connectionFailures,
    connectionSuccessRate: connectionAttempts > 0 ?
      ((connectionAttempts - connectionFailures) / connectionAttempts * 100).toFixed(2) + '%' : 'N/A',
    autoRecoveryAttempts,
    autoRecoverySuccesses,
    autoRecoverySuccessRate: autoRecoveryAttempts > 0 ?
      (autoRecoverySuccesses / autoRecoveryAttempts * 100).toFixed(2) + '%' : 'N/A',
    clientRecreations,
    clientCreatedAt: globalForPrisma.prismaCreatedAt ? new Date(globalForPrisma.prismaCreatedAt).toISOString() : null,
    healthStatus: isConnected ? 'healthy' : 'unhealthy',
    needsHealthCheck: lastHealthCheck === 0 || (Date.now() - lastHealthCheck) > HEALTH_CHECK_INTERVAL,
    memory: {
      heapUsedMB: Math.round(memUsage.heapUsed / 1024 / 1024),
      heapTotalMB: Math.round(memUsage.heapTotal / 1024 / 1024),
      externalMB: Math.round(memUsage.external / 1024 / 1024),
      rssMB: Math.round(memUsage.rss / 1024 / 1024),
    },
    timestamp: new Date().toISOString(),
  };
}

/**
 * Reset connection metrics (for testing)
 */
export function resetPrismaConnectionMetrics() {
  connectionAttempts = 0;
  connectionFailures = 0;
  autoRecoveryAttempts = 0;
  autoRecoverySuccesses = 0;
  clientRecreations = 0;
  lastConnectionError = null;
  lastHealthCheck = 0;
  logger.info('Prisma connection metrics reset', { operation: 'database_maintenance' });
}

/**
 * Force health check and return metrics
 */
export async function forcePrismaHealthCheck(): Promise<{
  healthy: boolean;
  error?: string;
  metrics: ReturnType<typeof getPrismaConnectionMetrics>
}> {
  const healthResult = await checkPrismaHealth();
  const currentMetrics = getPrismaConnectionMetrics();

  return {
    ...healthResult,
    metrics: currentMetrics
  };
}

// ============================================================================
// GRACEFUL SHUTDOWN
// ============================================================================

if (typeof process !== 'undefined' && process.on) {
  const gracefulShutdown = async (signal: string) => {
    try {
      await prisma.$disconnect();
      isConnected = false;
      logger.info(`Prisma client disconnected gracefully (${signal})`, { operation: 'database_shutdown' });
    } catch (error) {
      logger.error(`Error during Prisma disconnect (${signal})`, error as Error, { operation: 'database_shutdown' });
    }
  };

  process.on('beforeExit', () => gracefulShutdown('beforeExit'));
  process.on('SIGINT', async () => {
    await gracefulShutdown('SIGINT');
    process.exit(0);
  });
  process.on('SIGTERM', async () => {
    await gracefulShutdown('SIGTERM');
    process.exit(0);
  });
}

export default prisma;
