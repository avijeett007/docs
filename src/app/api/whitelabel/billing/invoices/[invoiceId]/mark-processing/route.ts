import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyWhitelabelAuth } from '@/lib/whitelabelAuth';

export const dynamic = 'force-dynamic';

export async function POST(
  request: NextRequest,
  { params }: { params: { invoiceId: string } }
) {
  try {
    const { invoiceId } = params;

    // Verify whitelabel authentication
    const authResult = await verifyWhitelabelAuth(request);
    if (!authResult) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { customerId, partnerId } = authResult;

    // Get request body for payment intent ID
    const body = await request.json();
    const { paymentIntentId } = body;

    if (!paymentIntentId) {
      return NextResponse.json(
        { success: false, error: 'Payment intent ID is required' },
        { status: 400 }
      );
    }

    // Find the invoice and verify ownership
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

    // Check if invoice is already paid or processing
    if (invoice.status === 'paid' || invoice.status === 'processing') {
      return NextResponse.json(
        { 
          success: true, 
          message: 'Invoice is already processed',
          status: invoice.status 
        }
      );
    }

    // Update invoice status to processing immediately after payment confirmation
    const updatedInvoice = await prisma.invoice.update({
      where: { id: invoiceId },
      data: {
        status: 'processing',
        stripePaymentIntentId: paymentIntentId,
        updatedAt: new Date(),
      },
    });

    console.log(`✅ Invoice ${invoice.invoiceNumber} marked as processing after payment confirmation`);

    return NextResponse.json({
      success: true,
      message: 'Invoice marked as processing',
      invoice: {
        id: updatedInvoice.id,
        status: updatedInvoice.status,
        invoiceNumber: updatedInvoice.invoiceNumber,
      },
    });

  } catch (error) {
    console.error('Error marking invoice as processing:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
