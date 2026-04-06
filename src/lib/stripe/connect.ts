// Stripe Connect service for partner onboarding and account management

import Stripe from 'stripe';
import { prisma } from '@/lib/prisma';
import {
  StripeConnectAccount,
  StripeAccountLink,
  CreateAccountLinkParams,
  OnboardingFlowParams,
  OnboardingFlowResponse,
  PartnerStripeStatus,
  DisconnectAccountParams,
  RefreshOnboardingParams,
} from './types';
import {
  createStripeConnectError,
  isValidStripeAccountId,
  getStripeErrorMessage,
} from './utils';
import { logger } from '@/lib/logger';

// Initialize Stripe with secret key
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2023-10-16',
});

export class StripeConnectService {
  /**
   * Create a new Stripe Connect account for a partner
   */
  static async createConnectAccount(
    partnerId: string,
    accountType: 'express' | 'standard' = 'express',
    email?: string,
    businessName?: string
  ): Promise<StripeConnectAccount> {
    try {
      // Check if partner already has a Stripe account
      const partner = await prisma.partner.findUnique({
        where: { id: partnerId },
        select: {
          stripeAccountId: true,
          emailAddress: true,
          businessName: true,
        },
      });

      if (!partner) {
        throw createStripeConnectError(
          'Partner not found',
          'PARTNER_NOT_FOUND',
          404
        );
      }

      if (partner.stripeAccountId) {
        throw createStripeConnectError(
          'Partner already has a Stripe account',
          'ACCOUNT_ALREADY_EXISTS',
          400
        );
      }

      // Create Stripe account
      // Note: Avoiding capabilities specification to prevent country preselection
      // as recommended by Stripe support
      const account = await stripe.accounts.create({
        type: accountType,
        email: email || partner.emailAddress,
        business_profile: businessName || partner.businessName ? {
          name: businessName || partner.businessName,
        } : undefined,
        metadata: {
          partner_id: partnerId,
          platform: 'knotie-ai-pro',
        },
      });

      // Update partner record with Stripe account ID
      await prisma.partner.update({
        where: { id: partnerId },
        data: {
          stripeAccountId: account.id,
          stripeAccountType: accountType,
          stripeChargesEnabled: account.charges_enabled,
          stripePayoutsEnabled: account.payouts_enabled,
          stripeDetailsSubmitted: account.details_submitted,
          stripeCapabilities: account.capabilities as any,
          stripeRequirements: account.requirements as any,
        },
      });

      return account as StripeConnectAccount;
    } catch (error: any) {
      logger.error('Error creating Stripe Connect account', error as Error, {
        operation: 'stripe_connect',
        partnerId,
        accountType
      });

      if (error.type === 'StripeConnectError') {
        throw error;
      }

      throw createStripeConnectError(
        getStripeErrorMessage(error),
        'ACCOUNT_CREATION_FAILED',
        500,
        error.code
      );
    }
  }

  /**
   * Create an account link for onboarding
   */
  static async createAccountLink(
    params: CreateAccountLinkParams
  ): Promise<StripeAccountLink> {
    try {
      if (!isValidStripeAccountId(params.account)) {
        throw createStripeConnectError(
          'Invalid Stripe account ID',
          'INVALID_ACCOUNT_ID',
          400
        );
      }

      const accountLink = await stripe.accountLinks.create({
        account: params.account,
        refresh_url: params.refresh_url,
        return_url: params.return_url,
        type: params.type,
      });

      return accountLink as StripeAccountLink;
    } catch (error: any) {
      logger.error('Error creating account link', error as Error, {
        operation: 'stripe_connect',
        account: params.account
      });

      throw createStripeConnectError(
        getStripeErrorMessage(error),
        'ACCOUNT_LINK_CREATION_FAILED',
        500,
        error.code
      );
    }
  }

  /**
   * Start the onboarding flow for a partner
   */
  static async startOnboardingFlow(
    params: OnboardingFlowParams
  ): Promise<OnboardingFlowResponse> {
    try {
      const partner = await prisma.partner.findUnique({
        where: { id: params.partnerId },
        select: {
          stripeAccountId: true,
          stripeAccountType: true,
          emailAddress: true,
          businessName: true,
        },
      });

      if (!partner) {
        throw createStripeConnectError(
          'Partner not found',
          'PARTNER_NOT_FOUND',
          404
        );
      }

      let accountId = partner.stripeAccountId;

      // Create account if it doesn't exist
      if (!accountId) {
        const account = await this.createConnectAccount(
          params.partnerId,
          params.accountType,
          partner.emailAddress,
          partner.businessName
        );
        accountId = account.id;
      }

      // Create account link for onboarding
      const accountLink = await this.createAccountLink({
        account: accountId,
        refresh_url: params.refreshUrl,
        return_url: params.returnUrl,
        type: 'account_onboarding',
      });

      return {
        accountId,
        onboardingUrl: accountLink.url,
        expiresAt: accountLink.expires_at,
      };
    } catch (error: any) {
      logger.error('Error starting onboarding flow', error as Error, {
        operation: 'stripe_connect',
        partnerId: params.partnerId
      });

      if (error.type === 'StripeConnectError') {
        throw error;
      }

      throw createStripeConnectError(
        'Failed to start onboarding flow',
        'ONBOARDING_FLOW_FAILED',
        500
      );
    }
  }

