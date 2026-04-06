/**
 * Cloudflare middleware for Next.js
 * 
 * This middleware handles Cloudflare-specific headers and properly extracts
 * client IP addresses when the application is behind Cloudflare.
 */

import { NextRequest, NextResponse } from 'next/server';

/**
 * Extract the real client IP address from Cloudflare headers
 * @param request The incoming request
 * @returns The real client IP address
 */
export function getClientIp(request: NextRequest): string {
  // First try Cloudflare-specific header
  const cfConnectingIp = request.headers.get('cf-connecting-ip');
  if (cfConnectingIp) {
    return cfConnectingIp;
  }
  
  // Then try standard forwarded headers
  const forwardedFor = request.headers.get('x-forwarded-for');
  if (forwardedFor) {
    // Get the first IP in the list (client's original IP)
    return forwardedFor.split(',')[0].trim();
  }
  
  // Fall back to request.ip (Next.js built-in)
  return request.ip || 'unknown';
}

/**
 * Detect if the request is coming through Cloudflare
 * @param request The incoming request
 * @returns True if the request is coming through Cloudflare
 */
export function isCloudflareRequest(request: NextRequest): boolean {
  return !!request.headers.get('cf-ray');
}

/**
 * Get Cloudflare country code from headers
 * @param request The incoming request
 * @returns The country code or null if not available
 */
export function getCountryCode(request: NextRequest): string | null {
  return request.headers.get('cf-ipcountry');
}

/**
 * Middleware to handle Cloudflare headers
 * This can be used in middleware.ts if needed
 */
export function cloudflareMiddleware(request: NextRequest): NextResponse {
  const response = NextResponse.next();
  
  // Add real client IP to request headers for downstream handlers
  const clientIp = getClientIp(request);
  response.headers.set('x-real-ip', clientIp);
  
  return response;
}
