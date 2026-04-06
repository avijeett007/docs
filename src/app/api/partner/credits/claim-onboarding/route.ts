import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getPartnerIdFromRequest } from '@/lib/auth/partnerAuth';
import { CreditClaimService } from '@/services/CreditClaimService';



export async function POST(request: NextRequest) {
  try {
    const partnerId = await getPartnerIdFromRequest(request);
    
    if (!partnerId) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { claimMethod, socialMessage } = body;

    if (!claimMethod || !['direct', 'social_share'].includes(claimMethod)) {
      return NextResponse.json(
        { success: false, error: 'Invalid claim method' },
        { status: 400 }
      );
    }

    const claimService = new CreditClaimService(prisma);
    const result = await claimService.claimOnboardingCredits(partnerId, {
      claimMethod,
      socialMessage
    });

    if (result.success) {
      return NextResponse.json(result);
    } else {
      return NextResponse.json(
        { success: false, error: result.message },
        { status: 400 }
      );
    }
  } catch (error) {
    console.error('Error claiming onboarding credits:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
