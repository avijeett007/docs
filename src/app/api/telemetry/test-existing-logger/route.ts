import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/logger';

/**
 * Test endpoint to verify existing logger.ts now sends logs to Signoz
 * 
 * This tests that the integrated OpenTelemetry logging works
 * with the existing logger that API routes already use
 */
export async function GET(_request: NextRequest) {
  console.log('\n📝 [Test Existing Logger] Endpoint called');
  
  try {
    // Use the existing logger that API routes already use
    logger.debug('Debug log from existing logger', {
      test: true,
      endpoint: '/api/telemetry/test-existing-logger',
      timestamp: Date.now(),
    });

    logger.info('Info log from existing logger', {
      test: true,
      userId: 'test-user-456',
      action: 'test-existing-logger',
      partnerId: 'partner-123',
    });

    logger.warn('Warning log from existing logger', {
      test: true,
      warningType: 'test-warning',
      customerId: 'customer-789',
    });

    // Test error log with error object
    const testError = new Error('Test error from existing logger');
    logger.error('Error log from existing logger', testError, {
      test: true,
      errorCode: 'TEST_ERROR',
      operation: 'test-operation',
    });

    console.log('✅ [Test Existing Logger] Generated 4 test logs using existing logger');

    return NextResponse.json({
      success: true,
      message: 'Test logs generated successfully using existing logger.ts',
      logs: {
        debug: 1,
        info: 1,
        warn: 1,
        error: 1,
        total: 4,
      },
      integration: {
        logger: 'src/lib/logger.ts',
        opentelemetry: 'integrated',
        dualOutput: true,
      },
      instructions: [
        '1. Logs have been sent to BOTH console AND Signoz',
        '2. Wait 5-10 seconds for logs to be exported to Signoz',
        '3. Go to Signoz dashboard → Logs',
        '4. Filter by service: knotie-ai-pro-dev',
        '5. You should see 4 log entries from the existing logger',
        '6. Logs are automatically correlated with traces (check trace_id field)',
        '7. All existing API routes using logger.ts now send logs to Signoz!',
      ],
    });
  } catch (error) {
    console.error('❌ [Test Existing Logger] Failed to generate logs:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 });
  }
}

