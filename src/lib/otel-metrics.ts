/**
 * OpenTelemetry Metrics for Signoz
 *
 * Provides custom metrics that are sent to Signoz.
 * Includes counters, gauges, and histograms.
 *
 * Usage:
 *   import { metrics } from '@/lib/otel-metrics';
 *   metrics.httpRequests.add(1, { method: 'GET', path: '/api/users' });
 *   metrics.activeUsers.add(1);
 *   metrics.requestDuration.record(150, { endpoint: '/api/users' });
 */

import { logger } from './logger';

// Edge Runtime compatibility - dynamic imports only when needed
let MeterProvider: any;
let PeriodicExportingMetricReader: any;
let OTLPMetricExporter: any;
let resourceFromAttributes: any;
let ATTR_SERVICE_NAME: any;
let ATTR_SERVICE_VERSION: any;
let apiMetrics: any;

// Check if we're in Edge Runtime
const isEdgeRuntime = (typeof process !== 'undefined' && process.env.NEXT_RUNTIME === 'edge') ||
                     (typeof globalThis !== 'undefined' && 'EdgeRuntime' in globalThis);

let meterProvider: any = null;
let meter: any = null;

// Metric instruments
let httpRequestsCounter: any = null;
let httpRequestDurationHistogram: any = null;
let activeUsersGauge: any = null;
let apiCallsCounter: any = null;
let errorCounter: any = null;
let databaseQueryDurationHistogram: any = null;
let cacheHitsCounter: any = null;
let cacheMissesCounter: any = null;

/**
 * Initialize the metrics provider
 * Should be called once during application startup
 */
export async function initializeMetrics() {
  // Only initialize on server-side
  if (typeof window !== 'undefined') {
    return;
  }

  // Skip in Edge Runtime
  if (isEdgeRuntime) {
    logger.warn('Skipping metrics initialization in Edge Runtime', {
      operation: 'otel_metrics'
    });
    return;
  }

  // Only initialize once
  if (meterProvider) {
    logger.info('Metrics already initialized', {
      operation: 'otel_metrics'
    });
    return;
  }

  // Check if enabled
  if (process.env.NEXT_PUBLIC_SIGNOZ_ENABLED !== 'true') {
    logger.info('Signoz disabled, skipping metrics initialization', {
      operation: 'otel_metrics'
    });
    return;
  }

  try {
    logger.info('Initializing OpenTelemetry Metrics', {
      operation: 'otel_metrics'
    });

    // Dynamic imports for Edge Runtime compatibility
    if (!MeterProvider) {
      const sdkMetrics = await import('@opentelemetry/sdk-metrics');
      const exporterHttp = await import('@opentelemetry/exporter-metrics-otlp-http');
      const resources = await import('@opentelemetry/resources');
      const semanticConventions = await import('@opentelemetry/semantic-conventions');
      const api = await import('@opentelemetry/api');

      MeterProvider = sdkMetrics.MeterProvider;
      PeriodicExportingMetricReader = sdkMetrics.PeriodicExportingMetricReader;
      OTLPMetricExporter = exporterHttp.OTLPMetricExporter;
      resourceFromAttributes = resources.resourceFromAttributes;
      ATTR_SERVICE_NAME = semanticConventions.ATTR_SERVICE_NAME;
      ATTR_SERVICE_VERSION = semanticConventions.ATTR_SERVICE_VERSION;
      apiMetrics = api.metrics;
    }

    // Determine service name based on environment
    const serviceName = process.env.SIGNOZ_SERVICE_NAME ||
      (process.env.NODE_ENV === 'production' ? 'knotie-ai-pro-app-prod' : 'knotie-ai-pro-dev');

    // Create resource with service information
    const resource = resourceFromAttributes({
      [ATTR_SERVICE_NAME]: serviceName,
      [ATTR_SERVICE_VERSION]: process.env.APP_VERSION || 'unknown',
      'deployment.environment': process.env.NODE_ENV || 'development',
      'service.namespace': 'knotie-ai',
    });

    // Create OTLP exporter for Signoz
    if (process.env.SIGNOZ_ENDPOINT && process.env.SIGNOZ_INGESTION_KEY) {
      const metricsEndpoint = process.env.SIGNOZ_ENDPOINT.replace('/v1/traces', '/v1/metrics');
      
      const otlpExporter = new OTLPMetricExporter({
        url: metricsEndpoint,
        headers: {
          'signoz-ingestion-key': process.env.SIGNOZ_INGESTION_KEY,
        },
      });

      // Create meter provider with periodic export
      meterProvider = new MeterProvider({
        resource: resource,
        readers: [
          new PeriodicExportingMetricReader({
            exporter: otlpExporter,
            exportIntervalMillis: 30000, // Export every 30 seconds
            exportTimeoutMillis: 10000,
          }),
        ],
      });

      // Set global meter provider
      apiMetrics.setGlobalMeterProvider(meterProvider);

      // Get meter instance
      meter = meterProvider.getMeter('knotie-ai-pro-meter', '1.0.0');

      // Create metric instruments
      createMetricInstruments();

      logger.info('OpenTelemetry Metrics initialized successfully', {
        operation: 'otel_metrics',
        metricsEndpoint,
        exportInterval: '30 seconds'
      });
    } else {
      logger.warn('Missing SIGNOZ_ENDPOINT or SIGNOZ_INGESTION_KEY', {
        operation: 'otel_metrics'
      });
    }
  } catch (error) {
    logger.error('Failed to initialize metrics', error as Error, {
      operation: 'otel_metrics'
    });
  }
}

