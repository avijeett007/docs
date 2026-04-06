import { prisma } from '@/lib/prisma';
import { Decimal } from '@prisma/client/runtime/library';
import { StripeConnectService } from '@/lib/stripe/connect';
import { UsageTrackingService } from './usageTracking';
import { InvoiceService } from '@/lib/stripe/invoices';
import { AuditTrailService } from './auditTrail';
import { DuplicatePreventionService } from './duplicatePreventionService';
import { billingLogger, measurePerformance, handleBillingError } from '@/lib/logger';

export interface PricingTier {
  upTo: number | null; // null means unlimited
  price: number; // price per unit in cents
}

export interface MeteredBillingPlanData {
  partnerId: string;
  name: string;
  description?: string;
  metricType: string;
  metricName: string;
  pricingModel: 'flat' | 'tiered' | 'volume';
  pricingTiers: PricingTier[];
  billingCycle: 'daily' | 'weekly' | 'monthly' | 'quarterly';
  billingDay?: number;
  minimumCharge?: number;
  maximumCharge?: number | null;
  includedUnits?: number;
  prorationEnabled?: boolean;
  usageAggregation?: 'sum' | 'max' | 'avg' | 'count';
  metadata?: Record<string, any>;
}

export interface MeteredBillingCalculation {
  totalUsage: number;
  includedUsage: number;
  billableUsage: number;
  totalCost: number;
  minimumCharge: number;
  finalAmount: number;
  tierBreakdown: Array<{
    tier: number;
    upTo: number | null;
    usage: number;
    rate: number;
    cost: number;
  }>;
}

export class MeteredBillingService {
  /**
   * Create a metered billing plan with Stripe integration
   */
  static async createPlan(data: MeteredBillingPlanData, userId?: string, ipAddress?: string, userAgent?: string) {
    try {
      // Check for duplicate plan creation
      const isDuplicate = await DuplicatePreventionService.isDuplicateBillingOperation(
        'plan_created',
        `${data.partnerId}-${data.name}`,
        data.partnerId,
        5 // 5 minute window
      );

      if (isDuplicate) {
        throw new Error('Duplicate plan creation detected');
      }

      // First create the plan in the database
      const plan = await prisma.meteredBillingPlan.create({
        data: {
          partnerId: data.partnerId,
          name: data.name,
          description: data.description,
          isActive: true, // Explicitly set to active
          metricType: data.metricType,
          metricName: data.metricName,
          pricingModel: data.pricingModel,
          pricingTiers: data.pricingTiers as any, // JSON field
          billingCycle: data.billingCycle,
          billingDay: data.billingDay,
          minimumCharge: data.minimumCharge ? new Decimal(data.minimumCharge) : new Decimal(0),
          maximumCharge: data.maximumCharge ? new Decimal(data.maximumCharge) : null,
          includedUnits: data.includedUnits ? new Decimal(data.includedUnits) : new Decimal(0),
          prorationEnabled: data.prorationEnabled ?? true,
          usageAggregation: data.usageAggregation || 'sum',
          metadata: data.metadata || {},
        },
      });

      // Check if partner has Stripe Connect account set up
      const partner = await prisma.partner.findUnique({
        where: { id: data.partnerId },
        select: {
          stripeAccountId: true,
          stripeOnboardingCompleted: true,
          stripeChargesEnabled: true,
        },
      });

      // If partner has Stripe set up, create Stripe product and prices
      if (partner?.stripeAccountId && partner.stripeOnboardingCompleted && partner.stripeChargesEnabled) {
        try {
          const { product, prices } = await StripeConnectService.createMeteredProduct(
            data.partnerId,
            {
              id: plan.id,
              name: data.name,
              description: data.description,
              metricType: data.metricType,
              metricName: data.metricName,
              pricingTiers: data.pricingTiers,
              billingCycle: data.billingCycle,
            }
          );

          // Update plan with Stripe IDs
          const updatedPlan = await prisma.meteredBillingPlan.update({
            where: { id: plan.id },
            data: {
              stripeProductId: product.id,
              stripePriceIds: prices.map(p => p.id),
            },
          });

          return updatedPlan;
        } catch (stripeError) {
          billingLogger.billingError('create_stripe_product', stripeError as Error, {
            planId: plan.id,
            partnerId: data.partnerId,
            operation: 'create_plan'
          });
          // Plan is created but without Stripe integration
          // This allows the plan to work without Stripe for now
        }
      }

      // Log plan creation for audit trail
      await AuditTrailService.logPlanCreated(
        plan.id,
        data.partnerId,
        userId || 'system',
        data,
        ipAddress,
        userAgent
      );

      billingLogger.billingOperation('plan_created', {
        planId: plan.id,
        partnerId: data.partnerId,
        metricType: data.metricType,
        metricName: data.metricName
      });

      return plan;
    } catch (error) {
      handleBillingError('create_plan', error as Error, {
        partnerId: data.partnerId,
        metricType: data.metricType,
        metricName: data.metricName
      });
    }
  }

