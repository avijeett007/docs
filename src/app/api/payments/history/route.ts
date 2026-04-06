// API endpoint for payment history

import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
import { StripePaymentService } from '@/lib/stripe/payments';
import { isStripeConnectError } from '@/lib/stripe/utils';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const partnerId = searchParams.get('partnerId');
    const customerId = searchParams.get('customerId');
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');

    // Validate parameters
    if (limit > 100) {
      return NextResponse.json(
        { error: 'Limit cannot exceed 100' },
        { status: 400 }
      );
    }

    if (offset < 0) {
      return NextResponse.json(
        { error: 'Offset cannot be negative' },
        { status: 400 }
      );
    }

    let result;

    if (partnerId) {
      // Get payment history for partner
      result = await StripePaymentService.getPartnerPaymentHistory(
        partnerId,
        limit,
        offset
      );
    } else if (customerId) {
      // Get payment history for customer
      result = await StripePaymentService.getCustomerPaymentHistory(
        customerId,
        limit,
        offset
      );
    } else {
      return NextResponse.json(
        { error: 'Either partnerId or customerId is required' },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (error: any) {
    console.error('Error retrieving payment history:', error);

    if (isStripeConnectError(error)) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: error.statusCode || 500 }
      );
    }

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
