/**
 * OpenTelemetry Initialization Module
 * 
 * This module initializes OpenTelemetry for Signoz tracing.
 * It auto-initializes when imported (server-side only).
 * 
 * This approach is more reliable than using the Next.js instrumentation hook,
 * which has known issues in development mode and with standalone builds.
 */

// Only import OpenTelemetry modules in Node.js runtime (not Edge runtime)
let registerOTel: any;
let OTLPHttpJsonTraceExporter: any;
let diag: any;
let DiagConsoleLogger: any;
let DiagLogLevel: any;

// Check if we're in Edge Runtime
const isEdgeRuntime = process.env.NEXT_RUNTIME === 'edge';

if (!isEdgeRuntime) {
  try {
    const otelModule = require('@vercel/otel');
    const apiModule = require('@opentelemetry/api');

    registerOTel = otelModule.registerOTel;
    OTLPHttpJsonTraceExporter = otelModule.OTLPHttpJsonTraceExporter;
    diag = apiModule.diag;
    DiagConsoleLogger = apiModule.DiagConsoleLogger;
    DiagLogLevel = apiModule.DiagLogLevel;
  } catch (error) {
    console.warn('⚠️  [OpenTelemetry] Failed to load modules:', error);
  }
}

let initialized = false;

/**
 * Initialize OpenTelemetry with Signoz
 * This function is idempotent - it will only initialize once
 */
export function initializeOpenTelemetry() {
  // Only initialize once
  if (initialized) {
    console.log('⚠️  [OpenTelemetry] Already initialized, skipping');
    return;
  }

  // Only run on server-side
  if (typeof window !== 'undefined') {
    console.log('⚠️  [OpenTelemetry] Skipping browser initialization');
    return;
  }

  // Skip in Edge Runtime
  if (isEdgeRuntime) {
    console.log('⚠️  [OpenTelemetry] Skipping Edge Runtime initialization');
    return;
  }

  // Check if modules are loaded
  if (!registerOTel || !OTLPHttpJsonTraceExporter || !diag) {
    console.log('⚠️  [OpenTelemetry] Modules not loaded, skipping initialization');
    return;
  }

  // Check if enabled
  if (process.env.NEXT_PUBLIC_SIGNOZ_ENABLED !== 'true') {
    console.log('⚠️  [OpenTelemetry] Disabled (NEXT_PUBLIC_SIGNOZ_ENABLED != true)');
    return;
  }

  // Validate configuration
  if (!process.env.SIGNOZ_ENDPOINT || !process.env.SIGNOZ_INGESTION_KEY) {
    console.warn('⚠️  [OpenTelemetry] Missing configuration');
    console.warn('    Required: SIGNOZ_ENDPOINT and SIGNOZ_INGESTION_KEY');
    return;
  }

  try {
    console.log('🔧 [OpenTelemetry] Initializing...');
    console.log('   Service:', process.env.SIGNOZ_SERVICE_NAME || 'knotie-ai-pro');
    console.log('   Environment:', process.env.NODE_ENV || 'development');
    console.log('   Endpoint:', process.env.SIGNOZ_ENDPOINT);
    
    // Set diagnostic logging level
    // Use DEBUG in development for troubleshooting
    const isDev = process.env.NODE_ENV === 'development';
    const diagLevel = isDev ? DiagLogLevel.DEBUG : DiagLogLevel.ERROR;
    diag.setLogger(new DiagConsoleLogger(), diagLevel);
    console.log('   Diagnostic level:', isDev ? 'DEBUG' : 'ERROR');

    // Determine service name based on environment
    const serviceName = process.env.SIGNOZ_SERVICE_NAME ||
      (process.env.NODE_ENV === 'production' ? 'knotie-ai-pro-app-prod' : 'knotie-ai-pro-dev');

    // Register OpenTelemetry with Signoz
    registerOTel({
      serviceName,
      traceExporter: new OTLPHttpJsonTraceExporter({
        url: process.env.SIGNOZ_ENDPOINT,
        headers: {
          'signoz-ingestion-key': process.env.SIGNOZ_INGESTION_KEY,
        },
      }),
      // Additional attributes for better trace identification
      attributes: {
        'service.name': serviceName,
        'service.version': process.env.APP_VERSION || 'unknown',
        'deployment.environment': process.env.NODE_ENV || 'development',
        'service.namespace': 'knotie-ai',
      },
    });

    initialized = true;
    console.log('✅ [OpenTelemetry] Initialized successfully!');
    console.log('   🎯 Traces will be sent to Signoz every 30 seconds');
    console.log('   📊 Check dashboard: https://signoz.io');
  } catch (error) {
    console.error('❌ [OpenTelemetry] Initialization failed:', error);
    if (error instanceof Error) {
      console.error('   Error:', error.message);
      console.error('   Stack:', error.stack);
    }
    // Don't throw - we don't want telemetry failures to break the app
  }
}

/**
 * Get initialization status
 */
export function isOpenTelemetryInitialized(): boolean {
  return initialized;
}

/**
 * Get configuration (for debugging)
 */
export function getOpenTelemetryConfig() {
  const serviceName = process.env.SIGNOZ_SERVICE_NAME ||
    (process.env.NODE_ENV === 'production' ? 'knotie-ai-pro-app-prod' : 'knotie-ai-pro-dev');

  return {
    initialized,
    enabled: process.env.NEXT_PUBLIC_SIGNOZ_ENABLED === 'true',
    serviceName,
    environment: process.env.NODE_ENV || 'development',
    endpoint: process.env.SIGNOZ_ENDPOINT || 'not configured',
    hasIngestionKey: !!process.env.SIGNOZ_INGESTION_KEY,
  };
}

// Auto-initialize on import (server-side only, not Edge runtime)
if (typeof window === 'undefined' && !isEdgeRuntime) {
  console.log('📦 [OpenTelemetry] Module loaded, initializing...');
  initializeOpenTelemetry();

  // Initialize metrics only in Node.js runtime (not Edge runtime)
  // Edge runtime doesn't support dynamic code evaluation used by metrics exporter
  // Use dynamic import to avoid webpack bundling issues in Edge Runtime
  initializeMetricsAsync();

  // Note: Logs are handled by the integrated logger.ts which uses console + custom logic
  // The otel-logger.ts module has version conflicts with Sentry/Vercel packages
} else if (isEdgeRuntime) {
  console.log('⚠️  [OpenTelemetry] Skipping initialization in Edge runtime');
}

/**
 * Initialize metrics asynchronously
 * This function initializes the otel-metrics module only in Node.js runtime
 */
async function initializeMetricsAsync() {
  // Skip if in Edge Runtime - this check is also done inside otel-metrics
  // but we add it here to avoid any import issues
  if (isEdgeRuntime) {
    console.log('⚠️  [OpenTelemetry] Skipping metrics initialization in Edge Runtime');
    return;
  }

  try {
    // Use regular dynamic import - webpack will bundle this correctly
    // The otel-metrics module has its own Edge Runtime guards
    const { initializeMetrics } = await import('./otel-metrics');
    await initializeMetrics();
  } catch (error) {
    console.error('❌ [OpenTelemetry] Failed to initialize metrics:', error);
  }
}