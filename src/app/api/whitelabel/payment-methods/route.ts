import { NextRequest, NextResponse } from 'next/server';
import { PaymentMethodService } from '@/lib/stripe/paymentMethods';
import { verifyCustomerAuth } from '@/lib/auth/customerAuth';
import { isStripeConnectError } from '@/lib/stripe/utils';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

// Validation schemas
const createSetupIntentSchema = z.object({
  returnUrl: z.string().url('Invalid return URL'),
  metadata: z.record(z.string()).optional(),
});

const savePaymentMethodSchema = z.object({
  stripePaymentMethodId: z.string().min(1, 'Payment method ID is required'),
  setAsDefault: z.boolean().optional(),
  billingAddress: z.object({
    line1: z.string().optional(),
    line2: z.string().optional(),
    city: z.string().optional(),
    state: z.string().optional(),
    postal_code: z.string().optional(),
    country: z.string().optional(),
  }).optional(),
  metadata: z.record(z.string()).optional(),
});

/**
 * GET /api/whitelabel/payment-methods
 * Get customer's payment methods
 */
export async function GET(request: NextRequest) {
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

    // Get payment methods
    const paymentMethods = await PaymentMethodService.getCustomerPaymentMethods(
      customerId,
      partnerId
    );

    return NextResponse.json({
      success: true,
      data: { paymentMethods },
    });
  } catch (error: any) {
    console.error('Error fetching payment methods:', error);

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
 * POST /api/whitelabel/payment-methods
 * Create setup intent or save payment method
 */
export async function POST(request: NextRequest) {
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
    const body = await request.json();
    const action = body.action;

    if (action === 'create_setup_intent') {
      // Validate request body
      const validationResult = createSetupIntentSchema.safeParse(body);
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

      const { returnUrl, metadata } = validationResult.data;

      // Create setup intent
      const setupIntent = await PaymentMethodService.createSetupIntent({
        customerId,
        partnerId,
        returnUrl,
        metadata,
      });

      return NextResponse.json({
        success: true,
        data: setupIntent,
      });
    } else if (action === 'save_payment_method') {
      // Validate request body
      const validationResult = savePaymentMethodSchema.safeParse(body);
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

      const { stripePaymentMethodId, setAsDefault, billingAddress, metadata } = validationResult.data;

      // Save payment method
      const paymentMethod = await PaymentMethodService.savePaymentMethod({
        customerId,
        partnerId,
        stripePaymentMethodId,
        setAsDefault,
        billingAddress,
        metadata,
      });

      return NextResponse.json({
        success: true,
        data: { paymentMethod },
      });
    } else {
      return NextResponse.json(
        { success: false, error: 'Invalid action' },
        { status: 400 }
      );
    }
  } catch (error: any) {
    console.error('Error processing payment method request:', error);

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
