import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import Stripe from 'stripe';
import { cookies } from 'next/headers';
import { verifyCustomerJWT } from '@/lib/customerJwt';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    // Verify customer is authenticated
    const cookieStore = cookies();
    const token = cookieStore.get('customer_token')?.value;
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const payload = await verifyCustomerJWT(token);
    if (!payload) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    const { planId, successUrl, cancelUrl } = await request.json();

    if (!planId || !successUrl || !cancelUrl) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Get the subscription plan
    const plan = await prisma.subscriptionPlan.findUnique({
      where: { id: planId },
      include: { partner: true }
    });

    if (!plan) {
      return NextResponse.json(
        { error: 'Subscription plan not found' },
        { status: 404 }
      );
    }

    // Get partner's Stripe account
    if (!plan.partner.stripeAccountId) {
      return NextResponse.json(
        { error: 'Partner Stripe account not configured' },
        { status: 400 }
      );
    }

    // Initialize Stripe with partner's account
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
      apiVersion: '2023-10-16',
    });

    // Create checkout session
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [
        {
          price: plan.stripePriceId,
          quantity: 1,
        },
      ],
      success_url: successUrl,
      cancel_url: cancelUrl,
      metadata: {
        planId: plan.id,
        partnerId: plan.partnerId,
      },
    }, {
      stripeAccount: plan.partner.stripeAccountId,
    });

    return NextResponse.json({ url: session.url });
  } catch (error) {
    logger.error('Error creating checkout session', error instanceof Error ? error : new Error(String(error)), { operation: 'create-checkout-session' });
    return NextResponse.json(
      { error: 'Failed to create checkout session' },
      { status: 500 }
    );
  }
}
