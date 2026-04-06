import { NextRequest, NextResponse } from 'next/server';
import { verifyPartnerAuth } from '@/lib/auth/partnerAuth';
import { TelephonyCreditService } from '@/lib/services/telephonyCreditService';
import { TelephonyCreditBalanceResponse } from '@/lib/types/credits';

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

    const partnerId = partner.id;

    // Get telephony credit balance
    const balance = await TelephonyCreditService.getPartnerTelephonyCreditBalance(partnerId);

    if (!balance) {
      return NextResponse.json(
        { success: false, error: 'Failed to fetch telephony credit balance' },
        { status: 500 }
      );
    }

    const response: TelephonyCreditBalanceResponse = {
      success: true,
      data: balance
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('Error in telephony credits balance API:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
