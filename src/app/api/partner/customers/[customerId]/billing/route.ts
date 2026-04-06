import { NextRequest, NextResponse } from 'next/server';
import { verifyJWT } from '@/lib/jwt';
import { prisma } from '@/lib/prisma';
import { cookies } from 'next/headers';
import { UsageIntegrationService } from '@/lib/billing/usageIntegration';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

interface RouteParams {
  params: {
    customerId: string;
  };
}

/**
 * GET /api/partner/customers/[customerId]/billing
 * Get customer's billing information for partner management
 */
export async function GET(
  request: NextRequest,
  { params }: RouteParams
) {
  console.log('GET /api/partner/customers/[customerId]/billing called with customerId:', params.customerId);
  try {
    // Try to get token from cookies first, then from Authorization header as fallback
    let token = cookies().get('partner_token')?.value;

    if (!token) {
      // Fallback to Authorization header
      const authHeader = request.headers.get('Authorization');
      if (authHeader && authHeader.startsWith('Bearer ')) {
        token = authHeader.split(' ')[1];
      }
    }

    if (!token) {
      console.log('No token found in cookies or Authorization header');
      return NextResponse.json({
        success: false,
        error: 'Unauthorized',
        message: 'No partner token found'
      }, { status: 401 });
    }

    console.log('Token found, verifying JWT...');

    // Verify JWT token
    const decodedToken = await verifyJWT(token);
    if (!decodedToken || !decodedToken.email) {
      return NextResponse.json({
        success: false,
        error: 'Invalid token',
        message: 'Your session has expired. Please log in again.'
      }, { status: 401 });
    }

    // Get partner using the JWT token's email
    const partner = await prisma.partner.findFirst({
      where: {
        AND: [
          { emailAddress: decodedToken.email },
          { approvalStatus: 'ACTIVE' }
        ]
      }
    });

    if (!partner) {
      return NextResponse.json({
        success: false,
        error: 'Partner not found or not active',
        message: 'Please ensure your partner account is active.'
      }, { status: 403 });
    }
    const { customerId } = params;
    console.log('Looking for customer with ID:', customerId);

    // Handle both UserOnboarding IDs (uo_*) and Customer IDs
    let customer;
    let actualCustomerId;

    if (customerId.startsWith('uo_')) {
      // This is a UserOnboarding ID, get the actual customer
      console.log('UserOnboarding ID detected, finding linked customer...');
      const userOnboarding = await prisma.userOnboarding.findFirst({
        where: {
          id: customerId,
          partnerId: partner.id,
        },
        include: {
          customer: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
              createdAt: true,
              stripeCustomerId: true,
            },
          },
        },
      });

      if (!userOnboarding || !userOnboarding.customer) {
        console.log('UserOnboarding record not found or no linked customer');
        return NextResponse.json(
          { success: false, error: 'Customer not found' },
          { status: 404 }
        );
      }

      customer = userOnboarding.customer;
      actualCustomerId = customer.id;
      console.log('Found linked customer:', actualCustomerId);
    } else {
      // This is a direct Customer ID
      console.log('Direct customer ID, looking up customer...');
      customer = await prisma.customer.findFirst({
        where: {
          id: customerId,
          credentials: {
            some: {
              partnerId: partner.id,
            },
          },
        },
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          createdAt: true,
          stripeCustomerId: true,
        },
      });
      actualCustomerId = customerId;
    }

    if (!customer) {
      return NextResponse.json(
        { success: false, error: 'Customer not found' },
        { status: 404 }
      );
    }

    // Get customer's subscription plan details
    const customerSubscription = await prisma.customerSubscription.findFirst({
      where: {
        customerId: actualCustomerId,
        partnerId: partner.id,
      },
      include: {
        plan: {
          select: {
            id: true,
            name: true,
            amount: true,
            currency: true,
            interval: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    // Get customer's metered subscriptions
    const meteredSubscriptions = await prisma.customerMeteredSubscription.findMany({
      where: {
        customerId: actualCustomerId,
        partnerId: partner.id,
      },
      include: {
        plan: {
          select: {
            id: true,
            name: true,
            metricType: true,
            metricName: true,
            pricingModel: true,
            pricingTiers: true,
            includedUnits: true,
            minimumCharge: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    // Get current usage projections for active subscriptions
    const subscriptionsWithProjections = await Promise.all(
      meteredSubscriptions.map(async (subscription) => {
        let projectedCost = 0;
        
        if (subscription.status === 'active') {
          try {
            const currentUsage = await UsageIntegrationService.getCurrentUsageForCustomer(
              actualCustomerId,
              partner.id
            );
            
            const relevantUsage = currentUsage.find(
              usage => usage.subscriptionId === subscription.id
            );
            
            projectedCost = relevantUsage?.projectedCost || 0;
          } catch (error) {
            console.error('Error calculating projected cost:', error);
          }
        }

        return {
          id: subscription.id,
          planId: subscription.planId,
          planName: subscription.plan.name,
          metricType: subscription.plan.metricType,
          metricName: subscription.plan.metricName,
          status: subscription.status,
          currentPeriodStart: subscription.currentPeriodStart.toISOString(),
          currentPeriodEnd: subscription.currentPeriodEnd.toISOString(),
          nextBillingDate: subscription.nextBillingDate.toISOString(),
          currentUsage: subscription.currentUsage,
          projectedCost,
        };
      })
    );

    // Get customer's payment methods
    const paymentMethods = await prisma.customerPaymentMethod.findMany({
      where: {
        customerId: actualCustomerId,
        partnerId: partner.id,
      },
      select: {
        id: true,
        type: true,
        lastFour: true,
        brand: true,
        isDefault: true,
        isActive: true,
        createdAt: true,
      },
      orderBy: [
        { isDefault: 'desc' },
        { createdAt: 'desc' },
      ],
    });

    // Calculate total unbilled amount
    const unbilledUsage = await prisma.usageMetric.aggregate({
      where: {
        customerId: actualCustomerId,
        partnerId: partner.id,
        billingStatus: 'pending',
      },
      _sum: {
        totalCost: true,
      },
    });

    const totalUnbilledAmount = Number(unbilledUsage._sum.totalCost || 0);

    // Check if auto-charge is enabled by checking Stripe directly
    let autoChargeEnabled = false;

    try {
      if (customer.stripeCustomerId && partner.stripeAccountId) {
        const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
        const stripePaymentMethods = await stripe.paymentMethods.list({
          customer: customer.stripeCustomerId,
          type: 'card',
        }, {
          stripeAccount: partner.stripeAccountId,
        });

        autoChargeEnabled = stripePaymentMethods.data.length > 0;
      } else {
        // Fallback to database check if Stripe data not available
        autoChargeEnabled = paymentMethods.some(pm => pm.isDefault && pm.isActive);
      }
    } catch (stripeError) {
      console.error('Error checking Stripe payment methods for auto-charge:', stripeError);
      // Fallback to database check
      autoChargeEnabled = paymentMethods.some(pm => pm.isDefault && pm.isActive);
    }

    // Format subscription data if exists
    const subscriptionData = customerSubscription ? {
      id: customerSubscription.id,
      planId: customerSubscription.planId,
      planName: customerSubscription.plan.name,
      amount: customerSubscription.plan.amount,
      currency: customerSubscription.plan.currency,
      interval: customerSubscription.plan.interval,
      status: customerSubscription.status,
      currentPeriodStart: customerSubscription.currentPeriodStart.toISOString(),
      currentPeriodEnd: customerSubscription.currentPeriodEnd.toISOString(),
      trialStart: customerSubscription.trialStart?.toISOString() || null,
      trialEnd: customerSubscription.trialEnd?.toISOString() || null,
      cancelAtPeriodEnd: customerSubscription.cancelAtPeriodEnd,
      createdAt: customerSubscription.createdAt.toISOString(),
    } : null;

    // Log subscription retrieval
    logger.info('Customer billing data retrieved', {
      operation: 'get-customer-billing',
      partnerId: partner.id,
      customerId: actualCustomerId,
      hasSubscription: !!customerSubscription,
      subscriptionStatus: customerSubscription?.status,
      meteredSubscriptionsCount: meteredSubscriptions.length,
    });

    return NextResponse.json({
      success: true,
      data: {
        customer: {
          id: customer.id,
          email: customer.email,
          firstName: customer.firstName,
          lastName: customer.lastName,
          createdAt: customer.createdAt.toISOString(),
        },
        subscription: subscriptionData,
        meteredSubscriptions: subscriptionsWithProjections,
        paymentMethods: paymentMethods.map(pm => ({
          id: pm.id,
          type: pm.type,
          lastFour: pm.lastFour,
          brand: pm.brand,
          isDefault: pm.isDefault,
          isActive: pm.isActive,
        })),
        autoChargeEnabled,
        totalUnbilledAmount,
      },
    });
  } catch (error: any) {
    logger.error(
      'Error fetching customer billing data',
      error instanceof Error ? error : new Error(String(error)),
      { operation: 'get-customer-billing' }
    );
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
