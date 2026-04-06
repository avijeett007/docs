import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getPartnerIdFromRequest } from '@/lib/auth/partnerAuth';
import { CreditClaimService } from '@/services/CreditClaimService';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const partnerId = await getPartnerIdFromRequest(request);
    
    if (!partnerId) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const claimService = new CreditClaimService(prisma);
    const pendingClaims = await claimService.getPendingClaims(partnerId);

    return NextResponse.json({
      success: true,
      claims: pendingClaims
    });
  } catch (error) {
    console.error('Error fetching pending claims:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
