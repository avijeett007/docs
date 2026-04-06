import { headers } from 'next/headers';

// This route uses dynamic features, so it must be server-rendered
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getServerStripe } from '@/lib/stripe';
import { prisma } from '@/lib/prisma';
import { SubscriptionCreditService } from '@/lib/services/subscriptionCreditService';
import Stripe from 'stripe';
import { logger } from '@/lib/logger';

export async function POST(req: Request) {
  const stripe = getServerStripe();
  if (!stripe) {
    return new NextResponse('Stripe is not properly initialized', { status: 500 });
  }

  const body = await req.text();
  const headersList = headers();
  const signature = headersList.get('Stripe-Signature') as string;
  const connectedAccountId = headersList.get('stripe-account');

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!
    );
  } catch (error: any) {
    console.error('Webhook signature verification failed:', error.message);
    return new NextResponse(`Webhook Error: ${error.message}`, { status: 400 });
  }

  // Check for idempotency - prevent duplicate processing
  const existingEvent = await prisma.stripeWebhookEvent.findUnique({
    where: { stripeEventId: event.id }
  });

  if (existingEvent?.processed) {
    console.log(`[Main Webhook] Event ${event.id} already processed, skipping`);
    return new NextResponse('Event already processed', { status: 200 });
  }

  // Create or update webhook event record
  const webhookEvent = await prisma.stripeWebhookEvent.upsert({
    where: { stripeEventId: event.id },
    create: {
      stripeEventId: event.id,
      eventType: event.type,
      processed: false,
      metadata: {
        livemode: event.livemode,
        created: event.created
      }
    },
    update: {
      eventType: event.type
    }
  });

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;

        // Check if this is a tool call quota subscription first
        if (session.mode === 'subscription' && session.metadata?.quotaTier) {
          console.log('[Main Webhook] Processing tool call quota subscription checkout session');

          const { customerId, quotaTier } = session.metadata;

          if (customerId && quotaTier) {
            console.log(`[Main Webhook] Updating customer ${customerId} quota tier to ${quotaTier} from checkout session`);

            // Update customer quota tier immediately
            await updateCustomerQuotaTier(customerId, quotaTier, session.subscription as string);

            console.log(`[Main Webhook] ✅ Tool call quota updated for customer ${customerId} to tier ${quotaTier}`);
          } else {
            console.error('[Main Webhook] Missing customerId or quotaTier in checkout session metadata:', session.metadata);
          }

          break;
        }

        // Check if this is an upgrade session - route to StripeWebhookService
        if (session.subscription && session.metadata?.is_upgrade === 'true') {
          console.log('[Main Webhook] Detected upgrade session, routing to StripeWebhookService');
          const { StripeWebhookService } = await import('@/lib/stripe/webhooks');
          await StripeWebhookService.processWebhookEvent(event as any, connectedAccountId);
          break;
        }

        // Handle partner subscription checkouts (onboarding)
        const partnerId = session.metadata?.partnerId;
        const couponId = session.metadata?.couponId;

        if (!partnerId) {
          console.error('No partner ID in session metadata');
          return new NextResponse('Partner ID is required', { status: 400 });
        }



        // Check if this is a one-time payment or subscription
        // One-time payments (including lifetime offers) have no subscription
        if (!session.subscription) {
          // This is a one-time payment - handle via StripeWebhookService
          console.log(`Processing one-time payment for partner ${partnerId}${couponId ? ` with coupon ${couponId}` : ' (no coupon)'}`);
          const { StripeWebhookService } = await import('@/lib/stripe/webhooks');
          await StripeWebhookService.processWebhookEvent(event as any, connectedAccountId);
          break;
        }

        // Handle subscription-based checkout
        // At this point, we know session.subscription exists because we checked above
        console.log(`Processing subscription-based payment for partner ${partnerId} with subscription ${session.subscription}`);

        // Retrieve subscription details
        const subscription = await stripe.subscriptions.retrieve(
          session.subscription as string
        );

        // Update partner status for subscription
        const updatedPartner = await prisma.partner.update({
          where: { id: partnerId },
          data: {
            approvalStatus: 'ACTIVE',
            subscriptionStatus: 'ACTIVE',
            stripeCustomerId: session.customer as string,
            stripeSubscriptionId: subscription.id,
            planId: subscription.items.data[0].price.id,
            billingInterval: subscription.items.data[0].price.recurring?.interval || 'month'
          },
        });

        // Handle referral tracking if referral metadata exists
        const referralId = session.metadata?.referral_id;
        const referralSource = session.metadata?.referral_source;

        /**
         * Referral Conversion Tracking Logic:
         *
         * 1. Free Forever ($0):
         *    - Rewardful JS automatically tracks as "lead" when user visits ?via=referral-code
         *    - No server-side API calls needed for lead tracking
         *    - Shows in Rewardful dashboard as lead automatically
         *
         * 2. Paid Plans (>$0):
         *    - Track as "conversion" in our database for internal reporting
         *    - Rewardful will also track this as conversion via their webhook (if configured)
         *    - Shows in Rewardful dashboard as conversion
         *
         * 3. Free → Paid Upgrade:
         *    - Original Free Forever signup was tracked as lead by Rewardful JS
         *    - This webhook converts the lead to conversion when they upgrade
         */
        if (referralId && referralSource === 'rewardful') {
          try {
            const priceId = subscription.items.data[0].price.id;
            const isFreeForeverTier = priceId === process.env.STRIPE_FREE_FOREVER_PRICE_ID;

            if (!isFreeForeverTier) {
              // Only track conversions for paid tiers (Free Forever is tracked automatically by Rewardful JS)
              await prisma.affiliateConversion.create({
                data: {
                  referralId,
                  stripeCustomerId: session.customer as string,
                  amount: session.amount_total || 0,
                  currency: session.currency || 'usd',
                  orderId: session.id, // Use session.id as orderId
                  isRecurring: true, // Subscription is recurring
                  metadata: {
                    planId: subscription.items.data[0].price.id,
                    billingInterval: subscription.items.data[0].price.recurring?.interval || 'month',
                    subscriptionId: subscription.id,
                    partnerId, // Store partnerId in metadata
                  },
                },
              });

              logger.info('Tracked referral conversion for paid tier', { referralId, partnerId });
            } else {
              // Free Forever: Rewardful JS handles lead tracking automatically
              logger.info('Free Forever signup - lead tracked automatically by Rewardful JS', { referralId, partnerId });
            }
          } catch (error) {
            logger.error('Error tracking referral', error instanceof Error ? error : new Error(String(error)));
            // Don't fail the webhook if referral tracking fails
          }
        }

        // Activate affiliate if partner has one and is now a paid user
        if (updatedPartner.rewardfulAffiliateId && updatedPartner.affiliateStatus === 'INACTIVE') {
          try {
            const { getRewardfulService } = await import('@/lib/rewardful');
            const rewardfulService = getRewardfulService();

            // Activate affiliate in Rewardful
            await rewardfulService.updateAffiliate(updatedPartner.rewardfulAffiliateId, {
              status: 'active',
            });

            // Update partner affiliate status
            await prisma.partner.update({
              where: { id: partnerId },
              data: {
                affiliateStatus: 'ACTIVE',
                affiliateCommissionRate: 20.0, // Upgrade to 20% for paid users
              },
            });

            console.log(`Activated affiliate for paid partner ${partnerId} with Rewardful ID: ${updatedPartner.rewardfulAffiliateId}`);
          } catch (error) {
            console.error('Error activating affiliate for partner:', partnerId, error);
            // Don't fail the webhook if affiliate activation fails
          }
        }

        // Allocate initial credits for new subscription
        const priceId = subscription.items.data[0].price.id;

        // Map price ID to plan name - fallback if metadata is missing
        let planName = session.metadata?.planName || 'Unknown Plan';

        // If planName is unknown, try to determine from price ID
        if (planName === 'Unknown Plan') {
          if (priceId === process.env.STRIPE_FREE_FOREVER_PRICE_ID) {
            planName = 'Free Forever';
          } else if (priceId === process.env.STRIPE_FREE_TRIAL_PRICE_ID) {
            planName = 'Free Forever Trial';
          } else if (priceId === process.env.STRIPE_STARTER_TRIAL_PRICE_ID) {
            planName = 'Starter Tier Trial';
          } else if (priceId === process.env.STRIPE_STARTER_MONTHLY_PRICE_ID || priceId === process.env.STRIPE_STARTER_YEARLY_PRICE_ID) {
            planName = 'Solo Agency Owner';
          } else if (priceId === process.env.STRIPE_STARTER_SPECIAL_MONTHLY_PRICE_ID || priceId === process.env.STRIPE_STARTER_SPECIAL_YEARLY_PRICE_ID) {
            planName = 'Solo Agency Owner (Special)';
          } else if (priceId === process.env.STRIPE_PRO_MONTHLY_PRICE_ID || priceId === process.env.STRIPE_PRO_YEARLY_PRICE_ID) {
            planName = 'Professional Agency Owner';
          } else if (priceId === process.env.STRIPE_ENTERPRISE_MONTHLY_PRICE_ID || priceId === process.env.STRIPE_ENTERPRISE_YEARLY_PRICE_ID) {
            planName = 'Ultimate Scaleup Agency';
          } else {
            // Log the unknown price ID for debugging
            console.warn(`Unknown price ID in webhook: ${priceId}. Using fallback plan name.`);
            planName = 'Solo Agency Owner'; // Default to starter plan
          }
        }

        console.log(`Allocating credits for plan: ${planName} (Price ID: ${priceId})`);

        const creditResult = await SubscriptionCreditService.allocateMonthlyCredits(
          partnerId,
          planName,
          priceId,
          true // force allocation for new subscriptions
        );

        if (creditResult.success) {
          console.log(`Allocated ${creditResult.creditsAllocated} initial credits for new partner subscription: ${subscription.id}`);
        } else {
          console.error(`Failed to allocate initial credits for partner ${partnerId}:`, creditResult.error);
        }

        console.log(`Subscription payment processed successfully for partner ${partnerId}`);

        break;
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription;

        // Find partner by subscription ID
        const partner = await prisma.partner.findFirst({
          where: { stripeSubscriptionId: subscription.id },
        });

        if (!partner) {
          console.error('No partner found for subscription:', subscription.id);
          return new NextResponse('No partner found', { status: 404 });
        }

        // Check if this deletion is part of an upgrade flow
        // If upgradeIntentPlanId is set, the partner is upgrading and we should NOT deactivate them
        if (partner.upgradeIntentPlanId) {
          console.log(`Subscription deleted during upgrade flow for partner ${partner.id}. Keeping partner active.`);
          // Only clear the old subscription ID, keep everything else intact
          await prisma.partner.update({
            where: { id: partner.id },
            data: {
              stripeSubscriptionId: null,
            },
          });
        } else {
          // Normal cancellation - deactivate the partner
          await prisma.partner.update({
            where: { id: partner.id },
            data: {
              approvalStatus: 'INACTIVE',
              subscriptionStatus: 'CANCELLED',
              stripeSubscriptionId: null,
              planId: null,
              billingInterval: null
            },
          });
        }

        break;
      }

      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription;
        
        // Find partner by subscription ID
        const partner = await prisma.partner.findFirst({
          where: { stripeSubscriptionId: subscription.id },
        });

        if (!partner) {
          console.error('No partner found for subscription:', subscription.id);
          return new NextResponse('No partner found', { status: 404 });
        }

        // Update partner with latest subscription status
        await prisma.partner.update({
          where: { id: partner.id },
          data: {
            approvalStatus: subscription.status === 'active' ? 'ACTIVE' : 'INACTIVE',
            subscriptionStatus: subscription.status.toUpperCase(),
            planId: subscription.items.data[0].price.id,
            billingInterval: subscription.items.data[0].price.recurring?.interval || 'month'
          },
        });

        break;
      }

      case 'checkout.session.expired': {
        const expiredSession = event.data.object as Stripe.Checkout.Session;

        // Check if this was an upgrade checkout session
        if (expiredSession.metadata?.is_upgrade === 'true' && expiredSession.metadata?.partner_id) {
          const upgradePartnerId = expiredSession.metadata.partner_id;
          const upgradeFrom = expiredSession.metadata.upgrade_from;

          console.log(`Upgrade checkout expired for partner ${upgradePartnerId}, upgrade_from: ${upgradeFrom}`);

          // If upgrading from free_forever, restore the free forever subscription
          if (upgradeFrom === 'free_forever') {
            try {
              const upgradePartner = await prisma.partner.findUnique({
                where: { id: upgradePartnerId },
                select: { id: true, stripeCustomerId: true, upgradeIntentPlanId: true },
              });

              if (upgradePartner?.upgradeIntentPlanId && upgradePartner.stripeCustomerId) {
                const freeForeverPriceId = process.env.STRIPE_FREE_FOREVER_PRICE_ID;

                if (freeForeverPriceId) {
                  // Recreate the free forever subscription
                  const newSub = await stripe.subscriptions.create({
                    customer: upgradePartner.stripeCustomerId,
                    items: [{ price: freeForeverPriceId }],
                    metadata: {
                      partner_id: upgradePartnerId,
                      restored_after_expired_upgrade: 'true',
                    },
                  });

                  // Restore partner state
                  await prisma.partner.update({
                    where: { id: upgradePartnerId },
                    data: {
                      stripeSubscriptionId: newSub.id,
                      planId: 'free_forever',
                      subscriptionStatus: 'ACTIVE',
                      upgradeIntentPlanId: null,
                      upgradeIntentBillingInterval: null,
                      upgradeIntentCreatedAt: null,
                    },
                  });

                  console.log(`Restored free forever subscription for partner ${upgradePartnerId}: ${newSub.id}`);
                }
              }
            } catch (restoreError) {
              console.error(`Failed to restore free forever subscription for partner ${upgradePartnerId}:`, restoreError);
            }
          } else {
            // For non-free-forever upgrades, just clear the upgrade intent
            await prisma.partner.update({
              where: { id: upgradePartnerId },
              data: {
                upgradeIntentPlanId: null,
                upgradeIntentBillingInterval: null,
                upgradeIntentCreatedAt: null,
              },
            });
          }
        }

        break;
      }

      default:
        console.log('Unhandled event type:', event.type);
    }

    // Mark event as processed
    await prisma.stripeWebhookEvent.update({
      where: { id: webhookEvent.id },
      data: {
        processed: true,
        processedAt: new Date()
      }
    });

    return new NextResponse('Webhook processed successfully', { status: 200 });
  } catch (error) {
    console.error('Error processing webhook:', error);

    // Mark event as failed
    await prisma.stripeWebhookEvent.update({
      where: { id: webhookEvent.id },
      data: {
        processed: false,
        errorMessage: error instanceof Error ? error.message : String(error)
      }
    });

    return new NextResponse('Webhook error', { status: 500 });
  }
}

