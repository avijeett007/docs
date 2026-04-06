import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { prisma } from '@/lib/prisma';
import { verifyJWT } from '@/lib/jwt';
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
        stripeAccountId: true,
        stripeOnboardingCompleted: true,
      },
    });

    if (!partner) {
      return NextResponse.json({ error: 'Partner not found' }, { status: 404 });
    }

    if (!partner.mfaEnabled) {
      return NextResponse.json({ error: 'MFA is not enabled' }, { status: 400 });
    }

    // Check if Stripe Connect is enabled - if so, MFA cannot be disabled
    const stripeConnectEnabled = !!(partner.stripeAccountId && partner.stripeOnboardingCompleted);
    if (stripeConnectEnabled) {
      return NextResponse.json({ 
        error: 'MFA cannot be disabled while Stripe Connect is active. MFA is required for payment processing security.' 
      }, { status: 403 });
    }

    // Verify password
    if (!partner.hashedPassword) {
      return NextResponse.json({ error: 'Password not set' }, { status: 400 });
    }

    const isValidPassword = await verifyPassword(password, partner.hashedPassword);
    if (!isValidPassword) {
      return NextResponse.json({ error: 'Invalid password' }, { status: 400 });
    }

    // Disable MFA
    await prisma.partner.update({
      where: { id: partner.id },
      data: {
        mfaEnabled: false,
        mfaSecret: null,
        mfaBackupCodes: [],
        mfaLastUsedAt: null,
      },
    });

    return NextResponse.json({
      message: 'MFA disabled successfully',
      mfaEnabled: false,
    });

  } catch (error) {
    console.error('MFA disable error:', error);
    return NextResponse.json(
      { error: 'Failed to disable MFA' },
      { status: 500 }
    );
  }
}
