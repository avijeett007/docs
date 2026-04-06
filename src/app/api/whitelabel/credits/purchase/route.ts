import { NextRequest, NextResponse } from 'next/server';
import { verifyCustomerAuth } from '@/lib/auth/customerAuth';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';
import Stripe from 'stripe';

export const dynamic = 'force-dynamic';

const purchaseSchema = z.object({
  planId: z.string().uuid(),
  successUrl: z.string().url(),
  cancelUrl: z.string().url(),
});

/**
 * POST /api/whitelabel/credits/purchase
 * Initiate credit purchase via Stripe Checkout
 */
export async function POST(request: NextRequest) {
  try {
    // Verify customer authentication
    const customerAuth = await verifyCustomerAuth(request);

    if (!customerAuth) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const customerId = customerAuth.customerId;
    const partnerId = customerAuth.partnerId;

    // Parse and validate request body
    const body = await request.json();
    const validation = purchaseSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Invalid request data',
          details: validation.error.errors
        },
        { status: 400 }
      );
    }

    const { planId, successUrl, cancelUrl } = validation.data;

    // Get customer and partner information
    const customer = await prisma.customer.findUnique({
      where: { id: customerId },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        stripeCustomerId: true,
      },
    });

    if (!customer) {
      return NextResponse.json(
        { success: false, error: 'Customer not found' },
        { status: 404 }
      );
    }

    const partner = await prisma.partner.findUnique({
      where: { id: partnerId },
      select: {
        id: true,
        businessName: true,
        stripeAccountId: true,
        stripeChargesEnabled: true,
        stripeOnboardingCompleted: true,
      },
    });

    if (!partner) {
      return NextResponse.json(
        { success: false, error: 'Partner not found' },
        { status: 404 }
      );
    }

    console.log(`Partner Stripe status: accountId=${partner.stripeAccountId}, chargesEnabled=${partner.stripeChargesEnabled}, onboardingCompleted=${partner.stripeOnboardingCompleted}`);

    if (!partner.stripeChargesEnabled || !partner.stripeOnboardingCompleted || !partner.stripeAccountId) {
      return NextResponse.json(
        { success: false, error: 'Partner Stripe integration not enabled' },
        { status: 400 }
      );
    }

    // Get the credit plan
    const creditPlan = await prisma.customerCreditPlan.findFirst({
      where: {
        id: planId,
        partnerId: partner.id,
        isActive: true,
      },
      select: {
        id: true,
        name: true,
        credits: true,
        priceCents: true,
        discountPercentage: true,
        description: true,
        stripeProductId: true,
        stripePriceId: true,
      },
    });

    if (!creditPlan) {
      return NextResponse.json(
        { success: false, error: 'Credit plan not found or inactive' },
        { status: 404 }
      );
    }

    if (!creditPlan.stripePriceId) {
      return NextResponse.json(
        { success: false, error: 'Credit plan not properly configured with Stripe' },
        { status: 400 }
      );
    }

    // Initialize Stripe
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
      apiVersion: '2023-10-16',
    });

    // Create or get Stripe customer
    let stripeCustomerId = customer.stripeCustomerId;
    if (!stripeCustomerId) {
      const stripeCustomer = await stripe.customers.create({
        email: customer.email,
        name: `${customer.firstName} ${customer.lastName}`,
        metadata: {
          customerId: customer.id,
          partnerId: partner.id,
        },
      }, {
        stripeAccount: partner.stripeAccountId,
      });

      stripeCustomerId = stripeCustomer.id;

      // Update customer with Stripe customer ID
      await prisma.customer.update({
        where: { id: customer.id },
        data: { stripeCustomerId },
      });
    }

    // Create Stripe Checkout session using the existing price
    console.log(`Creating checkout session with stripeAccount: ${partner.stripeAccountId}`);
    console.log(`Using price ID: ${creditPlan.stripePriceId}`);
    console.log(`Customer ID: ${stripeCustomerId}`);

    const session = await stripe.checkout.sessions.create({
      customer: stripeCustomerId,
      payment_method_types: ['card'],
      line_items: [
        {
          price: creditPlan.stripePriceId,
          quantity: 1,
        },
      ],
      mode: 'payment',
      success_url: successUrl,
      cancel_url: cancelUrl,
      metadata: {
        customerId: customer.id,
        partnerId: partner.id,
        planId: creditPlan.id,
        credits: creditPlan.credits.toString(),
        type: 'customer_credit_purchase',
      },
    }, {
      stripeAccount: partner.stripeAccountId,
    });

    console.log(`Created checkout session: ${session.id} in account: ${partner.stripeAccountId}`);
    console.log(`Payment intent: ${session.payment_intent}`);

    // Create purchase record
    await prisma.customerCreditPurchase.create({
      data: {
        customerId: customer.id,
        partnerId: partner.id,
        planId: creditPlan.id,
        creditsPurchased: creditPlan.credits,
        amountPaidCents: creditPlan.priceCents,
        discountApplied: creditPlan.discountPercentage,
        stripePaymentIntentId: session.payment_intent as string || '',
        status: 'pending',
        metadata: {
          stripeSessionId: session.id,
          stripeAccountId: partner.stripeAccountId,
        },
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        sessionId: session.id,
        url: session.url,
        planInfo: {
          id: creditPlan.id,
          name: creditPlan.name,
          credits: creditPlan.credits,
          priceCents: creditPlan.priceCents,
          discountPercentage: creditPlan.discountPercentage,
        },
      },
    });

  } catch (error) {
    console.error('Error creating credit purchase:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
