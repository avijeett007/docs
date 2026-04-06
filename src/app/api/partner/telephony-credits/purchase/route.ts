import { NextRequest, NextResponse } from 'next/server';
import { verifyPartnerAuth } from '@/lib/auth/partnerAuth';
import { prisma } from '@/lib/prisma';
import { TelephonyCreditPurchaseRequest, TelephonyCreditPurchaseResponse, dollarsToCents } from '@/lib/types/credits';
import Stripe from 'stripe';

export const dynamic = 'force-dynamic';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2023-10-16',
});

export async function POST(request: NextRequest) {
  try {
    // Verify partner authentication
    const partner = await verifyPartnerAuth(request);
    if (!partner) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const partnerId = partner.id;
    const body: TelephonyCreditPurchaseRequest = await request.json();

    let dollarAmount: number;
    let packageInfo: any = null;
    let discountPercentage = 0;

    if (body.packageId) {
      // Purchase from predefined package
      const package_ = await prisma.telephonyCreditPackage.findUnique({
        where: { id: body.packageId, isActive: true }
      });

      if (!package_) {
        return NextResponse.json(
          { success: false, error: 'Package not found or inactive' },
          { status: 404 }
        );
      }

      dollarAmount = Number(package_.dollarAmount);
      discountPercentage = typeof package_.discountPercentage === 'string'
        ? parseFloat(package_.discountPercentage)
        : Number(package_.discountPercentage);
      packageInfo = package_;
    } else if (body.customDollarAmount) {
      // Custom dollar amount purchase
      if (body.customDollarAmount < 10 || body.customDollarAmount > 10000) {
        return NextResponse.json(
          { success: false, error: 'Custom amount must be between $10 and $10,000' },
          { status: 400 }
        );
      }
      dollarAmount = body.customDollarAmount;
    } else {
      return NextResponse.json(
        { success: false, error: 'Either packageId or customDollarAmount is required' },
        { status: 400 }
      );
    }

    // Calculate final price (telephony credits have no discount typically)
    const finalPriceCents = dollarsToCents(dollarAmount);

    // Create purchase record
    const purchase = await prisma.telephonyCreditPurchase.create({
      data: {
        partnerId,
        packageId: body.packageId,
        dollarAmountPurchased: dollarAmount,
        amountPaidCents: finalPriceCents,
        discountApplied: discountPercentage,
        stripePaymentIntentId: '', // Will be updated after Stripe session creation
        status: 'pending',
        currency: 'usd',
        metadata: {
          packageInfo,
          customAmount: !body.packageId,
        }
      }
    });

    // Create Stripe checkout session
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: packageInfo ? packageInfo.name : `$${dollarAmount} Telephony Credits`,
              description: `Telephony credits for voice calls and phone numbers. Credits never expire.`,
            },
            unit_amount: finalPriceCents,
          },
          quantity: 1,
        },
      ],
      mode: 'payment',
      success_url: `${process.env.NEXT_PUBLIC_APP_URL}/partner/telephony-credits/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/partner/telephony-credits`,
      metadata: {
        partnerId,
        purchaseId: purchase.id,
        type: 'telephony_credit_purchase',
        dollarAmount: dollarAmount.toString(),
      },
      customer_email: partner.emailAddress,
    });

    // Update purchase with Stripe session ID
    await prisma.telephonyCreditPurchase.update({
      where: { id: purchase.id },
      data: {
        stripePaymentIntentId: session.id,
        metadata: {
          ...(purchase.metadata as Record<string, any> || {}),
          stripeSessionId: session.id,
        }
      }
    });

    const response: TelephonyCreditPurchaseResponse = {
      success: true,
      checkoutUrl: session.url || undefined
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('Error in telephony credit purchase API:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
