import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import Stripe from 'stripe';

export async function POST(request: NextRequest) {
  try {
    const { creditAmount, successUrl, cancelUrl } = await request.json();

    if (!creditAmount || !successUrl || !cancelUrl) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Get partner from hostname
    const hostname = request.headers.get('host') || '';
    let subdomain = '';
    
    if (hostname.includes('.lvh.me')) {
      subdomain = hostname.split('.')[0];
    } else if (hostname.includes('.knotie-ai.pro')) {
      subdomain = hostname.split('.')[0];
    } else if (hostname !== 'localhost' && hostname !== '127.0.0.1') {
      subdomain = hostname;
    }

    if (!subdomain) {
      return NextResponse.json(
        { error: 'Unable to determine partner from hostname' },
        { status: 400 }
      );
    }

    // Find partner by subdomain or custom domain
    const partner = await prisma.partner.findFirst({
      where: {
        OR: [
          { subdomain: subdomain },
          { customDomain: subdomain }
        ]
      }
    });

    if (!partner) {
      return NextResponse.json(
        { error: 'Partner not found' },
        { status: 404 }
      );
    }

    if (!partner.stripeAccountId) {
      return NextResponse.json(
        { error: 'Partner Stripe account not configured' },
        { status: 400 }
      );
    }

    // Calculate price based on partner's pay-as-you-go rate
    const ratePerMinute = partner.payAsYouGoRate ? Number(partner.payAsYouGoRate) : 0.10;
    const totalAmount = Math.round(creditAmount * ratePerMinute * 100); // Convert to cents

    // Initialize Stripe with partner's account
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
      apiVersion: '2023-10-16',
    });

    // Create checkout session for one-time payment
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: `${creditAmount} AI Credits`,
              description: `${creditAmount} credits for your AI receptionist`,
            },
            unit_amount: totalAmount,
          },
          quantity: 1,
        },
      ],
      success_url: successUrl,
      cancel_url: cancelUrl,
      metadata: {
        creditAmount: creditAmount.toString(),
        partnerId: partner.id,
        type: 'credit_purchase',
      },
    }, {
      stripeAccount: partner.stripeAccountId,
    });

    return NextResponse.json({ url: session.url });
  } catch (error) {
    console.error('Error creating credit purchase session:', error);
    return NextResponse.json(
      { error: 'Failed to create credit purchase session' },
      { status: 500 }
    );
  }
}
