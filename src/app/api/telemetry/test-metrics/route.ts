import { NextRequest, NextResponse } from 'next/server';
import { metrics } from '@/lib/otel-metrics';

/**
 * Test endpoint to verify OpenTelemetry Metrics are working
 * 
 * This endpoint generates various metrics and sends them to Signoz
 */
export async function GET(_request: NextRequest) {
  console.log('\n📊 [Test Metrics] Endpoint called');
  
  try {
    const startTime = Date.now();

    // Test HTTP request metrics
    metrics.recordHttpRequest('GET', '/api/test', 200, 150);
    metrics.recordHttpRequest('POST', '/api/users', 201, 250);
    metrics.recordHttpRequest('GET', '/api/orders', 500, 1200);
    console.log('✅ [Test Metrics] Recorded 3 HTTP request metrics');

    // Test active users metrics
    metrics.incrementActiveUsers(5);
    console.log('✅ [Test Metrics] Incremented active users by 5');

    // Test API call metrics
    metrics.recordApiCall('/v1/agents', 'retell', true);
    metrics.recordApiCall('/v1/voices', 'elevenlabs', true);
    metrics.recordApiCall('/v1/calls', 'vapi', false);
    console.log('✅ [Test Metrics] Recorded 3 API call metrics');

    // Test error metrics
    metrics.recordError('ValidationError', 'Invalid input data', {
      field: 'email',
      value: 'invalid',
    });
    metrics.recordError('DatabaseError', 'Connection timeout', {
      database: 'postgres',
      timeout: 5000,
    });
    console.log('✅ [Test Metrics] Recorded 2 error metrics');

    // Test database query metrics
    metrics.recordDbQuery('SELECT', 'users', 45, true);
    metrics.recordDbQuery('INSERT', 'orders', 120, true);
    metrics.recordDbQuery('UPDATE', 'customers', 2500, false);
    console.log('✅ [Test Metrics] Recorded 3 database query metrics');

    // Test cache metrics
    metrics.recordCacheHit('user:123');
    metrics.recordCacheHit('session:abc');
    metrics.recordCacheMiss('product:456');
    console.log('✅ [Test Metrics] Recorded 3 cache metrics (2 hits, 1 miss)');

    const duration = Date.now() - startTime;

    return NextResponse.json({
      success: true,
      message: 'Test metrics generated successfully',
      metrics: {
        httpRequests: 3,
        activeUsers: '+5',
        apiCalls: 3,
        errors: 2,
        dbQueries: 3,
        cacheHits: 2,
        cacheMisses: 1,
        total: 17,
      },
      duration: `${duration}ms`,
      instructions: [
        '1. Metrics have been recorded',
        '2. Wait 30 seconds for metrics to be exported to Signoz',
        '3. Go to Signoz dashboard → Metrics',
        '4. Look for these metrics:',
        '   - http.requests (counter)',
        '   - http.request.duration (histogram)',
        '   - active.users (gauge)',
        '   - api.calls (counter)',
        '   - errors (counter)',
        '   - db.query.duration (histogram)',
        '   - cache.hits (counter)',
        '   - cache.misses (counter)',
        '5. You can create dashboards and alerts based on these metrics',
      ],
    });
  } catch (error) {
    console.error('❌ [Test Metrics] Failed to generate metrics:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 });
  }
}

