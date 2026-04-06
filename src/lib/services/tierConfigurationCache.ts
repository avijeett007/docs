import { MarketingTier, TierLimits, TIER_CONFIGURATIONS } from './tierValidationService';

/**
 * In-memory cache for tier configurations to avoid repeated database lookups
 * In production, this could be replaced with Redis or another caching solution
 */
class TierConfigurationCache {
  private cache = new Map<string, { data: TierLimits; timestamp: number }>();
  private readonly TTL = 5 * 60 * 1000; // 5 minutes cache TTL
  private readonly PARTNER_CACHE_PREFIX = 'partner:';
  private readonly TIER_CACHE_PREFIX = 'tier:';

  /**
   * Get tier configuration for a specific partner
   * This caches the partner's custom limits if they have any
   */
  async getPartnerTierLimits(partnerId: string): Promise<TierLimits | null> {
    const cacheKey = `${this.PARTNER_CACHE_PREFIX}${partnerId}`;
    const cached = this.cache.get(cacheKey);

    // Return cached data if still valid
    if (cached && Date.now() - cached.timestamp < this.TTL) {
      return cached.data;
    }

    // Cache miss - would need to fetch from database
    // For now, return null to indicate cache miss
    return null;
  }

  /**
   * Cache partner-specific tier limits
   */
  setPartnerTierLimits(partnerId: string, limits: TierLimits): void {
    const cacheKey = `${this.PARTNER_CACHE_PREFIX}${partnerId}`;
    this.cache.set(cacheKey, {
      data: limits,
      timestamp: Date.now(),
    });
  }

  /**
   * Get standard tier configuration
   * This caches the default tier configurations
   */
  getTierConfiguration(tier: MarketingTier): TierLimits {
    const cacheKey = `${this.TIER_CACHE_PREFIX}${tier}`;
    const cached = this.cache.get(cacheKey);

    // Return cached data if still valid
    if (cached && Date.now() - cached.timestamp < this.TTL) {
      return cached.data;
    }

    // Get from static configuration and cache it
    const config = TIER_CONFIGURATIONS[tier];
    if (config) {
      this.cache.set(cacheKey, {
        data: config,
        timestamp: Date.now(),
      });
    }

    return config;
  }

  /**
   * Invalidate cache for a specific partner
   */
  invalidatePartner(partnerId: string): void {
    const cacheKey = `${this.PARTNER_CACHE_PREFIX}${partnerId}`;
    this.cache.delete(cacheKey);
  }

  /**
   * Invalidate cache for a specific tier
   */
  invalidateTier(tier: MarketingTier): void {
    const cacheKey = `${this.TIER_CACHE_PREFIX}${tier}`;
    this.cache.delete(cacheKey);
  }

  /**
   * Clear all cached data
   */
  clearAll(): void {
    this.cache.clear();
  }

  /**
   * Clean up expired cache entries
   */
  cleanup(): void {
    const now = Date.now();
    for (const [key, value] of this.cache.entries()) {
      if (now - value.timestamp >= this.TTL) {
        this.cache.delete(key);
      }
    }
  }

  /**
   * Get cache statistics
   */
  getStats(): {
    size: number;
    partnerEntries: number;
    tierEntries: number;
    oldestEntry: number | null;
    newestEntry: number | null;
  } {
    let partnerEntries = 0;
    let tierEntries = 0;
    let oldestTimestamp: number | null = null;
    let newestTimestamp: number | null = null;

    for (const [key, value] of this.cache.entries()) {
      if (key.startsWith(this.PARTNER_CACHE_PREFIX)) {
        partnerEntries++;
      } else if (key.startsWith(this.TIER_CACHE_PREFIX)) {
        tierEntries++;
      }

      if (oldestTimestamp === null || value.timestamp < oldestTimestamp) {
        oldestTimestamp = value.timestamp;
      }
      if (newestTimestamp === null || value.timestamp > newestTimestamp) {
        newestTimestamp = value.timestamp;
      }
    }

    return {
      size: this.cache.size,
      partnerEntries,
      tierEntries,
      oldestEntry: oldestTimestamp,
      newestEntry: newestTimestamp,
    };
  }
}

// Singleton instance
export const tierConfigurationCache = new TierConfigurationCache();

// Set up periodic cleanup (every 10 minutes)
if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    tierConfigurationCache.cleanup();
  }, 10 * 60 * 1000);
}

/**
 * Enhanced tier validation service with caching
 */
export class CachedTierValidationService {
  /**
   * Get tier limits for a partner with caching
   */
  static async getPartnerTierLimits(partnerId: string, tier: MarketingTier): Promise<TierLimits> {
    // Try to get from cache first
    const cached = await tierConfigurationCache.getPartnerTierLimits(partnerId);
    if (cached) {
      return cached;
    }

    // Fallback to standard tier configuration
    const tierConfig = tierConfigurationCache.getTierConfiguration(tier);
    
    // Cache the result for future use
    tierConfigurationCache.setPartnerTierLimits(partnerId, tierConfig);
    
    return tierConfig;
  }

  /**
   * Update partner tier limits and invalidate cache
   */
  static async updatePartnerTierLimits(partnerId: string, limits: TierLimits): Promise<void> {
    // Update cache
    tierConfigurationCache.setPartnerTierLimits(partnerId, limits);
    
    // In a real implementation, you would also update the database here
    // await prisma.partner.update({ where: { id: partnerId }, data: limits });
  }

  /**
   * Invalidate cache when partner data changes
   */
  static invalidatePartnerCache(partnerId: string): void {
    tierConfigurationCache.invalidatePartner(partnerId);
  }
}

export default tierConfigurationCache;
