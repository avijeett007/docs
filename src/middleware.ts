import { NextResponse } from 'next/server';
import type { NextRequest, NextFetchEvent } from 'next/server';

import { verifyJWT } from './lib/jwt';
import { cloudflareMiddleware } from './middleware/cloudflare';
import { handleWhiteLabelRequest } from './middleware-whitelabel';

// Note: OpenTelemetry and API key middleware removed from Edge Runtime middleware
// These will be handled in individual API routes that run in Node.js runtime

// Partner-specific routes and middleware
const partnerPublicPaths = [
  "/partner/login",
  "/partner/register",
  "/partner/google-signup",
  "/api/partner/auth/login",
  "/api/partner/auth/register",
  "/api/partner/auth/verify",
  "/api/partner/auth/reset-password",
  "/api/partner/auth/google",
  "/api/partner/auth/google/callback",
  "/api/partner/auth/google/signup",
  "/api/partner/onboarding/progress",
  "/api/partners/payment/success",
  "/api/partners/register",
  "/api/partners/complete"
];

// Public paths that don't require authentication
const publicPaths = [
  "/",
  "/pricing",
  "/contact",
  "/partners",
  "/api/public(.*)",
  "/api/v1(.*)", // API v1 routes use API key authentication
  "/api/whitelabel/billing/webhooks/(.*)", // Webhook routes should be public
  "/docs/api(.*)", // API documentation
  "/widget(.*)", // Widget pages should be public
  "/_next/static/(.*)",
  "/favicon.ico",
  "/sign-in(.*)",
  "/sign-up(.*)",
];

const isPublic = (path: string) => {
  return publicPaths.find(x =>
    path.match(new RegExp(`^${x}$`.replace('*$', '.*')))
  );
}

// Routes that use API key authentication instead of JWT
const partnerApiKeyRoutes = [
  "/api/partner/auth/set-password"
];

const isPartnerPublic = (path: string) => {
  return partnerPublicPaths.includes(path);
}

const usesApiKeyAuth = (path: string) => {
  return partnerApiKeyRoutes.includes(path);
}

const isPartnerRoute = (path: string) => {
  return path.startsWith('/partner/') || path.startsWith('/api/partner/') || path.startsWith('/api/partners/');
}

const handlePartnerRoute = async (request: NextRequest) => {
  const path = request.nextUrl.pathname;

  // Allow public partner routes
  if (isPartnerPublic(path)) {
    return NextResponse.next();
  }

  // Allow API key authenticated routes to handle their own authentication
  if (usesApiKeyAuth(path)) {
    if (process.env.ENABLE_TRACE_LOGS === 'true') {
      console.log(`[MIDDLEWARE] API key authenticated route, allowing through: ${path}`);
    }
    return NextResponse.next();
  }

  // For API routes, check Authorization header
  if (path.startsWith('/api/partner/') || path.startsWith('/api/partners/')) {
    if (process.env.ENABLE_TRACE_LOGS === 'true') {
      console.log(`[MIDDLEWARE] Partner API route detected: ${path}`);
    }
    const authHeader = request.headers.get('Authorization');
    if (process.env.ENABLE_TRACE_LOGS === 'true') {
      console.log(`[MIDDLEWARE] Authorization header present: ${!!authHeader}`);
    }

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      if (process.env.ENABLE_TRACE_LOGS === 'true') {
        console.log(`[MIDDLEWARE] Missing or invalid Authorization header for: ${path}`);
      }
      return NextResponse.json({ error: 'No token provided' }, { status: 401 });
    }

    const token = authHeader.split(' ')[1];
    try {
      const verified = await verifyJWT(token);
      if (!verified) {
        throw new Error('Invalid token');
      }
      if (process.env.ENABLE_TRACE_LOGS === 'true') {
        console.log(`[MIDDLEWARE] JWT token verified successfully for: ${path}`);
      }
      return NextResponse.next();
    } catch (error) {
      if (process.env.ENABLE_TRACE_LOGS === 'true') {
        console.log(`[MIDDLEWARE] JWT token verification failed for: ${path}`, error);
      }
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }
  }

  // For non-API partner routes, check token in cookies
  const token = request.cookies.get('partner_token')?.value;

  if (process.env.ENABLE_TRACE_LOGS === 'true') {
    console.log(`[MIDDLEWARE] Partner route: ${path}, Token present: ${!!token}`);
  }

  if (!token) {
    if (process.env.ENABLE_TRACE_LOGS === 'true') {
      console.log(`[MIDDLEWARE] No token found, redirecting to login from: ${path}`);
    }
    // Redirect to partner login if no token is present
    const loginUrl = new URL('/partner/login', request.url);
    loginUrl.searchParams.set('redirect_url', request.url);
    return NextResponse.redirect(loginUrl);
  }

  try {
    const verified = await verifyJWT(token);
    if (!verified) {
      throw new Error('Invalid token');
    }
    if (process.env.ENABLE_TRACE_LOGS === 'true') {
      console.log(`[MIDDLEWARE] JWT token verified successfully for: ${path}`);
    }
    return NextResponse.next();
  } catch (error) {
    if (process.env.ENABLE_TRACE_LOGS === 'true') {
      console.log(`[MIDDLEWARE] JWT token verification failed for: ${path}`, error);
    }
    const loginUrl = new URL('/partner/login', request.url);
    loginUrl.searchParams.set('error', 'invalid_token');
    return NextResponse.redirect(loginUrl);
  }
};



