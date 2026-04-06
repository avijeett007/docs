import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyCustomerJWT } from '@/lib/customerJwt';
import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';

const CONNECT_HUB_URL = process.env.CONNECT_HUB_URL || 'http://localhost:3001';

// Mark this route as dynamic
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    logger.info('Starting OAuth URL generation', { operation: 'oauth_url' });

    // Get the customer token from cookies
    const cookieStore = cookies();
    const token = cookieStore.get('customer_token')?.value;

    if (!token) {
      logger.warn('No customer token found', { operation: 'oauth_url' });
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Verify the JWT token
    const payload = await verifyCustomerJWT(token);
    if (!payload) {
      logger.warn('Invalid customer token', { operation: 'oauth_url' });
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    logger.info('Customer authenticated', { operation: 'oauth_url', customerId: payload.customerId, partnerId: payload.partnerId });

    // Get the app name and custom config from request body
    const { appName, customConfig } = await request.json();
    if (!appName) {
      logger.warn('No app name provided', { operation: 'oauth_url' });
      return NextResponse.json({ error: 'App name is required' }, { status: 400 });
    }

    // Server-side validation: check customer's allowedApps
    try {
      const customer = await prisma.customer.findUnique({
        where: { id: payload.customerId },
        select: { email: true }
      });

      if (customer) {
        const userOnboarding = await prisma.userOnboarding.findFirst({
          where: { email: customer.email, partnerId: payload.partnerId },
          select: { allowedApps: true, showIntegration: true }
        });

        let allowedApps: string[] = [];
        try { allowedApps = JSON.parse(userOnboarding?.allowedApps || '[]'); } catch { allowedApps = []; }

        if (!userOnboarding?.showIntegration || (allowedApps.length > 0 && !allowedApps.includes(appName))) {
          logger.warn('App not in customer allowedApps', { operation: 'oauth_url', appName, allowedApps, customerId: payload.customerId });
          return NextResponse.json(
            { error: 'This integration is not available for your account. Please contact your administrator.' },
            { status: 403 }
          );
        }
      }
    } catch (tierErr) {
      logger.error('App access check error (allowing through)', tierErr instanceof Error ? tierErr : new Error(String(tierErr)), { operation: 'oauth_url' });
    }

    // Get the redirect URL from query params (where to redirect after OAuth)
    const { searchParams } = new URL(request.url);
    const returnTo = searchParams.get('redirectUrl') || '/whitelabel/integration';

    // Build the return URL with proper domain context
    // CRITICAL: Use original domain for custom domains to maintain whitelabel experience
    const originalDomain = request.headers.get('x-original-domain') ||
                          request.headers.get('cf-connecting-domain') ||
                          request.headers.get('x-forwarded-host');
    const host = originalDomain || request.headers.get('host');
    const protocol = request.headers.get('x-forwarded-proto') || 'https';
    const fullReturnTo = `${protocol}://${host}${returnTo}`;

    logger.debug('Domain resolution', { operation: 'oauth_url', originalDomain, host, fullReturnTo });

    logger.info('OAuth URL request', { operation: 'oauth_url', appName, returnTo: fullReturnTo, preservedCustomDomain: !!originalDomain });

    // Call Connect Hub to get OAuth URL for the specific app
    const oauthUrl = new URL(`${CONNECT_HUB_URL}/oauth/composio/url`);
    oauthUrl.searchParams.set('tenantId', payload.customerId);
    oauthUrl.searchParams.set('partnerId', payload.partnerId);
    oauthUrl.searchParams.set('userId', payload.customerId); // Use customer ID as user ID
    oauthUrl.searchParams.set('returnTo', fullReturnTo);
    oauthUrl.searchParams.set('appName', appName);

    // Add custom config for apps that need it (like WhatsApp)
    if (customConfig) {
      oauthUrl.searchParams.set('customConfig', JSON.stringify(customConfig));
    }

    logger.debug('Calling Connect Hub', { operation: 'oauth_url', url: oauthUrl.toString() });

    const response = await fetch(oauthUrl.toString(), {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      logger.error('Connect Hub OAuth URL error', new Error(errorText), { operation: 'oauth_url', appName });
      return NextResponse.json(
        { error: 'Failed to generate OAuth URL' },
        { status: 500 }
      );
    }

    const data = await response.json();
    
    logger.info('OAuth URL generated successfully', { operation: 'oauth_url', appName });
    
    return NextResponse.json({
      success: true,
      authUrl: data.data.authUrl,
      state: data.data.state,
      appName: data.data.appName
    });

  } catch (error) {
    logger.error('OAuth URL generation failed', error instanceof Error ? error : new Error(String(error)), { operation: 'oauth_url' });
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
