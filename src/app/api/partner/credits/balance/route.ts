import { NextRequest, NextResponse } from 'next/server';
import { verifyPartnerAuth } from '@/lib/auth/partnerAuth';
import { CreditService } from '@/lib/services/creditService';

export const dynamic = 'force-dynamic';

/**
 * GET /api/partner/credits/balance
 * Get partner's current credit balance and related information
 */
export async function GET(request: NextRequest) {
  try {
    // Verify partner authentication
    const authResult = await verifyPartnerAuth(request);
    if (!authResult) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const partnerId = authResult.id;

    // Get credit balance
    const creditBalance = await CreditService.getPartnerCreditBalance(partnerId);

    if (!creditBalance) {
      return NextResponse.json(
        { success: false, error: 'Partner not found' },
        { status: 404 }
      );
    }

    // Check for low credit alert
    const lowCreditAlert = await CreditService.checkLowCreditAlert(partnerId);

    return NextResponse.json({
      success: true,
      data: {
        ...creditBalance,
        partnerId,
        lowCreditAlert
      }
    });
  } catch (error) {
    console.error('Error getting credit balance:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/partner/credits/balance
 * Update partner's low credit notification settings
 */
export async function PATCH(request: NextRequest) {
  try {
    // Verify partner authentication
    const authResult = await verifyPartnerAuth(request);
    if (!authResult) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const partnerId = authResult.id;
    const body = await request.json();
    const { lowCreditThreshold, lowCreditNotificationsEnabled } = body;

    // Validate input
    if (lowCreditThreshold !== undefined && (typeof lowCreditThreshold !== 'number' || lowCreditThreshold < 0)) {
      return NextResponse.json(
        { success: false, error: 'Invalid low credit threshold' },
        { status: 400 }
      );
    }

    if (lowCreditNotificationsEnabled !== undefined && typeof lowCreditNotificationsEnabled !== 'boolean') {
      return NextResponse.json(
        { success: false, error: 'Invalid notification setting' },
        { status: 400 }
      );
    }

    // Update settings
    const result = await CreditService.updateLowCreditSettings(
      partnerId,
      lowCreditThreshold,
      lowCreditNotificationsEnabled
    );

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 500 }
      );
    }

    // Get updated balance
    const creditBalance = await CreditService.getPartnerCreditBalance(partnerId);

    return NextResponse.json({
      success: true,
      data: creditBalance
    });
  } catch (error) {
    console.error('Error updating credit settings:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
