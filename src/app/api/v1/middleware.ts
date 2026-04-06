import { NextRequest, NextResponse } from 'next/server';
import { verifyApiKey } from '@/lib/apiKeys';

// Force Node.js runtime for Prisma compatibility
export const runtime = 'nodejs';

/**
 * Middleware for API key authentication
 * This middleware checks for a valid API key in the request headers
 * and adds the authenticated entity to the request
 */
export async function apiKeyMiddleware(request: NextRequest) {
  // Skip middleware for non-API routes
  if (!request.nextUrl.pathname.startsWith('/api/v1')) {
    return NextResponse.next();
  }

  // Get API key from request headers
  const apiKey = request.headers.get('x-api-key');

  if (!apiKey) {
    return NextResponse.json(
      { error: 'Missing API key' },
      { status: 401 }
    );
  }

  // Verify the API key
  const keyInfo = await verifyApiKey(apiKey);

  if (!keyInfo) {
    return NextResponse.json(
      { error: 'Invalid API key' },
      { status: 401 }
    );
  }

  // Add the authenticated entity to the request headers
  const headers = new Headers(request.headers);
  headers.set('x-auth-type', keyInfo.type);
  headers.set('x-auth-id', keyInfo.id);
  
  if (keyInfo.type === 'partner') {
    headers.set('x-partner-id', keyInfo.partnerId);
  } else if (keyInfo.type === 'customer') {
    headers.set('x-partner-id', keyInfo.partnerId);
    headers.set('x-customer-id', keyInfo.customerId || '');
  }

  // Continue with the modified request
  return NextResponse.next({
    request: {
      headers
    }
  });
}
