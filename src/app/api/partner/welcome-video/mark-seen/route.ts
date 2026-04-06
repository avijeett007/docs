import { NextRequest, NextResponse } from 'next/server';
import { verifyPartnerAuth } from '@/lib/auth/partnerAuth';
import { prisma } from '@/lib/prisma';

export async function POST(request: NextRequest) {
  try {
    // Verify partner authentication
    const partner = await verifyPartnerAuth(request);
    if (!partner) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Update the partner's welcome video status
    await prisma.partner.update({
      where: { id: partner.id },
      data: { hasSeenWelcomeVideo: true },
    });

    return NextResponse.json({
      success: true,
      message: 'Welcome video marked as seen'
    });

  } catch (error) {
    console.error('Error marking welcome video as seen:', error);
    return NextResponse.json(
      { error: 'Failed to update welcome video status' },
      { status: 500 }
    );
  }
}