  /**
   * Refresh onboarding link for a partner
   */
  static async refreshOnboardingLink(
    params: RefreshOnboardingParams
  ): Promise<OnboardingFlowResponse> {
    try {
      if (!isValidStripeAccountId(params.accountId)) {
        throw createStripeConnectError(
          'Invalid Stripe account ID',
          'INVALID_ACCOUNT_ID',
          400
        );
      }

      // Verify the account belongs to the partner
      const partner = await prisma.partner.findUnique({
        where: {
          id: params.partnerId,
          stripeAccountId: params.accountId,
        },
      });

      if (!partner) {
        throw createStripeConnectError(
          'Partner or account not found',
          'PARTNER_ACCOUNT_MISMATCH',
          404
        );
      }

      // Create new account link
      const accountLink = await this.createAccountLink({
        account: params.accountId,
        refresh_url: params.refreshUrl,
        return_url: params.returnUrl,
        type: 'account_onboarding',
      });

      return {
        accountId: params.accountId,
        onboardingUrl: accountLink.url,
        expiresAt: accountLink.expires_at,
      };
    } catch (error: any) {
      logger.error('Error refreshing onboarding link', error as Error, {
        operation: 'stripe_connect',
        partnerId: params.partnerId
      });

      if (error.type === 'StripeConnectError') {
        throw error;
      }

      throw createStripeConnectError(
        'Failed to refresh onboarding link',
        'REFRESH_LINK_FAILED',
        500
      );
    }
  }

  /**
   * Get Stripe account information
   */
  static async getAccount(accountId: string): Promise<StripeConnectAccount> {
    try {
      if (!isValidStripeAccountId(accountId)) {
        throw createStripeConnectError(
          'Invalid Stripe account ID',
          'INVALID_ACCOUNT_ID',
          400
        );
      }

      const account = await stripe.accounts.retrieve(accountId);
      return account as StripeConnectAccount;
    } catch (error: any) {
      logger.error('Error retrieving Stripe account', error as Error, {
        operation: 'stripe_connect',
        accountId
      });

      throw createStripeConnectError(
        getStripeErrorMessage(error),
        'ACCOUNT_RETRIEVAL_FAILED',
        500,
        error.code
      );
    }
  }

  /**
   * Get partner's Stripe status
   */
  static async getPartnerStripeStatus(partnerId: string): Promise<PartnerStripeStatus> {
    try {
      const partner = await prisma.partner.findUnique({
        where: { id: partnerId },
        select: {
          stripeAccountId: true,
          stripeAccountType: true,
          stripeOnboardingCompleted: true,
          stripeChargesEnabled: true,
          stripePayoutsEnabled: true,
          stripeDetailsSubmitted: true,
          applicationFeePercent: true,
          stripeCapabilities: true,
          stripeRequirements: true,
        },
      });

      if (!partner) {
        throw createStripeConnectError(
          'Partner not found',
          'PARTNER_NOT_FOUND',
          404
        );
      }

      const hasStripeAccount = !!partner.stripeAccountId;
      let needsOnboarding = true;

      if (hasStripeAccount) {
        // Get fresh account data from Stripe
        const account = await this.getAccount(partner.stripeAccountId!);

        // Update local database with fresh data
        await prisma.partner.update({
          where: { id: partnerId },
          data: {
            stripeChargesEnabled: account.charges_enabled,
            stripePayoutsEnabled: account.payouts_enabled,
            stripeDetailsSubmitted: account.details_submitted,
            stripeCapabilities: account.capabilities as any,
            stripeRequirements: account.requirements as any,
            stripeOnboardingCompleted: account.details_submitted && account.charges_enabled,
          },
        });

        needsOnboarding = !account.details_submitted || !account.charges_enabled;
      }

      const capabilities = partner.stripeCapabilities as Record<string, string> || {};
      const requirements = partner.stripeRequirements as any || {
        currently_due: [],
        eventually_due: [],
        past_due: [],
        pending_verification: [],
      };

      return {
        hasStripeAccount,
        accountId: partner.stripeAccountId || undefined,
        accountType: partner.stripeAccountType as 'express' | 'standard' || undefined,
        onboardingCompleted: partner.stripeOnboardingCompleted,
        chargesEnabled: partner.stripeChargesEnabled,
        payoutsEnabled: partner.stripePayoutsEnabled,
        detailsSubmitted: partner.stripeDetailsSubmitted,
        applicationFeePercent: Number(partner.applicationFeePercent),
        capabilities,
        requirements: {
          currentlyDue: requirements.currently_due || [],
          eventuallyDue: requirements.eventually_due || [],
          pastDue: requirements.past_due || [],
          pendingVerification: requirements.pending_verification || [],
        },
        needsOnboarding,
      };
    } catch (error: any) {
      logger.error('Error getting partner Stripe status', error as Error, {
        operation: 'stripe_connect',
        partnerId
      });

      if (error.type === 'StripeConnectError') {
        throw error;
      }

      throw createStripeConnectError(
        'Failed to get Stripe status',
        'STATUS_RETRIEVAL_FAILED',
        500
      );
    }
  }

