import { NextRequest, NextResponse } from 'next/server';
import { trace, context } from '@opentelemetry/api';
import { initializeOpenTelemetry, isOpenTelemetryInitialized, getOpenTelemetryConfig } from '@/lib/otel-init';

/**
 * Test endpoint to verify OpenTelemetry is actually working
 * This will show us if traces are being created
 */
export async function GET(_request: NextRequest) {
  console.log('\n🔍 [Test Trace] Endpoint called');

  // Force initialization if not already done
  console.log('🔍 [Test Trace] Checking initialization status...');
  const wasInitialized = isOpenTelemetryInitialized();
  console.log('🔍 [Test Trace] Was initialized:', wasInitialized);

  if (!wasInitialized) {
    console.log('⚠️  [Test Trace] Not initialized, forcing initialization...');
    initializeOpenTelemetry();
  }

  // Get config for debugging
  const config = getOpenTelemetryConfig();
  console.log('🔍 [Test Trace] Config:', config);

  // Check if OpenTelemetry is initialized
  const tracer = trace.getTracer('test-trace');
  console.log('🔍 [Test Trace] Tracer obtained:', !!tracer);
  
  // Get active span
  const activeSpan = trace.getActiveSpan();
  console.log('🔍 [Test Trace] Active span exists:', !!activeSpan);
  
  if (activeSpan) {
    console.log('✅ [Test Trace] Active span found!');
    console.log('   Span ID:', activeSpan.spanContext().spanId);
    console.log('   Trace ID:', activeSpan.spanContext().traceId);
    console.log('   Trace Flags:', activeSpan.spanContext().traceFlags);
    
    // Add some attributes
    activeSpan.setAttribute('test.endpoint', 'test-trace');
    activeSpan.setAttribute('test.timestamp', new Date().toISOString());
    activeSpan.addEvent('test_event', { message: 'This is a test event' });
    
    console.log('✅ [Test Trace] Added attributes and event to span');
  } else {
    console.log('❌ [Test Trace] No active span - OpenTelemetry might not be initialized');
  }
  
  // Try to create a manual span
  try {
    const span = tracer.startSpan('manual-test-span');
    console.log('✅ [Test Trace] Manual span created');
    console.log('   Span ID:', span.spanContext().spanId);
    
    span.setAttribute('manual.test', true);
    span.addEvent('manual_span_event');
    
    // Simulate some work
    await new Promise(resolve => setTimeout(resolve, 100));
    
    span.end();
    console.log('✅ [Test Trace] Manual span ended');
  } catch (error) {
    console.log('❌ [Test Trace] Failed to create manual span:', error);
  }
  
  // Check context
  const currentContext = context.active();
  console.log('🔍 [Test Trace] Active context exists:', !!currentContext);
  
  return NextResponse.json({
    success: true,
    message: 'Trace test complete - check server logs',
    initialization: {
      wasInitialized,
      currentStatus: isOpenTelemetryInitialized(),
      config,
    },
    telemetry: {
      tracerAvailable: !!tracer,
      activeSpanExists: !!activeSpan,
      activeContextExists: !!currentContext,
      spanDetails: activeSpan ? {
        spanId: activeSpan.spanContext().spanId,
        traceId: activeSpan.spanContext().traceId,
        traceFlags: activeSpan.spanContext().traceFlags,
      } : null,
    },
    instructions: [
      '1. Check the server console logs above',
      '2. Look for "Active span found" message',
      '3. Check initialization status above',
      '4. If no active span, OpenTelemetry is not initialized',
      '5. Wait 60 seconds and check Signoz dashboard',
      '6. Look for traces with traceId shown above',
    ],
  });
}

