import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyCustomerAuth } from '@/lib/auth/customerAuth';
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

    // Get the invoice
    const invoice = await prisma.invoice.findFirst({
      where: {
        id: invoiceId,
        customerId: customerId,
        partnerId: partnerId,
      },
      include: {
        partner: {
          select: {
            businessName: true,
            stripeAccountId: true,
            applicationFeePercent: true,
          },
        },
        customer: {
          select: {
            email: true,
            firstName: true,
            lastName: true,
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

    // Check if invoice is already paid
    if (invoice.status === 'paid') {
      return NextResponse.json(
        { success: false, error: 'Invoice is already paid' },
        { status: 400 }
      );
    }

    // Check if invoice can be paid
    if (invoice.status !== 'sent' && invoice.status !== 'overdue') {
      return NextResponse.json(
        { success: false, error: 'Invoice cannot be paid in its current status' },
        { status: 400 }
      );
    }

    // Calculate application fee if partner has Stripe Connect
    let applicationFeeAmount = 0;
    if (invoice.partner.stripeAccountId && invoice.partner.applicationFeePercent) {
      const feePercent = Number(invoice.partner.applicationFeePercent);
      applicationFeeAmount = Math.round(invoice.amount * (feePercent / 100));
    }

    // Create Stripe payment intent
    const paymentIntentData: Stripe.PaymentIntentCreateParams = {
      amount: invoice.amount,
      currency: invoice.currency,
      metadata: {
        invoiceId: invoice.id,
        customerId: customerId,
        partnerId: partnerId,
        invoiceNumber: invoice.invoiceNumber,
      },
      description: `Payment for ${invoice.title} - Invoice #${invoice.invoiceNumber}`,
    };

    // Add Stripe Connect parameters if partner has connected account
    if (invoice.partner.stripeAccountId) {
      paymentIntentData.transfer_data = {
        destination: invoice.partner.stripeAccountId,
      };

      if (applicationFeeAmount > 0) {
        paymentIntentData.application_fee_amount = applicationFeeAmount;
      }
    }

    const paymentIntent = await stripe.paymentIntents.create(paymentIntentData);

    // Update invoice with payment intent ID
    await prisma.invoice.update({
      where: { id: invoiceId },
      data: {
        stripePaymentIntentId: paymentIntent.id,
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        clientSecret: paymentIntent.client_secret,
        paymentIntentId: paymentIntent.id,
        amount: invoice.amount,
        currency: invoice.currency,
        invoiceNumber: invoice.invoiceNumber,
        title: invoice.title,
        description: invoice.description,
        partnerName: invoice.partner.businessName,
      },
    });
  } catch (error) {
    console.error('Error creating payment intent:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create payment intent' },
      { status: 500 }
    );
  }
}
