import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { signJWT } from '@/lib/jwt';
import { logger } from '@/lib/logger';
import { obfuscateEmail, obfuscateId } from '@/lib/pii-obfuscation';

/**
 * Get the correct base URL for redirects
 * Uses environment variable or falls back to request host
 */
function getBaseUrl(request: NextRequest): string {
  // Use NEXT_PUBLIC_APP_URL if available
  if (process.env.NEXT_PUBLIC_APP_URL) {
    return process.env.NEXT_PUBLIC_APP_URL;
  }

  // Use the host from the request headers (works with Cloudflare tunnel)
  const host = request.headers.get('host');
  const protocol = request.headers.get('x-forwarded-proto') || 'https';

  if (host) {
    return `${protocol}://${host}`;
  }

  // Fallback to request.url origin
  return new URL(request.url).origin;
}

// This route uses dynamic features, so it must be server-rendered
export const dynamic = 'force-dynamic';

interface GoogleTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  id_token: string;
  refresh_token?: string;
}

interface GoogleUserInfo {
  id: string;
  email: string;
  verified_email: boolean;
  name: string;
  given_name: string;
  family_name: string;
  picture: string;
}

/**
 * GET /api/partner/auth/google/callback - Handle Google OAuth callback
 * Processes the authorization code and creates/logs in partner
 */
