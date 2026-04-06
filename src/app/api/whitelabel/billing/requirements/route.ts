import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyCustomerJWT } from '@/lib/customerJwt';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

export async function GET(_request: NextRequest) {
  try {
    // Get customer token from cookies
    const token = cookies().get('customer_token')?.value;

    if (!token) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Verify JWT token
    const payload = await verifyCustomerJWT(token);

    if (!payload) {
      return NextResponse.json(
        { success: false, error: 'Invalid token' },
        { status: 401 }
      );
    }

    const customerId = payload.customerId;

    // Get customer information with partner relationship
    const customer = await prisma.customer.findUnique({
      where: { id: customerId },
      select: {
        id: true,
        stripeCustomerId: true,
        credentials: {
          select: {
            partnerId: true,
          },
          take: 1,
        },
      },
    });

    if (!customer || !customer.credentials.length) {
      return NextResponse.json(
        { success: false, error: 'Customer not found' },
        { status: 404 }
      );
    }

    const partnerId = customer.credentials[0].partnerId;

    // Check for active metered billing subscriptions
    const activeSubscriptions = await prisma.customerMeteredSubscription.count({
      where: {
        customerId: customer.id,
        status: 'active',
      },
    });

    // Check for unpaid invoices
    const unpaidInvoices = await prisma.invoice.count({
      where: {
        customerId: customer.id,
        status: {
          in: ['sent', 'overdue'],
        },
      },
    });

    // Determine if payment method is required
    const requiresPaymentMethod = activeSubscriptions > 0 || unpaidInvoices > 0;

    // Check if customer has valid payment method in Stripe
    let hasValidPaymentMethod = false;
    if (requiresPaymentMethod && customer.stripeCustomerId) {
      try {
        // Get partner's Stripe account
        const partner = await prisma.partner.findUnique({
          where: { id: partnerId },
          select: { stripeAccountId: true },
        });

        if (partner?.stripeAccountId) {
          const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
          
          // Get payment methods for the customer
          const paymentMethods = await stripe.paymentMethods.list({
            customer: customer.stripeCustomerId,
            type: 'card',
          }, {
            stripeAccount: partner.stripeAccountId,
          });

          hasValidPaymentMethod = paymentMethods.data.length > 0;
        }
      } catch (stripeError) {
        console.error('Error checking Stripe payment methods:', stripeError);
        // If we can't check Stripe, assume no valid payment method
        hasValidPaymentMethod = false;
      }
    } else if (!requiresPaymentMethod) {
      // If no payment method is required, consider it valid
      hasValidPaymentMethod = true;
    }

    const billingRequirement = {
      hasActiveSubscriptions: activeSubscriptions > 0,
      hasUnpaidInvoices: unpaidInvoices > 0,
      requiresPaymentMethod,
      hasValidPaymentMethod,
    };

    return NextResponse.json({
      success: true,
      data: billingRequirement,
    });

  } catch (error) {
    console.error('Error checking billing requirements:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