  /**
   * Update a metered billing plan
   */
  static async updatePlan(planId: string, data: Partial<MeteredBillingPlanData>) {
    try {
      // Check if plan has Stripe integration
      const existingPlan = await prisma.meteredBillingPlan.findUnique({
        where: { id: planId },
        select: { stripeProductId: true },
      });

      if (existingPlan?.stripeProductId) {
        throw new Error('Cannot update plan with Stripe integration. Stripe products and prices are immutable.');
      }

      const updateData: any = {};

      // Only include fields that are provided
      if (data.name !== undefined) updateData.name = data.name;
      if (data.description !== undefined) updateData.description = data.description;
      if (data.metricType !== undefined) updateData.metricType = data.metricType;
      if (data.metricName !== undefined) updateData.metricName = data.metricName;
      if (data.pricingModel !== undefined) updateData.pricingModel = data.pricingModel;
      if (data.pricingTiers !== undefined) updateData.pricingTiers = data.pricingTiers;
      if (data.billingCycle !== undefined) updateData.billingCycle = data.billingCycle;
      if (data.billingDay !== undefined) updateData.billingDay = data.billingDay;
      if (data.minimumCharge !== undefined) {
        updateData.minimumCharge = data.minimumCharge ? new Decimal(data.minimumCharge) : new Decimal(0);
      }
      if (data.maximumCharge !== undefined) {
        updateData.maximumCharge = data.maximumCharge ? new Decimal(data.maximumCharge) : null;
      }
      if (data.includedUnits !== undefined) {
        updateData.includedUnits = data.includedUnits ? new Decimal(data.includedUnits) : new Decimal(0);
      }
      if (data.prorationEnabled !== undefined) updateData.prorationEnabled = data.prorationEnabled;
      if (data.usageAggregation !== undefined) updateData.usageAggregation = data.usageAggregation;
      if (data.metadata !== undefined) updateData.metadata = data.metadata;

      const plan = await prisma.meteredBillingPlan.update({
        where: { id: planId },
        data: updateData,
      });

      return plan;
    } catch (error) {
      billingLogger.error('Error updating metered billing plan', error as Error, {
        operation: 'metered_billing',
        planId
      });
      throw new Error('Failed to update metered billing plan');
    }
  }

  /**
   * Subscribe customer to metered billing plan with Stripe integration
   */
  static async subscribeCustomer(
    customerId: string,
    partnerId: string,
    planId: string,
    startDate?: Date
  ) {
    // Input validation
    if (!customerId || typeof customerId !== 'string') {
      throw new Error('Valid customer ID is required');
    }
    if (!partnerId || typeof partnerId !== 'string') {
      throw new Error('Valid partner ID is required');
    }
    if (!planId || typeof planId !== 'string') {
      throw new Error('Valid plan ID is required');
    }

    // First, validate inputs and get plan data outside transaction
    const plan = await prisma.meteredBillingPlan.findUnique({
      where: { id: planId },
      include: {
        partner: {
          select: {
            stripeAccountId: true,
            stripeOnboardingCompleted: true,
            stripeChargesEnabled: true,
            applicationFeePercent: true,
          },
        },
      },
    });

    if (!plan) {
      throw new Error('Plan not found');
    }

    if (plan.partnerId !== partnerId) {
      throw new Error('Plan does not belong to the specified partner');
    }

    if (!plan.isActive) {
      throw new Error('Plan is not active');
    }

    // Verify customer exists and belongs to partner
    const customer = await prisma.customer.findFirst({
      where: {
        id: customerId,
        credentials: {
          some: {
            partnerId,
          },
        },
      },
    });

    if (!customer) {
      throw new Error('Customer not found or does not belong to partner');
    }

    // Check for existing subscription
    const existingSubscription = await prisma.customerMeteredSubscription.findFirst({
      where: {
        customerId,
        partnerId,
        planId,
        status: 'active',
      },
    });

    if (existingSubscription) {
      throw new Error('Customer already has an active subscription to this plan');
    }

    const currentDate = startDate || new Date();
    const billingPeriod = UsageTrackingService.getBillingPeriod(currentDate, plan.billingCycle as 'daily' | 'weekly' | 'monthly' | 'quarterly');

    // Create Stripe subscription first (if applicable)
    let stripeSubscriptionId: string | null = null;
    let stripeCustomerId: string | null = null;

    if (
      plan.stripeProductId &&
      plan.stripePriceIds &&
      Array.isArray(plan.stripePriceIds) &&
      plan.stripePriceIds.length > 0 &&
      plan.partner.stripeAccountId &&
      plan.partner.stripeOnboardingCompleted &&
      plan.partner.stripeChargesEnabled
    ) {
      try {
        const stripeSubscription = await StripeConnectService.createMeteredSubscription(
          partnerId,
          customerId,
          {
            id: planId,
            stripeProductId: plan.stripeProductId,
            stripePriceIds: plan.stripePriceIds as string[],
            applicationFeePercent: plan.partner.applicationFeePercent ? Number(plan.partner.applicationFeePercent) : undefined,
          }
        );

        stripeSubscriptionId = stripeSubscription.id;
        stripeCustomerId = stripeSubscription.customer as string;
      } catch (stripeError: any) {
        billingLogger.error('Error creating Stripe subscription', stripeError as Error, {
          operation: 'metered_billing',
          customerId,
          partnerId,
          planId
        });
        throw new Error(`Failed to create Stripe subscription: ${stripeError.message || stripeError}`);
      }
    }

    // Now create database subscription in a quick transaction
    return await prisma.$transaction(async (tx) => {
      try {
        const subscription = await tx.customerMeteredSubscription.create({
          data: {
            customerId,
            partnerId,
            planId,
            status: 'active',
            currentPeriodStart: billingPeriod.start,
            currentPeriodEnd: billingPeriod.end,
            nextBillingDate: billingPeriod.end,
            usageTrackingEnabled: true,
            currentUsage: {},
            usageLimits: {},
            overageCharges: new Decimal(0),
            stripeSubscriptionId,
            stripeCustomerId,
          },
        });

        billingLogger.billingOperation('subscription_created', {
          subscriptionId: subscription.id,
          customerId,
          partnerId,
          planId
        });

        return subscription;
      } catch (error) {
        handleBillingError('create_subscription', error as Error, {
          customerId,
          partnerId,
          planId
        });
      }
    });
  }

