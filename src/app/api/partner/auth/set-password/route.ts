import { NextResponse } from 'next/server';

// This route uses dynamic features, so it must be server-rendered
export const dynamic = 'force-dynamic';

import type { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { hashPassword } from '@/lib/password';
import { validateApiKey } from '@/lib/apiAuth';

export async function GET(request: NextRequest) {
  // Validate API key
  const validation = validateApiKey(request);
  if (!validation.isValid) {
    return validation.error;
  }

  return NextResponse.json({
    message: 'Set password endpoint is available',
    methods: ['POST']
  });
}

export async function POST(request: NextRequest) {
  // Validate API key
  const validation = validateApiKey(request);
  if (!validation.isValid) {
    return validation.error;
  }

  try {
    const { email, password } = await request.json();

    if (!email || !password) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    if (password.length < 8) {
      return NextResponse.json(
        { error: 'Password must be at least 8 characters long' },
        { status: 400 }
      );
    }

    const partner = await prisma.partner.findUnique({
      where: { emailAddress: email },
      select: { id: true, approvalStatus: true },
    });

    if (!partner) {
      return NextResponse.json({ error: 'Partner not found' }, { status: 404 });
    }

    const hashedPassword = await hashPassword(password);

    await prisma.partner.update({
      where: { id: partner.id },
      data: {
        hashedPassword,
        approvalStatus: 'ACTIVE'
      },
    });

    return NextResponse.json({ message: 'Password set successfully' });
  } catch (error: any) {
    console.error('Error setting password:', error);
    return NextResponse.json(
      { error: 'Failed to set password' },
      { status: 500 }
    );
  }
}
