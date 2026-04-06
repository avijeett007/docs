import { NextRequest, NextResponse } from 'next/server';

// This route uses dynamic features, so it must be server-rendered
export const dynamic = 'force-dynamic';

/**
 * GET /api/partner/auth/google - Initiate Google OAuth flow
 * Redirects user to Google OAuth consent screen
 */
export async function GET(request: NextRequest) {
  try {
    // Check if Google auth is enabled
    const isGoogleAuthEnabled = process.env.NEXT_PUBLIC_FEATURE_GOOGLE_AUTH === 'true';
    if (!isGoogleAuthEnabled) {
      return NextResponse.json(
        { error: 'Google authentication is not enabled' },
        { status: 403 }
      );
    }

    const clientId = process.env.GOOGLE_CLIENT_ID;
    const redirectUri = process.env.GOOGLE_REDIRECT_URI;

    if (!clientId || !redirectUri) {
      console.error('Missing Google OAuth configuration');
      return NextResponse.json(
        { error: 'Google authentication is not properly configured' },
        { status: 500 }
      );
    }

    // Get the return URL from query params (for post-auth redirect)
    const { searchParams } = new URL(request.url);
    const returnTo = searchParams.get('returnTo') || '/partner/dashboard';
    const isSignup = searchParams.get('signup') === 'true';

    // Create state parameter to prevent CSRF attacks and store return URL
    const state = Buffer.from(JSON.stringify({ 
      returnTo, 
      isSignup,
      timestamp: Date.now() 
    })).toString('base64');

    // Build Google OAuth URL
    const googleAuthUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
    googleAuthUrl.searchParams.set('client_id', clientId);
    googleAuthUrl.searchParams.set('redirect_uri', redirectUri);
    googleAuthUrl.searchParams.set('response_type', 'code');
    googleAuthUrl.searchParams.set('scope', 'openid email profile');
    googleAuthUrl.searchParams.set('state', state);
    googleAuthUrl.searchParams.set('access_type', 'offline');
    googleAuthUrl.searchParams.set('prompt', 'consent');

    // Return the auth URL for client-side redirect
    return NextResponse.json({ 
      authUrl: googleAuthUrl.toString() 
    });

  } catch (error) {
    console.error('Error initiating Google OAuth:', error);
    return NextResponse.json(
      { error: 'Failed to initiate Google authentication' },
      { status: 500 }
    );
  }
}
