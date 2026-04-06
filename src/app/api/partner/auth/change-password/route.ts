import { NextResponse } from 'next/server';

// This route uses dynamic features, so it must be server-rendered
export const dynamic = 'force-dynamic';

import { cookies } from 'next/headers';
import { verifyJWT } from '@/lib/jwt';
import { prisma } from '@/lib/prisma';
import { hashPassword, verifyPassword } from '@/lib/password';

export async function POST(request: Request) {
  try {
    const token = cookies().get('partner_token')?.value;
    
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const payload = await verifyJWT(token);
    if (!payload || !payload.partnerId) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    const { currentPassword, newPassword } = await request.json();

    if (!currentPassword || !newPassword) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    if (newPassword.length < 8) {
      return NextResponse.json(
        { error: 'New password must be at least 8 characters long' },
        { status: 400 }
      );
    }

    const partner = await prisma.partner.findUnique({
      where: { id: payload.partnerId },
      select: {
        hashedPassword: true,
        hasSeenWelcomeVideo: true,
        contactName: true,
        businessName: true
      },
    });

    if (!partner || !partner.hashedPassword) {
      return NextResponse.json({ error: 'Partner not found' }, { status: 404 });
    }

    const isValidPassword = await verifyPassword(currentPassword, partner.hashedPassword);
    if (!isValidPassword) {
      return NextResponse.json({ error: 'Current password is incorrect' }, { status: 400 });
    }

    const newHashedPassword = await hashPassword(newPassword);

    await prisma.partner.update({
      where: { id: payload.partnerId },
      data: {
        hashedPassword: newHashedPassword,
        hasChangedPassword: true,
        lastLoginAt: new Date(),
      },
    });

    return NextResponse.json({
      message: 'Password changed successfully',
      isFirstTimeLogin: !partner.hasSeenWelcomeVideo,
      name: partner.contactName || partner.businessName || 'Partner'
    });
  } catch (error: any) {
    console.error('Error changing password:', error);
    return NextResponse.json(
      { error: 'Failed to change password' },
      { status: 500 }
    );
  }
}
