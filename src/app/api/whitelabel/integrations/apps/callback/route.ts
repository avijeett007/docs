import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const CONNECT_HUB_URL = process.env.CONNECT_HUB_URL || 'http://localhost:3001';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    // Extract all query parameters
    const code = searchParams.get('code');
    const state = searchParams.get('state');
    const error = searchParams.get('error');
    const app = searchParams.get('app');
    const status = searchParams.get('status');
    const connectedAccountId = searchParams.get('connectedAccountId');
    const appName = searchParams.get('appName');

    console.log('[whitelabel/integrations/apps/callback] OAuth callback received:', {
      code: code ? 'present' : 'missing',
      state: state ? 'present' : 'missing',
      error,
      app,
      status,
      connectedAccountId,
      appName
    });

    // Forward to Connect Hub for processing
    const callbackUrl = new URL(`${CONNECT_HUB_URL}/oauth/composio/callback`);

    // Pass all parameters to Connect Hub
    if (code) callbackUrl.searchParams.set('code', code);
    if (state) callbackUrl.searchParams.set('state', state);
    if (error) callbackUrl.searchParams.set('error', error);
    if (app) callbackUrl.searchParams.set('app', app);
    if (status) callbackUrl.searchParams.set('status', status);
    if (connectedAccountId) callbackUrl.searchParams.set('connectedAccountId', connectedAccountId);
    if (appName) callbackUrl.searchParams.set('appName', appName);

    console.log('[whitelabel/integrations/apps/callback] Forwarding to Connect Hub:', callbackUrl.toString());

    // Forward the request to Connect Hub
    const response = await fetch(callbackUrl.toString(), {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': request.headers.get('User-Agent') || 'knotie-main-app',
      },
    });

    console.log('[whitelabel/integrations/apps/callback] Connect Hub response:', {
      status: response.status,
      statusText: response.statusText
    });

    if (!response.ok) {
      console.error('[whitelabel/integrations/apps/callback] Connect Hub error:', {
        status: response.status,
        statusText: response.statusText
      });

      // Try to get error details
      const errorText = await response.text();
      console.error('[whitelabel/integrations/apps/callback] Connect Hub error details:', errorText);

      const redirectUrl = '/whitelabel/integration?error=' + encodeURIComponent('Connection failed');
      return NextResponse.redirect(new URL(redirectUrl, request.url));
    }

    // Check if Connect Hub is redirecting us
    const location = response.headers.get('location');
    if (location) {
      console.log('[whitelabel/integrations/apps/callback] Connect Hub redirecting to:', location);
      return NextResponse.redirect(location);
    }

    // If no redirect, try to parse response
    const responseText = await response.text();
    console.log('[whitelabel/integrations/apps/callback] Connect Hub response body:', responseText);

    // Default redirect to integration page with success
    const redirectUrl = `/whitelabel/integration?status=connected&provider=composio&app=${app || appName || 'unknown'}`;
    return NextResponse.redirect(new URL(redirectUrl, request.url));

  } catch (error) {
    console.error('[whitelabel/integrations/apps/callback] OAuth callback error:', error);
    const redirectUrl = '/whitelabel/integration?error=' + encodeURIComponent('Internal server error');
    return NextResponse.redirect(new URL(redirectUrl, request.url));
  }
}