/**
 * Create all metric instruments
 */
function createMetricInstruments() {
  if (!meter) return;

  // HTTP Requests Counter
  httpRequestsCounter = meter.createCounter('http.requests', {
    description: 'Total number of HTTP requests',
    unit: '1',
  });

  // HTTP Request Duration Histogram
  httpRequestDurationHistogram = meter.createHistogram('http.request.duration', {
    description: 'HTTP request duration in milliseconds',
    unit: 'ms',
  });

  // Active Users Gauge (UpDownCounter)
  activeUsersGauge = meter.createUpDownCounter('active.users', {
    description: 'Number of currently active users',
    unit: '1',
  });

  // API Calls Counter
  apiCallsCounter = meter.createCounter('api.calls', {
    description: 'Total number of API calls',
    unit: '1',
  });

  // Error Counter
  errorCounter = meter.createCounter('errors', {
    description: 'Total number of errors',
    unit: '1',
  });

  // Database Query Duration Histogram
  databaseQueryDurationHistogram = meter.createHistogram('db.query.duration', {
    description: 'Database query duration in milliseconds',
    unit: 'ms',
  });

  // Cache Hits Counter
  cacheHitsCounter = meter.createCounter('cache.hits', {
    description: 'Total number of cache hits',
    unit: '1',
  });

  // Cache Misses Counter
  cacheMissesCounter = meter.createCounter('cache.misses', {
    description: 'Total number of cache misses',
    unit: '1',
  });

  logger.info('Created metric instruments', {
    operation: 'otel_metrics',
    instruments: ['requests', 'duration', 'users', 'errors', 'db', 'cache']
  });
}

/**
 * Metrics interface
 */
export const metrics = {
  /**
   * Record an HTTP request
   */
  recordHttpRequest(method: string, path: string, statusCode: number, duration: number) {
    if (httpRequestsCounter) {
      httpRequestsCounter.add(1, {
        'http.method': method,
        'http.route': path,
        'http.status_code': statusCode,
      });
    }
    if (httpRequestDurationHistogram) {
      httpRequestDurationHistogram.record(duration, {
        'http.method': method,
        'http.route': path,
        'http.status_code': statusCode,
      });
    }
  },

  /**
   * Increment active users
   */
  incrementActiveUsers(count: number = 1) {
    if (activeUsersGauge) {
      activeUsersGauge.add(count);
    }
  },

  /**
   * Decrement active users
   */
  decrementActiveUsers(count: number = 1) {
    if (activeUsersGauge) {
      activeUsersGauge.add(-count);
    }
  },

  /**
   * Record an API call
   */
  recordApiCall(endpoint: string, provider: string, success: boolean) {
    if (apiCallsCounter) {
      apiCallsCounter.add(1, {
        'api.endpoint': endpoint,
        'api.provider': provider,
        'api.success': success,
      });
    }
  },

  /**
   * Record an error
   */
  recordError(errorType: string, errorMessage: string, context?: Record<string, any>) {
    if (errorCounter) {
      errorCounter.add(1, {
        'error.type': errorType,
        'error.message': errorMessage,
        ...context,
      });
    }
  },

  /**
   * Record database query duration
   */
  recordDbQuery(operation: string, table: string, duration: number, success: boolean) {
    if (databaseQueryDurationHistogram) {
      databaseQueryDurationHistogram.record(duration, {
        'db.operation': operation,
        'db.table': table,
        'db.success': success,
      });
    }
  },

  /**
   * Record cache hit
   */
  recordCacheHit(cacheKey: string) {
    if (cacheHitsCounter) {
      cacheHitsCounter.add(1, {
        'cache.key': cacheKey,
      });
    }
  },

  /**
   * Record cache miss
   */
  recordCacheMiss(cacheKey: string) {
    if (cacheMissesCounter) {
      cacheMissesCounter.add(1, {
        'cache.key': cacheKey,
      });
    }
  },

  /**
   * Get raw meter for custom metrics
   */
  getMeter() {
    return meter;
  },
};

/**
 * Shutdown metrics (call on application shutdown)
 */
export async function shutdownMetrics() {
  if (meterProvider) {
    await meterProvider.shutdown();
    logger.info('Metrics shutdown complete', {
      operation: 'otel_metrics'
    });
  }
}

/**
 * Check if metrics are initialized
 */
export function isMetricsInitialized(): boolean {
  return !!meterProvider;
}

// Auto-initialize on import (server-side only, not Edge runtime)
// Skip auto-initialization since it's now handled by otel-init.ts
// This prevents double initialization and Edge Runtime issues
if (typeof window === 'undefined' && process.env.NEXT_RUNTIME !== 'edge') {
  // Only auto-initialize if not already initialized by otel-init.ts
  // This provides fallback initialization for direct imports
  if (!meterProvider) {
    initializeMetrics();
  }
}

