import { NextResponse } from 'next/server';

// This route uses dynamic features, so it must be server-rendered
export const dynamic = 'force-dynamic';

import { getServerStripe } from '@/lib/stripe';
import { auth, currentUser } from '@clerk/nextjs/server';

export async function POST(req: Request) {
  try {
    const stripe = getServerStripe();
    if (!stripe) {
      return new NextResponse('Stripe is not properly initialized', { status: 500 });
    }

    const { userId } = await auth();
    if (!userId) {
      return new NextResponse('Unauthorized', { status: 401 });
    }

    const user = await currentUser();
    if (!user) {
      return new NextResponse('User not found', { status: 404 });
    }

    const body = await req.json();
    const { priceId, planId, interval } = body;

    if (!priceId || !planId) {
      return new NextResponse('Price ID and Plan ID are required', { status: 400 });
    }

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

    // Create a Stripe checkout session
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      billing_address_collection: 'auto',
      customer_email: user.emailAddresses[0].emailAddress,
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      mode: 'subscription',
      allow_promotion_codes: true,
      subscription_data: {
        metadata: {
          userId,
          planId,
        },
      },
      success_url: `${baseUrl}/dashboard?success=true&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${baseUrl}/dashboard?canceled=true`,
    });

    return NextResponse.json({ sessionId: session.id });
  } catch (error) {
    console.error('Error creating checkout session:', error);
    return new NextResponse('Internal Error', { status: 500 });
  }
}
