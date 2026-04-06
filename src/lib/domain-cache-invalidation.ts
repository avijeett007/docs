import { domainCache } from './domain-cache';
import { logger } from './logger';

interface DomainChanges {
  subdomain?: { old?: string; new?: string };
  customDomain?: { old?: string; new?: string };
  branding?: boolean; // Any branding changes
  approval?: boolean; // Approval status changes
}

/**
 * Service for managing domain cache invalidation
 */
export class DomainCacheInvalidationService {
  
  /**
   * Invalidate cache when partner settings change
   * Call this from partner settings update endpoints
   */
  static async invalidatePartnerCache(partnerId: string, changes: DomainChanges): Promise<void> {
    try {
      logger.info('Processing cache invalidation for partner', {
        operation: 'domain_cache_invalidation',
        partnerId,
        changes
      });

      // If domain fields changed, invalidate old domains
      if (changes.subdomain?.old) {
        await domainCache.invalidate(changes.subdomain.old, 'subdomain');
        logger.info('Invalidated old subdomain', {
          operation: 'domain_cache_invalidation',
          subdomain: changes.subdomain.old
        });
      }
      
      if (changes.customDomain?.old) {
        await domainCache.invalidate(changes.customDomain.old, 'customDomain');
        logger.info('Invalidated old custom domain', {
          operation: 'domain_cache_invalidation',
          customDomain: changes.customDomain.old
        });
      }

      // If branding changed or approval status changed, invalidate all partner cache
      if (changes.branding || changes.approval) {
        await domainCache.invalidatePartner(partnerId);
        logger.info('Invalidated all cache entries for partner', {
          operation: 'domain_cache_invalidation',
          partnerId
        });
      }

      logger.info('Successfully processed cache invalidation for partner', {
        operation: 'domain_cache_invalidation',
        partnerId
      });
    } catch (error) {
      logger.error('Error invalidating cache for partner', error as Error, {
        operation: 'domain_cache_invalidation',
        partnerId
      });
      // Don't throw - cache invalidation failures shouldn't break the main operation
    }
  }

  /**
   * Invalidate cache for a specific domain (useful for manual operations)
   */
  static async invalidateDomain(domain: string, type?: 'subdomain' | 'customDomain'): Promise<void> {
    try {
      await domainCache.invalidate(domain, type);
      logger.info('Manually invalidated domain', {
        operation: 'domain_cache_invalidation',
        domain,
        type: type || 'both'
      });
    } catch (error) {
      logger.error('Error manually invalidating domain', error as Error, {
        operation: 'domain_cache_invalidation',
        domain
      });
    }
  }

  /**
   * Invalidate all cache entries for a partner (useful for manual operations)
   */
  static async invalidatePartner(partnerId: string): Promise<void> {
    try {
      await domainCache.invalidatePartner(partnerId);
      logger.info('Manually invalidated all cache for partner', {
        operation: 'domain_cache_invalidation',
        partnerId
      });
    } catch (error) {
      logger.error('Error manually invalidating partner', error as Error, {
        operation: 'domain_cache_invalidation',
        partnerId
      });
    }
  }

  /**
   * Warm up cache for a partner's domains
   * Useful after cache invalidation to pre-populate cache
   */
  static async warmUpPartnerCache(partnerId: string, subdomain?: string, customDomain?: string): Promise<void> {
    try {
      logger.info('Warming up cache for partner', {
        operation: 'domain_cache_invalidation',
        partnerId
      });

      // Trigger cache population by making requests to the branding endpoints
      const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000';
      
      const requests: Promise<any>[] = [];

      if (subdomain) {
        requests.push(
          fetch(`${baseUrl}/api/whitelabel/branding/${subdomain}`)
            .then(res => res.json())
            .catch(err => logger.warn('Failed to warm up subdomain cache', {
              operation: 'domain_cache_invalidation',
              error: err.message
            }))
        );
      }

      if (customDomain) {
        requests.push(
          fetch(`${baseUrl}/api/whitelabel/branding/domain/${encodeURIComponent(customDomain)}`)
            .then(res => res.json())
            .catch(err => logger.warn('Failed to warm up custom domain cache', {
              operation: 'domain_cache_invalidation',
              error: err.message
            }))
        );
      }

      if (requests.length > 0) {
        await Promise.allSettled(requests);
        logger.info('Cache warm-up completed for partner', {
          operation: 'domain_cache_invalidation',
          partnerId
        });
      }
    } catch (error) {
      logger.error('Error warming up cache for partner', error as Error, {
        operation: 'domain_cache_invalidation',
        partnerId
      });
    }
  }

  /**
   * Get cache statistics for monitoring
   */
  static async getCacheStats() {
    try {
      return await domainCache.getMetrics();
    } catch (error) {
      logger.error('Error getting cache stats', error as Error, {
        operation: 'domain_cache_invalidation'
      });
      return { hits: 0, misses: 0, errors: 0, lastUpdated: 0 };
    }
  }

  /**
   * Reset cache statistics
   */
  static async resetCacheStats() {
    try {
      await domainCache.resetMetrics();
      logger.info('Cache statistics reset', {
        operation: 'domain_cache_invalidation'
      });
    } catch (error) {
      logger.error('Error resetting cache stats', error as Error, {
        operation: 'domain_cache_invalidation'
      });
    }
  }
}

export default DomainCacheInvalidationService;