async function updateCustomerQuotaTier(
  customerId: string,
  tier: string,
  subscriptionId: string | null
): Promise<void> {
  try {
    console.log(`[Main Webhook] Updating customer quota tier: customerId=${customerId}, tier=${tier}, subscriptionId=${subscriptionId}`);

    const { getQuotaTier } = await import('@/lib/toolCallQuotas');
    const quotaTier = getQuotaTier(tier);

    if (!quotaTier) {
      console.error(`[Main Webhook] Invalid quota tier: ${tier}`);
      return;
    }

    console.log(`[Main Webhook] Quota tier details: limit=${quotaTier.limit}, windowMs=${quotaTier.windowMs}`);

    const updatedCustomer = await prisma.customer.update({
      where: { id: customerId },
      data: {
        toolCallQuotaTier: tier,
        toolCallQuotaLimit: quotaTier.limit,
        toolCallQuotaWindow: quotaTier.windowMs,
        toolCallQuotaSubscriptionId: subscriptionId,
        toolCallQuotaStripeProductId: quotaTier.stripePriceId,
        toolCallQuotaLastReset: new Date(),
        toolCallQuotaUsedInWindow: 0, // Reset usage when tier changes
      },
    });

    console.log(`[Main Webhook] Successfully updated customer ${customerId}: tier=${updatedCustomer.toolCallQuotaTier}, limit=${updatedCustomer.toolCallQuotaLimit}`);
  } catch (error) {
    console.error(`[Main Webhook] Error updating customer quota tier:`, error);
    throw error;
  }
}
