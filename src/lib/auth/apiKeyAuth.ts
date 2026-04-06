import { NextRequest, NextResponse } from 'next/server';
import { verifyApiKey } from '@/lib/apiKeys';
import { logger } from '@/lib/logger';

/**
 * Verify API key authentication from a request
 * Returns the authenticated entity or null if authentication fails
 */
export async function verifyApiKeyAuth(request: NextRequest) {
  try {
    // Get API key from request headers
    const apiKey = request.headers.get('x-api-key');

    if (!apiKey) {
      return null;
    }

    // Verify the API key
    const keyInfo = await verifyApiKey(apiKey);

    if (!keyInfo) {
      return null;
    }

    return keyInfo;
  } catch (error) {
    logger.error('Error verifying API key auth', error as Error, {
      operation: 'api_key_auth'
    });
    return null;
  }
}

/**
 * Middleware to check API key authentication
 * Returns a NextResponse if authentication fails, otherwise calls the next handler
 */
export async function withApiKeyAuth(
  request: NextRequest,
  handler: (request: NextRequest, keyInfo: any) => Promise<NextResponse>
) {
  const keyInfo = await verifyApiKeyAuth(request);

  if (!keyInfo) {
    return NextResponse.json(
      { error: 'Invalid or missing API key' },
      { status: 401 }
    );
  }

  return handler(request, keyInfo);
}

/**
 * Check if the API key has exceeded its rate limit
 * This is a placeholder for a more sophisticated rate limiting implementation
 * In a production environment, you would use Redis or a similar service for rate limiting
 */
export async function checkRateLimit(keyInfo: any) {
  // For now, we'll just return true (no rate limiting)
  // In a real implementation, you would check the rate limit against the key's settings
  return true;
}

/**
 * Middleware to check API key rate limits
 * Returns a NextResponse if rate limit is exceeded, otherwise calls the next handler
 */
export async function withRateLimit(
  request: NextRequest,
  keyInfo: any,
  handler: (request: NextRequest, keyInfo: any) => Promise<NextResponse>
) {
  const withinLimit = await checkRateLimit(keyInfo);

  if (!withinLimit) {
    return NextResponse.json(
      { error: 'Rate limit exceeded' },
      { status: 429 }
    );
  }

  return handler(request, keyInfo);
}

/**
 * Combined middleware for API key authentication and rate limiting
 */
export async function withApiKeyAuthAndRateLimit(
  request: NextRequest,
  handler: (request: NextRequest, keyInfo: any) => Promise<NextResponse>
) {
  return withApiKeyAuth(request, (req, keyInfo) => {
    return withRateLimit(req, keyInfo, handler);
  });
}
