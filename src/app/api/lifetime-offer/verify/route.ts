import { NextResponse, NextRequest } from 'next/server';

// This route uses dynamic features, so it must be server-rendered
export const dynamic = 'force-dynamic';

import { prisma } from '@/lib/prisma';
import Stripe from 'stripe';
import { generateRandomPassword } from '@/lib/password-generator';
import { sendPartnerWelcomeEmail } from '@/lib/email';
import { hashPassword } from '@/lib/password';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2023-10-16',
});

// Function to provision partner in analytics service
async function provisionPartnerInAnalytics(partner: {
  id: string;
  businessName: string;
  contactName: string;
  emailAddress: string;
}) {
  try {
    const analyticsApiUrl = process.env.ANALYTICS_API_URL || 'http://localhost:8001';
    const analyticsApiKey = process.env.ANALYTICS_ADMIN_API_KEY;

    if (!analyticsApiKey) {
      console.error('Missing ANALYTICS_ADMIN_API_KEY environment variable');
      return false;
    }

    const response = await fetch(`${analyticsApiUrl}/partners/provision`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': analyticsApiKey
      },
      body: JSON.stringify({
        partner_id: partner.id,
        partner_name: partner.contactName || partner.businessName, // Required field - use contactName or fallback to businessName
        business_name: partner.businessName,
        contact_name: partner.contactName,
        email: partner.emailAddress
      })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
      console.error('Failed to provision partner in analytics:', errorData);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Error provisioning partner in analytics:', error);
    return false;
  }
}

// POST /api/lifetime-offer/verify - Verify payment and activate lifetime access
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { sessionId, partnerId, couponId } = body;

    if (!sessionId || !partnerId || !couponId) {
      return NextResponse.json(
        { success: false, error: 'Missing required parameters' },
        { status: 400 }
      );
    }

    // Retrieve the Stripe session
    const session = await stripe.checkout.sessions.retrieve(sessionId);

    if (!session) {
      return NextResponse.json(
        { success: false, error: 'Invalid session ID' },
        { status: 404 }
      );
    }

    if (session.payment_status !== 'paid') {
      return NextResponse.json(
        { success: false, error: 'Payment not completed' },
        { status: 400 }
      );
    }

    // Verify the session metadata matches our request
    if (session.metadata?.partnerId !== partnerId || session.metadata?.couponId !== couponId) {
      return NextResponse.json(
        { success: false, error: 'Session metadata mismatch' },
        { status: 400 }
      );
    }

    // Check if this payment has already been processed
    const existingUsage = await prisma.couponUsage.findUnique({
      where: {
        couponId_partnerId: {
          couponId: couponId,
          partnerId: partnerId
        }
      }
    });

    if (existingUsage) {
      // Payment already processed, return success data
      const partner = await prisma.partner.findUnique({
        where: { id: partnerId },
        select: { businessName: true, emailAddress: true, approvalStatus: true }
      });

      const coupon = await prisma.coupon.findUnique({
        where: { id: couponId },
        select: { code: true, name: true, lifetimeOfferPrice: true }
      });

      // Log the current status for debugging
      console.log(`Partner ${partnerId} payment already processed. Current status: ${partner?.approvalStatus}`);

      return NextResponse.json({
        success: true,
        partner,
        coupon,
        payment: {
          amount: Number(coupon?.lifetimeOfferPrice || 0),
          sessionId: sessionId
        }
      });
    }

    // Generate random password for the partner
    const randomPassword = generateRandomPassword();
    const hashedPassword = await hashPassword(randomPassword);

    // Start a transaction to ensure data consistency
    const result = await prisma.$transaction(async (tx) => {
      // Fetch partner and coupon details
      const partner = await tx.partner.findUnique({
        where: { id: partnerId },
        select: {
          id: true,
          businessName: true,
          contactName: true,
          emailAddress: true,
          approvalStatus: true
        }
      });

      if (!partner) {
        throw new Error('Partner not found');
      }

      const coupon = await tx.coupon.findUnique({
        where: { id: couponId },
        select: {
          id: true,
          code: true,
          name: true,
          lifetimeOfferPrice: true,
          originalPrice: true,
          isActive: true,
          validUntil: true,
          type: true
        }
      });

      if (!coupon) {
        throw new Error('Coupon not found');
      }

      // Validate coupon is still valid
      if (!coupon.isActive || coupon.type !== 'lifetime_offer') {
        throw new Error('Invalid coupon');
      }

      if (new Date() > new Date(coupon.validUntil)) {
        throw new Error('Coupon has expired');
      }

      if (!coupon.lifetimeOfferPrice || Number(coupon.lifetimeOfferPrice) <= 0) {
        throw new Error('Invalid lifetime offer pricing');
      }

      // Create coupon usage record
      await tx.couponUsage.create({
        data: {
          couponId: coupon.id,
          partnerId: partner.id,
          orderAmount: Number(coupon.lifetimeOfferPrice || 0),
          discountAmount: Number(coupon.originalPrice || 0) - Number(coupon.lifetimeOfferPrice || 0),
          stripeSessionId: sessionId,
          stripePaymentIntentId: session.payment_intent as string,
          status: 'used',
          metadata: {
            sessionId: sessionId,
            paymentStatus: session.payment_status,
            customerEmail: session.customer_email,
            offerType: 'lifetime'
          }
        }
      });

      // Update partner status to ACTIVE and set lifetime access
      await tx.partner.update({
        where: { id: partner.id },
        data: {
          approvalStatus: 'ACTIVE',
          planId: 'lifetime',
          billingInterval: 'lifetime',
          hashedPassword: hashedPassword
          // Note: Lifetime access details are tracked in the coupon usage record
        }
      });

      return {
        partner: {
          id: partner.id,
          businessName: partner.businessName,
          contactName: partner.contactName,
          emailAddress: partner.emailAddress
        },
        coupon: {
          code: coupon.code,
          name: coupon.name
        },
        payment: {
          amount: Number(coupon.lifetimeOfferPrice || 0),
          sessionId: sessionId
        }
      };
    });

    // Provision partner in analytics service
    const analyticsResult = await provisionPartnerInAnalytics({
      id: result.partner.id,
      businessName: result.partner.businessName,
      contactName: result.partner.contactName || result.partner.businessName,
      emailAddress: result.partner.emailAddress,
    });

    if (!analyticsResult) {
      // Log the error but continue with the process
      console.warn('Partner provisioning in analytics service failed, but continuing with onboarding');
    } else {
      console.log(`Successfully provisioned partner ${result.partner.id} in analytics service`);
    }

    // Send welcome email with password
    await sendPartnerWelcomeEmail({
      to: result.partner.emailAddress,
      businessName: result.partner.businessName,
      password: randomPassword,
    });

    return NextResponse.json({
      success: true,
      ...result
    });

  } catch (error) {
    console.error('Error verifying lifetime offer payment:', error);
    
    if (error instanceof Stripe.errors.StripeError) {
      return NextResponse.json(
        { success: false, error: `Payment verification error: ${error.message}` },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Failed to verify payment' },
      { status: 500 }
    );
  }
}
