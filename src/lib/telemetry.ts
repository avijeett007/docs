/**
 * Telemetry Utilities for Signoz OpenTelemetry
 * 
 * This module provides helper functions to add custom traces, spans, and metrics
 * to your application code without impacting performance.
 * 
 * Usage Examples:
 * 
 * 1. Trace a function:
 *    const result = await traceAsync('fetchUserData', async () => {
 *      return await fetchUser(userId);
 *    }, { userId });
 * 
 * 2. Add custom attributes to current span:
 *    addSpanAttributes({ customerId: '123', action: 'purchase' });
 * 
 * 3. Record an event:
 *    recordEvent('user.login', { method: 'oauth', provider: 'google' });
 */

import { trace, context, SpanStatusCode, Span } from '@opentelemetry/api';

// Check if telemetry is enabled
const isTelemetryEnabled = () => {
  return process.env.NEXT_PUBLIC_SIGNOZ_ENABLED === 'true';
};

// Get the tracer instance
const getTracer = () => {
  if (!isTelemetryEnabled()) {
    return null;
  }
  return trace.getTracer('knotie-ai-pro', process.env.APP_VERSION || '1.0.0');
};

/**
 * Trace an async function with automatic span management
 * 
 * @param name - Name of the operation
 * @param fn - Async function to trace
 * @param attributes - Optional attributes to add to the span
 * @returns Result of the function
 */
export async function traceAsync<T>(
  name: string,
  fn: () => Promise<T>,
  attributes?: Record<string, string | number | boolean>
): Promise<T> {
  const tracer = getTracer();
  
  // If telemetry is disabled, just execute the function
  if (!tracer) {
    return fn();
  }

  // Create a span for this operation
  return tracer.startActiveSpan(name, async (span: Span) => {
    try {
      // Add custom attributes if provided
      if (attributes) {
        Object.entries(attributes).forEach(([key, value]) => {
          span.setAttribute(key, value);
        });
      }

      // Execute the function
      const result = await fn();

      // Mark span as successful
      span.setStatus({ code: SpanStatusCode.OK });
      
      return result;
    } catch (error) {
      // Record the error in the span
      span.setStatus({
        code: SpanStatusCode.ERROR,
        message: error instanceof Error ? error.message : 'Unknown error',
      });
      
      // Record exception details
      if (error instanceof Error) {
        span.recordException(error);
      }
      
      // Re-throw the error
      throw error;
    } finally {
      // Always end the span
      span.end();
    }
  });
}

/**
 * Trace a synchronous function with automatic span management
 * 
 * @param name - Name of the operation
 * @param fn - Synchronous function to trace
 * @param attributes - Optional attributes to add to the span
 * @returns Result of the function
 */
export function traceSync<T>(
  name: string,
  fn: () => T,
  attributes?: Record<string, string | number | boolean>
): T {
  const tracer = getTracer();
  
  // If telemetry is disabled, just execute the function
  if (!tracer) {
    return fn();
  }

  // Create a span for this operation
  return tracer.startActiveSpan(name, (span: Span) => {
    try {
      // Add custom attributes if provided
      if (attributes) {
        Object.entries(attributes).forEach(([key, value]) => {
          span.setAttribute(key, value);
        });
      }

      // Execute the function
      const result = fn();

      // Mark span as successful
      span.setStatus({ code: SpanStatusCode.OK });
      
      return result;
    } catch (error) {
      // Record the error in the span
      span.setStatus({
        code: SpanStatusCode.ERROR,
        message: error instanceof Error ? error.message : 'Unknown error',
      });
      
      // Record exception details
      if (error instanceof Error) {
        span.recordException(error);
      }
      
      // Re-throw the error
      throw error;
    } finally {
      // Always end the span
      span.end();
    }
  });
}

/**
 * Add attributes to the current active span
 * Useful for adding context to an existing trace
 * 
 * @param attributes - Key-value pairs to add to the current span
 */
export function addSpanAttributes(
  attributes: Record<string, string | number | boolean>
): void {
  if (!isTelemetryEnabled()) {
    return;
  }

  const span = trace.getActiveSpan();
  if (span) {
    Object.entries(attributes).forEach(([key, value]) => {
      span.setAttribute(key, value);
    });
  }
}

/**
 * Record an event in the current span
 * Events are timestamped occurrences that can be used to mark important moments
 * 
 * @param name - Name of the event
 * @param attributes - Optional attributes for the event
 */
export function recordEvent(
  name: string,
  attributes?: Record<string, string | number | boolean>
): void {
  if (!isTelemetryEnabled()) {
    return;
  }

  const span = trace.getActiveSpan();
  if (span) {
    span.addEvent(name, attributes);
  }
}

/**
 * Record an exception in the current span
 * This is useful for non-fatal errors that you want to track
 *
 * @param error - The error to record
 * @param attributes - Optional additional context
 */
export function recordException(
  error: Error,
  attributes?: Record<string, string | number | boolean>
): void {
  if (!isTelemetryEnabled()) {
    return;
  }

  const span = trace.getActiveSpan();
  if (span) {
    // recordException expects ExceptionEventOptions which has different signature
    span.recordException(error);
    // Add attributes separately if provided
    if (attributes) {
      Object.entries(attributes).forEach(([key, value]) => {
        span.setAttribute(key, value);
      });
    }
  }
}

/**
 * Create a manual span for fine-grained control
 * Remember to call span.end() when done!
 * 
 * @param name - Name of the span
 * @param attributes - Optional attributes
 * @returns Span object or null if telemetry is disabled
 */
export function createSpan(
  name: string,
  attributes?: Record<string, string | number | boolean>
): Span | null {
  const tracer = getTracer();
  
  if (!tracer) {
    return null;
  }

  const span = tracer.startSpan(name);
  
  if (attributes) {
    Object.entries(attributes).forEach(([key, value]) => {
      span.setAttribute(key, value);
    });
  }
  
  return span;
}

/**
 * Execute a function within a specific context
 * Useful for propagating trace context across async boundaries
 * 
 * @param fn - Function to execute
 * @returns Result of the function
 */
export function withContext<T>(fn: () => T): T {
  if (!isTelemetryEnabled()) {
    return fn();
  }

  return context.with(context.active(), fn);
}

/**
 * Helper to trace API route handlers
 * 
 * @param routeName - Name of the API route
 * @param handler - The route handler function
 * @returns Wrapped handler with tracing
 */
export function traceApiRoute<T>(
  routeName: string,
  handler: (req: any, res: any) => Promise<T>
) {
  return async (req: any, res: any): Promise<T> => {
    return traceAsync(
      `api.${routeName}`,
      () => handler(req, res),
      {
        'http.method': req.method,
        'http.route': routeName,
        'http.url': req.url,
      }
    );
  };
}

/**
 * Helper to trace database operations
 * 
 * @param operation - Name of the database operation
 * @param table - Table/collection name
 * @param fn - The database operation function
 * @returns Result of the operation
 */
export async function traceDbOperation<T>(
  operation: string,
  table: string,
  fn: () => Promise<T>
): Promise<T> {
  return traceAsync(
    `db.${operation}`,
    fn,
    {
      'db.operation': operation,
      'db.table': table,
      'db.system': 'postgresql',
    }
  );
}

