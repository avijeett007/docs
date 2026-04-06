import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { checkPrismaHealth } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

// SECURITY: Only allow in development/staging environments
function isTestingAllowed(): boolean {
  const env = process.env.NODE_ENV;
  const allowTesting = process.env.ALLOW_CONNECTION_TESTING === 'true';

  // Only allow in development or when explicitly enabled
  return env === 'development' || allowTesting;
}

function getUnauthorizedResponse() {
  return NextResponse.json({
    success: false,
    error: 'Connection testing endpoints are disabled in production for security',
    environment: process.env.NODE_ENV,
  }, { status: 403 });
}

/**
 * Test endpoint to simulate connection pool exhaustion and verify singleton resilience
 * 
 * This endpoint:
 * 1. Creates multiple PrismaClient instances to exhaust the connection pool
 * 2. Tests if our singleton can still handle requests gracefully
 * 3. Cleans up the test connections
 */
export async function GET() {
  // Security check
  if (!isTestingAllowed()) {
    return getUnauthorizedResponse();
  }

  const clients: PrismaClient[] = [];
  const startTime = Date.now();

  try {
    console.log('🧪 [Pool Exhaustion Test] Starting connection pool exhaustion test...');
    
    // Create multiple clients to exhaust connection pool
    const connectionCount = 12; // Adjust based on your pool size
    
    for (let i = 0; i < connectionCount; i++) {
      console.log(`🔗 [Pool Exhaustion Test] Creating connection ${i + 1}/${connectionCount}...`);
      const client = new PrismaClient({
        log: ['error'], // Reduce log noise
      });
      clients.push(client);
      
      try {
        await client.$connect();
        await client.$queryRaw`SELECT 1`; // Ensure connection is active
      } catch (error) {
        console.log(`⚠️ [Pool Exhaustion Test] Connection ${i + 1} failed (expected):`, error);
      }
    }
    
    console.log(`🔥 [Pool Exhaustion Test] Created ${clients.length} connections - pool should be under stress`);
    
    // Now try to use our singleton (should handle gracefully)
    console.log('🔄 [Pool Exhaustion Test] Testing singleton resilience...');
    const health = await checkPrismaHealth();
    
    const endTime = Date.now();
    const duration = endTime - startTime;
    
    if (health.healthy) {
      console.log('✅ [Pool Exhaustion Test] Singleton handled pool stress successfully!');
    } else {
      console.log('⚠️ [Pool Exhaustion Test] Singleton struggled with pool stress:', health.error);
    }
    
    return NextResponse.json({
      success: health.healthy,
      message: health.healthy 
        ? 'Singleton handled connection pool stress successfully!' 
        : 'Singleton struggled with pool stress but recovered',
      error: health.error,
      connectionsCreated: clients.length,
      duration: `${duration}ms`,
      timestamp: new Date().toISOString(),
      testType: 'pool-exhaustion'
    }, {
      status: health.healthy ? 200 : 500
    });
    
  } catch (error) {
    const endTime = Date.now();
    const duration = endTime - startTime;
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    console.error('❌ [Pool Exhaustion Test] Test failed:', errorMessage);
    
    return NextResponse.json({
      success: false,
      error: errorMessage,
      connectionsCreated: clients.length,
      duration: `${duration}ms`,
      timestamp: new Date().toISOString(),
      testType: 'pool-exhaustion'
    }, { status: 500 });
    
  } finally {
    // Clean up all test connections
    console.log('🧹 [Pool Exhaustion Test] Cleaning up test connections...');
    
    for (let i = 0; i < clients.length; i++) {
      try {
        await clients[i].$disconnect();
        console.log(`🔌 [Pool Exhaustion Test] Disconnected client ${i + 1}/${clients.length}`);
      } catch (error) {
        console.log(`⚠️ [Pool Exhaustion Test] Cleanup error for client ${i + 1}:`, error);
      }
    }
    
    console.log('✅ [Pool Exhaustion Test] Cleanup completed');
  }
}

/**
 * POST endpoint for stress testing with concurrent connections
 */
export async function POST() {
  // Security check
  if (!isTestingAllowed()) {
    return getUnauthorizedResponse();
  }

  const startTime = Date.now();

  try {
    console.log('🧪 [Pool Stress Test] Starting concurrent connection stress test...');
    
    // Create multiple concurrent connection attempts
    const concurrentTests = 8;
    const promises = [];
    
    for (let i = 0; i < concurrentTests; i++) {
      promises.push(
        (async (testId: number) => {
          const client = new PrismaClient({ log: ['error'] });
          try {
            await client.$connect();
            const result = await client.$queryRaw`SELECT ${testId} as test_id, NOW() as timestamp`;
            await client.$disconnect();
            return { testId, success: true, result };
          } catch (error) {
            await client.$disconnect();
            return { 
              testId, 
              success: false, 
              error: error instanceof Error ? error.message : 'Unknown error' 
            };
          }
        })(i + 1)
      );
    }
    
    // Wait for all concurrent tests
    const results = await Promise.all(promises);
    
    // Test singleton during stress
    const singletonHealth = await checkPrismaHealth();
    
    const endTime = Date.now();
    const duration = endTime - startTime;
    
    const successCount = results.filter(r => r.success).length;
    const overallSuccess = singletonHealth.healthy && successCount > 0;
    
    console.log(`🏁 [Pool Stress Test] Completed: ${successCount}/${concurrentTests} concurrent tests passed, singleton: ${singletonHealth.healthy ? 'healthy' : 'unhealthy'}`);
    
    return NextResponse.json({
      overallSuccess,
      singletonHealthy: singletonHealth.healthy,
      singletonError: singletonHealth.error,
      concurrentResults: results,
      successCount,
      totalTests: concurrentTests,
      duration: `${duration}ms`,
      timestamp: new Date().toISOString(),
      testType: 'concurrent-stress-test'
    }, {
      status: overallSuccess ? 200 : 500
    });
    
  } catch (error) {
    const endTime = Date.now();
    const duration = endTime - startTime;
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    console.error('❌ [Pool Stress Test] Test failed:', errorMessage);
    
    return NextResponse.json({
      success: false,
      error: errorMessage,
      duration: `${duration}ms`,
      timestamp: new Date().toISOString(),
      testType: 'concurrent-stress-test'
    }, { status: 500 });
  }
}