  /**
   * Calculate proration for mid-cycle changes
   */
  static calculateProration(
    oldAmount: number,
    newAmount: number,
    billingPeriodStart: Date,
    billingPeriodEnd: Date,
    changeDate: Date
  ): { proratedCredit: number; proratedCharge: number; remainingDays: number; totalDays: number } {
    const totalDays = Math.ceil((billingPeriodEnd.getTime() - billingPeriodStart.getTime()) / (1000 * 60 * 60 * 24));
    const remainingDays = Math.ceil((billingPeriodEnd.getTime() - changeDate.getTime()) / (1000 * 60 * 60 * 24));

    if (remainingDays <= 0) {
      return { proratedCredit: 0, proratedCharge: 0, remainingDays: 0, totalDays };
    }

    const prorationFactor = remainingDays / totalDays;

    // Calculate credit for unused portion of old plan
    const proratedCredit = oldAmount * prorationFactor;

    // Calculate charge for remaining portion of new plan
    const proratedCharge = newAmount * prorationFactor;

    return {
      proratedCredit: Math.round(proratedCredit * 100) / 100, // Round to 2 decimal places
      proratedCharge: Math.round(proratedCharge * 100) / 100,
      remainingDays,
      totalDays,
    };
  }

  /**
   * Calculate metered billing charges
   */
  static calculateMeteredCharges(
    usage: number,
    plan: {
      pricingModel: string;
      pricingTiers: any;
      includedUnits: Decimal;
      minimumCharge: Decimal;
      maximumCharge?: Decimal | null;
    }
  ): MeteredBillingCalculation {
    // Input validation
    if (typeof usage !== 'number' || isNaN(usage) || usage < 0) {
      throw new Error('Usage must be a non-negative number');
    }

    if (!plan) {
      throw new Error('Plan is required for billing calculation');
    }

    if (!plan.pricingModel || typeof plan.pricingModel !== 'string') {
      throw new Error('Plan must have a valid pricing model');
    }

    if (!Array.isArray(plan.pricingTiers) || plan.pricingTiers.length === 0) {
      throw new Error('Plan must have at least one pricing tier');
    }

    // Validate pricing tiers
    for (const tier of plan.pricingTiers) {
      if (typeof tier.price !== 'number' || isNaN(tier.price) || tier.price < 0) {
        throw new Error('All pricing tier prices must be non-negative numbers');
      }
      if (tier.upTo !== null && (typeof tier.upTo !== 'number' || isNaN(tier.upTo) || tier.upTo <= 0)) {
        throw new Error('Pricing tier limits must be positive numbers or null');
      }
    }

    const totalUsage = usage;
    const includedUsage = plan.includedUnits ? Number(plan.includedUnits) : 0;
    const billableUsage = Math.max(0, totalUsage - includedUsage);
    const minimumCharge = plan.minimumCharge ? Number(plan.minimumCharge) / 100 : 0; // Convert cents to dollars
    
    let totalCost = 0;
    const tierBreakdown: MeteredBillingCalculation['tierBreakdown'] = [];
    
    if (billableUsage > 0) {
      const tiers = Array.isArray(plan.pricingTiers) ? plan.pricingTiers : [];
      
      if (plan.pricingModel === 'flat') {
        // Flat rate pricing
        const rate = tiers[0]?.price || 0;
        totalCost = billableUsage * (rate / 100); // Convert cents to dollars
        tierBreakdown.push({
          tier: 1,
          upTo: null,
          usage: billableUsage,
          rate: rate / 100,
          cost: totalCost,
        });
      } else if (plan.pricingModel === 'tiered') {
        // Tiered pricing
        let remainingUsage = billableUsage;
        let previousLimit = 0;

        for (let i = 0; i < tiers.length && remainingUsage > 0; i++) {
          const tier = tiers[i];

          // Validate tier structure
          if (!tier || typeof tier.price !== 'number') {
            throw new Error(`Invalid tier structure at index ${i}`);
          }

          const tierLimit = tier.upTo || Infinity;

          // Prevent infinite loops and invalid calculations
          if (tierLimit <= previousLimit && tier.upTo !== null) {
            throw new Error(`Invalid tier configuration: tier ${i + 1} limit (${tierLimit}) must be greater than previous limit (${previousLimit})`);
          }

          const tierUsage = Math.min(remainingUsage, tierLimit - previousLimit);

          // Prevent negative usage calculations
          if (tierUsage < 0) {
            throw new Error(`Invalid tier usage calculation: ${tierUsage} for tier ${i + 1}`);
          }

          const tierCost = tierUsage * (tier.price / 100);

          // Validate cost calculation
          if (isNaN(tierCost) || !isFinite(tierCost)) {
            throw new Error(`Invalid cost calculation for tier ${i + 1}: ${tierCost}`);
          }

          totalCost += tierCost;
          tierBreakdown.push({
            tier: i + 1,
            upTo: tier.upTo,
            usage: tierUsage,
            rate: tier.price / 100,
            cost: tierCost,
          });

          remainingUsage -= tierUsage;
          previousLimit = tierLimit;
        }
      } else if (plan.pricingModel === 'volume') {
        // Volume pricing - find the tier that applies to total usage
        const applicableTier = tiers.find((tier: any) => 
          !tier.upTo || billableUsage <= tier.upTo
        ) || tiers[tiers.length - 1];
        
        if (applicableTier) {
          totalCost = billableUsage * (applicableTier.price / 100);
          tierBreakdown.push({
            tier: tiers.indexOf(applicableTier) + 1,
            upTo: applicableTier.upTo,
            usage: billableUsage,
            rate: applicableTier.price / 100,
            cost: totalCost,
          });
        }
      }
    }
    
    // Validate total cost calculation
    if (isNaN(totalCost) || !isFinite(totalCost) || totalCost < 0) {
      throw new Error(`Invalid total cost calculation: ${totalCost}`);
    }

    // Apply minimum charge
    const finalAmount = Math.max(totalCost, minimumCharge);

    // Apply maximum charge if set
    const maxCharge = plan.maximumCharge ? Number(plan.maximumCharge) / 100 : null; // Convert cents to dollars
    let cappedAmount = finalAmount;

    if (maxCharge !== null) {
      if (isNaN(maxCharge) || !isFinite(maxCharge) || maxCharge < 0) {
        throw new Error(`Invalid maximum charge: ${maxCharge}`);
      }
      cappedAmount = Math.min(finalAmount, maxCharge);
    }

    // Final validation of the result
    if (isNaN(cappedAmount) || !isFinite(cappedAmount) || cappedAmount < 0) {
      throw new Error(`Invalid final amount calculation: ${cappedAmount}`);
    }

    return {
      totalUsage,
      includedUsage,
      billableUsage,
      totalCost,
      minimumCharge,
      finalAmount: cappedAmount,
      tierBreakdown,
    };
  }