  /**
   * Disconnect a partner's Stripe account
   */
  static async disconnectAccount(params: DisconnectAccountParams): Promise<void> {
    try {
      // Verify the account belongs to the partner
      const partner = await prisma.partner.findUnique({
        where: {
          id: params.partnerId,
          stripeAccountId: params.accountId,
        },
      });

      if (!partner) {
        throw createStripeConnectError(
          'Partner or account not found',
          'PARTNER_ACCOUNT_MISMATCH',
          404
        );
      }

      // Note: We don't delete the Stripe account as it may have payment history
      // Instead, we just remove the connection from our database
      await prisma.partner.update({
        where: { id: params.partnerId },
        data: {
          stripeAccountId: null,
          stripeAccountType: null,
          stripeOnboardingCompleted: false,
          stripeChargesEnabled: false,
          stripePayoutsEnabled: false,
          stripeDetailsSubmitted: false,
          stripeCapabilities: {},
          stripeRequirements: {},
        },
      });
    } catch (error: any) {
      logger.error('Error disconnecting Stripe account', error as Error, {
        operation: 'stripe_connect',
        partnerId: params.partnerId
      });

      if (error.type === 'StripeConnectError') {
        throw error;
      }

      throw createStripeConnectError(
        'Failed to disconnect account',
        'DISCONNECT_FAILED',
        500
      );
    }
  }

  /**
   * Update partner's Stripe account information from webhook
   */
  static async updateAccountFromWebhook(
    accountId: string,
    accountData: any
  ): Promise<void> {
    try {
      const partner = await prisma.partner.findFirst({
        where: { stripeAccountId: accountId },
      });

      if (!partner) {
        logger.warn('No partner found for Stripe account', {
          operation: 'stripe_connect',
          accountId
        });
        return;
      }

      await prisma.partner.update({
        where: { id: partner.id },
        data: {
          stripeChargesEnabled: accountData.charges_enabled,
          stripePayoutsEnabled: accountData.payouts_enabled,
          stripeDetailsSubmitted: accountData.details_submitted,
          stripeCapabilities: accountData.capabilities || {},
          stripeRequirements: accountData.requirements || {},
          stripeOnboardingCompleted: accountData.details_submitted && accountData.charges_enabled,
        },
      });
    } catch (error: any) {
      logger.error('Error updating account from webhook', error as Error, {
        operation: 'stripe_connect',
        accountId
      });
      throw error;
    }
  }

