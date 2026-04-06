/**
 * Circuit Breaker Pattern Implementation
 *
 * A production-ready circuit breaker to protect against cascading failures
 * when calling external services like AnythingLLM, VAPI, Retell, etc.
 *
 * @see /documentations/circuit-breaker/README.md for usage guide
 */

import { logger } from '@/lib/logger';

export enum CircuitState {
  CLOSED = 'CLOSED',
  OPEN = 'OPEN',
  HALF_OPEN = 'HALF_OPEN',
}

export interface CircuitBreakerConfig {
  name: string;
  failureThreshold?: number;
  resetTimeout?: number;
  timeout?: number;
  successThreshold?: number;
  halfOpenRequestPercentage?: number;
}

export interface CircuitBreakerStats {
  state: CircuitState;
  failures: number;
  successes: number;
  lastFailureTime: number | null;
  lastSuccessTime: number | null;
  totalRequests: number;
  totalFailures: number;
  totalSuccesses: number;
}

export class CircuitBreakerError extends Error {
  constructor(
    message: string,
    public readonly circuitName: string,
    public readonly state: CircuitState
  ) {
    super(message);
    this.name = 'CircuitBreakerError';
  }
}

export class CircuitBreaker {
  private state: CircuitState = CircuitState.CLOSED;
  private failures: number = 0;
  private successes: number = 0;
  private lastFailureTime: number | null = null;
  private lastSuccessTime: number | null = null;
  private totalRequests: number = 0;
  private totalFailures: number = 0;
  private totalSuccesses: number = 0;
  private halfOpenRequests: number = 0;
  private readonly config: Required<CircuitBreakerConfig>;

  constructor(config: CircuitBreakerConfig) {
    this.config = {
      name: config.name,
      failureThreshold: config.failureThreshold ?? 5,
      resetTimeout: config.resetTimeout ?? 30000,
      timeout: config.timeout ?? 30000,
      successThreshold: config.successThreshold ?? 2,
      halfOpenRequestPercentage: config.halfOpenRequestPercentage ?? 50,
    };
  }

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    this.totalRequests++;
    if (this.state === CircuitState.OPEN) {
      if (this.shouldAttemptReset()) {
        this.transitionTo(CircuitState.HALF_OPEN);
      } else {
        throw new CircuitBreakerError(
          `Circuit breaker is OPEN for ${this.config.name}`,
          this.config.name, this.state
        );
      }
    }
    if (this.state === CircuitState.HALF_OPEN) {
      this.halfOpenRequests++;
      if (!this.shouldAllowHalfOpenRequest()) {
        throw new CircuitBreakerError(
          `Circuit breaker is HALF_OPEN, limiting requests for ${this.config.name}`,
          this.config.name, this.state
        );
      }
    }
    try {
      const result = await this.executeWithTimeout(fn);
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure(error as Error);
      throw error;
    }
  }

  private async executeWithTimeout<T>(fn: () => Promise<T>): Promise<T> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.config.timeout);
    try {
      const result = await Promise.race([
        fn(),
        new Promise<never>((_, reject) => {
          controller.signal.addEventListener('abort', () => {
            reject(new Error(`Request timed out after ${this.config.timeout}ms`));
          });
        }),
      ]);
      return result;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  private onSuccess(): void {
    this.lastSuccessTime = Date.now();
    this.totalSuccesses++;
    if (this.state === CircuitState.HALF_OPEN) {
      this.successes++;
      if (this.successes >= this.config.successThreshold) {
        this.transitionTo(CircuitState.CLOSED);
      }
    } else {
      this.failures = 0;
    }
  }

  private onFailure(error: Error): void {
    this.lastFailureTime = Date.now();
    this.totalFailures++;
    this.failures++;
    logger.warn(`Circuit breaker ${this.config.name} recorded failure`, {
      operation: 'circuit_breaker_failure',
      circuitName: this.config.name,
      state: this.state,
      failures: this.failures,
      threshold: this.config.failureThreshold,
      error: error.message,
    });
    if (this.state === CircuitState.HALF_OPEN) {
      this.transitionTo(CircuitState.OPEN);
    } else if (this.failures >= this.config.failureThreshold) {
      this.transitionTo(CircuitState.OPEN);
    }
  }

  private shouldAttemptReset(): boolean {
    if (this.lastFailureTime === null) return true;
    return Date.now() - this.lastFailureTime >= this.config.resetTimeout;
  }

  private shouldAllowHalfOpenRequest(): boolean {
    return Math.random() * 100 < this.config.halfOpenRequestPercentage;
  }

  private transitionTo(newState: CircuitState): void {
    const previousState = this.state;
    this.state = newState;
    logger.info(`Circuit breaker ${this.config.name} state transition`, {
      operation: 'circuit_breaker_transition',
      circuitName: this.config.name,
      previousState,
      newState,
      failures: this.failures,
      successes: this.successes,
    });
    if (newState === CircuitState.CLOSED) {
      this.failures = 0;
      this.successes = 0;
      this.halfOpenRequests = 0;
    } else if (newState === CircuitState.HALF_OPEN) {
      this.successes = 0;
      this.halfOpenRequests = 0;
    }
  }

  getStats(): CircuitBreakerStats {
    return {
      state: this.state,
      failures: this.failures,
      successes: this.successes,
      lastFailureTime: this.lastFailureTime,
      lastSuccessTime: this.lastSuccessTime,
      totalRequests: this.totalRequests,
      totalFailures: this.totalFailures,
      totalSuccesses: this.totalSuccesses,
    };
  }

  isAvailable(): boolean {
    if (this.state === CircuitState.CLOSED) return true;
    if (this.state === CircuitState.OPEN) return this.shouldAttemptReset();
    return true;
  }

  reset(): void {
    this.transitionTo(CircuitState.CLOSED);
    logger.info(`Circuit breaker ${this.config.name} manually reset`, {
      operation: 'circuit_breaker_reset',
      circuitName: this.config.name,
    });
  }

  trip(): void {
    this.transitionTo(CircuitState.OPEN);
    logger.info(`Circuit breaker ${this.config.name} manually tripped`, {
      operation: 'circuit_breaker_trip',
      circuitName: this.config.name,
    });
  }
}

// Registry for managing multiple circuit breakers
const circuitBreakers = new Map<string, CircuitBreaker>();

export function getCircuitBreaker(config: CircuitBreakerConfig): CircuitBreaker {
  const existing = circuitBreakers.get(config.name);
  if (existing) return existing;
  const breaker = new CircuitBreaker(config);
  circuitBreakers.set(config.name, breaker);
  return breaker;
}

export function getAllCircuitBreakerStats(): Record<string, CircuitBreakerStats> {
  const stats: Record<string, CircuitBreakerStats> = {};
  circuitBreakers.forEach((breaker, name) => {
    stats[name] = breaker.getStats();
  });
  return stats;
}

export function resetAllCircuitBreakers(): void {
  circuitBreakers.forEach((breaker) => breaker.reset());
}