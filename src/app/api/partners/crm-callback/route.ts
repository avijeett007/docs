import { NextResponse, NextRequest } from 'next/server';

// This route uses dynamic features, so it must be server-rendered
export const dynamic = 'force-dynamic';

import { prisma } from '@/lib/prisma';
import { hashPassword } from '@/lib/password';

// This endpoint will be called by the CRM when a partner is approved
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { partnerId, status, temporaryPassword } = body;

    // Verify the request comes from your CRM (you should implement proper authentication)
    // TODO: Add CRM authentication check here

    // Hash the temporary password if provided
    const hashedPassword = temporaryPassword ? await hashPassword(temporaryPassword) : undefined;

    // Update partner status in database
    const partner = await prisma.partner.update({
      where: { id: partnerId },
      data: {
        approvalStatus: status,
        hashedPassword: hashedPassword,
        ...(status === 'ACTIVE' ? { lastLoginAt: null } : {}),
      },
    });

    return NextResponse.json({ success: true, data: partner });
  } catch (error) {
    console.error('Error in CRM callback:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to process CRM callback' },
      { status: 500 }
    );
  }
}
