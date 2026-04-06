import { NextRequest, NextResponse } from 'next/server';
import { PaymentMethodService } from '@/lib/stripe/paymentMethods';
import { verifyCustomerAuth } from '@/lib/auth/customerAuth';
import { isStripeConnectError } from '@/lib/stripe/utils';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

interface RouteParams {
  params: {
    paymentMethodId: string;
  };
}

// Validation schema
const updatePaymentMethodSchema = z.object({
  action: z.enum(['set_default']),
});

/**
 * PATCH /api/whitelabel/payment-methods/[paymentMethodId]
 * Update payment method (e.g., set as default)
 */
export async function PATCH(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    // Verify customer authentication
    const authResult = await verifyCustomerAuth(request);
    if (!authResult) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { customerId, partnerId } = authResult;
    const { paymentMethodId } = params;
    const body = await request.json();

    // Validate request body
    const validationResult = updatePaymentMethodSchema.safeParse(body);
    if (!validationResult.success) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Invalid request data',
          details: validationResult.error.errors 
        },
        { status: 400 }
      );
    }

    const { action } = validationResult.data;

    if (action === 'set_default') {
      await PaymentMethodService.setDefaultPaymentMethod(
        paymentMethodId,
        customerId,
        partnerId
      );

      return NextResponse.json({
        success: true,
        message: 'Payment method set as default',
      });
    }

    return NextResponse.json(
      { success: false, error: 'Invalid action' },
      { status: 400 }
    );
  } catch (error: any) {
    console.error('Error updating payment method:', error);

    if (isStripeConnectError(error)) {
      return NextResponse.json(
        { success: false, error: error.message, code: error.code },
        { status: error.statusCode || 500 }
      );
    }

    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/whitelabel/payment-methods/[paymentMethodId]
 * Delete payment method
 */
export async function DELETE(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    // Verify customer authentication
    const authResult = await verifyCustomerAuth(request);
    if (!authResult) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { customerId, partnerId } = authResult;
    const { paymentMethodId } = params;

    await PaymentMethodService.deletePaymentMethod(
      paymentMethodId,
      customerId,
      partnerId
    );

    return NextResponse.json({
      success: true,
      message: 'Payment method deleted successfully',
    });
  } catch (error: any) {
    console.error('Error deleting payment method:', error);

    if (isStripeConnectError(error)) {
      return NextResponse.json(
        { success: false, error: error.message, code: error.code },
        { status: error.statusCode || 500 }
      );
    }

    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