  /**
   * Process metered billing for a customer subscription
   */
  static async processMeteredBilling(subscriptionId: string) {
    try {
      const subscription = await prisma.customerMeteredSubscription.findUnique({
        where: { id: subscriptionId },
        include: {
          plan: true,
          customer: true,
          partner: true,
        },
      });

      if (!subscription) {
        throw new Error('Subscription not found');
      }

      if (subscription.status !== 'active') {
        billingLogger.info('Skipping inactive subscription', {
          operation: 'metered_billing',
          subscriptionId
        });
        return null;
      }

      // Get usage for the billing period
      const usageAggregations = await UsageTrackingService.getUnbilledUsage(
        subscription.customerId,
        subscription.partnerId,
        subscription.plan.metricType
      );

      const relevantUsage = usageAggregations.find(
        usage => 
          usage.metricName === subscription.plan.metricName &&
          usage.billingPeriodStart.getTime() === subscription.currentPeriodStart.getTime() &&
          usage.billingPeriodEnd.getTime() === subscription.currentPeriodEnd.getTime()
      );

      const totalUsage = relevantUsage?.totalQuantity || 0;

      // Calculate charges
      const calculation = this.calculateMeteredCharges(totalUsage, subscription.plan);

      if (calculation.finalAmount > 0) {
        // Create invoice for metered charges
        const invoice = await InvoiceService.createInvoice({
          partnerId: subscription.partnerId,
          customerId: subscription.customerId,
          title: `${subscription.plan.name} - Usage Billing`,
          description: `Usage charges for ${subscription.plan.metricName}: ${totalUsage} units`,
          amount: Math.round(calculation.finalAmount * 100), // Convert to cents
          type: 'one_time',
          // usagePeriodStart: subscription.currentPeriodStart,
          // usagePeriodEnd: subscription.currentPeriodEnd,
          metadata: {
            subscriptionId: subscription.id,
            billingType: 'metered',
            planId: subscription.planId,
            planName: subscription.plan.name,
            metricType: subscription.plan.metricType,
            metricName: subscription.plan.metricName,
            totalUsage: calculation.totalUsage,
            includedUsage: calculation.includedUsage,
            billableUsage: calculation.billableUsage,
            totalCost: calculation.totalCost,
            finalAmount: calculation.finalAmount,
            tierBreakdown: JSON.stringify(calculation.tierBreakdown),
            usageCalculation: JSON.stringify(calculation),
          },
        });

        // Mark usage as billed
        if (relevantUsage) {
          await UsageTrackingService.markUsageAsBilled(
            subscription.customerId,
            subscription.partnerId,
            subscription.currentPeriodStart,
            subscription.currentPeriodEnd,
            invoice.id,
            subscription.plan.metricType
          );
        }

        // Update subscription for next billing period
        const nextBillingPeriod = UsageTrackingService.getBillingPeriod(
          new Date(subscription.currentPeriodEnd.getTime() + 1),
          subscription.plan.billingCycle as 'daily' | 'weekly' | 'monthly' | 'quarterly'
        );

        await prisma.customerMeteredSubscription.update({
          where: { id: subscriptionId },
          data: {
            currentPeriodStart: nextBillingPeriod.start,
            currentPeriodEnd: nextBillingPeriod.end,
            nextBillingDate: nextBillingPeriod.end,
            currentUsage: {},
            overageCharges: new Decimal(0),
          },
        });

        billingLogger.billingOperation('metered_billing_processed', {
          subscriptionId,
          invoiceId: invoice.id,
          totalUsage,
          finalAmount: calculation.finalAmount,
          customerId: subscription.customerId,
          partnerId: subscription.partnerId
        });

        return {
          invoice,
          calculation,
          totalUsage,
        };
      } else {
        billingLogger.billingOperation('metered_billing_no_charges', {
          subscriptionId,
          totalUsage,
          minimumCharge: calculation.minimumCharge,
          customerId: subscription.customerId,
          partnerId: subscription.partnerId
        });

        // Still update the billing period even if no charges
        const nextBillingPeriod = UsageTrackingService.getBillingPeriod(
          new Date(subscription.currentPeriodEnd.getTime() + 1),
          subscription.plan.billingCycle as 'daily' | 'weekly' | 'monthly' | 'quarterly'
        );

        await prisma.customerMeteredSubscription.update({
          where: { id: subscriptionId },
          data: {
            currentPeriodStart: nextBillingPeriod.start,
            currentPeriodEnd: nextBillingPeriod.end,
            nextBillingDate: nextBillingPeriod.end,
            currentUsage: {},
          },
        });

        return null;
      }
    } catch (error) {
      handleBillingError('process_metered_billing', error as Error, {
        subscriptionId
      });
    }
  }

