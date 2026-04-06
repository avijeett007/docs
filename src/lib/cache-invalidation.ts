/**
 * Cache invalidation utilities for analytics service
 */

import { logger } from './logger';

/**
 * Invalidate analytics cache for a deleted agent
 * This function is called during agent deletion to ensure analytics caches are updated
 */
export async function invalidateCacheForDeletedAgent(params: {
  agentId: string;
  partnerId: string;
  customerId?: string | null;
}): Promise<{ success: boolean; error?: string }> {
  try {
    // Check if cache invalidation is enabled via feature flag
    const cacheInvalidationEnabled = process.env.ENABLE_CACHE_INVALIDATION_ON_DELETION === 'true';
    
    if (!cacheInvalidationEnabled) {
      logger.info('Cache invalidation disabled for agent deletion', {
        operation: 'cache_invalidation_agent',
        agentId: params.agentId,
        reason: 'disabled'
      });
      return { success: true }; // Return success but don't actually invalidate
    }

    const analyticsApiUrl = process.env.ANALYTICS_API_URL || 'http://localhost:8001';
    const analyticsApiKey = process.env.ANALYTICS_STANDARD_API_KEY;

    if (!analyticsApiKey) {
      logger.error('Missing ANALYTICS_STANDARD_API_KEY environment variable', new Error('Missing environment variable'), {
        operation: 'cache_invalidation_agent'
      });
      return { success: false, error: 'Analytics API key not configured' };
    }

    logger.info('Invalidating cache for deleted agent', {
      operation: 'cache_invalidation_agent',
      agentId: params.agentId
    });

    // Build query parameters
    const queryParams = new URLSearchParams({
      agent_id: params.agentId,
      partner_id: params.partnerId,
    });

    // Add customer_id if provided
    if (params.customerId) {
      queryParams.append('customer_id', params.customerId);
    }

    const response = await fetch(`${analyticsApiUrl}/v2/analytics/cache/invalidate-for-agent-deletion?${queryParams}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': analyticsApiKey
      }
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
      logger.error('Failed to invalidate cache for agent', new Error(`HTTP ${response.status}`), {
        operation: 'cache_invalidation_agent',
        agentId: params.agentId,
        httpStatus: response.status,
        errorData
      });
      return { success: false, error: `HTTP ${response.status}: ${errorData.error || 'Unknown error'}` };
    }

    const result = await response.json();
    logger.info('Successfully invalidated cache for agent', {
      operation: 'cache_invalidation_agent',
      agentId: params.agentId,
      result
    });
    
    return { success: true };
  } catch (error) {
    logger.error('Error invalidating cache for agent', error as Error, {
      operation: 'cache_invalidation_agent',
      agentId: params.agentId
    });
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

/**
 * Invalidate analytics cache for a specific entity
 * Generic function for cache invalidation
 */
export async function invalidateAnalyticsCache(params: {
  entityType: 'agent' | 'customer' | 'partner';
  entityId: string;
}): Promise<{ success: boolean; error?: string }> {
  try {
    const analyticsApiUrl = process.env.ANALYTICS_API_URL || 'http://localhost:8001';
    const analyticsApiKey = process.env.ANALYTICS_ADMIN_API_KEY;

    if (!analyticsApiKey) {
      logger.error('Missing ANALYTICS_ADMIN_API_KEY environment variable', new Error('Missing environment variable'), {
        operation: 'cache_invalidation_entity'
      });
      return { success: false, error: 'Analytics admin API key not configured' };
    }

    logger.info('Invalidating entity cache', {
      operation: 'cache_invalidation_entity',
      entityType: params.entityType,
      entityId: params.entityId
    });

    const queryParams = new URLSearchParams({
      entity_type: params.entityType,
      entity_id: params.entityId,
    });

    const response = await fetch(`${analyticsApiUrl}/v2/analytics/cache/invalidate?${queryParams}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': analyticsApiKey
      }
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
      logger.error('Failed to invalidate entity cache', new Error(`HTTP ${response.status}`), {
        operation: 'cache_invalidation_entity',
        entityType: params.entityType,
        entityId: params.entityId,
        httpStatus: response.status,
        errorData
      });
      return { success: false, error: `HTTP ${response.status}: ${errorData.error || 'Unknown error'}` };
    }

    const result = await response.json();
    logger.info('Successfully invalidated entity cache', {
      operation: 'cache_invalidation_entity',
      entityType: params.entityType,
      entityId: params.entityId,
      result
    });
    
    return { success: true };
  } catch (error) {
    logger.error('Error invalidating entity cache', error as Error, {
      operation: 'cache_invalidation_entity',
      entityType: params.entityType,
      entityId: params.entityId
    });
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}
