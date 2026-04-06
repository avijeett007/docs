import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { prisma } from '@/lib/prisma';
import { verifyJWT } from '@/lib/jwt';
import { generateBackupCodes, encryptBackupCodes } from '@/lib/mfa';
import { verifyPassword } from '@/lib/password';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const { password } = await request.json();

    if (!password) {
      return NextResponse.json({ error: 'Password is required' }, { status: 400 });
    }

    // Get partner from JWT token
    const token = cookies().get('partner_token')?.value;
    if (!token) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const payload = await verifyJWT(token);
    if (!payload) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    // Get partner details
    const partner = await prisma.partner.findUnique({
      where: { id: payload.partnerId },
      select: {
        id: true,
        hashedPassword: true,
        mfaEnabled: true,
      },
    });

    if (!partner) {
      return NextResponse.json({ error: 'Partner not found' }, { status: 404 });
    }

    if (!partner.mfaEnabled) {
      return NextResponse.json({ error: 'MFA is not enabled' }, { status: 400 });
    }

    // Verify password
    if (!partner.hashedPassword) {
      return NextResponse.json({ error: 'Password not set' }, { status: 400 });
    }

    const isValidPassword = await verifyPassword(password, partner.hashedPassword);
    if (!isValidPassword) {
      return NextResponse.json({ error: 'Invalid password' }, { status: 400 });
    }

    // Generate new backup codes
    const backupCodes = generateBackupCodes();
    const encryptedBackupCodes = await encryptBackupCodes(backupCodes);

    // Update partner with new backup codes
    await prisma.partner.update({
      where: { id: partner.id },
      data: {
        mfaBackupCodes: encryptedBackupCodes,
      },
    });

    return NextResponse.json({
      message: 'New backup codes generated successfully',
      backupCodes,
    });

  } catch (error) {
    console.error('Backup codes generation error:', error);
    return NextResponse.json(
      { error: 'Failed to generate backup codes' },
      { status: 500 }
    );
  }
}

export async function GET(request: Request) {
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

    // Get partner backup codes count
    const partner = await prisma.partner.findUnique({
      where: { id: payload.partnerId },
      select: {
        id: true,
        mfaEnabled: true,
        mfaBackupCodes: true,
      },
    });

    if (!partner) {
      return NextResponse.json({ error: 'Partner not found' }, { status: 404 });
    }

    if (!partner.mfaEnabled) {
      return NextResponse.json({ error: 'MFA is not enabled' }, { status: 400 });
    }

    return NextResponse.json({
      backupCodesCount: partner.mfaBackupCodes.length,
    });

  } catch (error) {
    console.error('Backup codes check error:', error);
    return NextResponse.json(
      { error: 'Failed to check backup codes' },
      { status: 500 }
    );
  }
}