  /**
   * Get customer's metered billing plans
   */
  static async getCustomerPlans(customerId: string, partnerId: string) {
    try {
      const subscriptions = await prisma.customerMeteredSubscription.findMany({
        where: {
          customerId,
          partnerId,
          status: 'active',
        },
        include: {
          plan: true,
        },
        orderBy: {
          createdAt: 'desc',
        },
      });

      return subscriptions;
    } catch (error) {
      billingLogger.error('Error getting customer metered plans', error as Error, {
        operation: 'metered_billing',
        customerId,
        partnerId
      });
      throw new Error('Failed to get customer metered plans');
    }
  }

  /**
   * Get partner's metered billing plans
   */
  static async getPartnerPlans(partnerId: string) {
    try {
      const plans = await prisma.meteredBillingPlan.findMany({
        where: {
          partnerId,
          isActive: true,
        },
        include: {
          subscriptions: {
            where: {
              status: 'active',
            },
            select: {
              id: true,
              customerId: true,
              status: true,
              currentUsage: true,
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
      });

      return plans;
    } catch (error) {
      billingLogger.error('Error getting partner metered plans', error as Error, {
        operation: 'metered_billing',
        partnerId
      });
      throw new Error('Failed to get partner metered plans');
    }
  }

  /**
   * Handle mid-cycle plan changes with proration
   */
  static async changePlan(
    subscriptionId: string,
    newPlanId: string,
    changeDate?: Date,
    userId?: string,
    ipAddress?: string,
    userAgent?: string
  ) {
    return await prisma.$transaction(async (tx) => {
      try {
        const changeDateTime = changeDate || new Date();

        // Get current subscription
        const subscription = await tx.customerMeteredSubscription.findUnique({
          where: { id: subscriptionId },
          include: {
            plan: true,
            customer: true,
            partner: true,
          },
        });

        if (!subscription) {
          throw new Error('Subscription not found');
        }

        if (subscription.status !== 'active') {
          throw new Error('Can only change plans for active subscriptions');
        }

        // Get new plan
        const newPlan = await tx.meteredBillingPlan.findUnique({
          where: { id: newPlanId },
        });

        if (!newPlan || !newPlan.isActive) {
          throw new Error('New plan not found or not active');
        }

        if (newPlan.partnerId !== subscription.partnerId) {
          throw new Error('New plan must belong to the same partner');
        }

        // Calculate current usage for the billing period
        const currentUsage = await UsageTrackingService.getUsageAggregation(
          subscription.customerId,
          subscription.partnerId,
          subscription.currentPeriodStart,
          changeDateTime,
          subscription.plan.metricType
        );

        const totalUsage = currentUsage.reduce((sum: number, usage: any) => sum + Number(usage.totalQuantity), 0);

        // Calculate charges for current plan up to change date
        const oldCharges = this.calculateMeteredCharges(totalUsage, {
          pricingModel: subscription.plan.pricingModel,
          pricingTiers: subscription.plan.pricingTiers,
          includedUnits: subscription.plan.includedUnits,
          minimumCharge: subscription.plan.minimumCharge,
          maximumCharge: subscription.plan.maximumCharge,
        });

        // Calculate what charges would be for new plan
        const newCharges = this.calculateMeteredCharges(totalUsage, {
          pricingModel: newPlan.pricingModel,
          pricingTiers: newPlan.pricingTiers,
          includedUnits: newPlan.includedUnits,
          minimumCharge: newPlan.minimumCharge,
          maximumCharge: newPlan.maximumCharge,
        });

        // Calculate proration if enabled
        let prorationDetails = null;
        if (subscription.plan.prorationEnabled) {
          prorationDetails = this.calculateProration(
            oldCharges.finalAmount,
            newCharges.finalAmount,
            subscription.currentPeriodStart,
            subscription.currentPeriodEnd,
            changeDateTime
          );
        }

        // Update subscription
        const updatedSubscription = await tx.customerMeteredSubscription.update({
          where: { id: subscriptionId },
          data: {
            planId: newPlanId,
            metadata: {
              ...(subscription.metadata as any),
              planChangeHistory: [
                ...(subscription.metadata as any)?.planChangeHistory || [],
                {
                  oldPlanId: subscription.planId,
                  newPlanId,
                  changeDate: changeDateTime.toISOString(),
                  prorationDetails,
                  oldCharges,
                  newCharges,
                },
              ],
            },
          },
        });

        // Log the plan change
        await AuditTrailService.logBillingOperation({
          action: 'subscription_plan_changed',
          entityType: 'subscription',
          entityId: subscriptionId,
          partnerId: subscription.partnerId,
          customerId: subscription.customerId,
          userId,
          details: {
            oldPlanId: subscription.planId,
            newPlanId,
            changeDate: changeDateTime.toISOString(),
            prorationDetails,
            oldCharges,
            newCharges,
          },
          ipAddress,
          userAgent,
        });

        return {
          subscription: updatedSubscription,
          prorationDetails,
          oldCharges,
          newCharges,
        };
      } catch (error) {
        billingLogger.error('Error changing subscription plan', error as Error, {
          operation: 'metered_billing',
          subscriptionId,
          newPlanId
        });
        throw error;
      }
    });
  }

  /**
   * Pause a subscription
   */
  static async pauseSubscription(
    subscriptionId: string,
    options: {
      reason?: string;
      pauseUntil?: Date;
      userId?: string;
      ipAddress?: string;
      userAgent?: string;
    } = {}
  ) {
    try {
      const subscription = await prisma.customerMeteredSubscription.findUnique({
        where: { id: subscriptionId },
        include: { customer: true, partner: true },
      });

      if (!subscription) {
        throw new Error('Subscription not found');
      }

      if (subscription.status !== 'active') {
        throw new Error(`Cannot pause subscription with status: ${subscription.status}. Only active subscriptions can be paused.`);
      }

      // Pause Stripe subscription if it exists
      if (subscription.stripeSubscriptionId && subscription.partner.stripeAccountId) {
        try {
          await StripeConnectService.pauseSubscription(
            subscription.partnerId,
            subscription.stripeSubscriptionId,
            {
              pauseUntil: options.pauseUntil,
              reason: options.reason,
            }
          );
        } catch (stripeError) {
          billingLogger.error('Error pausing Stripe subscription', stripeError as Error, {
            operation: 'metered_billing',
            subscriptionId
          });
          // Continue with local pause even if Stripe fails
        }
      }

      const updatedSubscription = await prisma.customerMeteredSubscription.update({
        where: { id: subscriptionId },
        data: {
          status: 'paused',
          metadata: {
            ...(subscription.metadata as any),
            pausedAt: new Date().toISOString(),
            pauseReason: options.reason,
            pauseUntil: options.pauseUntil?.toISOString(),
          },
        },
      });

      // Log the pause action
      await AuditTrailService.logSubscriptionStatusChanged(
        subscriptionId,
        subscription.partnerId,
        subscription.customerId,
        'active',
        'paused',
        options.reason,
        options.userId,
        options.ipAddress,
        options.userAgent
      );

      return updatedSubscription;
    } catch (error) {
      billingLogger.error('Error pausing subscription', error as Error, {
        operation: 'metered_billing',
        subscriptionId
      });
      throw error;
    }
  }

  /**
   * Resume a paused subscription
   */
  static async resumeSubscription(
    subscriptionId: string,
    userId?: string,
    ipAddress?: string,
    userAgent?: string
  ) {
    try {
      const subscription = await prisma.customerMeteredSubscription.findUnique({
        where: { id: subscriptionId },
        include: { customer: true, partner: true },
      });

      if (!subscription) {
        throw new Error('Subscription not found');
      }

      if (subscription.status !== 'paused') {
        throw new Error(`Cannot resume subscription with status: ${subscription.status}. Only paused subscriptions can be resumed.`);
      }

      // Resume Stripe subscription if it exists
      if (subscription.stripeSubscriptionId && subscription.partner.stripeAccountId) {
        try {
          await StripeConnectService.resumeSubscription(
            subscription.partnerId,
            subscription.stripeSubscriptionId
          );
        } catch (stripeError) {
          billingLogger.error('Error resuming Stripe subscription', stripeError as Error, {
            operation: 'metered_billing',
            subscriptionId
          });
          // Continue with local resume even if Stripe fails
        }
      }

      const updatedSubscription = await prisma.customerMeteredSubscription.update({
        where: { id: subscriptionId },
        data: {
          status: 'active',
          metadata: {
            ...(subscription.metadata as any),
            resumedAt: new Date().toISOString(),
            pausedAt: undefined,
            pauseReason: undefined,
            pauseUntil: undefined,
          },
        },
      });

      // Log the resume action
      await AuditTrailService.logSubscriptionStatusChanged(
        subscriptionId,
        subscription.partnerId,
        subscription.customerId,
        'paused',
        'active',
        'Subscription resumed',
        userId,
        ipAddress,
        userAgent
      );

      return updatedSubscription;
    } catch (error) {
      billingLogger.error('Error resuming subscription', error as Error, {
        operation: 'metered_billing',
        subscriptionId
      });
      throw error;
    }
  }

  /**
   * Cancel a subscription with optional grace period
   */
  static async cancelSubscription(
    subscriptionId: string,
    options: {
      immediate?: boolean;
      gracePeriodDays?: number;
      reason?: string;
      refundUnusedPortion?: boolean;
    } = {},
    userId?: string,
    ipAddress?: string,
    userAgent?: string
  ) {
    return await prisma.$transaction(async (tx) => {
      try {
        const subscription = await tx.customerMeteredSubscription.findUnique({
          where: { id: subscriptionId },
          include: {
            plan: true,
            customer: true,
            partner: true,
          },
        });

        if (!subscription) {
          throw new Error('Subscription not found');
        }

        if (subscription.status === 'cancelled') {
          throw new Error('Subscription is already cancelled');
        }

        const now = new Date();
        const cancellationDate = now;
        let effectiveDate = now;

        // Calculate effective cancellation date
        if (!options.immediate) {
          if (options.gracePeriodDays && options.gracePeriodDays > 0) {
            effectiveDate = new Date(now.getTime() + options.gracePeriodDays * 24 * 60 * 60 * 1000);
          } else {
            // Cancel at end of current billing period
            effectiveDate = subscription.currentPeriodEnd;
          }
        }

        // Calculate refund if applicable
        const refundAmount = 0;
        if (options.refundUnusedPortion && subscription.plan.prorationEnabled) {
          const prorationDetails = this.calculateProration(
            0, // No new amount since we're cancelling
            0,
            subscription.currentPeriodStart,
            subscription.currentPeriodEnd,
            cancellationDate
          );

          // This would need to be calculated based on actual charges
          // For now, we'll store the proration details for manual processing
        }

        const updatedSubscription = await tx.customerMeteredSubscription.update({
          where: { id: subscriptionId },
          data: {
            status: options.immediate ? 'cancelled' : 'active', // Keep active until effective date
            cancelledAt: cancellationDate,
            metadata: {
              ...(subscription.metadata as any),
              cancellationRequested: cancellationDate.toISOString(),
              cancellationEffectiveDate: effectiveDate.toISOString(),
              cancellationReason: options.reason,
              gracePeriodDays: options.gracePeriodDays,
              refundRequested: options.refundUnusedPortion,
              refundAmount,
            },
          },
        });

        // Cancel Stripe subscription if it exists
        if (subscription.stripeSubscriptionId && subscription.partner.stripeAccountId) {
          try {
            await StripeConnectService.cancelSubscription(
              subscription.partnerId,
              subscription.stripeSubscriptionId,
              {
                immediate: options.immediate,
                reason: options.reason,
              }
            );
          } catch (stripeError) {
            billingLogger.error('Error cancelling Stripe subscription', stripeError as Error, {
              operation: 'metered_billing',
              subscriptionId
            });
            // Continue with local cancellation even if Stripe fails
            // This ensures data consistency in our system
          }
        }

        // Log the cancellation
        await AuditTrailService.logSubscriptionStatusChanged(
          subscriptionId,
          subscription.partnerId,
          subscription.customerId,
          subscription.status,
          options.immediate ? 'cancelled' : 'pending_cancellation',
          options.reason,
          userId,
          ipAddress,
          userAgent
        );

        return {
          subscription: updatedSubscription,
          cancellationDate,
          effectiveDate,
          refundAmount,
        };
      } catch (error) {
        billingLogger.error('Error cancelling subscription', error as Error, {
          operation: 'metered_billing',
          subscriptionId
        });
        throw error;
      }
    });
  }

  /**
   * Process pending cancellations (to be called by CRON job)
   */
  static async processPendingCancellations(): Promise<number> {
    try {
      const now = new Date();

      // Find subscriptions that should be cancelled now
      const pendingCancellations = await prisma.customerMeteredSubscription.findMany({
        where: {
          status: 'active',
          cancelledAt: { not: null },
          metadata: {
            path: ['cancellationEffectiveDate'],
            lte: now.toISOString(),
          },
        },
      });

      let processedCount = 0;

      for (const subscription of pendingCancellations) {
        try {
          await prisma.customerMeteredSubscription.update({
            where: { id: subscription.id },
            data: {
              status: 'cancelled',
              metadata: {
                ...(subscription.metadata as any),
                actualCancellationDate: now.toISOString(),
              },
            },
          });

          // Log the actual cancellation
          await AuditTrailService.logSubscriptionStatusChanged(
            subscription.id,
            subscription.partnerId,
            subscription.customerId,
            'active',
            'cancelled',
            'Grace period expired',
            'system'
          );

          processedCount++;
        } catch (error) {
          billingLogger.error('Error processing cancellation for subscription', error as Error, {
            operation: 'metered_billing',
            subscriptionId: subscription.id
          });
        }
      }

      billingLogger.info('Processed pending cancellations', {
        operation: 'metered_billing',
        processedCount
      });
      return processedCount;
    } catch (error) {
      billingLogger.error('Error processing pending cancellations', error as Error, {
        operation: 'metered_billing'
      });
      throw error;
    }
  }
}
