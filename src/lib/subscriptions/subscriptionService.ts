import Stripe from 'stripe';
import { prisma } from '@/lib/prisma';
import {
  SubscriptionStatus,
  SubscriptionChangeType,
  CreateSubscriptionRequest,
  UpdateSubscriptionRequest,
  SubscriptionAction,
} from './types';
import { logger } from '../logger';
import { applyPlanFeaturesToCustomer } from '../services/planFeatureService';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2023-10-16',
});

export class SubscriptionService {
  /**
   * Create a new customer subscription
   */
  static async createSubscription(
    partnerId: string,
    request: CreateSubscriptionRequest
  ): Promise<any> {
    try {
      // Get customer and partner details
      const [customer, partner, plan] = await Promise.all([
        prisma.customer.findUnique({ where: { id: request.customerId } }),
        prisma.partner.findUnique({ where: { id: partnerId } }),
        prisma.subscriptionPlan.findUnique({ where: { id: request.planId } }),
      ]);

      if (!customer || !partner || !plan) {
        throw new Error('Customer, partner, or plan not found');
      }

      // Create or get Stripe customer
      let stripeCustomer: Stripe.Customer;
      if (customer.stripeCustomerId) {
        stripeCustomer = await stripe.customers.retrieve(customer.stripeCustomerId) as Stripe.Customer;
      } else {
        stripeCustomer = await stripe.customers.create({
          email: customer.email,
          name: `${customer.firstName} ${customer.lastName}`.trim(),
          metadata: {
            customerId: customer.id,
            partnerId: partnerId,
          },
        });

        // Update customer with Stripe ID
        await prisma.customer.update({
          where: { id: customer.id },
          data: { stripeCustomerId: stripeCustomer.id },
        });
      }

      // Create Stripe subscription
      const subscriptionParams: Stripe.SubscriptionCreateParams = {
        customer: stripeCustomer.id,
        items: [{ price: plan.stripePriceId }],
        metadata: {
          customerId: customer.id,
          partnerId: partnerId,
          planId: plan.id,
          ...request.metadata,
        },
        expand: ['latest_invoice.payment_intent'],
      };

      // Add trial period if specified
      if (request.trialPeriodDays) {
        subscriptionParams.trial_period_days = request.trialPeriodDays;
      }

      // Add coupon if specified
      if (request.couponId) {
        subscriptionParams.coupon = request.couponId;
      }

      // Add Stripe Connect parameters if partner has connected account
      if (partner.stripeAccountId) {
        subscriptionParams.transfer_data = {
          destination: partner.stripeAccountId,
        };

        if (partner.applicationFeePercent) {
          subscriptionParams.application_fee_percent = Number(partner.applicationFeePercent);
        }
      }

      const stripeSubscription = await stripe.subscriptions.create(subscriptionParams);

      // Create subscription record in database
      const subscription = await prisma.customerSubscription.create({
        data: {
          customerId: customer.id,
          partnerId: partnerId,
          planId: plan.id,
          stripeSubscriptionId: stripeSubscription.id,
          stripeCustomerId: stripeCustomer.id,
          status: stripeSubscription.status as SubscriptionStatus,
          currentPeriodStart: new Date(stripeSubscription.current_period_start * 1000),
          currentPeriodEnd: new Date(stripeSubscription.current_period_end * 1000),
          trialStart: stripeSubscription.trial_start ? new Date(stripeSubscription.trial_start * 1000) : null,
          trialEnd: stripeSubscription.trial_end ? new Date(stripeSubscription.trial_end * 1000) : null,
          cancelAtPeriodEnd: stripeSubscription.cancel_at_period_end,
          metadata: request.metadata || {},
        },
      });

      // Log subscription event
      await this.logSubscriptionEvent(subscription.id, 'created', {
        planId: plan.id,
        amount: plan.amount,
        interval: plan.interval,
      });

      // Apply plan features to customer immediately (don't rely solely on webhook timing)
      try {
        logger.info('Applying plan features inline after subscription creation', {
          operation: 'subscription_service',
          planId: plan.id,
          customerId: customer.id,
          partnerId
        });
        await applyPlanFeaturesToCustomer(plan.id, customer.id, partnerId);
        logger.info('Plan features applied successfully', {
          operation: 'subscription_service',
          planId: plan.id,
          customerId: customer.id,
          partnerId
        });
      } catch (featureError) {
        // Log error but don't fail subscription creation - webhook will retry feature application
        logger.error(
          'Failed to apply plan features during subscription creation',
          featureError instanceof Error ? featureError : new Error(String(featureError)),
          {
            operation: 'subscription_service',
            planId: plan.id,
            customerId: customer.id,
            partnerId
          }
        );
      }

      return subscription;
    } catch (error) {
      logger.error('Error creating subscription', error as Error, {
        operation: 'subscription_service',
        partnerId,
        customerId: request.customerId
      });
      throw error;
    }
  }

