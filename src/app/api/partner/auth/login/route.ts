import { NextResponse } from 'next/server';

// This route uses dynamic features, so it must be server-rendered
export const dynamic = 'force-dynamic';

import { cookies } from 'next/headers';
import { prisma } from '@/lib/prisma';
import { verifyPassword } from '@/lib/password';
import { signJWT, verifyJWT } from '@/lib/jwt';
import { getMFAWarningState } from '@/lib/mfa';
import { logger } from '@/lib/logger';
import { obfuscateEmail, obfuscateId } from '@/lib/pii-obfuscation';

export async function POST(request: Request) {
  try {
    const { email, password } = await request.json();

    if (!email || !password) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    try {
      const partner = await prisma.partner.findUnique({
        where: { emailAddress: email },
        select: {
          id: true,
          emailAddress: true,
          hashedPassword: true,
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
      });

      // If no partner found or no password set, return 401
      if (!partner || !partner.hashedPassword) {
        return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
      }

      // Check approval status
      if (partner.approvalStatus !== 'ACTIVE') {
        return NextResponse.json(
          { error: 'Your partner account is pending approval' },
          { status: 403 }
        );
      }

      // Verify password
      const isValidPassword = await verifyPassword(password, partner.hashedPassword);
      if (!isValidPassword) {
        return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
      }

      // Check if MFA is enabled
      if (partner.mfaEnabled) {
        // Don't generate full JWT token yet, just return MFA requirement
        return NextResponse.json({
          requiresMFA: true,
          partnerId: partner.id,
          message: 'Multi-factor authentication required',
        });
      }

      // Generate JWT token with password change status (only if MFA is not enabled)
      const jwtPayload = {
        partnerId: partner.id,
        email: partner.emailAddress,
        hasChangedPassword: !partner.hasChangedPassword,
      };
      logger.debug('Creating JWT for partner login', {
        partnerId: obfuscateId(partner.id),
        email: obfuscateEmail(partner.emailAddress),
        operation: 'partner_login_jwt_create',
      });

      const token = await signJWT(jwtPayload);

      // Verify the token immediately to ensure it's valid
      try {
        const verifiedPayload = await verifyJWT(token);
        logger.debug('Partner login JWT verification', {
          partnerId: obfuscateId(partner.id),
          isValid: !!verifiedPayload,
          operation: 'partner_login_jwt_verify',
        });
      } catch (verifyError) {
        logger.error('Partner login JWT verification failed', verifyError instanceof Error ? verifyError : undefined, {
          partnerId: obfuscateId(partner.id),
          operation: 'partner_login_jwt_verify',
        });
      }

      // Update last login time
      await prisma.partner.update({
        where: { id: partner.id },
        data: { lastLoginAt: new Date() },
      });

      logger.info('Partner login successful', {
        partnerId: obfuscateId(partner.id),
        email: obfuscateEmail(partner.emailAddress),
        mfaEnabled: partner.mfaEnabled,
        operation: 'partner_login',
      });

      // Set cookie with JWT token
      cookies().set('partner_token', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 7 * 24 * 60 * 60, // 7 days
        path: '/',
      });

      // Check if MFA warning should be shown
      const stripeConnectEnabled = !!(partner.stripeAccountId && partner.stripeOnboardingCompleted);
      const mfaWarning = getMFAWarningState(
        stripeConnectEnabled,
        partner.mfaEnabled,
        partner.mfaWarningDismissedAt
      );

      // Check if partner should start walkthrough
      const shouldStartWalkthrough = !partner.hasSeenWelcomeVideo &&
                                   !partner.walkthroughStartedAt &&
                                   !partner.walkthroughCompletedAt &&
                                   !partner.walkthroughSkipped;

      return NextResponse.json({
        message: 'Login successful',
        requirePasswordChange: !partner.hasChangedPassword,
        name: partner.contactName || partner.businessName || 'Partner',
        token,
        isFirstTimeLogin: !partner.hasSeenWelcomeVideo,
        shouldStartWalkthrough,
        mfaWarning: mfaWarning.shouldShow ? mfaWarning : null
      });
    } catch (dbError) {
      logger.error('Partner login database error', dbError instanceof Error ? dbError : undefined, {
        operation: 'partner_login',
      });
      return NextResponse.json(
        { error: 'An error occurred while processing your request' },
        { status: 500 }
      );
    }
  } catch (error) {
    logger.error('Partner login request parsing error', error instanceof Error ? error : undefined, {
      operation: 'partner_login',
    });
    return NextResponse.json(
      { error: 'Invalid request format' },
      { status: 400 }
    );
  }
}
