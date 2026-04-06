import { NextRequest, NextResponse } from 'next/server';
import { verifyPartnerAuth } from '@/lib/auth/partnerAuth';
import { CreditPurchaseService } from '@/lib/services/creditPurchaseService';
import { calculateDiscountedPrice } from '@/lib/types/credits';

export const dynamic = 'force-dynamic';

/**
 * GET /api/partner/credits/packages
 * Get available credit packages for purchase
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

    // Initialize default packages if they don't exist
    await CreditPurchaseService.initializeDefaultPackages();

    // Get available packages
    const packages = await CreditPurchaseService.getCreditPackages();

    // Get custom pricing calculation for reference
    const { searchParams } = new URL(request.url);
    const customCredits = searchParams.get('custom_credits');
    
    let customPricing = null;
    if (customCredits) {
      const credits = parseInt(customCredits);
      if (!isNaN(credits) && credits > 0) {
        customPricing = {
          credits,
          ...calculateDiscountedPrice(credits)
        };
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        packages,
        customPricing,
        baseRate: {
          description: '1 Credit = 1 Cent (base rate)',
          creditsPerDollar: 100
        }
      }
    });
  } catch (error) {
    console.error('Error getting credit packages:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
