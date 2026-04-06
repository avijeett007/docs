import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { prisma } from '@/lib/prisma';
import { verifyJWT } from '@/lib/jwt';
import { verifyTOTP, isValidOTPFormat } from '@/lib/mfa';
import { decryptData } from '@/lib/encryption';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const { token } = await request.json();

    if (!token || !isValidOTPFormat(token)) {
      return NextResponse.json({ error: 'Invalid token format' }, { status: 400 });
    }

    // Get partner from JWT token
    const jwtToken = cookies().get('partner_token')?.value;
    if (!jwtToken) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const payload = await verifyJWT(jwtToken);
    if (!payload) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    // Get partner details
    const partner = await prisma.partner.findUnique({
      where: { id: payload.partnerId },
      select: {
        id: true,
        mfaEnabled: true,
        mfaSecret: true,
      },
    });

    if (!partner) {
      return NextResponse.json({ error: 'Partner not found' }, { status: 404 });
    }

    // Check if MFA is already enabled
    if (partner.mfaEnabled) {
      return NextResponse.json({ error: 'MFA is already enabled' }, { status: 400 });
    }

    // Check if setup was initiated
    if (!partner.mfaSecret) {
      return NextResponse.json({ error: 'MFA setup not initiated' }, { status: 400 });
    }

    // Decrypt the secret
    const secret = await decryptData(partner.mfaSecret);

    // Verify the TOTP token
    const isValid = verifyTOTP(token, secret);
    if (!isValid) {
      return NextResponse.json({ error: 'Invalid verification code' }, { status: 400 });
    }

    // Enable MFA
    await prisma.partner.update({
      where: { id: partner.id },
      data: {
        mfaEnabled: true,
        mfaLastUsedAt: new Date(),
      },
    });

    return NextResponse.json({
      message: 'MFA enabled successfully',
      mfaEnabled: true,
    });

  } catch (error) {
    console.error('MFA verification setup error:', error);
    return NextResponse.json(
      { error: 'Failed to verify MFA setup' },
      { status: 500 }
    );
  }
}
