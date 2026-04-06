import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyWhitelabelAuth } from '@/lib/whitelabelAuth';
import Stripe from 'stripe';

export const dynamic = 'force-dynamic';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2023-10-16',
});

interface RouteParams {
  params: {
    invoiceId: string;
  };
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    // Verify whitelabel authentication
    const authResult = await verifyWhitelabelAuth(request);
    if (!authResult) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { customerId, partnerId } = authResult;
    const { invoiceId } = params;

    // Get the invoice with partner information for Stripe Connect context
    const invoice = await prisma.invoice.findFirst({
      where: {
        id: invoiceId,
        customerId: customerId,
        partnerId: partnerId,
      },
      include: {
        partner: {
          select: {
            id: true,
            stripeAccountId: true,
          },
        },
      },
    });

    if (!invoice) {
      return NextResponse.json(
        { success: false, error: 'Invoice not found' },
        { status: 404 }
      );
    }

    // If invoice is already paid, return success
    if (invoice.status === 'paid') {
      return NextResponse.json({
        success: true,
        status: 'paid',
        message: 'Invoice is already paid'
      });
    }

    // If invoice has no payment intent, return current status
    if (!invoice.stripePaymentIntentId) {
      return NextResponse.json({
        success: true,
        status: invoice.status,
        message: 'No payment attempt found'
      });
    }

    // Check payment intent status in Stripe with proper Connect account context
    try {
      const retrieveOptions = invoice.partner.stripeAccountId
        ? { stripeAccount: invoice.partner.stripeAccountId }
        : {};

      const paymentIntent = await stripe.paymentIntents.retrieve(
        invoice.stripePaymentIntentId,
        {},
        retrieveOptions
      );
      
      console.log(`Checking payment intent ${paymentIntent.id}: status=${paymentIntent.status}, amount_received=${paymentIntent.amount_received}`);

      // Only return status - do NOT automatically update to "paid"
      // Let webhooks handle the final status update
      if (paymentIntent.status === 'succeeded') {
        console.log(`💳 Payment succeeded in Stripe for invoice ${invoiceId} - waiting for webhook to confirm`);

        return NextResponse.json({
          success: true,
          status: 'processing', // Keep as processing until webhook confirms
          stripeStatus: paymentIntent.status,
          message: 'Payment succeeded in Stripe - awaiting webhook confirmation'
        });
      }

      // Return current payment status
      return NextResponse.json({
        success: true,
        status: paymentIntent.status === 'processing' ? 'processing' :
                invoice.status,
        paymentIntentStatus: paymentIntent.status,
        message: `Payment status: ${paymentIntent.status}`
      });

    } catch (stripeError) {
      console.error('Error checking payment intent:', stripeError);
      
      return NextResponse.json({
        success: true,
        status: invoice.status,
        message: 'Unable to verify payment status'
      });
    }

  } catch (error) {
    console.error('Error checking payment status:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to check payment status' },
      { status: 500 }
    );
  }
}
