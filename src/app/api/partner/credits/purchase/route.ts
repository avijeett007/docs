import { NextRequest, NextResponse } from 'next/server';
import { verifyPartnerAuth } from '@/lib/auth/partnerAuth';
import { CreditPurchaseService } from '@/lib/services/creditPurchaseService';
import { CreditPurchaseRequest } from '@/lib/types/credits';

export const dynamic = 'force-dynamic';

/**
 * POST /api/partner/credits/purchase
 * Create a Stripe checkout session for credit purchase
 */
export async function POST(request: NextRequest) {
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
    const { packageId, customCredits } = body;

    // Validate input
    if (!packageId && !customCredits) {
      return NextResponse.json(
        { success: false, error: 'Either packageId or customCredits must be provided' },
        { status: 400 }
      );
    }

    if (packageId && customCredits) {
      return NextResponse.json(
        { success: false, error: 'Cannot specify both packageId and customCredits' },
        { status: 400 }
      );
    }

    if (customCredits && (typeof customCredits !== 'number' || customCredits <= 0 || customCredits > 10000000)) {
      return NextResponse.json(
        { success: false, error: 'Custom credits must be a positive number between 1 and 10,000,000' },
        { status: 400 }
      );
    }

    const purchaseRequest: CreditPurchaseRequest = {
      partnerId,
      packageId,
      customCredits
    };

    // Create checkout session
    const result = await CreditPurchaseService.createCheckoutSession(purchaseRequest);

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        checkoutUrl: result.checkoutUrl
      }
    });
  } catch (error) {
    console.error('Error creating credit purchase:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/partner/credits/purchase
 * Get partner's credit purchase history
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
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');

    // Validate pagination parameters
    if (page < 1 || limit < 1 || limit > 100) {
      return NextResponse.json(
        { success: false, error: 'Invalid pagination parameters' },
        { status: 400 }
      );
    }

    // Get purchase history
    const result = await CreditPurchaseService.getPurchaseHistory(partnerId, page, limit);

    return NextResponse.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('Error getting purchase history:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