  /**
   * Update an existing subscription
   */
  static async updateSubscription(
    subscriptionId: string,
    request: UpdateSubscriptionRequest
  ): Promise<any> {
    try {
      const subscription = await prisma.customerSubscription.findUnique({
        where: { id: subscriptionId },
        include: { plan: true },
      });

      if (!subscription) {
        throw new Error('Subscription not found');
      }

      const updateParams: Stripe.SubscriptionUpdateParams = {};

      // Update plan if specified
      if (request.planId && request.planId !== subscription.planId) {
        const newPlan = await prisma.subscriptionPlan.findUnique({
          where: { id: request.planId },
        });

        if (!newPlan) {
          throw new Error('New plan not found');
        }

        updateParams.items = [{
          id: subscription.stripeSubscriptionId,
          price: newPlan.stripePriceId,
        }];

        updateParams.proration_behavior = 'create_prorations';
      }

      // Update cancel at period end
      if (request.cancelAtPeriodEnd !== undefined) {
        updateParams.cancel_at_period_end = request.cancelAtPeriodEnd;
      }

      // Handle pause collection
      if (request.pauseCollection) {
        updateParams.pause_collection = {
          behavior: request.pauseCollection.behavior,
          resumes_at: request.pauseCollection.resumesAt
            ? Math.floor(request.pauseCollection.resumesAt.getTime() / 1000)
            : undefined,
        };
      }

      // Update metadata
      if (request.metadata) {
        updateParams.metadata = request.metadata;
      }

      const updatedStripeSubscription = await stripe.subscriptions.update(
        subscription.stripeSubscriptionId,
        updateParams
      );

      // Update subscription in database
      const updatedSubscription = await prisma.customerSubscription.update({
        where: { id: subscriptionId },
        data: {
          planId: request.planId || subscription.planId,
          status: updatedStripeSubscription.status as SubscriptionStatus,
          currentPeriodStart: new Date(updatedStripeSubscription.current_period_start * 1000),
          currentPeriodEnd: new Date(updatedStripeSubscription.current_period_end * 1000),
          cancelAtPeriodEnd: updatedStripeSubscription.cancel_at_period_end,
          pausedAt: request.pauseCollection ? new Date() : subscription.pausedAt,
          resumeAt: request.pauseCollection?.resumesAt || subscription.resumeAt,
          metadata: updateParams.metadata || {},
        },
      });

      // Log subscription event
      const eventType: SubscriptionChangeType = request.planId ?
        (request.planId !== subscription.planId ? 'upgraded' : 'updated') : 'updated';

      await this.logSubscriptionEvent(subscriptionId, eventType, {
        oldPlanId: subscription.planId,
        newPlanId: request.planId,
        changes: request,
      });

      return updatedSubscription;
    } catch (error) {
      logger.error('Error updating subscription', error as Error, {
        operation: 'subscription_service',
        subscriptionId
      });
      throw error;
    }
  }

  /**
   * Cancel a subscription
   */
  static async cancelSubscription(
    subscriptionId: string,
    action: SubscriptionAction
  ): Promise<any> {
    try {
      const subscription = await prisma.customerSubscription.findUnique({
        where: { id: subscriptionId },
      });

      if (!subscription) {
        throw new Error('Subscription not found');
      }

      const cancelParams: Stripe.SubscriptionUpdateParams = {
        cancel_at_period_end: action.effectiveDate ? false : true,
      };

      if (action.effectiveDate) {
        cancelParams.cancel_at = Math.floor(action.effectiveDate.getTime() / 1000);
      }

      const canceledStripeSubscription = await stripe.subscriptions.update(
        subscription.stripeSubscriptionId,
        cancelParams
      );

      // Update subscription in database
      const updatedSubscription = await prisma.customerSubscription.update({
        where: { id: subscriptionId },
        data: {
          status: canceledStripeSubscription.status as SubscriptionStatus,
          canceledAt: action.effectiveDate || new Date(),
          cancelAtPeriodEnd: canceledStripeSubscription.cancel_at_period_end,
          metadata: {
            cancelReason: action.reason,
            ...(action.metadata || {}),
          },
        },
      });

      // Log subscription event
      await this.logSubscriptionEvent(subscriptionId, 'canceled', {
        reason: action.reason,
        effectiveDate: action.effectiveDate,
      });

      return updatedSubscription;
    } catch (error) {
      logger.error('Error canceling subscription', error as Error, {
        operation: 'subscription_service',
        subscriptionId
      });
      throw error;
    }
  }

  /**
   * Log subscription events for audit trail
   */
  private static async logSubscriptionEvent(
    subscriptionId: string,
    type: SubscriptionChangeType,
    data: Record<string, any>
  ): Promise<void> {
    try {
      await prisma.subscriptionEvent.create({
        data: {
          subscriptionId,
          type,
          data,
        },
      });
    } catch (error) {
      logger.error('Error logging subscription event', error as Error, {
        operation: 'subscription_service'
      });
      // Don't throw - logging shouldn't break the main operation
    }
  }
}
