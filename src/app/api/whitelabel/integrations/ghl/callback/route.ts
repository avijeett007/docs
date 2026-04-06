import { NextRequest, NextResponse } from 'next/server';

const CONNECT_HUB_URL = process.env.CONNECT_HUB_URL || 'http://localhost:3001';

// Mark this route as dynamic
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    console.log('[whitelabel/integrations/ghl/callback] Starting OAuth callback handling');

    const { searchParams } = new URL(request.url);
    const code = searchParams.get('code');
    const state = searchParams.get('state');
    const error = searchParams.get('error');

    console.log('[whitelabel/integrations/ghl/callback] Callback params:', {
      hasCode: !!code,
      hasState: !!state,
      hasError: !!error
    });

    // Handle OAuth error
    if (error) {
      console.error('[whitelabel/integrations/ghl/callback] OAuth error:', error);
      const redirectUrl = '/whitelabel/integration?error=' + encodeURIComponent(error);
      return NextResponse.redirect(new URL(redirectUrl, request.url));
    }

    // Validate required parameters
    if (!code || !state) {
      console.error('[whitelabel/integrations/ghl/callback] Missing OAuth parameters:', { code: !!code, state: !!state });
      const redirectUrl = '/whitelabel/integration?error=' + encodeURIComponent('Missing OAuth parameters');
      return NextResponse.redirect(new URL(redirectUrl, request.url));
    }

    // Forward to Connect Hub for token exchange using GET with query params
    const callbackUrl = new URL(`${CONNECT_HUB_URL}/oauth/ghl/callback`);
    callbackUrl.searchParams.set('code', code);
    callbackUrl.searchParams.set('state', state);
    if (error) {
      callbackUrl.searchParams.set('error', error);
    }

    console.log('[whitelabel/integrations/ghl/callback] Forwarding to Connect Hub:', callbackUrl.toString());

    const response = await fetch(callbackUrl.toString(), {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[whitelabel/integrations/ghl/callback] Connect Hub callback error:', errorText);
      const redirectUrl = '/whitelabel/integration?error=' + encodeURIComponent('OAuth callback failed');
      return NextResponse.redirect(new URL(redirectUrl, request.url));
    }

    const data = await response.json();
    
    console.log('[whitelabel/integrations/ghl/callback] OAuth callback completed successfully');
    
    // Redirect back to integration page with success
    const redirectUrl = data.redirectUrl || '/whitelabel/integration';
    const successUrl = `${redirectUrl}?success=true&provider=ghl`;
    
    return NextResponse.redirect(new URL(successUrl, request.url));

  } catch (error) {
    console.error('[whitelabel/integrations/ghl/callback] OAuth callback error:', error);
    const redirectUrl = '/whitelabel/integration?error=' + encodeURIComponent('Internal server error');
    return NextResponse.redirect(new URL(redirectUrl, request.url));
  }
}
