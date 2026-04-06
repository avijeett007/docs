import { NextRequest, NextResponse } from 'next/server';
import { DomainCacheInvalidationService } from '@/lib/domain-cache-invalidation';
import RedisClient from '@/lib/redis-client';

export const dynamic = 'force-dynamic';

/**
 * Security check for monitoring endpoints (consistent with database monitoring)
 */
function isMonitoringAllowed(request: NextRequest): boolean {
  const authHeader = request.headers.get('authorization');
  const apiKey = request.headers.get('x-api-key');
  const monitoringKey = process.env.MONITORING_API_KEY;

  // Allow in development without auth
  if (process.env.NODE_ENV === 'development') {
    return true;
  }

  // Require API key in production
  if (!monitoringKey) {
    console.warn('⚠️ MONITORING_API_KEY not set - monitoring endpoints disabled');
    return false;
  }

  // Check API key in header
  if (apiKey === monitoringKey) {
    return true;
  }

  // Check Bearer token
  if (authHeader?.startsWith('Bearer ') && authHeader.slice(7) === monitoringKey) {
    return true;
  }

  return false;
}

function getUnauthorizedResponse() {
  return NextResponse.json({
    success: false,
    error: 'Unauthorized - monitoring endpoints require valid API key',
    environment: process.env.NODE_ENV,
  }, { status: 401 });
}

/**
 * GET /api/monitoring/domain-cache
 * 
 * Returns domain cache performance metrics
 */
export async function GET(request: NextRequest) {
  if (!isMonitoringAllowed(request)) {
    return getUnauthorizedResponse();
  }

  try {
    const [cacheStats, redisHealth] = await Promise.all([
      DomainCacheInvalidationService.getCacheStats(),
      RedisClient.healthCheck()
    ]);

    const totalRequests = cacheStats.hits + cacheStats.misses;
    const hitRate = totalRequests > 0 ? ((cacheStats.hits / totalRequests) * 100).toFixed(2) : '0.00';

    return NextResponse.json({
      success: true,
      data: {
        cache: {
          hits: cacheStats.hits,
          misses: cacheStats.misses,
          errors: cacheStats.errors,
          totalRequests,
          hitRate: `${hitRate}%`,
          lastUpdated: new Date(cacheStats.lastUpdated).toISOString()
        },
        redis: {
          connected: redisHealth,
          url: process.env.REDIS_URL ? 'configured' : 'not configured'
        },
        performance: {
          estimatedSavings: {
            databaseQueries: cacheStats.hits,
            responseTimeImprovement: `~${(cacheStats.hits * 40).toFixed(0)}ms saved` // Assuming 40ms per DB query
          }
        }
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('[DomainCacheMonitoring] Error getting cache stats:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}

/**
 * POST /api/monitoring/domain-cache
 * 
 * Perform cache management operations:
 * - action: "reset_stats" - Reset cache statistics
 * - action: "invalidate_domain" - Invalidate specific domain
 * - action: "invalidate_partner" - Invalidate all cache for a partner
 * - action: "warm_up" - Warm up cache for a partner
 */
export async function POST(request: NextRequest) {
  if (!isMonitoringAllowed(request)) {
    return getUnauthorizedResponse();
  }

  try {
    const body = await request.json();
    const { action, domain, partnerId, subdomain, customDomain } = body;

    switch (action) {
      case 'reset_stats':
        await DomainCacheInvalidationService.resetCacheStats();
        return NextResponse.json({
          success: true,
          action: 'reset_stats',
          message: 'Cache statistics have been reset',
          timestamp: new Date().toISOString()
        });

      case 'invalidate_domain':
        if (!domain) {
          return NextResponse.json({
            success: false,
            error: 'Domain parameter is required for invalidate_domain action'
          }, { status: 400 });
        }
        await DomainCacheInvalidationService.invalidateDomain(domain);
        return NextResponse.json({
          success: true,
          action: 'invalidate_domain',
          domain,
          message: `Cache invalidated for domain: ${domain}`,
          timestamp: new Date().toISOString()
        });

      case 'invalidate_partner':
        if (!partnerId) {
          return NextResponse.json({
            success: false,
            error: 'partnerId parameter is required for invalidate_partner action'
          }, { status: 400 });
        }
        await DomainCacheInvalidationService.invalidatePartner(partnerId);
        return NextResponse.json({
          success: true,
          action: 'invalidate_partner',
          partnerId,
          message: `All cache invalidated for partner: ${partnerId}`,
          timestamp: new Date().toISOString()
        });

      case 'warm_up':
        if (!partnerId) {
          return NextResponse.json({
            success: false,
            error: 'partnerId parameter is required for warm_up action'
          }, { status: 400 });
        }
        await DomainCacheInvalidationService.warmUpPartnerCache(partnerId, subdomain, customDomain);
        return NextResponse.json({
          success: true,
          action: 'warm_up',
          partnerId,
          message: `Cache warmed up for partner: ${partnerId}`,
          timestamp: new Date().toISOString()
        });

      default:
        return NextResponse.json({
          success: false,
          error: `Unknown action: ${action}. Supported actions: reset_stats, invalidate_domain, invalidate_partner, warm_up`
        }, { status: 400 });
    }
  } catch (error) {
    console.error('[DomainCacheMonitoring] Error processing cache action:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}
