import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyCustomerAuth } from '@/lib/auth/customerAuth';

export const dynamic = 'force-dynamic';

interface RouteParams {
  params: {
    invoiceId: string;
  };
}

export async function POST(request: NextRequest, { params }: RouteParams) {
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
    const { invoiceId } = params;
    const { paymentIntentId, amount } = await request.json();

    // Get the invoice
    const invoice = await prisma.invoice.findFirst({
      where: {
        id: invoiceId,
        customerId: customerId,
        partnerId: partnerId,
      },
    });

    if (!invoice) {
      return NextResponse.json(
        { success: false, error: 'Invoice not found' },
        { status: 404 }
      );
    }

    // Check if invoice is already paid
    if (invoice.status === 'paid') {
      return NextResponse.json(
        { success: false, error: 'Invoice is already paid' },
        { status: 400 }
      );
    }

    // Start a transaction to update invoice and create payment record
    await prisma.$transaction(async (tx) => {
      // Update invoice status
      await tx.invoice.update({
        where: { id: invoiceId },
        data: {
          status: 'paid',
          paidAt: new Date(),
        },
      });

      // Create payment record
      await tx.invoicePayment.create({
        data: {
          invoiceId: invoiceId,
          amount: amount,
          currency: invoice.currency,
          status: 'succeeded',
          stripePaymentIntentId: paymentIntentId,
          paidAt: new Date(),
        },
      });
    });

    console.log(`Invoice ${invoiceId} marked as paid (manual completion for local development)`);

    return NextResponse.json({
      success: true,
      message: 'Invoice marked as paid',
    });
  } catch (error) {
    console.error('Error completing invoice payment:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to complete payment' },
      { status: 500 }
    );
  }
}
