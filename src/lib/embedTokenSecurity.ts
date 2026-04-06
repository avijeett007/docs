import { NextRequest } from 'next/server';
import { logger } from './logger';

// Simple in-memory rate limiting store
// In production, you might want to use Redis or a database
const rateLimitStore = new Map<string, { count: number; resetTime: number }>();

interface RateLimitConfig {
  windowMs: number; // Time window in milliseconds
  maxRequests: number; // Maximum requests per window
}

/**
 * Rate limiting for embed token access
 */
export function checkRateLimit(
  identifier: string,
  config: RateLimitConfig = { windowMs: 60000, maxRequests: 10 } // 10 requests per minute by default
): { allowed: boolean; remaining: number; resetTime: number } {
  const now = Date.now();
  const key = `embed_rate_limit:${identifier}`;
  
  // Clean up expired entries
  if (rateLimitStore.size > 1000) {
    for (const [k, v] of rateLimitStore.entries()) {
      if (v.resetTime < now) {
        rateLimitStore.delete(k);
      }
    }
  }
  
  const current = rateLimitStore.get(key);
  
  if (!current || current.resetTime < now) {
    // First request or window expired
    const resetTime = now + config.windowMs;
    rateLimitStore.set(key, { count: 1, resetTime });
    return {
      allowed: true,
      remaining: config.maxRequests - 1,
      resetTime,
    };
  }
  
  if (current.count >= config.maxRequests) {
    // Rate limit exceeded
    return {
      allowed: false,
      remaining: 0,
      resetTime: current.resetTime,
    };
  }
  
  // Increment count
  current.count++;
  rateLimitStore.set(key, current);
  
  return {
    allowed: true,
    remaining: config.maxRequests - current.count,
    resetTime: current.resetTime,
  };
}

/**
 * Extract client IP address from request
 */
export function getClientIP(request: NextRequest): string {
  // Check various headers for the real IP
  const forwardedFor = request.headers.get('x-forwarded-for');
  const realIP = request.headers.get('x-real-ip');
  const cfConnectingIP = request.headers.get('cf-connecting-ip');
  
  if (cfConnectingIP) return cfConnectingIP;
  if (realIP) return realIP;
  if (forwardedFor) {
    // x-forwarded-for can contain multiple IPs, take the first one
    return forwardedFor.split(',')[0].trim();
  }
  
  // Fallback to connection IP (might be proxy IP)
  return request.ip || 'unknown';
}

/**
 * Validate referer/origin against allowed domains
 */
export function validateRefererDomain(
  request: NextRequest,
  allowedDomains: string[]
): { isValid: boolean; domain?: string; error?: string } {
  if (!allowedDomains || allowedDomains.length === 0) {
    return { isValid: true }; // No restrictions
  }
  
  const referer = request.headers.get('referer');
  const origin = request.headers.get('origin');

  // Check for iframe-specific headers that might preserve the original referer
  const xEmbedReferer = request.headers.get('x-embed-referer');
  const xOriginalReferer = request.headers.get('x-original-referer');

  // Debug: Log all relevant headers
  logger.debug('Headers received', {
    operation: 'embed_security',
    referer,
    origin,
    xEmbedReferer,
    xOriginalReferer,
    'x-iframe-original-domain': request.headers.get('x-iframe-original-domain'),
    'x-cross-site-domain': request.headers.get('x-cross-site-domain'),
    'sec-fetch-dest': request.headers.get('sec-fetch-dest'),
    'sec-fetch-site': request.headers.get('sec-fetch-site'),
  });

  let requestDomain: string | null = null;

  // Priority: x-original-referer (from client), x-embed-referer (from worker), referer, origin
  if (xOriginalReferer) {
    try {
      requestDomain = new URL(xOriginalReferer).hostname;
      logger.debug('Using domain from x-original-referer', {
        operation: 'embed_security',
        requestDomain
      });
    } catch (e) {
      logger.warn('Invalid x-original-referer URL', {
        operation: 'embed_security',
        xOriginalReferer
      });
    }
  }

  if (!requestDomain && xEmbedReferer) {
    try {
      requestDomain = new URL(xEmbedReferer).hostname;
      logger.debug('Using domain from x-embed-referer', {
        operation: 'embed_security',
        requestDomain
      });
    } catch (e) {
      logger.warn('Invalid x-embed-referer URL', {
        operation: 'embed_security',
        xEmbedReferer
      });
    }
  }

  if (!requestDomain && referer) {
    try {
      requestDomain = new URL(referer).hostname;
      logger.debug('Using domain from referer', {
        operation: 'embed_security',
        requestDomain
      });
    } catch (e) {
      // Invalid referer URL
    }
  }

  if (!requestDomain && origin) {
    try {
      requestDomain = new URL(origin).hostname;
      logger.debug('Using domain from origin', {
        operation: 'embed_security',
        requestDomain
      });
    } catch (e) {
      // Invalid origin URL
    }
  }
  
  // If no domain found in headers, allow for direct access but log it
  if (!requestDomain) {
    logger.warn('Embed token access without referer/origin headers', {
      operation: 'embed_security',
      headersAvailable: {
        referer,
        origin,
        xEmbedReferer,
        'sec-fetch-dest': request.headers.get('sec-fetch-dest'),
        'sec-fetch-site': request.headers.get('sec-fetch-site'),
        'x-forwarded-host': request.headers.get('x-forwarded-host'),
        'host': request.headers.get('host'),
      }
    });
    return { isValid: true }; // Allow direct access
  }

  logger.debug('Validating domain against allowed domains', {
    operation: 'embed_security',
    requestDomain,
    allowedDomains
  });
  
  // Check if domain is in allowed list
  const isAllowed = allowedDomains.some(allowedDomain => {
    // Support wildcard subdomains (e.g., *.gohighlevel.com)
    if (allowedDomain.startsWith('*.')) {
      const baseDomain = allowedDomain.substring(2);
      const matches = requestDomain === baseDomain || requestDomain!.endsWith('.' + baseDomain);
      logger.debug('Wildcard check', {
        operation: 'embed_security',
        allowedDomain,
        requestDomain,
        matches
      });
      return matches;
    }
    const matches = requestDomain === allowedDomain;
    logger.debug('Exact match check', {
      operation: 'embed_security',
      allowedDomain,
      requestDomain,
      matches
    });
    return matches;
  });

  if (!isAllowed) {
    logger.error('Domain validation failed', new Error('Domain not in allowed list'), {
      operation: 'embed_security',
      requestDomain,
      allowedDomains
    });
    return {
      isValid: false,
      domain: requestDomain,
      error: `Domain '${requestDomain}' is not in the allowed list: ${allowedDomains.join(', ')}`,
    };
  }

  logger.debug('Domain validation successful', {
    operation: 'embed_security',
    requestDomain
  });
  return { isValid: true, domain: requestDomain || undefined };
}

