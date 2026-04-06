import { NextRequest, NextResponse } from 'next/server';
import { verifyPartnerAuth } from '@/lib/auth/partnerAuth';
import { CreditService } from '@/lib/services/creditService';
import { CreditTransactionType } from '@/lib/types/credits';

export const dynamic = 'force-dynamic';

/**
 * GET /api/partner/credits/transactions
 * Get partner's credit transaction history
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
    const limit = parseInt(searchParams.get('limit') || '50');
    const type = searchParams.get('type') as CreditTransactionType | null;

    // Validate pagination parameters
    if (page < 1 || limit < 1 || limit > 100) {
      return NextResponse.json(
        { success: false, error: 'Invalid pagination parameters' },
        { status: 400 }
      );
    }

    // Validate transaction type if provided
    const validTypes: CreditTransactionType[] = ['purchase', 'allocation', 'usage', 'refund', 'adjustment'];
    if (type && !validTypes.includes(type)) {
      return NextResponse.json(
        { success: false, error: 'Invalid transaction type' },
        { status: 400 }
      );
    }

    // Get transaction history
    const result = await CreditService.getCreditTransactions(
      partnerId, 
      page, 
      limit, 
      type || undefined
    );

    return NextResponse.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('Error getting credit transactions:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
