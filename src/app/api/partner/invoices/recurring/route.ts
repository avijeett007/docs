import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyPartnerAuth } from '@/lib/auth/partnerAuth';
import { recurringPaymentService, RecurringInterval } from '@/lib/billing/recurringPaymentService';

export const dynamic = 'force-dynamic';

/**
 * Create a new recurring invoice
 */
export async function POST(request: NextRequest) {
  try {
    // Verify partner authentication
    const authResult = await verifyPartnerAuth(request);
    if (!authResult) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const partnerId = authResult.id;
    const body = await request.json();

    const {
      customerId,
      title,
      description,
      amount,
      currency = 'usd',
      recurringInterval,
      recurringCount,
      dueDate,
    } = body;

    // Validate required fields
    if (!customerId || !title || !amount || !recurringInterval) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Validate recurring interval
    const validIntervals: RecurringInterval[] = ['weekly', 'monthly', 'quarterly', 'yearly'];
    if (!validIntervals.includes(recurringInterval)) {
      return NextResponse.json(
        { success: false, error: 'Invalid recurring interval' },
        { status: 400 }
      );
    }

    // Verify customer belongs to this partner
    const customer = await prisma.customer.findFirst({
      where: {
        id: customerId,
        credentials: {
          some: {
            partnerId: partnerId,
          },
        },
      },
    });

    if (!customer) {
      return NextResponse.json(
        { success: false, error: 'Customer not found or not associated with this partner' },
        { status: 404 }
      );
    }

    // Create recurring invoice
    const invoice = await recurringPaymentService.createRecurringInvoice({
      partnerId,
      customerId,
      title,
      description,
      amount: Math.round(amount * 100), // Convert to cents
      currency,
      recurringInterval,
      recurringCount: recurringCount || null,
      dueDate: dueDate ? new Date(dueDate) : undefined,
    });

    return NextResponse.json({
      success: true,
      message: 'Recurring invoice created successfully',
      data: {
        id: invoice.id,
        invoiceNumber: invoice.invoiceNumber,
        title: invoice.title,
        amount: invoice.amount,
        currency: invoice.currency,
        recurringInterval: invoice.recurringInterval,
        recurringCount: invoice.recurringCount,
        nextPaymentDate: invoice.nextPaymentDate,
        status: invoice.status,
      },
    });
  } catch (error) {
    console.error('Error creating recurring invoice:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create recurring invoice' },
      { status: 500 }
    );
  }
}

/**
 * Get recurring invoices for a partner
 */
export async function GET(request: NextRequest) {
  try {
    // Verify partner authentication
    const authResult = await verifyPartnerAuth(request);
    if (!authResult) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const partnerId = authResult.id;

    // Get recurring invoices
    const recurringInvoices = await prisma.invoice.findMany({
      where: {
        partnerId,
        type: 'recurring',
      },
      include: {
        customer: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    // Get recurring statistics
    const stats = await recurringPaymentService.getRecurringStats(partnerId);

    // Format response
    const formattedInvoices = recurringInvoices.map(invoice => ({
      id: invoice.id,
      invoiceNumber: invoice.invoiceNumber,
      title: invoice.title,
      description: invoice.description,
      amount: invoice.amount,
      currency: invoice.currency,
      status: invoice.status,
      recurringInterval: invoice.recurringInterval,
      recurringCount: invoice.recurringCount,
      nextPaymentDate: invoice.nextPaymentDate,
      dueDate: invoice.dueDate,
      createdAt: invoice.createdAt,
      updatedAt: invoice.updatedAt,
      customer: {
        id: invoice.customer.id,
        email: invoice.customer.email,
        name: `${invoice.customer.firstName || ''} ${invoice.customer.lastName || ''}`.trim() || 'Customer',
      },
    }));

    return NextResponse.json({
      success: true,
      data: {
        invoices: formattedInvoices,
        stats,
      },
    });
  } catch (error) {
    console.error('Error fetching recurring invoices:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch recurring invoices' },
      { status: 500 }
    );
  }
}