  /**
   * Create Stripe product and prices for metered billing plan
   */
  static async createMeteredProduct(
    partnerId: string,
    planData: {
      id: string;
      name: string;
      description?: string;
      metricType: string;
      metricName: string;
      pricingTiers: Array<{ upTo: number | null; price: number }>;
      billingCycle: 'daily' | 'weekly' | 'monthly' | 'quarterly';
    }
  ): Promise<{ product: Stripe.Product; prices: Stripe.Price[] }> {
    try {
      // Get partner's Stripe account
      const partner = await prisma.partner.findUnique({
        where: { id: partnerId },
        select: {
          stripeAccountId: true,
          stripeOnboardingCompleted: true,
          stripeChargesEnabled: true,
        },
      });

      if (!partner?.stripeAccountId) {
        throw createStripeConnectError(
          'Partner does not have a Stripe Connect account',
          'NO_STRIPE_ACCOUNT',
          400
        );
      }

      if (!partner.stripeOnboardingCompleted || !partner.stripeChargesEnabled) {
        throw createStripeConnectError(
          'Partner Stripe account is not fully set up',
          'STRIPE_ACCOUNT_INCOMPLETE',
          400
        );
      }

      // Create Stripe product on partner's Connect account
      const product = await stripe.products.create({
        name: planData.name,
        description: planData.description || `Metered billing plan for ${planData.metricType}`,
        metadata: {
          partner_id: partnerId,
          plan_id: planData.id,
          metric_type: planData.metricType,
          metric_name: planData.metricName,
          platform: 'knotie-ai-pro',
        },
      }, {
        stripeAccount: partner.stripeAccountId!,
      });

      // Create prices for each pricing tier
      const prices = await Promise.all(
        planData.pricingTiers.map(async (tier, index) => {
          return await stripe.prices.create({
            product: product.id,
            unit_amount: tier.price, // Price in cents
            currency: 'usd',
            recurring: {
              interval: planData.billingCycle === 'quarterly' ? 'month' :
                       planData.billingCycle === 'weekly' ? 'week' :
                       planData.billingCycle === 'daily' ? 'day' : 'month',
              interval_count: planData.billingCycle === 'quarterly' ? 3 : 1,
              usage_type: 'metered',
              aggregate_usage: 'sum',
            },
            metadata: {
              tier_index: index.toString(),
              tier_up_to: tier.upTo?.toString() || 'unlimited',
              plan_id: planData.id,
              partner_id: partnerId,
            },
          }, {
            stripeAccount: partner.stripeAccountId!,
          });
        })
      );

      return { product, prices };
    } catch (error: any) {
      logger.error('Error creating Stripe metered product', error as Error, {
        operation: 'stripe_connect',
        partnerId,
        planName: planData.name
      });

      if (error.type === 'StripeConnectError') {
        throw error;
      }

      throw createStripeConnectError(
        getStripeErrorMessage(error),
        'PRODUCT_CREATION_FAILED',
        500,
        error.code
      );
    }
  }

  /**
   * Create Stripe subscription for metered billing
   */
  static async createMeteredSubscription(
    partnerId: string,
    customerId: string,
    planData: {
      id: string;
      stripeProductId: string;
      stripePriceIds: string[];
      applicationFeePercent?: number;
    }
  ): Promise<Stripe.Subscription> {
    try {
      // Get partner's Stripe account
      const partner = await prisma.partner.findUnique({
        where: { id: partnerId },
        select: {
          stripeAccountId: true,
          applicationFeePercent: true,
        },
      });

      if (!partner?.stripeAccountId) {
        throw createStripeConnectError(
          'Partner does not have a Stripe Connect account',
          'NO_STRIPE_ACCOUNT',
          400
        );
      }

      // Get customer's Stripe customer ID
      const customer = await prisma.customer.findUnique({
        where: { id: customerId },
        select: {
          stripeCustomerId: true,
          email: true,
          firstName: true,
          lastName: true,
        },
      });

      if (!customer) {
        throw createStripeConnectError(
          'Customer not found',
          'CUSTOMER_NOT_FOUND',
          404
        );
      }

      let stripeCustomerId = customer.stripeCustomerId;

      // Create Stripe customer if doesn't exist
      if (!stripeCustomerId) {
        const stripeCustomer = await stripe.customers.create({
          email: customer.email,
          name: `${customer.firstName} ${customer.lastName}`.trim(),
          metadata: {
            customer_id: customerId,
            partner_id: partnerId,
            platform: 'knotie-ai-pro',
          },
        }, {
          stripeAccount: partner.stripeAccountId!,
        });

        stripeCustomerId = stripeCustomer.id;

        // Update customer record with Stripe ID
        await prisma.customer.update({
          where: { id: customerId },
          data: { stripeCustomerId },
        });
      }

      // Create subscription with metered pricing
      const subscription = await stripe.subscriptions.create({
        customer: stripeCustomerId,
        items: planData.stripePriceIds.map(priceId => ({
          price: priceId,
          // Note: No quantity for metered billing - Stripe manages this automatically
        })),
        metadata: {
          partner_id: partnerId,
          customer_id: customerId,
          plan_id: planData.id,
          platform: 'knotie-ai-pro',
        },
        application_fee_percent: planData.applicationFeePercent || (partner.applicationFeePercent ? Number(partner.applicationFeePercent) : 0),
        expand: ['latest_invoice'],
      }, {
        stripeAccount: partner.stripeAccountId!,
      });

      return subscription;
    } catch (error: any) {
      logger.error('Error creating Stripe metered subscription', error as Error, {
        operation: 'stripe_connect',
        customerId,
        partnerId
      });

      if (error.type === 'StripeConnectError') {
        throw error;
      }

      throw createStripeConnectError(
        getStripeErrorMessage(error),
        'SUBSCRIPTION_CREATION_FAILED',
        500,
        error.code
      );
    }
  }

