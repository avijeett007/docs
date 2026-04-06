/**
 * Stripe Checkout API for Tool Call Quota Upgrades
 * Creates Stripe checkout sessions for quota tier upgrades
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifyPartnerAuth } from '@/lib/auth/partnerAuth';
import { prisma } from '@/lib/prisma';
import { TOOL_CALL_QUOTA_TIERS, getQuotaTier } from '@/lib/toolCallQuotas';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2023-10-16',
});

interface RouteParams {
  params: {
    customerId: string;
  };
}

/**
 * POST /api/partner/customers/[customerId]/tool-call-quota/checkout
 * Create Stripe checkout session for quota tier upgrade
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    // Verify partner authentication
    const partner = await verifyPartnerAuth(request);
    if (!partner) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { customerId } = params;
    const body = await request.json();
    const { tier } = body;

    // Validate tier
    if (!tier || !TOOL_CALL_QUOTA_TIERS[tier]) {
      return NextResponse.json({ error: 'Invalid quota tier' }, { status: 400 });
    }

    const quotaTier = getQuotaTier(tier);
    if (!quotaTier) {
      return NextResponse.json({ error: 'Quota tier not found' }, { status: 404 });
    }

    // Get customer details
    // Find customer through UserOnboarding relationship
    const userOnboarding = await prisma.userOnboarding.findFirst({
      where: {
        OR: [
          { id: customerId, partnerId: partner.id }, // customerId is UserOnboarding ID
          { customerId: customerId, partnerId: partner.id }, // customerId is actual Customer ID
        ],
      },
      include: {
        customer: true,
      },
    });

    if (!userOnboarding || !userOnboarding.customer) {
      return NextResponse.json(
        { success: false, error: 'Customer not found' },
        { status: 404 }
      );
    }

    const customer = userOnboarding.customer;

    if (!customer) {
      return NextResponse.json({ error: 'Customer not found' }, { status: 404 });
    }

    // Check if tier has a Stripe price ID
    if (!quotaTier.stripePriceId) {
      return NextResponse.json(
        { error: 'This tier is not available for purchase' },
        { status: 400 }
      );
    }

    // Create Stripe checkout session
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      mode: 'subscription',
      line_items: [
        {
          price: quotaTier.stripePriceId,
          quantity: 1,
        },
      ],
      customer_email: customer.email,
      metadata: {
        customerId: customer.id,
        partnerId: partner.id,
        quotaTier: tier,
        customerName: `${customer.firstName} ${customer.lastName}`,
        partnerName: partner.businessName || partner.contactName,
      },
      subscription_data: {
        metadata: {
          customerId: customer.id,
          partnerId: partner.id,
          quotaTier: tier,
          type: 'tool_call_quota',
        },
      },
      success_url: `${process.env.NEXT_PUBLIC_APP_URL}/partner/customers?upgrade=success&tier=${tier}&customer=${encodeURIComponent(`${customer.firstName} ${customer.lastName}`)}`,
      cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/partner/customers?upgrade=cancelled`,
      allow_promotion_codes: true,
      billing_address_collection: 'auto',
      tax_id_collection: {
        enabled: true,
      },
    });

    // Log the checkout session creation
    console.log('Stripe checkout session created', {
      sessionId: session.id,
      customerId: customer.id,
      partnerId: partner.id,
      tier,
      amount: quotaTier.priceMonthly,
    });

    return NextResponse.json({
      success: true,
      checkoutUrl: session.url,
      sessionId: session.id,
      tier: {
        id: quotaTier.id,
        name: quotaTier.name,
        price: quotaTier.priceMonthly,
        limit: quotaTier.limit,
      },
    });
  } catch (error: any) {
    console.error('Error creating Stripe checkout session:', error);
    
    // Handle specific Stripe errors
    if (error.type === 'StripeCardError') {
      return NextResponse.json(
        { error: 'Payment failed. Please check your card details.' },
        { status: 400 }
      );
    }
    
    if (error.type === 'StripeRateLimitError') {
      return NextResponse.json(
        { error: 'Too many requests. Please try again later.' },
        { status: 429 }
      );
    }
    
    if (error.type === 'StripeInvalidRequestError') {
      return NextResponse.json(
        { error: 'Invalid request. Please check your input.' },
        { status: 400 }
      );
    }
    
    if (error.type === 'StripeAPIError') {
      return NextResponse.json(
        { error: 'Payment service temporarily unavailable.' },
        { status: 503 }
      );
    }
    
    if (error.type === 'StripeConnectionError') {
      return NextResponse.json(
        { error: 'Network error. Please try again.' },
        { status: 503 }
      );
    }
    
    if (error.type === 'StripeAuthenticationError') {
      return NextResponse.json(
        { error: 'Payment configuration error.' },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to create checkout session' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/partner/customers/[customerId]/tool-call-quota/checkout
 * Get available checkout options for a customer
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    // Verify partner authentication
    const partner = await verifyPartnerAuth(request);
    if (!partner) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { customerId } = params;

    // Get customer details
    // Find customer through UserOnboarding relationship
    const userOnboarding = await prisma.userOnboarding.findFirst({
      where: {
        OR: [
          { id: customerId, partnerId: partner.id }, // customerId is UserOnboarding ID
          { customerId: customerId, partnerId: partner.id }, // customerId is actual Customer ID
        ],
      },
      include: {
        customer: true,
      },
    });

    if (!userOnboarding || !userOnboarding.customer) {
      return NextResponse.json(
        { success: false, error: 'Customer not found' },
        { status: 404 }
      );
    }

    const customer = userOnboarding.customer;

    if (!customer) {
      return NextResponse.json({ error: 'Customer not found' }, { status: 404 });
    }

    // Get available tiers with pricing
    const availableTiers = Object.values(TOOL_CALL_QUOTA_TIERS)
      .filter(tier => tier.stripePriceId) // Only tiers with Stripe pricing
      .map(tier => ({
        id: tier.id,
        name: tier.name,
        description: tier.description,
        limit: tier.limit,
        windowMs: tier.windowMs,
        priceMonthly: tier.priceMonthly,
        features: tier.features,
        popular: tier.popular,
        stripePriceId: tier.stripePriceId,
        isCurrent: tier.id === customer.toolCallQuotaTier,
      }));

    return NextResponse.json({
      success: true,
      customer: {
        id: customer.id,
        name: `${customer.firstName} ${customer.lastName}`,
        currentTier: customer.toolCallQuotaTier,
        quotaEnabled: customer.toolCallQuotaEnabled,
      },
      availableTiers,
      currency: 'USD',
      taxIncluded: false,
    });
  } catch (error) {
    console.error('Error fetching checkout options:', error);
    return NextResponse.json(
      { error: 'Failed to fetch checkout options' },
      { status: 500 }
    );
  }
}
