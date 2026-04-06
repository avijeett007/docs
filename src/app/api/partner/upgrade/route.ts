import { NextResponse, NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getStripe } from '@/lib/stripe';
import { verifyPartnerJWT } from '@/lib/auth';
import Stripe from 'stripe';

export const dynamic = 'force-dynamic';

/**
 * POST /api/partner/upgrade
 * Create Stripe checkout session for existing partner upgrade
 */
export async function POST(req: NextRequest) {
  try {
    // Verify partner authentication
    const decoded = await verifyPartnerJWT(req);
    if (!decoded || !decoded.payload || !decoded.isValid) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const partnerId = decoded.payload.partnerId;
    const { billingInterval, planId } = await req.json();

    if (!planId || !billingInterval) {
      return NextResponse.json(
        { error: 'Plan ID and billing interval are required' },
        { status: 400 }
      );
    }

    const partner = await prisma.partner.findUnique({
      where: { id: partnerId },
      select: {
        id: true,
        businessName: true,
        contactName: true,
        emailAddress: true,
        subscriptionStatus: true,
      },
    });

    if (!partner) {
      return NextResponse.json(
        { error: 'Partner not found' },
        { status: 404 }
      );
    }

    // Check if partner is already on a paid plan
    if (partner.subscriptionStatus === 'ACTIVE') {
      return NextResponse.json(
        { error: 'Partner already has an active subscription' },
        { status: 400 }
      );
    }

    // Get price ID based on billing interval and plan
    const priceId = billingInterval === 'yearly' 
      ? process.env[`STRIPE_${planId.toUpperCase()}_YEARLY_PRICE_ID`]
      : process.env[`STRIPE_${planId.toUpperCase()}_MONTHLY_PRICE_ID`];

    if (!priceId) {
      return NextResponse.json(
        { error: 'Invalid price configuration' },
        { status: 500 }
      );
    }

    // Update partner with plan info
    await prisma.partner.update({
      where: { id: partnerId },
      data: {
        planId,
        billingInterval,
      },
    });

    // Initialize Stripe
    const stripe = (await getStripe()) as Stripe;
    if (!stripe) {
      return NextResponse.json(
        { error: 'Failed to initialize payment provider' },
        { status: 500 }
      );
    }

    const origin = process.env.NEXT_PUBLIC_APP_URL;
    
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      mode: 'subscription',
      billing_address_collection: 'required',
      customer_email: partner.emailAddress,
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      allow_promotion_codes: true,
      success_url: `${origin}/partner/dashboard?upgrade=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/partner/dashboard?upgrade=cancelled`,
      metadata: {
        partnerId,
        planId,
        billingInterval,
        upgradeFlow: 'true',
      },
    });

    return NextResponse.json({ 
      success: true,
      url: session.url,
    });

  } catch (error) {
    console.error('Error creating upgrade checkout session:', error);
    return NextResponse.json(
      { error: 'Failed to create checkout session' },
      { status: 500 }
    );
  }
}
