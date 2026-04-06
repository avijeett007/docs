/**
 * Structured logging utility for the application
 * Provides consistent logging format and context tracking
 *
 * Now integrated with OpenTelemetry to send logs to Signoz!
 */

import { trace, context } from '@opentelemetry/api';

export interface LogContext {
  userId?: string;
  partnerId?: string;
  customerId?: string;
  subscriptionId?: string;
  planId?: string;
  requestId?: string;
  operation?: string;
  [key: string]: any;
}

export interface LogEntry {
  level: 'info' | 'warn' | 'error' | 'debug';
  message: string;
  context?: LogContext;
  error?: Error;
  timestamp: string;
  service: string;
}

class Logger {
  private service: string;
  private defaultContext: LogContext;

  constructor(service: string = 'main-app', defaultContext: LogContext = {}) {
    this.service = service;
    this.defaultContext = defaultContext;
  }

  private formatLog(level: LogEntry['level'], message: string, context?: LogContext, error?: Error): LogEntry {
    return {
      level,
      message,
      context: { ...this.defaultContext, ...context },
      error: error ? {
        name: error.name,
        message: error.message,
        stack: error.stack,
      } as any : undefined,
      timestamp: new Date().toISOString(),
      service: this.service,
    };
  }

  private getSeverityNumber(level: LogEntry['level']): number {
    // OpenTelemetry severity numbers
    // https://opentelemetry.io/docs/specs/otel/logs/data-model/#field-severitynumber
    switch (level) {
      case 'debug':
        return 5; // DEBUG
      case 'info':
        return 9; // INFO
      case 'warn':
        return 13; // WARN
      case 'error':
        return 17; // ERROR
      default:
        return 9; // INFO
    }
  }

  private output(logEntry: LogEntry) {
    const logString = JSON.stringify(logEntry, null, process.env.NODE_ENV === 'development' ? 2 : 0);

    // 1. Output to console (existing behavior)
    switch (logEntry.level) {
      case 'error':
        console.error(logString);
        break;
      case 'warn':
        console.warn(logString);
        break;
      case 'debug':
        if (process.env.NODE_ENV === 'development' || process.env.LOG_LEVEL === 'debug') {
          console.debug(logString);
        }
        break;
      default:
        console.log(logString);
    }

    // 2. Send to Signoz via HTTP (new behavior)
    // Note: We use direct HTTP instead of OpenTelemetry SDK due to version conflicts
    if (typeof window === 'undefined' && process.env.NEXT_PUBLIC_SIGNOZ_ENABLED === 'true') {
      this.sendToSignoz(logEntry).catch(() => {
        // Silently fail if Signoz logging fails
      });
    }
  }

  private async sendToSignoz(logEntry: LogEntry) {
    try {
      // Get current trace context for correlation
      const span = trace.getSpan(context.active());
      const spanContext = span?.spanContext();

      // Prepare log record in OTLP JSON format
      const logRecord = {
        resourceLogs: [{
          resource: {
            attributes: [
              { key: 'service.name', value: { stringValue: process.env.SIGNOZ_SERVICE_NAME || 'knotie-ai-pro' } },
              { key: 'service.namespace', value: { stringValue: 'knotie-ai' } },
              { key: 'deployment.environment', value: { stringValue: process.env.NODE_ENV || 'development' } },
            ],
          },
          scopeLogs: [{
            scope: {
              name: this.service,
              version: '1.0.0',
            },
            logRecords: [{
              timeUnixNano: String(Date.now() * 1000000),
              severityNumber: this.getSeverityNumber(logEntry.level),
              severityText: logEntry.level.toUpperCase(),
              body: { stringValue: logEntry.message },
              attributes: [
                ...Object.entries(logEntry.context || {}).map(([key, value]) => ({
                  key,
                  value: { stringValue: String(value) },
                })),
                ...(spanContext ? [
                  { key: 'trace_id', value: { stringValue: spanContext.traceId } },
                  { key: 'span_id', value: { stringValue: spanContext.spanId } },
                  { key: 'trace_flags', value: { intValue: spanContext.traceFlags } },
                ] : []),
                ...(logEntry.error ? [
                  { key: 'error.type', value: { stringValue: logEntry.error.name } },
                  { key: 'error.message', value: { stringValue: logEntry.error.message } },
                  { key: 'error.stack', value: { stringValue: logEntry.error.stack || '' } },
                ] : []),
              ],
            }],
          }],
        }],
      };

      // Send to Signoz
      const logsEndpoint = process.env.SIGNOZ_ENDPOINT?.replace('/v1/traces', '/v1/logs');
      if (logsEndpoint && process.env.SIGNOZ_INGESTION_KEY) {
        await fetch(logsEndpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'signoz-ingestion-key': process.env.SIGNOZ_INGESTION_KEY,
          },
          body: JSON.stringify(logRecord),
        });
      }
    } catch (error) {
      // Silently fail - don't break the application
    }
  }

  info(message: string, context?: LogContext) {
    this.output(this.formatLog('info', message, context));
  }

  warn(message: string, context?: LogContext) {
    this.output(this.formatLog('warn', message, context));
  }

  error(message: string, error?: Error, context?: LogContext) {
    this.output(this.formatLog('error', message, context, error));
  }

  debug(message: string, context?: LogContext) {
    this.output(this.formatLog('debug', message, context));
  }

  // Billing-specific logging methods
  billingOperation(operation: string, context: LogContext) {
    this.info(`Billing operation: ${operation}`, { ...context, operation });
  }

  billingError(operation: string, error: Error, context: LogContext) {
    this.error(`Billing operation failed: ${operation}`, error, { ...context, operation });
  }

  // Performance logging
  performance(operation: string, duration: number, context?: LogContext) {
    this.info(`Performance: ${operation}`, { 
      ...context, 
      operation, 
      duration_ms: duration,
      performance: true 
    });
  }

  // Create child logger with additional context
  child(additionalContext: LogContext): Logger {
    return new Logger(this.service, { ...this.defaultContext, ...additionalContext });
  }
}

// Default logger instance
export const logger = new Logger();

// Billing-specific logger
export const billingLogger = new Logger('billing-service');

// Cron job logger
export const cronLogger = new Logger('cron-service');

// Performance measurement utility
export function measurePerformance<T>(
  operation: string,
  fn: () => Promise<T>,
  context?: LogContext
): Promise<T> {
  const start = Date.now();
  
  return fn().then(
    (result) => {
      const duration = Date.now() - start;
      logger.performance(operation, duration, context);
      return result;
    },
    (error) => {
      const duration = Date.now() - start;
      logger.error(`Operation failed: ${operation}`, error, { 
        ...context, 
        operation, 
        duration_ms: duration 
      });
      throw error;
    }
  );
}

// Error handling utility
export function handleBillingError(
  operation: string,
  error: Error,
  context: LogContext,
  rethrow: boolean = true
) {
  billingLogger.billingError(operation, error, context);
  
  if (rethrow) {
    throw error;
  }
}

// Request context middleware helper
export function createRequestLogger(requestId: string, userId?: string): Logger {
  return logger.child({ requestId, userId });
}

export default logger;
