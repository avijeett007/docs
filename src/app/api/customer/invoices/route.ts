import { NextRequest, NextResponse } from 'next/server';
import { InvoiceService } from '@/lib/stripe/invoices';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

// Validation schemas
const listInvoicesSchema = z.object({
  limit: z.string().optional().transform((val) => val ? parseInt(val) : 50),
  offset: z.string().optional().transform((val) => val ? parseInt(val) : 0),
  status: z.string().optional(),
});

/**
 * Verify customer authentication from whitelabel portal
 * This will be integrated with the existing whitelabel authentication system
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
    // This should verify the customer session/token and ensure they belong to the partner

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
 * GET /api/customer/invoices - List customer's invoices
 */
export async function GET(request: NextRequest) {
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

    // Parse and validate query parameters
    const { searchParams } = new URL(request.url);
    const queryParams = Object.fromEntries(searchParams.entries());
    const validatedParams = listInvoicesSchema.parse(queryParams);

    // Get customer invoices
    const result = await InvoiceService.getInvoicesByCustomer(customerId, {
      limit: validatedParams.limit,
      offset: validatedParams.offset,
      status: validatedParams.status,
    });

    // Format response
    const formattedInvoices = result.invoices.map((invoice) => ({
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
      // Calculate if invoice is overdue
      isOverdue: invoice.dueDate && invoice.status !== 'paid' && invoice.status !== 'cancelled' 
        ? new Date() > new Date(invoice.dueDate) 
        : false,
      // Calculate days until due or overdue
      daysUntilDue: invoice.dueDate && invoice.status !== 'paid' && invoice.status !== 'cancelled'
        ? Math.ceil((new Date(invoice.dueDate).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))
        : null,
    }));

    return NextResponse.json({
      success: true,
      data: {
        invoices: formattedInvoices,
        pagination: {
          total: result.total,
          limit: validatedParams.limit,
          offset: validatedParams.offset,
          hasMore: result.hasMore,
        },
        summary: {
          totalInvoices: result.total,
          pendingInvoices: formattedInvoices.filter(inv => inv.status === 'sent').length,
          overdueInvoices: formattedInvoices.filter(inv => inv.isOverdue).length,
          paidInvoices: formattedInvoices.filter(inv => inv.status === 'paid').length,
          totalAmountDue: formattedInvoices
            .filter(inv => inv.status === 'sent' || inv.status === 'overdue')
            .reduce((sum, inv) => sum + inv.amount, 0),
        },
      },
    });
  } catch (error: any) {
    console.error('Error fetching customer invoices:', error);

    // Handle validation errors
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          error: 'Invalid query parameters',
          code: 'VALIDATION_ERROR',
          details: error.errors,
        },
        { status: 400 }
      );
    }

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
        error: 'Failed to fetch invoices',
        code: 'INTERNAL_ERROR',
      },
      { status: 500 }
    );
  }
}
