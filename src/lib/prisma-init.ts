/**
 * Prisma initialization and connection management
 * This module handles early connection establishment and monitoring
 */

import { ensurePrismaConnection, checkPrismaHealth } from './prisma';
import { logger } from './logger';

let initializationPromise: Promise<void> | null = null;
let isInitialized = false;

/**
 * Initialize Prisma connection early in the application lifecycle
 * This should be called during app startup to establish connections proactively
 */
export async function initializePrisma(): Promise<void> {
  if (isInitialized) {
    return;
  }

  if (initializationPromise) {
    return initializationPromise;
  }

  initializationPromise = (async () => {
    try {
      logger.info('Initializing Prisma connection', {
        operation: 'prisma_init'
      });
      await ensurePrismaConnection();
      isInitialized = true;
      logger.info('Prisma connection initialized successfully', {
        operation: 'prisma_init'
      });
      
      // Start periodic health checks in production
      if (process.env.NODE_ENV === 'production') {
        startHealthMonitoring();
      }
    } catch (error) {
      logger.error('Failed to initialize Prisma connection', error as Error, {
        operation: 'prisma_init'
      });
      isInitialized = false;
      initializationPromise = null;
      throw error;
    }
  })();

  return initializationPromise;
}

/**
 * Start periodic health monitoring for the database connection
 */
function startHealthMonitoring(): void {
  const healthCheckInterval = parseInt(process.env.PRISMA_HEALTH_CHECK_INTERVAL || '30000'); // 30 seconds default
  
  setInterval(async () => {
    try {
      const health = await checkPrismaHealth();
      if (!health.healthy) {
        logger.error('Database health check failed', new Error(health.error), {
          operation: 'prisma_init'
        });
        isInitialized = false;
        initializationPromise = null;
        
        // Attempt to reinitialize
        try {
          await initializePrisma();
        } catch (reinitError) {
          logger.error('Failed to reinitialize database connection', reinitError as Error, {
            operation: 'prisma_init'
          });
        }
      }
    } catch (error) {
      logger.error('Health check monitoring error', error as Error, {
        operation: 'prisma_init'
      });
    }
  }, healthCheckInterval);
}

/**
 * Get the current initialization status
 */
export function getPrismaInitializationStatus(): {
  isInitialized: boolean;
  isInitializing: boolean;
} {
  return {
    isInitialized,
    isInitializing: initializationPromise !== null && !isInitialized,
  };
}

/**
 * Force reset the initialization state (useful for testing)
 */
export function resetPrismaInitialization(): void {
  isInitialized = false;
  initializationPromise = null;
}
