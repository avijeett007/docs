import Redis, { Redis as RedisType } from 'ioredis';
import { logger } from './logger';

// Singleton Redis client for the main application
class RedisClient {
  private static instance: RedisType | null = null;
  private static isConnecting = false;

  static getInstance(): RedisType {
    if (!RedisClient.instance && !RedisClient.isConnecting) {
      RedisClient.isConnecting = true;
      
      try {
        const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';

        RedisClient.instance = new Redis(redisUrl, {
          maxRetriesPerRequest: 3,
          lazyConnect: true,
          connectTimeout: 10000,
          commandTimeout: 5000,
        });

        // Connection event handlers
        RedisClient.instance.on('connect', () => {
          logger.info('Redis connected successfully', {
            operation: 'redis_client'
          });
        });

        RedisClient.instance.on('error', (error) => {
          logger.error('Redis connection error', error as Error, {
            operation: 'redis_client'
          });
        });

        RedisClient.instance.on('close', () => {
          logger.info('Redis connection closed', {
            operation: 'redis_client'
          });
        });

        RedisClient.instance.on('reconnecting', () => {
          logger.info('Redis reconnecting', {
            operation: 'redis_client'
          });
        });

      } catch (error) {
        logger.error('Failed to initialize Redis client', error as Error, {
          operation: 'redis_client'
        });
        RedisClient.instance = null;
      } finally {
        RedisClient.isConnecting = false;
      }
    }

    if (!RedisClient.instance) {
      throw new Error('Redis client not available');
    }

    return RedisClient.instance;
  }

  static async disconnect(): Promise<void> {
    if (RedisClient.instance) {
      await RedisClient.instance.quit();
      RedisClient.instance = null;
    }
  }

  // Health check method
  static async healthCheck(): Promise<boolean> {
    try {
      const client = RedisClient.getInstance();
      const result = await client.ping();
      return result === 'PONG';
    } catch (error) {
      logger.error('Redis health check failed', error as Error, {
        operation: 'redis_client'
      });
      return false;
    }
  }
}

export default RedisClient;
