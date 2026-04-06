import { NextRequest, NextResponse } from 'next/server';
import { verifyPartnerAuth } from '@/lib/auth/partnerAuth';
import { TelephonyCreditService } from '@/lib/services/telephonyCreditService';

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

    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get('session_id');

    if (!sessionId) {
      return NextResponse.json(
        { success: false, error: 'Session ID is required' },
        { status: 400 }
      );
    }

    // Verify the Stripe session and get purchase details
    const result = await TelephonyCreditService.verifyStripeSession(partner.id, sessionId);

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error || 'Failed to verify purchase' },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      data: result.data
    });

  } catch (error) {
    console.error('Error in verify-purchase API:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
