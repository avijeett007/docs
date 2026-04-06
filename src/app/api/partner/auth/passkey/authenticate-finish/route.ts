import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { prisma } from '@/lib/prisma';
import { signJWT } from '@/lib/jwt';
import { logger } from '@/lib/logger';
import { getMFAWarningState } from '@/lib/mfa';
import { obfuscateEmail, obfuscateId } from '@/lib/pii-obfuscation';
import { 
  verifyPasskeyAuthentication, 
  parseStoredCredential,
  serializeCredential,
  clearRateLimit,
  type PasskeyCredential 
} from '@/lib/passkey';
import type { AuthenticationResponseJSON } from '@simplewebauthn/server';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

const requestSchema = z.object({
  response: z.object({
    id: z.string(),
    rawId: z.string(),
    response: z.object({
      authenticatorData: z.string(),
      clientDataJSON: z.string(),
      signature: z.string(),
      userHandle: z.string().optional(),
    }),
    type: z.literal('public-key'),
    clientExtensionResults: z.object({}).optional(),
    authenticatorAttachment: z.enum(['platform', 'cross-platform']).optional(),
  }),
});

export async function POST(request: NextRequest) {
  try {
    // Get challenge and user ID from cookies
    const challenge = cookies().get('passkey_auth_challenge')?.value;
    const userId = cookies().get('passkey_auth_user_id')?.value;

    if (!challenge || !userId) {
      return NextResponse.json(
        { error: 'Missing authentication data or expired session' },
        { status: 401 }
      );
    }

    // Parse request body
    const body = await request.json();
    const { response: authenticationResponse } = requestSchema.parse(body);

    // Get partner details
    const partner = await prisma.partner.findUnique({
      where: { id: userId },
      select: {
        id: true,
        emailAddress: true,
        contactName: true,
        businessName: true,
        approvalStatus: true,
        hasChangedPassword: true,
        passkeyEnabled: true,
        passkeyCredentials: true,
        mfaEnabled: true,
        stripeAccountId: true,
        stripeOnboardingCompleted: true,
        mfaWarningDismissedAt: true,
        hasSeenWelcomeVideo: true,
        walkthroughStartedAt: true,
        walkthroughCompletedAt: true,
        walkthroughSkipped: true,
      },
    });

    if (!partner) {
      return NextResponse.json(
        { error: 'Partner not found' },
        { status: 404 }
      );
    }

    // Check approval status
    if (partner.approvalStatus !== 'ACTIVE') {
      return NextResponse.json(
        { error: 'Partner account is not active' },
        { status: 403 }
      );
    }

    // Find the credential used for authentication
    const credentialId = authenticationResponse.id;
    const userCredentials = partner.passkeyCredentials.map(parseStoredCredential);
    const credential = userCredentials.find(cred => cred.id === credentialId);

    if (!credential) {
      return NextResponse.json(
        { error: 'Credential not found' },
        { status: 404 }
      );
    }

    // Verify the authentication response
    const verification = await verifyPasskeyAuthentication(
      authenticationResponse as AuthenticationResponseJSON,
      challenge,
      credential
    );

    if (!verification.verified || !verification.authenticationInfo) {
      return NextResponse.json(
        { error: 'Passkey authentication verification failed' },
        { status: 400 }
      );
    }

    // Update credential counter and last used timestamp
    const updatedCredential: PasskeyCredential = {
      ...credential,
      counter: verification.authenticationInfo.newCounter,
      lastUsedAt: new Date(),
    };

    // Update all credentials in the database
    const updatedCredentials = userCredentials.map(cred => 
      cred.id === credentialId ? serializeCredential(updatedCredential) : serializeCredential(cred)
    );

    await prisma.partner.update({
      where: { id: partner.id },
      data: {
        passkeyCredentials: updatedCredentials,
        passkeyLastUsedAt: new Date(),
      },
    });

    if (partner.mfaEnabled) {
      cookies().delete('passkey_auth_challenge');
      cookies().delete('passkey_auth_user_id');

      return NextResponse.json({
        success: true,
        requiresMFA: true,
        partnerId: partner.id,
        message: 'Multi-factor authentication required',
        authenticatedWith: 'passkey',
      });
    }

    // Generate JWT token
    const jwtPayload = {
      partnerId: partner.id,
      email: partner.emailAddress,
      hasChangedPassword: !partner.hasChangedPassword,
    };

    const token = await signJWT(jwtPayload);

    // Set cookie with JWT token (same method as regular login)
    cookies().set('partner_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60, // 7 days
      path: '/',
    });

    // Clear authentication cookies
    cookies().delete('passkey_auth_challenge');
    cookies().delete('passkey_auth_user_id');

    // Clear rate limiting on successful authentication
    const clientIP = request.headers.get('x-forwarded-for') || 'unknown';
    clearRateLimit(`partner-passkey-auth:${clientIP}`);

    // Check if MFA warning should be shown (same logic as password login)
    const stripeConnectEnabled = !!(partner.stripeAccountId && partner.stripeOnboardingCompleted);
    const mfaWarning = getMFAWarningState(
      stripeConnectEnabled,
      partner.mfaEnabled,
      partner.mfaWarningDismissedAt
    );
    const shouldStartWalkthrough = !partner.hasSeenWelcomeVideo &&
      !partner.walkthroughStartedAt &&
      !partner.walkthroughCompletedAt &&
      !partner.walkthroughSkipped;

    await prisma.partner.update({
      where: { id: partner.id },
      data: { lastLoginAt: new Date() },
    });

    logger.info('Partner passkey authentication completed', {
      partnerId: obfuscateId(partner.id),
      email: obfuscateEmail(partner.emailAddress),
      operation: 'partner_passkey_auth_finish',
      mfaEnabled: partner.mfaEnabled,
    });

    return NextResponse.json({
      success: true,
      message: 'Authentication successful',
      requirePasswordChange: !partner.hasChangedPassword,
      name: partner.contactName || partner.businessName || 'Partner',
      token, // Return token so client can store in localStorage
      authenticatedWith: 'passkey',
      deviceName: credential.deviceName,
      isFirstTimeLogin: !partner.hasSeenWelcomeVideo,
      shouldStartWalkthrough,
      mfaWarning: mfaWarning.shouldShow ? mfaWarning : null
    });

  } catch (error) {
    logger.error('Partner passkey authentication finish failed', error instanceof Error ? error : undefined, {
      operation: 'partner_passkey_auth_finish',
    });
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request data', details: error.errors },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to complete passkey authentication' },
      { status: 500 }
    );
  }
}