export async function GET(request: NextRequest) {
  try {
    const baseUrl = getBaseUrl(request);

    // Check if Google auth is enabled
    const isGoogleAuthEnabled = process.env.NEXT_PUBLIC_FEATURE_GOOGLE_AUTH === 'true';
    if (!isGoogleAuthEnabled) {
      return NextResponse.redirect(new URL('/partner/login?error=google_auth_disabled', baseUrl));
    }

    const { searchParams } = new URL(request.url);
    const code = searchParams.get('code');
    const state = searchParams.get('state');
    const error = searchParams.get('error');

    // Handle OAuth errors
    if (error) {
      logger.error('Google OAuth callback returned provider error', undefined, {
        operation: 'partner_google_callback',
        providerError: error,
      });
      return NextResponse.redirect(new URL('/partner/login?error=oauth_error', baseUrl));
    }

    if (!code || !state) {
      return NextResponse.redirect(new URL('/partner/login?error=missing_params', baseUrl));
    }

    // Decode and validate state
    let stateData;
    try {
      stateData = JSON.parse(Buffer.from(state, 'base64').toString());
    } catch (err) {
      logger.error('Google OAuth callback state decode failed', err instanceof Error ? err : undefined, {
        operation: 'partner_google_callback',
      });
      return NextResponse.redirect(new URL('/partner/login?error=invalid_state', baseUrl));
    }

    const { returnTo = '/partner/dashboard', isSignup = false } = stateData;

    // Exchange authorization code for tokens
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: process.env.GOOGLE_CLIENT_ID!,
        client_secret: process.env.GOOGLE_CLIENT_SECRET!,
        code,
        grant_type: 'authorization_code',
        redirect_uri: process.env.GOOGLE_REDIRECT_URI!,
      }),
    });

    if (!tokenResponse.ok) {
      logger.error('Google OAuth token exchange failed', undefined, {
        operation: 'partner_google_callback',
        status: tokenResponse.status,
      });
      return NextResponse.redirect(new URL('/partner/login?error=token_exchange_failed', baseUrl));
    }

    const tokens: GoogleTokenResponse = await tokenResponse.json();

    // Get user info from Google
    const userResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: {
        Authorization: `Bearer ${tokens.access_token}`,
      },
    });

    if (!userResponse.ok) {
      logger.error('Google OAuth user info fetch failed', undefined, {
        operation: 'partner_google_callback',
        status: userResponse.status,
      });
      return NextResponse.redirect(new URL('/partner/login?error=user_info_failed', baseUrl));
    }

    const googleUser: GoogleUserInfo = await userResponse.json();
    logger.info('Google OAuth user info received', {
      operation: 'partner_google_callback',
      email: obfuscateEmail(googleUser.email),
      verified: googleUser.verified_email,
    });

    if (!googleUser.verified_email) {
      return NextResponse.redirect(new URL('/partner/login?error=email_not_verified', baseUrl));
    }

    // Check if partner already exists (with timeout and retry)
    let existingPartner;
    try {
      existingPartner = await Promise.race([
        prisma.partner.findUnique({
          where: { emailAddress: googleUser.email },
          select: {
            id: true,
            googleId: true,
            emailAddress: true,
            approvalStatus: true,
            hasChangedPassword: true,
            businessName: true,
            contactName: true,
            mfaEnabled: true,
            stripeAccountId: true,
            stripeOnboardingCompleted: true,
            mfaWarningDismissedAt: true,
            hasSeenWelcomeVideo: true,
            walkthroughStartedAt: true,
            walkthroughCompletedAt: true,
            walkthroughSkipped: true,
          },
        }),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Database query timeout')), 8000)
        )
      ]);
    } catch (dbError) {
      logger.error('Google OAuth partner lookup failed', dbError instanceof Error ? dbError : undefined, {
        operation: 'partner_google_callback',
        email: obfuscateEmail(googleUser.email),
      });
      return NextResponse.redirect(new URL('/partner/login?error=database_error', baseUrl));
    }

    logger.info('Google OAuth partner lookup completed', {
      operation: 'partner_google_callback',
      found: !!existingPartner,
      email: obfuscateEmail(googleUser.email),
      partnerId: obfuscateId((existingPartner as any)?.id),
      approvalStatus: (existingPartner as any)?.approvalStatus,
    });

    let partner = existingPartner;

    if (existingPartner) {
      // Update existing partner with Google ID if not already set
      if (!(existingPartner as any).googleId) {
        try {
          partner = await Promise.race([
            prisma.partner.update({
              where: { id: (existingPartner as any).id },
              data: { googleId: googleUser.id } as any,
              select: {
                id: true,
                googleId: true,
                emailAddress: true,
                approvalStatus: true,
                hasChangedPassword: true,
                businessName: true,
                contactName: true,
                mfaEnabled: true,
                stripeAccountId: true,
                stripeOnboardingCompleted: true,
                mfaWarningDismissedAt: true,
                hasSeenWelcomeVideo: true,
                walkthroughStartedAt: true,
                walkthroughCompletedAt: true,
                walkthroughSkipped: true,
              },
            }),
            new Promise((_, reject) =>
              setTimeout(() => reject(new Error('Database update timeout')), 8000)
            )
          ]);
        } catch (updateError) {
          logger.error('Google OAuth partner update failed', updateError instanceof Error ? updateError : undefined, {
            operation: 'partner_google_callback',
            partnerId: obfuscateId((existingPartner as any).id),
            email: obfuscateEmail(googleUser.email),
          });
          return NextResponse.redirect(new URL('/partner/login?error=database_error', baseUrl));
        }
      }

      // Check approval status for existing partners
      if (partner) {
        const approvalStatus = (partner as any).approvalStatus;
        const partnerId = (partner as any).id;

        if (approvalStatus === 'PENDING') {
          // If partner was created via Google signup but hasn't completed payment,
          // redirect them to complete the payment process
          return NextResponse.redirect(new URL(`/partners?partnerId=${partnerId}&step=pricing`, baseUrl));
        } else if (approvalStatus !== 'ACTIVE') {
          // Other non-active statuses (REJECTED, SUSPENDED, etc.)
          return NextResponse.redirect(new URL('/partner/login?error=account_pending', baseUrl));
        }
        // If ACTIVE, continue with login flow below
      }
    } else if (isSignup) {
      // Create new partner for signup flow
      // For Google signup, we'll redirect to collect additional info (business name, coupon)
      // Store Google user data in session/temporary storage for the signup completion
      const googleUserData = {
        id: googleUser.id,
        email: googleUser.email,
        name: googleUser.name,
        picture: googleUser.picture,
        timestamp: Date.now()
      };

      // Encode the data to pass it via URL (in production, consider using session storage)
      const encodedData = Buffer.from(JSON.stringify(googleUserData)).toString('base64');

      return NextResponse.redirect(new URL(`/partner/google-signup?data=${encodedData}`, baseUrl));
    } else {
      // No existing partner and not signup flow
      return NextResponse.redirect(new URL('/partner/login?error=account_not_found', baseUrl));
    }

    // Ensure partner exists before proceeding
    if (!partner) {
      return NextResponse.redirect(new URL('/partner/login?error=partner_not_found', baseUrl));
    }

    if ((partner as any).mfaEnabled) {
      const redirectUrl = new URL('/partner/login', baseUrl);
      redirectUrl.searchParams.set('mfa_required', 'true');
      redirectUrl.searchParams.set('partnerId', (partner as any).id);
      redirectUrl.searchParams.set('email', (partner as any).emailAddress);
      redirectUrl.searchParams.set('auth_provider', 'google');
      return NextResponse.redirect(redirectUrl);
    }

    // Generate JWT token for existing partner
    const jwtPayload = {
      partnerId: (partner as any).id,
      email: (partner as any).emailAddress,
      hasChangedPassword: true, // Google auth users don't need password change
    };

    const token = await signJWT(jwtPayload);

    // Update last login time
    await prisma.partner.update({
      where: { id: (partner as any).id },
      data: { lastLoginAt: new Date() },
    });

    // Determine redirect URL
    let redirectUrl = returnTo;

    if (!(partner as any).hasSeenWelcomeVideo) {
      redirectUrl += (redirectUrl.includes('?') ? '&' : '?') + 'first_login=true';
    }

    // Add token to URL for frontend to store in localStorage
    redirectUrl += (redirectUrl.includes('?') ? '&' : '?') + `google_auth_token=${encodeURIComponent(token)}`;

    // Create redirect response with cookie
    const response = NextResponse.redirect(new URL(redirectUrl, baseUrl));

    // Set cookie with JWT token using Set-Cookie header
    const cookieValue = `partner_token=${token}; HttpOnly; ${process.env.NODE_ENV === 'production' ? 'Secure; ' : ''}SameSite=Lax; Max-Age=${7 * 24 * 60 * 60}; Path=/`;
    response.headers.set('Set-Cookie', cookieValue);

    logger.info('Google OAuth callback completed', {
      operation: 'partner_google_callback',
      partnerId: obfuscateId((partner as any).id),
      email: obfuscateEmail((partner as any).emailAddress),
    });

    return response;

  } catch (error) {
    logger.error('Google OAuth callback failed', error instanceof Error ? error : undefined, {
      operation: 'partner_google_callback',
    });
    const baseUrl = getBaseUrl(request);
    return NextResponse.redirect(new URL('/partner/login?error=oauth_callback_failed', baseUrl));
  }
}
