import { NextRequest, NextResponse } from 'next/server';
import { verifyPartnerAuth } from '@/lib/auth/partnerAuth';
import { InvoiceService, CreateInvoiceRequest } from '@/lib/stripe/invoices';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

// Validation schemas
const createInvoiceSchema = z.object({
  customerId: z.string().min(1, 'Customer ID is required'),
  title: z.string().min(1, 'Title is required').max(200, 'Title too long'),
  description: z.string().optional(),
  amount: z.number().int().min(50, 'Minimum amount is $0.50').max(99999999, 'Amount too large'), // in cents
  currency: z.string().optional().default('usd'),
  dueDate: z.string().optional().transform((val) => val ? new Date(val) : undefined),
  type: z.enum(['one_time', 'recurring']),
  recurringInterval: z.enum(['weekly', 'monthly', 'yearly']).optional(),
  recurringCount: z.number().int().positive().optional(),
  metadata: z.record(z.string()).optional(),
});

const listInvoicesSchema = z.object({
  limit: z.string().optional().transform((val) => val ? parseInt(val) : 50),
  offset: z.string().optional().transform((val) => val ? parseInt(val) : 0),
  status: z.string().optional(),
  customerId: z.string().optional(),
});

/**
 * POST /api/partner/invoices - Create a new invoice
 */
export async function POST(request: NextRequest) {
  console.log('🚀 POST /api/partner/invoices - Handler started');
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

    // Parse and validate request body
    const body = await request.json();
    const validatedData = createInvoiceSchema.parse(body);

    console.log('🔍 Invoice creation request for customer ID:', validatedData.customerId);

    // Create invoice request - frontend now passes the correct Customer ID
    const createRequest: CreateInvoiceRequest = {
      partnerId,
      customerId: validatedData.customerId,
      title: validatedData.title,
      description: validatedData.description,
      amount: validatedData.amount,
      currency: validatedData.currency,
      dueDate: validatedData.dueDate,
      type: validatedData.type,
      recurringInterval: validatedData.recurringInterval,
      recurringCount: validatedData.recurringCount,
      metadata: validatedData.metadata,
    };

    console.log('🚀 Creating invoice with customer ID:', validatedData.customerId);

    // Create invoice
    const invoice = await InvoiceService.createInvoice(createRequest);

    return NextResponse.json({
      success: true,
      data: {
        id: invoice.id,
        invoiceNumber: invoice.invoiceNumber,
        title: invoice.title,
        description: invoice.description,
        amount: invoice.amount,
        currency: invoice.currency,
        status: invoice.status,
        type: invoice.type,
        dueDate: invoice.dueDate,
        createdAt: invoice.createdAt,
        customer: {
          id: invoice.customer.id,
          email: invoice.customer.email,
          name: `${invoice.customer.firstName || ''} ${invoice.customer.lastName || ''}`.trim() || null,
        },
      },
    });
  } catch (error: any) {
    console.error('Error creating invoice:', error);

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
        error: 'Failed to create invoice',
        code: 'INTERNAL_ERROR',
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/partner/invoices - List partner's invoices
 */
export async function GET(request: NextRequest) {
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

    // Parse and validate query parameters
    const { searchParams } = new URL(request.url);
    const queryParams = Object.fromEntries(searchParams.entries());
    const validatedParams = listInvoicesSchema.parse(queryParams);

    // Get invoices - frontend now passes the correct Customer ID
    const result = await InvoiceService.getInvoicesByPartner(partnerId, {
      limit: validatedParams.limit,
      offset: validatedParams.offset,
      status: validatedParams.status,
      customerId: validatedParams.customerId,
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
      },
    });
  } catch (error: any) {
    console.error('Error fetching invoices:', error);

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