  /**
   * Cancel Stripe subscription
   */
  static async cancelSubscription(
    partnerId: string,
    stripeSubscriptionId: string,
    options: {
      immediate?: boolean;
      reason?: string;
    } = {}
  ): Promise<Stripe.Subscription> {
    try {
      // Get partner's Stripe account
      const partner = await prisma.partner.findUnique({
        where: { id: partnerId },
        select: {
          stripeAccountId: true,
        },
      });

      if (!partner?.stripeAccountId) {
        throw createStripeConnectError(
          'Partner does not have a Stripe Connect account',
          'NO_STRIPE_ACCOUNT',
          400
        );
      }

      // Cancel the subscription in Stripe
      const subscription = await stripe.subscriptions.cancel(
        stripeSubscriptionId,
        {
          prorate: !options.immediate,
          invoice_now: options.immediate,
        },
        {
          stripeAccount: partner.stripeAccountId!,
        }
      );

      return subscription;
    } catch (error: any) {
      logger.error('Error cancelling Stripe subscription', error as Error, {
        operation: 'stripe_connect',
        stripeSubscriptionId,
        partnerId
      });

      if (error.type === 'StripeConnectError') {
        throw error;
      }

      throw createStripeConnectError(
        getStripeErrorMessage(error),
        'SUBSCRIPTION_CANCELLATION_FAILED',
        500,
        error.code
      );
    }
  }

  /**
   * Pause Stripe subscription
   */
  static async pauseSubscription(
    partnerId: string,
    stripeSubscriptionId: string,
    options: {
      pauseUntil?: Date; // If not provided, pauses indefinitely
      reason?: string;
    } = {}
  ): Promise<Stripe.Subscription> {
    try {
      // Get partner's Stripe account
      const partner = await prisma.partner.findUnique({
        where: { id: partnerId },
        select: {
          stripeAccountId: true,
        },
      });

      if (!partner?.stripeAccountId) {
        throw createStripeConnectError(
          'Partner does not have a Stripe Connect account',
          'NO_STRIPE_ACCOUNT',
          400
        );
      }

      // Pause the subscription in Stripe
      const pauseCollection = options.pauseUntil
        ? {
            behavior: 'void' as const,
            resumes_at: Math.floor(options.pauseUntil.getTime() / 1000),
          }
        : {
            behavior: 'void' as const,
          };

      const subscription = await stripe.subscriptions.update(
        stripeSubscriptionId,
        {
          pause_collection: pauseCollection,
        },
        {
          stripeAccount: partner.stripeAccountId!,
        }
      );

      return subscription;
    } catch (error: any) {
      logger.error('Error pausing Stripe subscription', error as Error, {
        operation: 'stripe_connect',
        stripeSubscriptionId,
        partnerId
      });

      if (error.type === 'StripeConnectError') {
        throw error;
      }

      throw createStripeConnectError(
        getStripeErrorMessage(error),
        'SUBSCRIPTION_PAUSE_FAILED',
        500,
        error.code
      );
    }
  }

  /**
   * Resume Stripe subscription
   */
  static async resumeSubscription(
    partnerId: string,
    stripeSubscriptionId: string
  ): Promise<Stripe.Subscription> {
    try {
      // Get partner's Stripe account
      const partner = await prisma.partner.findUnique({
        where: { id: partnerId },
        select: {
          stripeAccountId: true,
        },
      });

      if (!partner?.stripeAccountId) {
        throw createStripeConnectError(
          'Partner does not have a Stripe Connect account',
          'NO_STRIPE_ACCOUNT',
          400
        );
      }

      // Resume the subscription in Stripe
      const subscription = await stripe.subscriptions.update(
        stripeSubscriptionId,
        {
          pause_collection: null, // Remove pause
        },
        {
          stripeAccount: partner.stripeAccountId!,
        }
      );

      return subscription;
    } catch (error: any) {
      logger.error('Error resuming Stripe subscription', error as Error, {
        operation: 'stripe_connect',
        stripeSubscriptionId,
        partnerId
      });

      if (error.type === 'StripeConnectError') {
        throw error;
      }

      throw createStripeConnectError(
        getStripeErrorMessage(error),
        'SUBSCRIPTION_RESUME_FAILED',
        500,
        error.code
      );
    }
  }
}
