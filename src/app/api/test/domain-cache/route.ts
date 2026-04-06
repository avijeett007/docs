import { NextRequest, NextResponse } from 'next/server';
import { domainCache } from '@/lib/domain-cache';
import RedisClient from '@/lib/redis-client';

export const dynamic = 'force-dynamic';

/**
 * Test endpoint for domain cache functionality
 * GET /api/test/domain-cache - Test cache operations
 */
export async function GET(_request: NextRequest) {
  // Only allow in development
  if (process.env.NODE_ENV !== 'development') {
    return NextResponse.json({ error: 'Not available in production' }, { status: 404 });
  }

  try {
    const testResults = {
      redis: {
        connected: false,
        error: null as string | null
      },
      cache: {
        setTest: false,
        getTest: false,
        metricsTest: false,
        error: null as string | null
      }
    };

    // Test Redis connection
    try {
      testResults.redis.connected = await RedisClient.healthCheck();
    } catch (error) {
      testResults.redis.error = error instanceof Error ? error.message : 'Unknown error';
    }

    // Test cache operations
    try {
      const testDomain = 'test-domain.example.com';
      const testData = {
        partnerId: 'test-partner-123',
        branding: {
          businessName: 'Test Business',
          primaryColor: '#3B82F6',
          logo: null
        },
        type: 'customDomain' as const,
        cachedAt: Date.now(),
        isApproved: true
      };

      // Test SET operation
      await domainCache.set(testDomain, 'customDomain', testData);
      testResults.cache.setTest = true;

      // Test GET operation
      const retrieved = await domainCache.get(testDomain, 'customDomain');
      testResults.cache.getTest = retrieved !== null && retrieved.partnerId === testData.partnerId;

      // Test metrics
      const metrics = await domainCache.getMetrics();
      testResults.cache.metricsTest = typeof metrics.hits === 'number';

      // Clean up test data
      await domainCache.invalidate(testDomain, 'customDomain');

    } catch (error) {
      testResults.cache.error = error instanceof Error ? error.message : 'Unknown error';
    }

    return NextResponse.json({
      success: true,
      message: 'Domain cache test completed',
      results: testResults,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}

/**
 * POST /api/test/domain-cache - Perform specific cache tests
 */
export async function POST(_request: NextRequest) {
  // Only allow in development
  if (process.env.NODE_ENV !== 'development') {
    return NextResponse.json({ error: 'Not available in production' }, { status: 404 });
  }

  try {
    const body = await _request.json();
    const { action, domain, partnerId } = body;

    switch (action) {
      case 'populate_test_cache':
        // Populate cache with test data
        const testData = {
          partnerId: partnerId || 'test-partner-123',
          branding: {
            businessName: 'Test Business',
            primaryColor: '#3B82F6',
            secondaryColor: '#10B981',
            logo: null,
            portalTitle: 'Test Portal'
          },
          type: 'subdomain' as const,
          cachedAt: Date.now(),
          isApproved: true
        };

        await domainCache.set(domain || 'test-subdomain', 'subdomain', testData);
        
        return NextResponse.json({
          success: true,
          message: `Test cache populated for domain: ${domain || 'test-subdomain'}`,
          data: testData
        });

      case 'check_cache':
        const cached = await domainCache.get(domain || 'test-subdomain', 'subdomain');
        
        return NextResponse.json({
          success: true,
          message: `Cache check for domain: ${domain || 'test-subdomain'}`,
          cached: cached !== null,
          data: cached
        });

      case 'clear_test_cache':
        await domainCache.invalidate(domain || 'test-subdomain', 'subdomain');
        
        return NextResponse.json({
          success: true,
          message: `Test cache cleared for domain: ${domain || 'test-subdomain'}`
        });

      case 'get_metrics':
        const metrics = await domainCache.getMetrics();
        
        return NextResponse.json({
          success: true,
          message: 'Cache metrics retrieved',
          metrics
        });

      default:
        return NextResponse.json({
          success: false,
          error: `Unknown action: ${action}. Supported: populate_test_cache, check_cache, clear_test_cache, get_metrics`
        }, { status: 400 });
    }

  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}
