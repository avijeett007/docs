import { NextRequest, NextResponse } from 'next/server';
import { verifyPartnerAuth } from '@/lib/auth/partnerAuth';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    // Verify partner authentication
    const partner = await verifyPartnerAuth(request);
    if (!partner) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get active telephony credit packages
    const packages = await prisma.telephonyCreditPackage.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: 'asc' }
    });

    const response = {
      success: true,
      data: packages
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('Error in telephony credit packages API:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
