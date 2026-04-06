/**
 * Client-side logger for frontend components
 * Provides consistent logging interface without sending to external services
 */

interface LogContext {
  [key: string]: any;
}

class ClientLogger {
  private isDevelopment = process.env.NODE_ENV === 'development';

  info(message: string, context?: LogContext) {
    if (this.isDevelopment) {
      console.log(`[INFO] ${message}`, context || '');
    }
  }

  warn(message: string, context?: LogContext) {
    if (this.isDevelopment) {
      console.warn(`[WARN] ${message}`, context || '');
    }
  }

  error(message: string, error?: Error, context?: LogContext) {
    // Always log errors, even in production (for debugging)
    console.error(`[ERROR] ${message}`, error || '', context || '');
  }

  debug(message: string, context?: LogContext) {
    if (this.isDevelopment) {
      console.debug(`[DEBUG] ${message}`, context || '');
    }
  }
}

export const clientLogger = new ClientLogger();
