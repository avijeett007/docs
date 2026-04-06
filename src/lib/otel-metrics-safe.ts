/**
 * Edge Runtime Safe Metrics Module
 *
 * This module provides a safe interface for metrics that works in both
 * Node.js and Edge Runtime environments. In Edge Runtime, it provides
 * no-op implementations to prevent import errors.
 */

import { logger } from './logger';

// Check if we're in Edge Runtime
const isEdgeRuntime = (typeof process !== 'undefined' && process.env.NEXT_RUNTIME === 'edge') ||
                     (typeof globalThis !== 'undefined' && 'EdgeRuntime' in globalThis);

// No-op metrics interface for Edge Runtime
const noOpMetrics = {
  recordDbQuery: () => {},
  recordError: () => {},
  recordHttpRequest: () => {},
  recordCustomEvent: () => {},
  recordGauge: () => {},
  recordHistogram: () => {},
  recordCounter: () => {},
  initializeMetrics: async () => {},
};

let metricsInstance: any = noOpMetrics;

// Only load real metrics in Node.js runtime
if (!isEdgeRuntime) {
  try {
    // Temporarily disable metrics loading to avoid webpack issues
    logger.warn('Using no-op metrics (OTEL temporarily disabled)', {
      operation: 'otel_metrics_safe'
    });
    metricsInstance = noOpMetrics;
  } catch (error) {
    logger.warn('Using no-op metrics due to import error', {
      operation: 'otel_metrics_safe',
      error: error instanceof Error ? error.message : String(error)
    });
    metricsInstance = noOpMetrics;
  }
}

/**
 * Safe metrics interface that works in both Node.js and Edge Runtime
 */
export const metrics = {
  recordDbQuery: (operation: string, provider: string, duration: number, success: boolean) => {
    metricsInstance?.recordDbQuery?.(operation, provider, duration, success);
  },
  
  recordError: (errorType: string, message: string, metadata?: Record<string, any>) => {
    metricsInstance?.recordError?.(errorType, message, metadata);
  },
  
  recordHttpRequest: (method: string, path: string, statusCode: number, duration: number) => {
    metricsInstance?.recordHttpRequest?.(method, path, statusCode, duration);
  },
  
  recordCustomEvent: (eventName: string, value: number, attributes?: Record<string, any>) => {
    metricsInstance?.recordCustomEvent?.(eventName, value, attributes);
  },
  
  recordGauge: (name: string, value: number, attributes?: Record<string, any>) => {
    metricsInstance?.recordGauge?.(name, value, attributes);
  },
  
  recordHistogram: (name: string, value: number, attributes?: Record<string, any>) => {
    metricsInstance?.recordHistogram?.(name, value, attributes);
  },
  
  recordCounter: (name: string, value: number, attributes?: Record<string, any>) => {
    metricsInstance?.recordCounter?.(name, value, attributes);
  },
  
  initializeMetrics: async () => {
    if (!isEdgeRuntime && metricsInstance?.initializeMetrics) {
      await metricsInstance.initializeMetrics();
    }
  }
};

export default metrics;
