// API endpoint for creating payment intents

import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
import { StripePaymentService } from '@/lib/stripe/payments';
import { isStripeConnectError, validatePaymentAmount, isSupportedCurrency } from '@/lib/stripe/utils';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      amount,
      currency = 'usd',
      description,
      customerEmail,
      metadata = {},
      partnerId,
      customerId,
    } = body;

    // Validate required fields
    if (!amount || !partnerId) {
      return NextResponse.json(
        { error: 'Missing required fields: amount, partnerId' },
        { status: 400 }
      );
    }

    // Validate amount
    const amountValidation = validatePaymentAmount(amount, currency);
    if (!amountValidation.isValid) {
      return NextResponse.json(
        { error: amountValidation.error },
        { status: 400 }
      );
    }

    // Validate currency
    if (!isSupportedCurrency(currency)) {
      return NextResponse.json(
        { error: `Unsupported currency: ${currency}` },
        { status: 400 }
      );
    }

    // Create payment intent
    const result = await StripePaymentService.createPaymentIntent({
      amount,
      currency,
      description,
      customerEmail,
      metadata,
      partnerId,
      customerId,
    });

    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (error: any) {
    console.error('Error creating payment intent:', error);

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
