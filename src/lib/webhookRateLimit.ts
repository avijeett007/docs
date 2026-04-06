import { NextRequest } from 'next/server';

interface RateLimitResult {
  success: boolean;
  remaining: number;
  resetTime: number;
  total: number;
  error?: string;
}

interface RateLimitEntry {
  count: number;
  resetTime: number;
}

// In-memory rate limiting store (in production, use Redis or similar)
const rateLimitStore = new Map<string, RateLimitEntry>();

// Clean up expired entries periodically
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of rateLimitStore.entries()) {
    if (entry.resetTime <= now) {
      rateLimitStore.delete(key);
    }
  }
}, 60000); // Clean up every minute

/**
 * Rate limiting for webhooks
 * @param request - The incoming request
 * @param options - Rate limiting options
 * @returns Rate limit result
 */
export function webhookRateLimit(
  request: NextRequest,
  options: {
    maxRequests?: number;
    windowMs?: number;
    keyGenerator?: (request: NextRequest) => string;
  } = {}
): RateLimitResult {
  const {
    maxRequests = 100, // Default: 100 requests
    windowMs = 60000, // Default: 1 minute window
    keyGenerator = (req) => getClientIdentifier(req)
  } = options;

  const key = keyGenerator(request);
  const now = Date.now();
  const resetTime = now + windowMs;

  // Get or create rate limit entry
  let entry = rateLimitStore.get(key);
  
  if (!entry || entry.resetTime <= now) {
    // Create new entry or reset expired entry
    entry = {
      count: 1,
      resetTime
    };
    rateLimitStore.set(key, entry);
    
    return {
      success: true,
      remaining: maxRequests - 1,
      resetTime,
      total: maxRequests
    };
  }

  // Check if limit exceeded
  if (entry.count >= maxRequests) {
    return {
      success: false,
      remaining: 0,
      resetTime: entry.resetTime,
      total: maxRequests,
      error: 'Rate limit exceeded'
    };
  }

  // Increment counter
  entry.count++;
  rateLimitStore.set(key, entry);

  return {
    success: true,
    remaining: maxRequests - entry.count,
    resetTime: entry.resetTime,
    total: maxRequests
  };
}

/**
 * Get client identifier for rate limiting
 * Uses IP address and User-Agent as fallback
 */
function getClientIdentifier(request: NextRequest): string {
  // Try to get IP from various headers
  const forwarded = request.headers.get('x-forwarded-for');
  const realIp = request.headers.get('x-real-ip');
  const cfConnectingIp = request.headers.get('cf-connecting-ip');
  
  const ip = forwarded?.split(',')[0]?.trim() || 
           realIp || 
           cfConnectingIp || 
           'unknown';

  // Add User-Agent for additional uniqueness
  const userAgent = request.headers.get('user-agent') || 'unknown';
  const userAgentHash = hashString(userAgent);

  return `${ip}:${userAgentHash}`;
}

/**
 * Simple hash function for strings
 */
function hashString(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash).toString(36);
}

/**
 * Marketing webhook specific rate limiting
 * More restrictive limits for webhook endpoints
 */
export function marketingWebhookRateLimit(request: NextRequest): RateLimitResult {
  return webhookRateLimit(request, {
    maxRequests: 50, // 50 requests per minute
    windowMs: 60000, // 1 minute window
    keyGenerator: (req) => {
      // Use a combination of IP and webhook signature for uniqueness
      const ip = getClientIdentifier(req);
      const signature = req.headers.get('x-webhook-signature') || 'no-sig';
      const sigHash = hashString(signature.substring(0, 20)); // First 20 chars of signature
      return `marketing_webhook:${ip}:${sigHash}`;
    }
  });
}

/**
 * IP-based rate limiting for additional security
 */
export function ipRateLimit(request: NextRequest): RateLimitResult {
  return webhookRateLimit(request, {
    maxRequests: 200, // 200 requests per hour per IP
    windowMs: 3600000, // 1 hour window
    keyGenerator: (req) => {
      const forwarded = req.headers.get('x-forwarded-for');
      const realIp = req.headers.get('x-real-ip');
      const cfConnectingIp = req.headers.get('cf-connecting-ip');
      
      const ip = forwarded?.split(',')[0]?.trim() || 
                 realIp || 
                 cfConnectingIp || 
                 'unknown';
      
      return `ip_limit:${ip}`;
    }
  });
}

/**
 * Webhook endpoint specific rate limiting
 * Combines multiple rate limiting strategies
 */
export function webhookEndpointRateLimit(request: NextRequest): {
  success: boolean;
  error?: string;
  headers: Record<string, string>;
} {
  // Check IP-based rate limit first (broader limit)
  const ipLimit = ipRateLimit(request);
  
  // Check webhook-specific rate limit (more restrictive)
  const webhookLimit = marketingWebhookRateLimit(request);

  // Prepare rate limit headers
  const headers: Record<string, string> = {
    'X-RateLimit-Limit': webhookLimit.total.toString(),
    'X-RateLimit-Remaining': webhookLimit.remaining.toString(),
    'X-RateLimit-Reset': Math.ceil(webhookLimit.resetTime / 1000).toString(),
    'X-RateLimit-IP-Limit': ipLimit.total.toString(),
    'X-RateLimit-IP-Remaining': ipLimit.remaining.toString(),
    'X-RateLimit-IP-Reset': Math.ceil(ipLimit.resetTime / 1000).toString()
  };

  // Check if either limit is exceeded
  if (!ipLimit.success) {
    return {
      success: false,
      error: `IP rate limit exceeded. Try again after ${new Date(ipLimit.resetTime).toISOString()}`,
      headers
    };
  }

  if (!webhookLimit.success) {
    return {
      success: false,
      error: `Webhook rate limit exceeded. Try again after ${new Date(webhookLimit.resetTime).toISOString()}`,
      headers
    };
  }

  return {
    success: true,
    headers
  };
}
