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
 * GET /api/customer/invoices/[id] - Get specific invoice for customer
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
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

    // Get invoice
    const invoice = await InvoiceService.getInvoice(invoiceId);

    if (!invoice) {
      return NextResponse.json(
        { error: 'Invoice not found', code: 'INVOICE_NOT_FOUND' },
        { status: 404 }
      );
    }

    // Verify customer owns this invoice
    if (invoice.customer.id !== customerId) {
      return NextResponse.json(
        { error: 'Access denied', code: 'ACCESS_DENIED' },
        { status: 403 }
      );
    }

    // Calculate additional fields for customer view
    const isOverdue = invoice.dueDate && invoice.status !== 'paid' && invoice.status !== 'cancelled' 
      ? new Date() > new Date(invoice.dueDate) 
      : false;

    const daysUntilDue = invoice.dueDate && invoice.status !== 'paid' && invoice.status !== 'cancelled'
      ? Math.ceil((new Date(invoice.dueDate).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))
      : null;

    // Format response
    const formattedInvoice = {
      id: invoice.id,
      invoiceNumber: invoice.invoiceNumber,
      title: invoice.title,
      description: invoice.description,
      amount: invoice.amount,
      currency: invoice.currency,
      status: invoice.status,
      type: invoice.type,
      dueDate: invoice.dueDate,
      paidAt: invoice.paidAt,
      createdAt: invoice.createdAt,
      updatedAt: invoice.updatedAt,
      partner: {
        id: invoice.partner.id,
        businessName: invoice.partner.businessName,
        emailAddress: invoice.partner.emailAddress,
      },
      payments: invoice.payments.map((payment) => ({
        id: payment.id,
        amount: payment.amount,
        status: payment.status,
        paidAt: payment.paidAt,
      })),
      isOverdue,
      daysUntilDue,
      // Payment status indicators
      canPay: invoice.status === 'sent' || invoice.status === 'overdue',
      isPaid: invoice.status === 'paid',
      isCancelled: invoice.status === 'cancelled',
      // Amount formatting
      formattedAmount: `$${(invoice.amount / 100).toFixed(2)}`,
    };

    return NextResponse.json({
      success: true,
      data: formattedInvoice,
    });
  } catch (error: any) {
    console.error('Error fetching customer invoice:', error);

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
        error: 'Failed to fetch invoice',
        code: 'INTERNAL_ERROR',
      },
      { status: 500 }
    );
  }
}
