import { NextRequest, NextResponse } from 'next/server';
import { verifyPartnerAuth } from '@/lib/auth/partnerAuth';
import { InvoiceService, UpdateInvoiceRequest } from '@/lib/stripe/invoices';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

// Validation schemas
const updateInvoiceSchema = z.object({
  title: z.string().min(1, 'Title is required').max(200, 'Title too long').optional(),
  description: z.string().optional(),
  amount: z.number().int().min(50, 'Minimum amount is $0.50').max(99999999, 'Amount too large').optional(),
  dueDate: z.string().optional().transform((val) => val ? new Date(val) : undefined),
  status: z.enum(['draft', 'sent', 'paid', 'overdue', 'cancelled']).optional(),
});

interface RouteParams {
  params: {
    id: string;
  };
}

/**
 * GET /api/partner/invoices/[id] - Get specific invoice
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
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

    // Get invoice
    const invoice = await InvoiceService.getInvoice(invoiceId);

    if (!invoice) {
      return NextResponse.json(
        { error: 'Invoice not found', code: 'INVOICE_NOT_FOUND' },
        { status: 404 }
      );
    }

    // Verify partner owns this invoice
    if (invoice.partner.id !== partnerId) {
      return NextResponse.json(
        { error: 'Access denied', code: 'ACCESS_DENIED' },
        { status: 403 }
      );
    }

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
      customer: {
        id: invoice.customer.id,
        email: invoice.customer.email,
        name: `${invoice.customer.firstName || ''} ${invoice.customer.lastName || ''}`.trim() || null,
      },
      payments: invoice.payments.map((payment) => ({
        id: payment.id,
        amount: payment.amount,
        status: payment.status,
        paidAt: payment.paidAt,
      })),
    };

    return NextResponse.json({
      success: true,
      data: formattedInvoice,
    });
  } catch (error: any) {
    console.error('Error fetching invoice:', error);

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

/**
 * PUT /api/partner/invoices/[id] - Update invoice
 */
export async function PUT(request: NextRequest, { params }: RouteParams) {
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

    // Parse and validate request body
    const body = await request.json();
    const validatedData = updateInvoiceSchema.parse(body);

    // Create update request
    const updateRequest: UpdateInvoiceRequest = {
      title: validatedData.title,
      description: validatedData.description,
      amount: validatedData.amount,
      dueDate: validatedData.dueDate,
      status: validatedData.status,
    };

    // Update invoice
    const updatedInvoice = await InvoiceService.updateInvoice(invoiceId, updateRequest);

    // Format response
    const formattedInvoice = {
      id: updatedInvoice.id,
      invoiceNumber: updatedInvoice.invoiceNumber,
      title: updatedInvoice.title,
      description: updatedInvoice.description,
      amount: updatedInvoice.amount,
      currency: updatedInvoice.currency,
      status: updatedInvoice.status,
      type: updatedInvoice.type,
      dueDate: updatedInvoice.dueDate,
      paidAt: updatedInvoice.paidAt,
      createdAt: updatedInvoice.createdAt,
      updatedAt: updatedInvoice.updatedAt,
      customer: {
        id: updatedInvoice.customer.id,
        email: updatedInvoice.customer.email,
        name: `${updatedInvoice.customer.firstName || ''} ${updatedInvoice.customer.lastName || ''}`.trim() || null,
      },
      payments: updatedInvoice.payments.map((payment) => ({
        id: payment.id,
        amount: payment.amount,
        status: payment.status,
        paidAt: payment.paidAt,
      })),
    };

    return NextResponse.json({
      success: true,
      data: formattedInvoice,
    });
  } catch (error: any) {
    console.error('Error updating invoice:', error);

    // Handle validation errors
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          error: 'Invalid request data',
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
        error: 'Failed to update invoice',
        code: 'INTERNAL_ERROR',
      },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/partner/invoices/[id] - Cancel invoice
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
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

    // Cancel invoice
    const cancelledInvoice = await InvoiceService.cancelInvoice(invoiceId);

    // Format response
    const formattedInvoice = {
      id: cancelledInvoice.id,
      invoiceNumber: cancelledInvoice.invoiceNumber,
      title: cancelledInvoice.title,
      description: cancelledInvoice.description,
      amount: cancelledInvoice.amount,
      currency: cancelledInvoice.currency,
      status: cancelledInvoice.status,
      type: cancelledInvoice.type,
      dueDate: cancelledInvoice.dueDate,
      paidAt: cancelledInvoice.paidAt,
      createdAt: cancelledInvoice.createdAt,
      updatedAt: cancelledInvoice.updatedAt,
      customer: {
        id: cancelledInvoice.customer.id,
        email: cancelledInvoice.customer.email,
        name: `${cancelledInvoice.customer.firstName || ''} ${cancelledInvoice.customer.lastName || ''}`.trim() || null,
      },
      payments: cancelledInvoice.payments.map((payment) => ({
        id: payment.id,
        amount: payment.amount,
        status: payment.status,
        paidAt: payment.paidAt,
      })),
    };

    return NextResponse.json({
      success: true,
      data: formattedInvoice,
      message: 'Invoice cancelled successfully',
    });
  } catch (error: any) {
    console.error('Error cancelling invoice:', error);

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
        error: 'Failed to cancel invoice',
        code: 'INTERNAL_ERROR',
      },
      { status: 500 }
    );
  }
}