/**
 * Check if embed token has expired
 */
export function isTokenExpired(expiresAt: Date | null): boolean {
  if (!expiresAt) return false; // No expiration set
  return expiresAt <= new Date();
}

/**
 * Generate a secure random token
 */
export function generateSecureToken(): string {
  // Use crypto.randomUUID() for better security
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  
  // Fallback for environments without crypto.randomUUID
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

/**
 * Validate token format
 */
export function isValidTokenFormat(token: string): boolean {
  // Check if token is a valid UUID format
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(token);
}

/**
 * Sanitize domain input
 */
export function sanitizeDomain(domain: string): string {
  return domain.toLowerCase().trim();
}

/**
 * Validate domain format
 */
export function isValidDomainFormat(domain: string): boolean {
  // Basic domain validation regex
  const domainRegex = /^(\*\.)?[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
  return domainRegex.test(domain);
}

/**
 * Security headers for embed responses
 */
export function getSecurityHeaders(): Record<string, string> {
  return {
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'SAMEORIGIN', // Allow embedding in same origin
    'X-XSS-Protection': '1; mode=block',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Content-Security-Policy': "frame-ancestors 'self' *", // Allow embedding from any domain
  };
}

/**
 * Log security event
 */
export function logSecurityEvent(
  event: string,
  details: Record<string, any>,
  severity: 'info' | 'warning' | 'error' = 'info'
): void {
  const logEntry = {
    timestamp: new Date().toISOString(),
    event,
    severity,
    ...details,
  };
  
  logger.info('Embed security log', {
    operation: 'embed_security',
    ...logEntry
  });
  
  // In production, you might want to send this to a security monitoring service
  // Example: sendToSecurityMonitoring(logEntry);
}

/**
 * Comprehensive security validation for embed token access
 */
export function validateEmbedSecurity(
  request: NextRequest,
  token: string,
  allowedDomains: string[]
): {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  clientIP: string;
  domain?: string;
} {
  const errors: string[] = [];
  const warnings: string[] = [];
  const clientIP = getClientIP(request);
  
  // Validate token format
  if (!isValidTokenFormat(token)) {
    errors.push('Invalid token format');
  }
  
  // Check rate limiting
  const rateLimitResult = checkRateLimit(clientIP, { windowMs: 60000, maxRequests: 20 });
  if (!rateLimitResult.allowed) {
    errors.push('Rate limit exceeded');
    logSecurityEvent('rate_limit_exceeded', {
      clientIP,
      token: token.substring(0, 8) + '...',
    }, 'warning');
  }
  
  // Validate referer domain
  const domainValidation = validateRefererDomain(request, allowedDomains);
  if (!domainValidation.isValid) {
    errors.push(domainValidation.error || 'Domain validation failed');
    logSecurityEvent('domain_validation_failed', {
      clientIP,
      requestDomain: domainValidation.domain,
      allowedDomains,
      token: token.substring(0, 8) + '...',
    }, 'warning');
  }
  
  // Check for suspicious patterns
  const userAgent = request.headers.get('user-agent') || '';
  if (!userAgent || userAgent.length < 10) {
    warnings.push('Suspicious or missing user agent');
  }
  
  // Log successful validation
  if (errors.length === 0) {
    logSecurityEvent('embed_access_validated', {
      clientIP,
      domain: domainValidation.domain,
      token: token.substring(0, 8) + '...',
    });
  }
  
  return {
    isValid: errors.length === 0,
    errors,
    warnings,
    clientIP,
    domain: domainValidation.domain,
  };
}
