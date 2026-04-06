// API endpoint for payment operations by ID

import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
import { StripePaymentService } from '@/lib/stripe/payments';
import { isStripeConnectError, isValidPaymentIntentId } from '@/lib/stripe/utils';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const paymentIntentId = params.id;

    if (!isValidPaymentIntentId(paymentIntentId)) {
      return NextResponse.json(
        { error: 'Invalid payment intent ID' },
        { status: 400 }
      );
    }

    // Get payment intent details
    const paymentIntent = await StripePaymentService.getPaymentIntent(paymentIntentId);

    return NextResponse.json({
      success: true,
      data: paymentIntent,
    });
  } catch (error: any) {
    console.error('Error retrieving payment intent:', error);

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

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const paymentIntentId = params.id;
    const body = await request.json();
    const { action, paymentMethodId, amount, reason } = body;

    if (!isValidPaymentIntentId(paymentIntentId)) {
      return NextResponse.json(
        { error: 'Invalid payment intent ID' },
        { status: 400 }
      );
    }

    let result;

    switch (action) {
      case 'confirm':
        result = await StripePaymentService.confirmPaymentIntent(
          paymentIntentId,
          paymentMethodId
        );
        break;

      case 'refund':
        result = await StripePaymentService.refundPayment(
          paymentIntentId,
          amount,
          reason
        );
        break;

      default:
        return NextResponse.json(
          { error: 'Invalid action. Supported actions: confirm, refund' },
          { status: 400 }
        );
    }

    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (error: any) {
    console.error(`Error processing payment action:`, error);

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
