import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyPartnerAuth } from '@/lib/auth/partnerAuth';
import { recurringPaymentService } from '@/lib/billing/recurringPaymentService';

export const dynamic = 'force-dynamic';

/**
 * Cancel a recurring invoice
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
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
    const invoiceId = params.id;

    // Verify the recurring invoice belongs to this partner
    const invoice = await prisma.invoice.findFirst({
      where: {
        id: invoiceId,
        partnerId,
        type: 'recurring',
      },
    });

    if (!invoice) {
      return NextResponse.json(
        { success: false, error: 'Recurring invoice not found' },
        { status: 404 }
      );
    }

    // Cancel the recurring invoice
    await recurringPaymentService.cancelRecurringInvoice(invoiceId, partnerId);

    return NextResponse.json({
      success: true,
      message: 'Recurring invoice cancelled successfully',
    });
  } catch (error) {
    console.error('Error cancelling recurring invoice:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to cancel recurring invoice' },
      { status: 500 }
    );
  }
}

/**
 * Update a recurring invoice
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
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
    const invoiceId = params.id;
    const body = await request.json();

    const {
      title,
      description,
      amount,
      recurringCount,
    } = body;

    // Verify the recurring invoice belongs to this partner
    const existingInvoice = await prisma.invoice.findFirst({
      where: {
        id: invoiceId,
        partnerId,
        type: 'recurring',
      },
    });

    if (!existingInvoice) {
      return NextResponse.json(
        { success: false, error: 'Recurring invoice not found' },
        { status: 404 }
      );
    }

    // Prepare update data
    const updateData: any = {};

    if (title !== undefined) updateData.title = title;
    if (description !== undefined) updateData.description = description;
    if (amount !== undefined) updateData.amount = Math.round(amount * 100); // Convert to cents
    if (recurringCount !== undefined) updateData.recurringCount = recurringCount;

    // Update the recurring invoice
    const updatedInvoice = await prisma.invoice.update({
      where: { id: invoiceId },
      data: updateData,
    });

    return NextResponse.json({
      success: true,
      message: 'Recurring invoice updated successfully',
      data: {
        id: updatedInvoice.id,
        invoiceNumber: updatedInvoice.invoiceNumber,
        title: updatedInvoice.title,
        description: updatedInvoice.description,
        amount: updatedInvoice.amount,
        currency: updatedInvoice.currency,
        recurringInterval: updatedInvoice.recurringInterval,
        recurringCount: updatedInvoice.recurringCount,
        nextPaymentDate: updatedInvoice.nextPaymentDate,
        status: updatedInvoice.status,
      },
    });
  } catch (error) {
    console.error('Error updating recurring invoice:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update recurring invoice' },
      { status: 500 }
    );
  }
}

/**
 * Get a specific recurring invoice
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
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
    const invoiceId = params.id;

    // Get the recurring invoice with customer details
    const invoice = await prisma.invoice.findFirst({
      where: {
        id: invoiceId,
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
    });

    if (!invoice) {
      return NextResponse.json(
        { success: false, error: 'Recurring invoice not found' },
        { status: 404 }
      );
    }

    // Get related invoices generated from this recurring template
    const generatedInvoices = await prisma.invoice.findMany({
      where: {
        partnerId,
        customerId: invoice.customerId,
        title: invoice.title,
        type: 'one_time', // Generated invoices are one-time
        createdAt: {
          gte: invoice.createdAt,
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: 10, // Last 10 generated invoices
    });

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
        generatedInvoices: generatedInvoices.map(inv => ({
          id: inv.id,
          invoiceNumber: inv.invoiceNumber,
          amount: inv.amount,
          status: inv.status,
          createdAt: inv.createdAt,
          paidAt: inv.paidAt,
        })),
      },
    });
  } catch (error) {
    console.error('Error fetching recurring invoice:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch recurring invoice' },
      { status: 500 }
    );
  }
}
