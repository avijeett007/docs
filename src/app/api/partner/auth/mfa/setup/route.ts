import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { prisma } from '@/lib/prisma';
import { verifyJWT } from '@/lib/jwt';
import { logger } from '@/lib/logger';
import { getMFAWarningState } from '@/lib/mfa';
import { generateTOTPSecret, generateQRCode, generateBackupCodes, encryptBackupCodes } from '@/lib/mfa';
import { encryptData } from '@/lib/encryption';
import { obfuscateId } from '@/lib/pii-obfuscation';

export const dynamic = 'force-dynamic';

export async function POST() {
  let partnerIdForLog: string | null = null;

  try {
    // Get partner from JWT token
    const token = cookies().get('partner_token')?.value;
    if (!token) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const payload = await verifyJWT(token);
    if (!payload) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    partnerIdForLog = payload.partnerId;

    // Get partner details
    const partner = await prisma.partner.findUnique({
      where: { id: payload.partnerId },
      select: {
        id: true,
        emailAddress: true,
        businessName: true,
        mfaEnabled: true,
      },
    });

    if (!partner) {
      return NextResponse.json({ error: 'Partner not found' }, { status: 404 });
    }

    // Check if MFA is already enabled
    if (partner.mfaEnabled) {
      return NextResponse.json({ error: 'MFA is already enabled' }, { status: 400 });
    }

    // Generate TOTP secret
    const secret = generateTOTPSecret();
    
    // Generate QR code for the secret
    const qrCodeUrl = await generateQRCode(
      secret, 
      partner.emailAddress, 
      `${partner.businessName} - Knotie AI Pro`
    );

    // Generate backup codes
    const backupCodes = generateBackupCodes();
    const encryptedBackupCodes = await encryptBackupCodes(backupCodes);

    // Encrypt the secret for temporary storage
    const encryptedSecret = await encryptData(secret);

    // Store the setup data temporarily (we'll enable MFA after verification)
    await prisma.partner.update({
      where: { id: partner.id },
      data: {
        mfaSecret: encryptedSecret,
        mfaBackupCodes: encryptedBackupCodes,
      },
    });

    return NextResponse.json({
      secret,
      qrCodeUrl,
      backupCodes,
      manualEntryKey: secret,
      issuer: `${partner.businessName} - Knotie AI Pro`,
      accountName: partner.emailAddress,
    });

  } catch (error) {
    logger.error('Partner MFA setup initialization failed', error instanceof Error ? error : undefined, {
      operation: 'partner_mfa_setup',
      partnerId: obfuscateId(partnerIdForLog),
    });
    return NextResponse.json(
      { error: 'Failed to setup MFA' },
      { status: 500 }
    );
  }
}

export async function GET() {
  let partnerIdForLog: string | null = null;

  try {
    // Get partner from JWT token
    const token = cookies().get('partner_token')?.value;
    if (!token) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const payload = await verifyJWT(token);
    if (!payload) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    partnerIdForLog = payload.partnerId;

    // Get partner MFA status
    const partner = await prisma.partner.findUnique({
      where: { id: payload.partnerId },
      select: {
        id: true,
        mfaEnabled: true,
        mfaLastUsedAt: true,
        stripeAccountId: true,
        stripeOnboardingCompleted: true,
        mfaWarningDismissedAt: true,
      },
    });

    if (!partner) {
      return NextResponse.json({ error: 'Partner not found' }, { status: 404 });
    }

    // Check if Stripe Connect is enabled
    const stripeConnectEnabled = !!(partner.stripeAccountId && partner.stripeOnboardingCompleted);
    const mfaWarning = getMFAWarningState(
      stripeConnectEnabled,
      partner.mfaEnabled,
      partner.mfaWarningDismissedAt
    );

    return NextResponse.json({
      mfaEnabled: partner.mfaEnabled,
      mfaLastUsedAt: partner.mfaLastUsedAt,
      stripeConnectEnabled,
      mfaWarningDismissedAt: partner.mfaWarningDismissedAt,
      mfaWarning,
    });

  } catch (error) {
    logger.error('Partner MFA status check failed', error instanceof Error ? error : undefined, {
      operation: 'partner_mfa_status',
      partnerId: obfuscateId(partnerIdForLog),
    });
    return NextResponse.json(
      { error: 'Failed to check MFA status' },
      { status: 500 }
    );
  }
}
