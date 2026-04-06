import { NextRequest, NextResponse } from 'next/server';
import { verifyPartnerAuth } from '@/lib/auth/partnerAuth';
import { InvoiceService } from '@/lib/stripe/invoices';

export const dynamic = 'force-dynamic';

interface RouteParams {
  params: {
    id: string;
  };
}

/**
 * POST /api/partner/invoices/[id]/payment-intent - Create payment intent for invoice
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    // Verify partner authentication
    const partner = await verifyPartnerAuth(request);
    if (!partner) {
      return NextResponse.json(
        { error: 'Unauthorized', code: 'UNAUTHORIZED' },
        { status: 401 }
      );
    }

    const partnerId = partner.id;
    const invoiceId = params.id;

    // Verify invoice exists and partner owns it
    const existingInvoice = await InvoiceService.getInvoice(invoiceId);
    if (!existingInvoice) {
      return NextResponse.json(
        { error: 'Invoice not found', code: 'INVOICE_NOT_FOUND' },
        { status: 404 }
      );
    }

    if (existingInvoice.partner.id !== partnerId) {
      return NextResponse.json(
        { error: 'Access denied', code: 'ACCESS_DENIED' },
        { status: 403 }
      );
    }

    // Create payment intent
    const paymentIntent = await InvoiceService.createPaymentIntent(invoiceId);

    return NextResponse.json({
      success: true,
      data: {
        paymentIntentId: paymentIntent.paymentIntentId,
        clientSecret: paymentIntent.clientSecret,
        amount: paymentIntent.amount,
        applicationFeeAmount: paymentIntent.applicationFeeAmount,
        currency: paymentIntent.currency,
        invoice: {
          id: existingInvoice.id,
          invoiceNumber: existingInvoice.invoiceNumber,
          title: existingInvoice.title,
          description: existingInvoice.description,
        },
      },
    });
  } catch (error: any) {
    console.error('Error creating payment intent for invoice:', error);

    // Handle Stripe Connect errors
    if (error.type === 'StripeConnectError') {
      return NextResponse.json(
        {
          error: error.message,
          code: error.code,
        },
        { status: error.statusCode }
      );
    }

    // Handle other errors
    return NextResponse.json(
      {
        error: 'Failed to create payment intent',
        code: 'INTERNAL_ERROR',
      },
      { status: 500 }
    );
  }
}
