import { NextRequest } from 'next/server';

interface RateLimitConfig {
  windowMs: number; // Time window in milliseconds
  maxRequests: number; // Maximum requests per window
  keyGenerator?: (request: NextRequest) => string; // Custom key generator
}

interface RateLimitEntry {
  count: number;
  resetTime: number;
}

// In-memory store for rate limiting (in production, use Redis)
const rateLimitStore = new Map<string, RateLimitEntry>();

// Cleanup old entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of rateLimitStore.entries()) {
    if (now > entry.resetTime) {
      rateLimitStore.delete(key);
    }
  }
}, 5 * 60 * 1000);

/**
 * Rate limiting function
 * @param request - The NextRequest object
 * @param config - Rate limit configuration
 * @returns Object with success status and remaining requests
 */
export function rateLimit(request: NextRequest, config: RateLimitConfig) {
  const now = Date.now();
  const windowMs = config.windowMs;
  const maxRequests = config.maxRequests;
  
  // Generate key for rate limiting
  const key = config.keyGenerator 
    ? config.keyGenerator(request)
    : getDefaultKey(request);

  // Get or create rate limit entry
  let entry = rateLimitStore.get(key);
  
  if (!entry || now > entry.resetTime) {
    // Create new entry or reset expired entry
    entry = {
      count: 0,
      resetTime: now + windowMs
    };
  }

  // Increment request count
  entry.count++;
  rateLimitStore.set(key, entry);

  // Check if limit exceeded
  const success = entry.count <= maxRequests;
  const remaining = Math.max(0, maxRequests - entry.count);
  const resetTime = entry.resetTime;

  return {
    success,
    remaining,
    resetTime,
    total: maxRequests
  };
}

/**
 * Default key generator using IP address and user agent
 */
function getDefaultKey(request: NextRequest): string {
  const ip = getClientIP(request);
  const userAgent = request.headers.get('user-agent') || 'unknown';
  return `${ip}:${userAgent.slice(0, 50)}`;
}

/**
 * Get client IP address from request
 */
function getClientIP(request: NextRequest): string {
  // Check various headers for the real IP
  const forwarded = request.headers.get('x-forwarded-for');
  const realIP = request.headers.get('x-real-ip');
  const cfConnectingIP = request.headers.get('cf-connecting-ip');
  
  if (cfConnectingIP) return cfConnectingIP;
  if (realIP) return realIP;
  if (forwarded) return forwarded.split(',')[0].trim();
  
  // Fallback to connection remote address (may not be available in all environments)
  return 'unknown';
}

/**
 * Admin-specific rate limiting (more restrictive)
 */
export function adminRateLimit(request: NextRequest) {
  return rateLimit(request, {
    windowMs: 15 * 60 * 1000, // 15 minutes
    maxRequests: 100, // 100 requests per 15 minutes
    keyGenerator: (req) => {
      const ip = getClientIP(req);
      return `admin:${ip}`;
    }
  });
}

/**
 * Partner API rate limiting
 */
export function partnerRateLimit(request: NextRequest) {
  return rateLimit(request, {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 60, // 60 requests per minute
    keyGenerator: (req) => {
      const ip = getClientIP(req);
      const authHeader = req.headers.get('authorization');
      return `partner:${ip}:${authHeader?.slice(-10) || 'anonymous'}`;
    }
  });
}

/**
 * Customer API rate limiting
 */
export function customerRateLimit(request: NextRequest) {
  return rateLimit(request, {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 30, // 30 requests per minute
    keyGenerator: (req) => {
      const ip = getClientIP(req);
      return `customer:${ip}`;
    }
  });
}

/**
 * Webhook rate limiting (very restrictive)
 */
export function webhookRateLimit(request: NextRequest) {
  return rateLimit(request, {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 1000, // 1000 webhooks per minute (adjust based on expected volume)
    keyGenerator: (req) => {
      const ip = getClientIP(req);
      const userAgent = req.headers.get('user-agent') || 'unknown';
      return `webhook:${ip}:${userAgent.slice(0, 20)}`;
    }
  });
}