async function customMiddleware(request: NextRequest) {
  const path = request.nextUrl.pathname;

  // Handle partner routes
  if (isPartnerRoute(path)) {
    return handlePartnerRoute(request);
  }

  // All other routes are public (admin routes handle their own authentication)
  return NextResponse.next();


}

// Export the middleware function
export default async function middleware(
  request: NextRequest,
  _event: NextFetchEvent
) {
  // Check for health endpoint - bypass all middleware for monitoring
  if (request.nextUrl.pathname === '/api/health') {
    return NextResponse.next();
  }

  // Note: API v1 routes with API key authentication are now handled
  // directly in the API routes themselves (Node.js runtime) rather than
  // in middleware (Edge runtime) to avoid Prisma compatibility issues

  // First, check if this is a white-label domain request
  try {
    if (process.env.ENABLE_TRACE_LOGS === 'true') {
      console.log(`Checking white-label for: ${request.headers.get('host')}`);
    }
    const whitelabelResponse = await handleWhiteLabelRequest(request);

    if (whitelabelResponse) {
      if (process.env.ENABLE_TRACE_LOGS === 'true') {
        console.log(`White-label routing applied: ${request.url} → ${whitelabelResponse.headers.get('x-nextjs-rewrite') || 'no rewrite'}`);
      }
      return whitelabelResponse;
    } else if (process.env.ENABLE_TRACE_LOGS === 'true') {
      console.log(`No white-label routing applied for: ${request.url}`);
    }
  } catch (error) {
    console.error(`White-label middleware error: ${error instanceof Error ? error.message : String(error)}`);
    // Continue to other middleware even if white-label handling fails
  }

  // Apply Cloudflare middleware first to handle headers
  const cfResponse = cloudflareMiddleware(request);

  // Run our custom middleware directly (with Cloudflare headers preserved)
  const customResponse = await customMiddleware(request);

  // Preserve Cloudflare headers in the response
  if (customResponse && customResponse instanceof Response) {
    const headers = new Headers(customResponse.headers);
    cfResponse.headers.forEach((value, key) => {
      if (key.toLowerCase().startsWith('x-')) {
        headers.set(key, value);
      }
    });

    return new Response(customResponse.body, {
      status: customResponse.status,
      statusText: customResponse.statusText,
      headers
    });
  }

  return customResponse || NextResponse.next();
}

// Update config to use Clerk's recommended matcher
export const config = {
  // Add matcher configuration that includes all paths except static files
  // This ensures our white-label middleware runs for all relevant routes
  matcher: [
    // Match all pages except static files and Next.js internal routes
    '/((?!_next/static|_next/image|favicon.ico).*)',
    '/(api|trpc)(.*)',
  ],
};
