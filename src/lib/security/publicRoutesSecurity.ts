import { NextRequest, NextResponse } from 'next/server';
import { rateLimit } from '@/lib/rateLimit';
import { z } from 'zod';
import crypto from 'crypto';
import { logger } from '@/lib/logger';

/**
 * Security middleware for public partner routes
 * Provides rate limiting, input validation, and CSRF protection
 */

export interface SecurityConfig {
  rateLimitRequests?: number;
  rateLimitWindowMs?: number;
  requireOriginValidation?: boolean;
  requireTimestampValidation?: boolean;
  maxRequestSize?: number;
  allowedMethods?: string[];
}

const DEFAULT_CONFIG: SecurityConfig = {
  rateLimitRequests: 10,
  rateLimitWindowMs: 60 * 1000, // 1 minute
  requireOriginValidation: true,
  requireTimestampValidation: false,
  maxRequestSize: 1024 * 1024, // 1MB
  allowedMethods: ['GET', 'POST']
};

/**
 * Apply security measures to public routes
 */
export async function securePublicRoute(
  request: NextRequest,
  config: SecurityConfig = {}
): Promise<{ success: true } | { success: false; response: NextResponse }> {
  const finalConfig = { ...DEFAULT_CONFIG, ...config };

  try {
    // 1. Method validation
    if (!finalConfig.allowedMethods?.includes(request.method)) {
      return {
        success: false,
        response: NextResponse.json(
          { error: 'Method not allowed' },
          { status: 405 }
        )
      };
    }

    // 2. Rate limiting
    const rateLimitResult = await rateLimit(request, {
      windowMs: finalConfig.rateLimitWindowMs!,
      maxRequests: finalConfig.rateLimitRequests!,
      keyGenerator: (req) => {
        const ip = getClientIP(req);
        const path = req.nextUrl.pathname;
        return `public_route:${path}:${ip}`;
      }
    });

    if (!rateLimitResult.success) {
      return {
        success: false,
        response: NextResponse.json(
          { 
            error: 'Rate limit exceeded',
            retryAfter: Math.ceil((rateLimitResult.resetTime - Date.now()) / 1000)
          },
          { 
            status: 429,
            headers: {
              'Retry-After': Math.ceil((rateLimitResult.resetTime - Date.now()) / 1000).toString(),
              'X-RateLimit-Remaining': rateLimitResult.remaining.toString(),
              'X-RateLimit-Reset': rateLimitResult.resetTime.toString()
            }
          }
        )
      };
    }

    // 3. Origin validation for state-changing operations
    if (finalConfig.requireOriginValidation && request.method !== 'GET') {
      const origin = request.headers.get('origin');
      const referer = request.headers.get('referer');
      const allowedOrigins = [
        process.env.NEXT_PUBLIC_APP_URL,
        'https://knotie-ai.pro',
        'https://www.knotie-ai.pro',
        'http://localhost:3000',
        'http://localhost:3001',
        'http://localhost:3002',
        'https://knotie.kno2gether.com'
      ].filter(Boolean);

      if (!origin && !referer) {
        return {
          success: false,
          response: NextResponse.json(
            { error: 'Missing origin header' },
            { status: 403 }
          )
        };
      }

      const requestOrigin = origin || (referer ? new URL(referer).origin : '');
      if (!allowedOrigins.includes(requestOrigin)) {
        logger.warn('Blocked request from unauthorized origin', {
          operation: 'public_routes_security',
          requestOrigin,
          allowedOrigins
        });
        return {
          success: false,
          response: NextResponse.json(
            { error: 'Unauthorized origin' },
            { status: 403 }
          )
        };
      }
    }

    // 4. Content-Length validation
    const contentLength = request.headers.get('content-length');
    if (contentLength && parseInt(contentLength) > finalConfig.maxRequestSize!) {
      return {
        success: false,
        response: NextResponse.json(
          { error: 'Request too large' },
          { status: 413 }
        )
      };
    }

    // 5. Timestamp validation (for sensitive operations)
    if (finalConfig.requireTimestampValidation) {
      const timestamp = request.headers.get('x-timestamp');
      if (!timestamp) {
        return {
          success: false,
          response: NextResponse.json(
            { error: 'Missing timestamp header' },
            { status: 400 }
          )
        };
      }

      const requestTime = parseInt(timestamp);
      const currentTime = Math.floor(Date.now() / 1000);
      const timeDiff = Math.abs(currentTime - requestTime);

      // Allow 5 minutes tolerance
      if (timeDiff > 300) {
        return {
          success: false,
          response: NextResponse.json(
            { error: 'Request timestamp too old' },
            { status: 400 }
          )
        };
      }
    }

    return { success: true };

  } catch (error) {
    logger.error('Security validation error', error as Error, {
      operation: 'public_routes_security'
    });
    return {
      success: false,
      response: NextResponse.json(
        { error: 'Security validation failed' },
        { status: 500 }
      )
    };
  }
}

/**
 * Get client IP address from request headers
 */
function getClientIP(request: NextRequest): string {
  return (
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip') ||
    request.headers.get('cf-connecting-ip') ||
    'unknown'
  );
}

/**
 * Validate Stripe session and prevent replay attacks
 */
export async function validateStripeSession(
  sessionId: string,
  partnerId: string
): Promise<{ success: true; session: any } | { success: false; error: string }> {
  try {
    const { getServerStripe } = await import('@/lib/stripe');
    const stripe = getServerStripe();

    if (!stripe) {
      return { success: false, error: 'Stripe not initialized' };
    }

    // Retrieve session from Stripe
    const session = await stripe.checkout.sessions.retrieve(sessionId);

    // Validate session status
    if (session.payment_status !== 'paid') {
      return { success: false, error: 'Payment not completed' };
    }

    // Validate partner ID matches
    if (session.metadata?.partnerId !== partnerId) {
      return { success: false, error: 'Partner ID mismatch' };
    }

    // Check if session is recent (within 1 hour)
    const sessionCreated = new Date(session.created * 1000);
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

    if (sessionCreated < oneHourAgo) {
      return { success: false, error: 'Session too old' };
    }

    return { success: true, session };

  } catch (error) {
    logger.error('Stripe session validation error', error as Error, {
      operation: 'public_routes_security'
    });
    return { success: false, error: 'Session validation failed' };
  }
}

/**
 * Input validation schemas
 */
export const ValidationSchemas = {
  email: z.string().email().max(255),
  partnerId: z.string().uuid(),
  sessionId: z.string().min(10).max(200),
  password: z.string().min(8).max(128),
  businessName: z.string().min(1).max(255).transform(val => val.trim()),
  phoneNumber: z.string().min(10).max(20).regex(/^[\+]?[1-9][\d]{0,15}$/),

  // Sanitize string inputs to prevent XSS
  sanitizedString: z.string().transform(val =>
    val.trim()
      .replace(/[<>]/g, '') // Remove potential HTML tags
      .replace(/javascript:/gi, '') // Remove javascript: protocol
      .slice(0, 1000) // Limit length
  )
};

/**
 * Generate secure session token for one-time operations
 */
export function generateSecureToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Verify secure token with timing-safe comparison
 */
export function verifySecureToken(provided: string, expected: string): boolean {
  if (provided.length !== expected.length) {
    return false;
  }

  return crypto.timingSafeEqual(
    Buffer.from(provided, 'hex'),
    Buffer.from(expected, 'hex')
  );
}
