import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { prisma } from '@/lib/prisma';
import { signJWT } from '@/lib/jwt';
import { logger } from '@/lib/logger';
import { verifyTOTP, isValidOTPFormat, isValidBackupCodeFormat, verifyAndConsumeBackupCode } from '@/lib/mfa';
import { decryptData } from '@/lib/encryption';
import { obfuscateId } from '@/lib/pii-obfuscation';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  let partnerIdForLog: string | null = null;

  try {
    const { partnerId, code, isBackupCode = false } = await request.json();
    partnerIdForLog = partnerId ?? null;

    if (!partnerId || !code) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Validate code format
    if (isBackupCode) {
      if (!isValidBackupCodeFormat(code)) {
        return NextResponse.json({ error: 'Invalid backup code format' }, { status: 400 });
      }
    } else if (code !== 'email_verified') {
      if (!isValidOTPFormat(code)) {
        return NextResponse.json({ error: 'Invalid code format' }, { status: 400 });
      }
    }

    // Get partner details
    const partner = await prisma.partner.findUnique({
      where: { id: partnerId },
      select: {
        id: true,
        emailAddress: true,
        businessName: true,
        contactName: true,
        mfaEnabled: true,
        mfaSecret: true,
        mfaBackupCodes: true,
        approvalStatus: true,
        hasChangedPassword: true,
        hasSeenWelcomeVideo: true,
        walkthroughStartedAt: true,
        walkthroughCompletedAt: true,
        walkthroughSkipped: true,
      },
    });

    if (!partner) {
      return NextResponse.json({ error: 'Partner not found' }, { status: 404 });
    }

    if (!partner.mfaEnabled) {
      return NextResponse.json({ error: 'MFA is not enabled' }, { status: 400 });
    }

    if (partner.approvalStatus !== 'ACTIVE') {
      return NextResponse.json({ error: 'Partner account is not active' }, { status: 403 });
    }

    let isValid = false;
    let updatedBackupCodes = partner.mfaBackupCodes;

    if (code === 'email_verified') {
      // Special case for email verification - already verified in previous step
      isValid = true;
    } else if (isBackupCode) {
      // Verify backup code
      const result = await verifyAndConsumeBackupCode(code, partner.mfaBackupCodes);
      isValid = result.isValid;
      updatedBackupCodes = result.remainingCodes;
    } else {
      // Verify TOTP code
      if (!partner.mfaSecret) {
        return NextResponse.json({ error: 'MFA secret not found' }, { status: 500 });
      }

      const secret = await decryptData(partner.mfaSecret);
      isValid = verifyTOTP(code, secret);
    }

    if (!isValid) {
      return NextResponse.json({ error: 'Invalid verification code' }, { status: 400 });
    }

    // Update partner with new backup codes if a backup code was used
    const updateData: any = {
      lastLoginAt: new Date(),
      mfaLastUsedAt: new Date(),
    };

    if (isBackupCode) {
      updateData.mfaBackupCodes = updatedBackupCodes;
    }

    await prisma.partner.update({
      where: { id: partner.id },
      data: updateData,
    });

    // Generate JWT token
    const jwtPayload = {
      partnerId: partner.id,
      email: partner.emailAddress,
      hasChangedPassword: !partner.hasChangedPassword,
    };

    const token = await signJWT(jwtPayload);

    // Set cookie with JWT token
    cookies().set('partner_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60, // 7 days
      path: '/',
    });

    const shouldStartWalkthrough = !partner.hasSeenWelcomeVideo &&
      !partner.walkthroughStartedAt &&
      !partner.walkthroughCompletedAt &&
      !partner.walkthroughSkipped;

    return NextResponse.json({
      message: 'MFA verification successful',
      requirePasswordChange: !partner.hasChangedPassword,
      name: partner.contactName || partner.businessName || 'Partner',
      token,
      isFirstTimeLogin: !partner.hasSeenWelcomeVideo,
      shouldStartWalkthrough,
      backupCodesRemaining: isBackupCode ? updatedBackupCodes.length : undefined,
    });

  } catch (error) {
    logger.error('Partner MFA verification failed', error instanceof Error ? error : undefined, {
      operation: 'partner_mfa_verify',
      partnerId: obfuscateId(partnerIdForLog),
    });
    return NextResponse.json(
      { error: 'Failed to verify MFA code' },
      { status: 500 }
    );
  }
}
