import RedisClient from './redis-client';
import { logger } from './logger';

interface DomainCacheData {
  partnerId: string;
  branding: any; // Partner branding data
  type: 'subdomain' | 'customDomain';
  cachedAt: number;
  isApproved: boolean; // For determining cache TTL
}

interface CacheMetrics {
  hits: number;
  misses: number;
  errors: number;
  lastUpdated: number;
}

class DomainCacheService {
  private readonly CACHE_PREFIX = 'knotie:domain:';
  private readonly METRICS_KEY = 'knotie:domain:metrics';
  
  // Cache TTL based on approval status
  private readonly TTL_APPROVED = 24 * 60 * 60; // 24 hours for approved partners
  private readonly TTL_PENDING = 1 * 60 * 60;   // 1 hour for pending partners
  private readonly TTL_DEFAULT = 6 * 60 * 60;   // 6 hours default

  private getCacheKey(domain: string, type: 'subdomain' | 'customDomain'): string {
    return `${this.CACHE_PREFIX}${type}:${domain.toLowerCase()}`;
  }

  /**
   * Get cached domain branding data
   */
  async get(domain: string, type: 'subdomain' | 'customDomain'): Promise<DomainCacheData | null> {
    try {
      const redis = RedisClient.getInstance();
      const cacheKey = this.getCacheKey(domain, type);
      
      const cached = await redis.get(cacheKey);
      
      if (cached) {
        const data = JSON.parse(cached) as DomainCacheData;
        await this.recordMetric('hit');
        
        logger.debug('Domain cache hit', {
          operation: 'domain_cache',
          type,
          domain
        });
        return data;
      }
      
      await this.recordMetric('miss');
      logger.debug('Domain cache miss', {
        operation: 'domain_cache',
        type,
        domain
      });
      return null;
      
    } catch (error) {
      await this.recordMetric('error');
      logger.error('Error getting domain cache', error as Error, {
        operation: 'domain_cache',
        domain,
        type
      });
      return null;
    }
  }

  /**
   * Set cached domain branding data
   */
  async set(domain: string, type: 'subdomain' | 'customDomain', data: DomainCacheData): Promise<void> {
    try {
      const redis = RedisClient.getInstance();
      const cacheKey = this.getCacheKey(domain, type);
      
      // Determine TTL based on approval status
      let ttl = this.TTL_DEFAULT;
      if (data.isApproved) {
        ttl = this.TTL_APPROVED;
      } else {
        ttl = this.TTL_PENDING;
      }
      
      const cacheData = {
        ...data,
        cachedAt: Date.now()
      };
      
      await redis.setex(cacheKey, ttl, JSON.stringify(cacheData));
      
      logger.debug('Domain cache set', {
        operation: 'domain_cache',
        type,
        domain,
        ttl
      });
      
    } catch (error) {
      await this.recordMetric('error');
      logger.error('Error setting domain cache', error as Error, {
        operation: 'domain_cache',
        domain,
        type
      });
    }
  }

  /**
   * Invalidate cache for a specific domain
   */
  async invalidate(domain: string, type?: 'subdomain' | 'customDomain'): Promise<void> {
    try {
      const redis = RedisClient.getInstance();
      
      if (type) {
        const cacheKey = this.getCacheKey(domain, type);
        await redis.del(cacheKey);
        logger.debug('Domain cache invalidated', {
          operation: 'domain_cache',
          type,
          domain
        });
      } else {
        // Invalidate both types
        const subdomainKey = this.getCacheKey(domain, 'subdomain');
        const customDomainKey = this.getCacheKey(domain, 'customDomain');
        await redis.del(subdomainKey, customDomainKey);
        logger.debug('Domain cache invalidated for both types', {
          operation: 'domain_cache',
          domain
        });
      }
      
    } catch (error) {
      logger.error('Error invalidating domain cache', error as Error, {
        operation: 'domain_cache',
        domain
      });
    }
  }

  /**
   * Invalidate all cache entries for a partner
   */
  async invalidatePartner(partnerId: string): Promise<void> {
    try {
      const redis = RedisClient.getInstance();
      const pattern = `${this.CACHE_PREFIX}*`;

      // Use SCAN to find keys (more efficient than KEYS)
      const stream = redis.scanStream({
        match: pattern,
        count: 100
      });

      const keysToDelete: string[] = [];

      // Wrap stream processing in a promise to properly await completion
      await new Promise<void>((resolve, reject) => {
        stream.on('data', async (keys: string[]) => {
          // Pause stream while processing to avoid race conditions
          stream.pause();

          for (const key of keys) {
            try {
              const cached = await redis.get(key);
              if (cached) {
                const data = JSON.parse(cached) as DomainCacheData;
                if (data.partnerId === partnerId) {
                  keysToDelete.push(key);
                }
              }
            } catch (parseError) {
              // Skip invalid cache entries
              logger.warn('Invalid domain cache entry', {
                operation: 'domain_cache',
                key
              });
            }
          }

          // Resume stream after processing batch
          stream.resume();
        });

        stream.on('end', () => {
          resolve();
        });

        stream.on('error', (err) => {
          reject(err);
        });
      });

      // Delete keys after stream processing is complete
      if (keysToDelete.length > 0) {
        await redis.del(...keysToDelete);
        logger.info('Partner domain cache invalidated', {
          operation: 'domain_cache',
          partnerId,
          entriesCount: keysToDelete.length
        });
      } else {
        logger.debug('No cache entries found for partner', {
          operation: 'domain_cache',
          partnerId
        });
      }

    } catch (error) {
      logger.error('Error invalidating partner domain cache', error as Error, {
        operation: 'domain_cache',
        partnerId
      });
    }
  }

  /**
   * Record cache metrics
   */
  private async recordMetric(type: 'hit' | 'miss' | 'error'): Promise<void> {
    try {
      const redis = RedisClient.getInstance();
      // Map singular types to plural field names for consistency with getMetrics
      const fieldName = type === 'hit' ? 'hits' : type === 'miss' ? 'misses' : 'errors';
      await redis.hincrby(this.METRICS_KEY, fieldName, 1);
      await redis.hset(this.METRICS_KEY, 'lastUpdated', Date.now());

      // Set expiry on metrics key (7 days)
      await redis.expire(this.METRICS_KEY, 7 * 24 * 60 * 60);
    } catch (error) {
      // Don't log metrics errors to avoid noise
    }
  }

  /**
   * Get cache performance metrics
   */
  async getMetrics(): Promise<CacheMetrics> {
    try {
      const redis = RedisClient.getInstance();
      const metrics = await redis.hmget(this.METRICS_KEY, 'hits', 'misses', 'errors', 'lastUpdated');
      
      return {
        hits: parseInt(metrics[0] || '0'),
        misses: parseInt(metrics[1] || '0'),
        errors: parseInt(metrics[2] || '0'),
        lastUpdated: parseInt(metrics[3] || '0')
      };
    } catch (error) {
      return { hits: 0, misses: 0, errors: 0, lastUpdated: 0 };
    }
  }

  /**
   * Reset cache metrics
   */
  async resetMetrics(): Promise<void> {
    try {
      const redis = RedisClient.getInstance();
      await redis.del(this.METRICS_KEY);
    } catch (error) {
      logger.error('Error resetting domain cache metrics', error as Error, {
        operation: 'domain_cache'
      });
    }
  }
}

// Export singleton instance
export const domainCache = new DomainCacheService();
export type { DomainCacheData, CacheMetrics };
