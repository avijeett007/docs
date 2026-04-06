import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { prisma } from '@/lib/prisma';
import { verifyJWT } from '@/lib/jwt';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
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

    // Update partner's warning dismissal timestamp
    await prisma.partner.update({
      where: { id: payload.partnerId },
      data: {
        mfaWarningDismissedAt: new Date(),
      },
    });

    return NextResponse.json({
      message: 'MFA warning dismissed successfully',
    });

  } catch (error) {
    console.error('MFA warning dismissal error:', error);
    return NextResponse.json(
      { error: 'Failed to dismiss MFA warning' },
      { status: 500 }
    );
  }
}
