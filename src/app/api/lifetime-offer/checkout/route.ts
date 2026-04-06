import { NextResponse, NextRequest } from 'next/server';

// This route uses dynamic features, so it must be server-rendered
export const dynamic = 'force-dynamic';

import { prisma } from '@/lib/prisma';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2023-10-16',
});

// POST /api/lifetime-offer/checkout - Create Stripe checkout session for lifetime offer
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { partnerId, couponId } = body;

    if (!partnerId || !couponId) {
      return NextResponse.json(
        { success: false, error: 'Partner ID and Coupon ID are required' },
        { status: 400 }
      );
    }

    // Fetch partner details
    const partner = await prisma.partner.findUnique({
      where: { id: partnerId },
      select: {
        id: true,
        businessName: true,
        emailAddress: true,
        approvalStatus: true
      }
    });

    if (!partner) {
      return NextResponse.json(
        { success: false, error: 'Partner not found' },
        { status: 404 }
      );
    }

    // Fetch coupon details
    const coupon = await prisma.coupon.findUnique({
      where: { id: couponId },
      include: {
        usages: {
          where: {
            partnerId: partnerId
          }
        }
      }
    });

    if (!coupon) {
      return NextResponse.json(
        { success: false, error: 'Coupon not found' },
        { status: 404 }
      );
    }

    // Validate coupon (same validation as details endpoint)
    if (!coupon.isActive || coupon.type !== 'lifetime_offer') {
      return NextResponse.json(
        { success: false, error: 'Invalid coupon for lifetime offer' },
        { status: 400 }
      );
    }

    const now = new Date();
    if (now > new Date(coupon.validUntil)) {
      return NextResponse.json(
        { success: false, error: 'Coupon has expired' },
        { status: 400 }
      );
    }

    if (coupon.usages.length > 0) {
      return NextResponse.json(
        { success: false, error: 'Coupon already used by this partner' },
        { status: 400 }
      );
    }

    if (!coupon.lifetimeOfferPrice || Number(coupon.lifetimeOfferPrice) <= 0) {
      return NextResponse.json(
        { success: false, error: 'Invalid lifetime offer pricing' },
        { status: 400 }
      );
    }

    // Create or retrieve Stripe customer
    let stripeCustomer;
    try {
      // Try to find existing customer by email
      const existingCustomers = await stripe.customers.list({
        email: partner.emailAddress,
        limit: 1
      });

      if (existingCustomers.data.length > 0) {
        stripeCustomer = existingCustomers.data[0];
      } else {
        // Create new customer
        stripeCustomer = await stripe.customers.create({
          email: partner.emailAddress,
          name: partner.businessName,
          metadata: {
            partnerId: partner.id,
            businessName: partner.businessName,
          }
        });
      }
    } catch (error) {
      console.error('Error creating/retrieving Stripe customer:', error);
      return NextResponse.json(
        { success: false, error: 'Failed to process customer information' },
        { status: 500 }
      );
    }

    // Create Stripe checkout session
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      mode: 'payment',
      customer: stripeCustomer.id,
      line_items: [
        // Use custom Stripe price ID if available, otherwise create price_data
        (coupon as any).stripePriceId ? {
          price: (coupon as any).stripePriceId,
          quantity: 1,
        } : {
          price_data: {
            currency: 'usd',
            product_data: {
              name: `Knotie AI Pro - Lifetime Access (${coupon.name})`,
              description: `Lifetime access to Knotie AI Pro with coupon ${coupon.code}`,
              images: ['https://knotie-ai.pro/logo.png'], // Add your logo URL
            },
            unit_amount: Math.round(Number(coupon.lifetimeOfferPrice) * 100), // Convert to cents
          },
          quantity: 1,
        },
      ],
      metadata: {
        partnerId: partner.id,
        couponId: coupon.id,
        couponCode: coupon.code,
        offerType: 'lifetime',
        businessName: partner.businessName,
      },
      success_url: `${process.env.NEXT_PUBLIC_APP_URL || 'https://knotie-ai.pro'}/lifetime-offer/success?session_id={CHECKOUT_SESSION_ID}&partnerId=${partnerId}&couponId=${couponId}`,
      cancel_url: `${process.env.NEXT_PUBLIC_APP_URL || 'https://knotie-ai.pro'}/lifetime-offer?partnerId=${partnerId}&couponId=${couponId}`,
      allow_promotion_codes: false, // Disable since we're handling coupons internally
      invoice_creation: {
        enabled: true,
        invoice_data: {
          description: `Knotie AI Pro - Lifetime Access (${coupon.name})`,
          metadata: {
            partnerId: partner.id,
            couponId: coupon.id,
            couponCode: coupon.code,
            offerType: 'lifetime',
            businessName: partner.businessName,
          },
          footer: 'Thank you for choosing Knotie AI Pro! Your lifetime access is now active.',
        }
      },
      payment_intent_data: {
        receipt_email: partner.emailAddress,
        metadata: {
          partnerId: partner.id,
          couponId: coupon.id,
          couponCode: coupon.code,
          offerType: 'lifetime',
          businessName: partner.businessName,
        }
      }
    });

    return NextResponse.json({
      success: true,
      url: session.url,
      sessionId: session.id
    });

  } catch (error) {
    console.error('Error creating lifetime offer checkout session:', error);
    
    if (error instanceof Stripe.errors.StripeError) {
      return NextResponse.json(
        { success: false, error: `Payment error: ${error.message}` },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { success: false, error: 'Failed to create checkout session' },
      { status: 500 }
    );
  }
}
