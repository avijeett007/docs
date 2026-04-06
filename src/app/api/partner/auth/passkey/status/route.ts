import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

const requestSchema = z.object({
  email: z.string().email(),
});

export async function POST(request: NextRequest) {
  try {
    // Parse request body
    const body = await request.json();
    const { email } = requestSchema.parse(body);

    // Find partner by email
    const partner = await prisma.partner.findUnique({
      where: { emailAddress: email },
      select: {
        id: true,
        passkeyEnabled: true,
        passkeyCredentials: true,
        approvalStatus: true,
      },
    });

    if (!partner) {
      return NextResponse.json({
        hasPasskeys: false,
        isActive: false,
      });
    }

    // Check if account is active
    const isActive = partner.approvalStatus === 'ACTIVE' || partner.approvalStatus === 'APPROVED';
    
    // Check if passkeys are available
    const hasPasskeys = partner.passkeyEnabled && partner.passkeyCredentials.length > 0;

    return NextResponse.json({
      hasPasskeys,
      isActive,
      credentialCount: partner.passkeyCredentials.length,
    });

  } catch (error) {
    console.error('Passkey status check error:', error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request data', details: error.errors },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to check passkey status' },
      { status: 500 }
    );
  }
}
