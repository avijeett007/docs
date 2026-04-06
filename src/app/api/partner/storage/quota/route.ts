import { NextRequest, NextResponse } from 'next/server';
import { verifyPartnerAuth } from '@/lib/auth/partnerAuth';
import PartnerStorageService from '@/lib/services/partnerStorageService';

export const dynamic = 'force-dynamic';

/**
 * GET /api/partner/storage/quota
 * Get partner's storage quota and usage information
 */
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

    // Get storage quota
    console.log('Fetching storage quota for partner:', partnerId);
    const quota = await PartnerStorageService.getStorageQuota(partnerId);
    console.log('Storage quota result:', quota);

    if (!quota) {
      console.error('Failed to get storage quota for partner:', partnerId);
      return NextResponse.json(
        { success: false, error: 'Failed to get storage quota' },
        { status: 500 }
      );
    }

    // Get storage usage breakdown
    const breakdown = await PartnerStorageService.getStorageUsageBreakdown(partnerId);
    console.log('Storage breakdown result:', breakdown);

    // Get pricing information
    const pricing = PartnerStorageService.getStoragePricing();
    console.log('Storage pricing result:', pricing);

    const responseData = {
      success: true,
      data: {
        quota,
        breakdown,
        pricing,
      }
    };

    console.log('Sending storage API response:', responseData);
    return NextResponse.json(responseData);

  } catch (error) {
    console.error('Error getting storage quota:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/partner/storage/quota
 * Purchase additional storage for partner
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
    const { additionalMB } = body;

    if (!additionalMB || additionalMB <= 0) {
      return NextResponse.json(
        { success: false, error: 'Invalid storage amount' },
        { status: 400 }
      );
    }

    // Calculate cost
    const cost = PartnerStorageService.calculateStorageCost(additionalMB);

    // For now, just update the storage quota (in production, integrate with Stripe)
    const result = await PartnerStorageService.purchaseAdditionalStorage(partnerId, additionalMB);

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 500 }
      );
    }

    // Get updated quota
    const updatedQuota = await PartnerStorageService.getStorageQuota(partnerId);

    return NextResponse.json({
      success: true,
      data: {
        quota: updatedQuota,
        cost,
        message: `Successfully purchased ${cost.storageGB}GB of additional storage for $${cost.costUSD}`
      }
    });

  } catch (error) {
    console.error('Error purchasing storage:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      },
      { status: 500 }
    );
  }
}
