import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { UsageTrackingService } from '@/lib/billing/usageTracking';
import { MeteredBillingService } from '@/lib/billing/meteredBilling';
import { verifyCustomerJWT } from '@/lib/customerJwt';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

// Validation schema for query parameters
const usageQuerySchema = z.object({
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  metricType: z.string().optional(),
  limit: z.string().optional(),
});

/**
 * GET /api/whitelabel/usage
 * Get customer's usage data and metered billing information
 */
export async function GET(request: NextRequest) {
  try {
    // Get the customer token from cookies
    const cookieStore = cookies();
    const token = cookieStore.get('customer_token')?.value;

    if (!token) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Verify the token
    const payload = await verifyCustomerJWT(token);
    if (!payload) {
      return NextResponse.json(
        { success: false, error: 'Invalid token' },
        { status: 401 }
      );
    }

    const { customerId, partnerId } = payload;

    // Verify customer exists and portal is enabled
    const customer = await prisma.customer.findUnique({
      where: { id: customerId },
      select: {
        id: true,
        customerPortalEnabled: true,
      },
    });

    if (!customer || !customer.customerPortalEnabled) {
      return NextResponse.json(
        { success: false, error: 'Customer portal not enabled' },
        { status: 403 }
      );
    }
    const { searchParams } = new URL(request.url);

    // Parse and validate query parameters
    const queryParams = {
      startDate: searchParams.get('startDate') || undefined,
      endDate: searchParams.get('endDate') || undefined,
      metricType: searchParams.get('metricType') || undefined,
      limit: searchParams.get('limit') || undefined,
    };

    const validationResult = usageQuerySchema.safeParse(queryParams);
    if (!validationResult.success) {
      console.error('🔍 [DEBUG] Usage API validation error:', {
        queryParams,
        validationError: validationResult.error.errors
      });
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid query parameters',
          details: validationResult.error.errors
        },
        { status: 400 }
      );
    }

    const { startDate, endDate, metricType, limit } = validationResult.data;

    console.log('🔍 [DEBUG] Usage API processing:', {
      customerId,
      partnerId,
      queryParams: { startDate, endDate, metricType, limit }
    });

    // Set default date range if not provided (last 30 days)
    const defaultEndDate = new Date();
    const defaultStartDate = new Date();
    defaultStartDate.setDate(defaultStartDate.getDate() - 30);

    const queryStartDate = startDate ? new Date(startDate) : defaultStartDate;
    const queryEndDate = endDate ? new Date(endDate) : defaultEndDate;
    const queryLimit = limit ? parseInt(limit) : 100;

    // Get customer's metered billing plans
    const meteredPlans = await MeteredBillingService.getCustomerPlans(customerId, partnerId);

    // Get usage history
    const usageHistory = await UsageTrackingService.getUsageHistory(
      customerId,
      partnerId,
      queryStartDate,
      queryEndDate,
      metricType,
      { limit: queryLimit }
    );

    // Get current billing period usage aggregation
    const currentBillingPeriod = UsageTrackingService.getCurrentBillingPeriod();
    const currentUsageAggregation = await UsageTrackingService.getUsageAggregation(
      customerId,
      partnerId,
      currentBillingPeriod.start,
      currentBillingPeriod.end,
      metricType
    );

    // Get unbilled usage
    const unbilledUsage = await UsageTrackingService.getUnbilledUsage(
      customerId,
      partnerId,
      metricType
    );

    // Calculate usage projections for active metered plans
    const usageProjections = meteredPlans.map(subscription => {
      // First try exact match, then fallback to metric name only
      let planUsage = currentUsageAggregation.find(
        usage => usage.metricType === subscription.plan.metricType &&
                 usage.metricName === subscription.plan.metricName
      );

      // Fallback: match by metric name only if exact match not found
      if (!planUsage) {
        planUsage = currentUsageAggregation.find(
          usage => usage.metricName === subscription.plan.metricName
        );
      }

      const currentUsage = planUsage?.totalQuantity || 0;
      const calculation = MeteredBillingService.calculateMeteredCharges(
        currentUsage,
        subscription.plan
      );

      return {
        subscriptionId: subscription.id,
        planName: subscription.plan.name,
        metricType: subscription.plan.metricType,
        metricName: subscription.plan.metricName,
        billingCycle: subscription.plan.billingCycle,
        currentPeriodStart: subscription.currentPeriodStart,
        currentPeriodEnd: subscription.currentPeriodEnd,
        currentUsage,
        includedUnits: Number(subscription.plan.includedUnits),
        projectedCost: calculation.finalAmount,
        calculation,
      };
    });

    // Group usage history by metric name for easier consumption
    const usageByMetric = usageHistory.data.reduce((acc: any, usage) => {
      const key = usage.metricName; // Group by metric name only
      if (!acc[key]) {
        acc[key] = {
          metricType: usage.metricType, // Use the first metricType encountered
          metricName: usage.metricName,
          metricCategory: usage.metricCategory,
          events: [],
          totalQuantity: 0,
          totalCost: 0,
        };
      }

      acc[key].events.push(usage);
      acc[key].totalQuantity += usage.quantity;
      acc[key].totalCost += usage.totalCost || 0;

      return acc;
    }, {});

    return NextResponse.json({
      success: true,
      data: {
        // Current period summary
        currentPeriod: {
          start: currentBillingPeriod.start,
          end: currentBillingPeriod.end,
          usage: currentUsageAggregation,
        },
        
        // Active metered billing plans and projections
        meteredPlans: meteredPlans.map(sub => ({
          id: sub.id,
          planName: sub.plan.name,
          metricType: sub.plan.metricType,
          metricName: sub.plan.metricName,
          billingCycle: sub.plan.billingCycle,
          status: sub.status,
          currentPeriodStart: sub.currentPeriodStart,
          currentPeriodEnd: sub.currentPeriodEnd,
          nextBillingDate: sub.nextBillingDate,
        })),
        
        // Usage projections with cost calculations
        usageProjections,
        
        // Unbilled usage summary
        unbilledUsage,
        
        // Detailed usage history
        usageHistory: {
          period: {
            start: queryStartDate,
            end: queryEndDate,
          },
          byMetric: Object.values(usageByMetric),
          events: usageHistory,
        },
        
        // Summary statistics
        summary: {
          totalEvents: usageHistory.data.length,
          totalMetricTypes: new Set(usageHistory.data.map(u => u.metricName)).size,
          activePlans: meteredPlans.length,
          unbilledAmount: unbilledUsage.reduce((sum, usage) => sum + usage.totalCost, 0),
        },
      },
    });
  } catch (error: any) {
    console.error('Error fetching usage data:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
