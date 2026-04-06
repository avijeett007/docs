import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

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
 * Test endpoint to simulate and verify auto-recovery from stale connections
 * 
 * This endpoint:
 * 1. Forces a disconnect to simulate a stale connection
 * 2. Attempts to use the connection (should trigger auto-recovery)
 * 3. Returns success/failure status
 */
export async function GET() {
  // Security check
  if (!isTestingAllowed()) {
    return getUnauthorizedResponse();
  }

  const startTime = Date.now();

  try {
    console.log('🧪 [Connection Recovery Test] Starting test...');
    
    // Force disconnect to simulate stale connection
    await prisma.$disconnect();
    console.log('🔌 [Connection Recovery Test] Forced disconnect - simulating stale connection');
    
    // Wait a moment to ensure disconnect is complete
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Try to use the connection (should trigger auto-recovery)
    console.log('🔄 [Connection Recovery Test] Attempting query on potentially stale connection...');
    const result = await prisma.$queryRaw`SELECT 1 as test, NOW() as timestamp, 'auto-recovery-test' as source`;
    
    const endTime = Date.now();
    const duration = endTime - startTime;
    
    console.log('✅ [Connection Recovery Test] Auto-recovery successful!');
    
    return NextResponse.json({
      success: true,
      message: 'Auto-recovery successful! Connection was restored automatically.',
      result,
      duration: `${duration}ms`,
      timestamp: new Date().toISOString(),
      testType: 'connection-recovery'
    });
  } catch (error) {
    const endTime = Date.now();
    const duration = endTime - startTime;
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    console.error('❌ [Connection Recovery Test] Auto-recovery failed:', errorMessage);
    
    return NextResponse.json({
      success: false,
      error: errorMessage,
      duration: `${duration}ms`,
      timestamp: new Date().toISOString(),
      testType: 'connection-recovery',
      message: 'Auto-recovery failed - this indicates an issue with the recovery mechanism'
    }, { status: 500 });
  }
}

/**
 * POST endpoint to run multiple recovery tests in sequence
 */
export async function POST() {
  // Security check
  if (!isTestingAllowed()) {
    return getUnauthorizedResponse();
  }

  const results = [];
  const testCount = 3;
  
  console.log(`🧪 [Connection Recovery Test] Running ${testCount} sequential recovery tests...`);
  
  for (let i = 1; i <= testCount; i++) {
    const testStartTime = Date.now();
    
    try {
      console.log(`🔄 [Test ${i}/${testCount}] Starting recovery test ${i}...`);
      
      // Force disconnect
      await prisma.$disconnect();
      console.log(`🔌 [Test ${i}/${testCount}] Forced disconnect`);
      
      // Wait between tests
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Attempt recovery
      const result = await prisma.$queryRaw`SELECT ${i} as test_number, NOW() as timestamp`;
      
      const testEndTime = Date.now();
      const testDuration = testEndTime - testStartTime;
      
      results.push({
        testNumber: i,
        success: true,
        duration: `${testDuration}ms`,
        result
      });
      
      console.log(`✅ [Test ${i}/${testCount}] Recovery successful in ${testDuration}ms`);
      
    } catch (error) {
      const testEndTime = Date.now();
      const testDuration = testEndTime - testStartTime;
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      results.push({
        testNumber: i,
        success: false,
        duration: `${testDuration}ms`,
        error: errorMessage
      });
      
      console.error(`❌ [Test ${i}/${testCount}] Recovery failed:`, errorMessage);
    }
  }
  
  const successCount = results.filter(r => r.success).length;
  const overallSuccess = successCount === testCount;
  
  console.log(`🏁 [Connection Recovery Test] Completed: ${successCount}/${testCount} tests passed`);
  
  return NextResponse.json({
    overallSuccess,
    successCount,
    totalTests: testCount,
    results,
    timestamp: new Date().toISOString(),
    testType: 'sequential-recovery-tests'
  }, {
    status: overallSuccess ? 200 : 500
  });
}
