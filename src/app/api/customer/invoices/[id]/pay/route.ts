import { NextRequest, NextResponse } from 'next/server';
import { InvoiceService } from '@/lib/stripe/invoices';

export const dynamic = 'force-dynamic';

interface RouteParams {
  params: {
    id: string;
  };
}

/**
 * Verify customer authentication from whitelabel portal
 */
async function verifyCustomerAuth(request: NextRequest): Promise<{
  success: boolean;
  customerId?: string;
  partnerId?: string;
}> {
  try {
    // For now, we'll extract customer info from headers or query params
    // This should be replaced with proper whitelabel authentication
    const customerId = request.headers.get('x-customer-id') || 
                      new URL(request.url).searchParams.get('customerId');
    const partnerId = request.headers.get('x-partner-id') || 
                     new URL(request.url).searchParams.get('partnerId');

    if (!customerId || !partnerId) {
      return { success: false };
    }

    // TODO: Implement proper customer authentication verification
    return {
      success: true,
      customerId,
      partnerId,
    };
  } catch (error) {
    console.error('Error verifying customer auth:', error);
    return { success: false };
  }
}

/**
 * POST /api/customer/invoices/[id]/pay - Create payment intent for customer to pay invoice
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    // Verify customer authentication
    const authResult = await verifyCustomerAuth(request);
    if (!authResult.success) {
      return NextResponse.json(
        { error: 'Unauthorized', code: 'UNAUTHORIZED' },
        { status: 401 }
      );
    }

    const customerId = authResult.customerId!;
    const invoiceId = params.id;

    // Verify invoice exists and customer owns it
    const existingInvoice = await InvoiceService.getInvoice(invoiceId);
    if (!existingInvoice) {
      return NextResponse.json(
        { error: 'Invoice not found', code: 'INVOICE_NOT_FOUND' },
        { status: 404 }
      );
    }

    if (existingInvoice.customer.id !== customerId) {
      return NextResponse.json(
        { error: 'Access denied', code: 'ACCESS_DENIED' },
        { status: 403 }
      );
    }

    // Check if invoice can be paid
    if (existingInvoice.status === 'paid') {
      return NextResponse.json(
        { error: 'Invoice is already paid', code: 'INVOICE_ALREADY_PAID' },
        { status: 400 }
      );
    }

    if (existingInvoice.status === 'cancelled') {
      return NextResponse.json(
        { error: 'Invoice is cancelled', code: 'INVOICE_CANCELLED' },
        { status: 400 }
      );
    }

    if (existingInvoice.status === 'draft') {
      return NextResponse.json(
        { error: 'Invoice is not ready for payment', code: 'INVOICE_NOT_READY' },
        { status: 400 }
      );
    }

    // Create payment intent
    const paymentIntent = await InvoiceService.createPaymentIntent(invoiceId);

    // Calculate additional information for customer
    const isOverdue = existingInvoice.dueDate && existingInvoice.status !== 'paid' && existingInvoice.status !== 'cancelled' 
      ? new Date() > new Date(existingInvoice.dueDate) 
      : false;

    return NextResponse.json({
      success: true,
      data: {
        paymentIntentId: paymentIntent.paymentIntentId,
        clientSecret: paymentIntent.clientSecret,
        amount: paymentIntent.amount,
        currency: paymentIntent.currency,
        formattedAmount: `$${(paymentIntent.amount / 100).toFixed(2)}`,
        invoice: {
          id: existingInvoice.id,
          invoiceNumber: existingInvoice.invoiceNumber,
          title: existingInvoice.title,
          description: existingInvoice.description,
          dueDate: existingInvoice.dueDate,
          isOverdue,
          partner: {
            businessName: existingInvoice.partner.businessName,
            emailAddress: existingInvoice.partner.emailAddress,
          },
        },
        // Payment processing information
        processingInfo: {
          applicationFeeAmount: paymentIntent.applicationFeeAmount,
          platformFeePercentage: ((paymentIntent.applicationFeeAmount / paymentIntent.amount) * 100).toFixed(2),
          partnerReceivesAmount: paymentIntent.amount - paymentIntent.applicationFeeAmount,
          formattedPartnerReceives: `$${((paymentIntent.amount - paymentIntent.applicationFeeAmount) / 100).toFixed(2)}`,
        },
      },
      message: 'Payment intent created successfully. Use the client secret to complete payment.',
    });
  } catch (error: any) {
    console.error('Error creating payment intent for customer:', error);

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
