import { NextRequest, NextResponse } from 'next/server';
import { verifyPartnerJWT } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { getServerStripe } from '@/lib/stripe';
import Stripe from 'stripe';
import { FreeForeverUpgradeService } from '@/lib/services/freeForeverUpgradeService';

export const dynamic = 'force-dynamic';

const stripe = getServerStripe();

/**
 * GET /api/partner/subscription
 * Get partner's subscription details from Stripe
 */
export async function GET(request: NextRequest) {
  try {
    // Verify partner authentication
    const decoded = await verifyPartnerJWT(request);
    if (!decoded || !decoded.payload || !decoded.isValid) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const partnerId = decoded.payload.partnerId;

    // Get partner details
    const partner = await prisma.partner.findUnique({
      where: { id: partnerId },
      select: {
        id: true,
        businessName: true,
        emailAddress: true,
        stripeCustomerId: true,
        stripeSubscriptionId: true,
        planId: true,
        billingInterval: true,
        subscriptionStatus: true,
        marketingTier: true,
        approvalStatus: true,
        createdAt: true,
        hasStartedTrial: true,
      },
    });

    if (!partner) {
      return NextResponse.json({ error: 'Partner not found' }, { status: 404 });
    }

    let subscriptionDetails = null;
    let paymentMethod = null;
    let upcomingInvoice = null;
    let customerPortalUrl = null;

    // If partner has Stripe subscription, fetch details
    if (partner.stripeCustomerId && partner.stripeSubscriptionId) {
      try {
        // Fetch subscription from Stripe
        const subscription = await stripe.subscriptions.retrieve(
          partner.stripeSubscriptionId,
          {
            expand: ['default_payment_method', 'latest_invoice'],
          }
        );

        subscriptionDetails = {
          id: subscription.id,
          status: subscription.status,
          currentPeriodStart: new Date(subscription.current_period_start * 1000),
          currentPeriodEnd: new Date(subscription.current_period_end * 1000),
          cancelAtPeriodEnd: subscription.cancel_at_period_end,
          cancelAt: subscription.cancel_at ? new Date(subscription.cancel_at * 1000) : null,
          trialStart: subscription.trial_start ? new Date(subscription.trial_start * 1000) : null,
          trialEnd: subscription.trial_end ? new Date(subscription.trial_end * 1000) : null,
          items: subscription.items.data.map(item => ({
            id: item.id,
            priceId: item.price.id,
            productId: item.price.product as string,
            amount: item.price.unit_amount,
            currency: item.price.currency,
            interval: item.price.recurring?.interval,
            intervalCount: item.price.recurring?.interval_count,
          })),
        };

        // Get payment method details (masked for security)
        if (subscription.default_payment_method) {
          const pm = subscription.default_payment_method as Stripe.PaymentMethod;
          if (pm.card) {
            paymentMethod = {
              type: 'card',
              brand: pm.card.brand,
              lastFour: pm.card.last4,
              expMonth: pm.card.exp_month,
              expYear: pm.card.exp_year,
            };
          }
        }

        // Get upcoming invoice
        try {
          const invoice = await stripe.invoices.retrieveUpcoming({
            customer: partner.stripeCustomerId,
          });

          upcomingInvoice = {
            amountDue: invoice.amount_due,
            currency: invoice.currency,
            periodStart: new Date(invoice.period_start * 1000),
            periodEnd: new Date(invoice.period_end * 1000),
            nextPaymentAttempt: invoice.next_payment_attempt 
              ? new Date(invoice.next_payment_attempt * 1000) 
              : null,
          };
        } catch (invoiceError) {
          // No upcoming invoice found - this is normal for some subscription states
        }

        // Generate customer portal URL for payment management
        const portalSession = await stripe.billingPortal.sessions.create({
          customer: partner.stripeCustomerId,
          return_url: `${process.env.NEXT_PUBLIC_APP_URL}/partner/settings`,
        });

        customerPortalUrl = portalSession.url;

      } catch (stripeError) {
        // Error handled silently for production
        // Continue without Stripe data if there's an error
      }
    }

    // Determine subscription type
    let subscriptionType = 'none';
    if (partner.subscriptionStatus === 'ACTIVE') {
      if (partner.billingInterval === 'lifetime') {
        subscriptionType = 'one_time';
      } else {
        subscriptionType = partner.billingInterval || 'monthly';
      }
    }

    // Determine subscription tier based on actual Stripe data (planId + billingInterval)
    // Don't use marketingTier for subscription display - that's for marketing campaign tracking
    const freeForeverPriceId = process.env.STRIPE_FREE_FOREVER_PRICE_ID;
    let tier: string;

    // Get Stripe price IDs from environment
    const enterpriseMonthlyPriceId = process.env.STRIPE_ENTERPRISE_MONTHLY_PRICE_ID;
    const enterpriseYearlyPriceId = process.env.STRIPE_ENTERPRISE_YEARLY_PRICE_ID;
    const starterMonthlyPriceId = process.env.STRIPE_STARTER_MONTHLY_PRICE_ID;
    const starterYearlyPriceId = process.env.STRIPE_STARTER_YEARLY_PRICE_ID;
    const proMonthlyPriceId = process.env.STRIPE_PRO_MONTHLY_PRICE_ID;
    const proYearlyPriceId = process.env.STRIPE_PRO_YEARLY_PRICE_ID;
    const lifetimeProPriceId = process.env.STRIPE_LIFETIME_PRO_PRICE_ID;

    // Debug logging for tier calculation
    console.log('🔍 Tier Calculation Debug:', {
      partnerId: partner.id,
      planId: partner.planId,
      marketingTier: partner.marketingTier,
      approvalStatus: partner.approvalStatus,
      subscriptionStatus: partner.subscriptionStatus,
      billingInterval: partner.billingInterval,
      enterpriseMonthlyPriceId,
      enterpriseYearlyPriceId,
      starterMonthlyPriceId,
      starterYearlyPriceId,
      freeForeverPriceId
    });

    // Determine tier based on planId and approval status only
    // Check approval status first - must be ACTIVE for paid tiers
    if (partner.approvalStatus !== 'ACTIVE') {
      tier = 'free_forever'; // Non-active partners get free tier
    } else if (partner.planId === 'enterprise' ||
               (enterpriseMonthlyPriceId && partner.planId === enterpriseMonthlyPriceId) ||
               (enterpriseYearlyPriceId && partner.planId === enterpriseYearlyPriceId)) {
      tier = 'enterprise';
    } else if (partner.planId === 'starter' ||
               (starterMonthlyPriceId && partner.planId === starterMonthlyPriceId) ||
               (starterYearlyPriceId && partner.planId === starterYearlyPriceId)) {
      tier = 'starter';
    } else if (partner.planId === 'lifetime' ||
               (partner.planId === 'pro' && partner.billingInterval === 'lifetime') ||
               (lifetimeProPriceId && partner.planId === lifetimeProPriceId)) {
      tier = 'lifetime_pro';
    } else if (partner.planId === 'pro' ||
               (proMonthlyPriceId && partner.planId === proMonthlyPriceId) ||
               (proYearlyPriceId && partner.planId === proYearlyPriceId)) {
      tier = 'pro';
    } else if (partner.planId === 'free_forever_trial' || partner.planId === 'free_forever' ||
        (freeForeverPriceId && partner.planId === freeForeverPriceId)) {
      tier = 'free_forever';
    } else if (!partner.planId && partner.subscriptionStatus === 'INACTIVE') {
      tier = 'free_forever';
    } else {
      // Fallback for unknown planId
      tier = 'unknown';
    }

    console.log('🎯 Calculated Tier:', tier);

    // Clear the FreeForeverUpgradeService cache to ensure fresh data
    FreeForeverUpgradeService.clearCache();

    return NextResponse.json({
      success: true,
      data: {
        partner: {
          id: partner.id,
          businessName: partner.businessName,
          emailAddress: partner.emailAddress,
          subscriptionStatus: partner.subscriptionStatus,
          approvalStatus: partner.approvalStatus,
          marketingTier: partner.marketingTier,
          createdAt: partner.createdAt,
          hasStartedTrial: partner.hasStartedTrial,
        },
        subscription: {
          type: subscriptionType,
          tier: tier,
          planId: partner.planId,
          billingInterval: partner.billingInterval,
          details: subscriptionDetails,
          paymentMethod,
          upcomingInvoice,
          customerPortalUrl,
        },
      },
    });

  } catch (error) {
    // Error handled silently for production
    return NextResponse.json(
      { error: 'Failed to fetch subscription details' },
      { status: 500 }
    );
  }
}
