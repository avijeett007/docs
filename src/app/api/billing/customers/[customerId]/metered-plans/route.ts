import { NextRequest, NextResponse } from 'next/server';
import { verifyPartnerAuth } from '@/lib/auth/partnerAuth';
import { prisma } from '@/lib/prisma';

interface RouteParams {
  params: {
    customerId: string;
  };
}

/**
 * GET /api/billing/customers/[customerId]/metered-plans
 * Get available metered billing plans for a customer (for metrics configuration)
 */
export async function GET(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    // Verify partner authentication
    const partner = await verifyPartnerAuth(request);
    if (!partner) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { customerId } = params;
    console.log('Loading metered plans for customer:', customerId, 'partner:', partner.id);

    // Verify the customer belongs to this partner
    // Customers are linked to partners through the credentials relationship
    const customer = await prisma.customer.findFirst({
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
      },
    });

    console.log('Customer found:', customer ? 'Yes' : 'No');

    if (!customer) {
      return NextResponse.json(
        { success: false, error: 'Customer not found' },
        { status: 404 }
      );
    }

    // Get customer's active metered subscriptions to determine available plans
    const activeSubscriptions = await prisma.customerMeteredSubscription.findMany({
      where: {
        customerId: customerId,
        partnerId: partner.id,
        status: {
          in: ['active', 'paused'], // Only active and paused subscriptions
        },
      },
      include: {
        plan: {
          select: {
            id: true,
            name: true,
            description: true,
            metricType: true,
            metricName: true,
            pricingModel: true,
            pricingTiers: true,
            billingCycle: true,
            minimumCharge: true,
            maximumCharge: true,
            includedUnits: true,
            isActive: true,
          },
        },
      },
    });

    console.log('Found active subscriptions:', activeSubscriptions.length);
    console.log('Subscription details:', activeSubscriptions.map(sub => ({
      id: sub.id,
      status: sub.status,
      planId: sub.plan.id,
      planName: sub.plan.name,
      planActive: sub.plan.isActive
    })));

    // Transform subscriptions to plans format for the metrics configuration
    const plans = activeSubscriptions
      .filter(sub => sub.plan.isActive) // Only include active plans
      .map(sub => ({
        id: sub.plan.id,
        name: sub.plan.name,
        description: sub.plan.description,
        metricType: sub.plan.metricType,
        metricName: sub.plan.metricName,
        pricingModel: sub.plan.pricingModel,
        pricingTiers: sub.plan.pricingTiers,
        billingCycle: sub.plan.billingCycle,
        minimumCharge: sub.plan.minimumCharge,
        maximumCharge: sub.plan.maximumCharge,
        includedUnits: sub.plan.includedUnits,
        isActive: sub.plan.isActive,
        subscriptionId: sub.id,
        subscriptionStatus: sub.status,
      }));

    console.log('Filtered active plans:', plans.length);
    console.log('Final plans response:', plans);

    return NextResponse.json({
      success: true,
      plans: plans, // Return plans array directly for compatibility
    });
  } catch (error: any) {
    console.error('Error fetching customer metered plans:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// Add dynamic export to prevent build errors
export const dynamic = 'force-dynamic';
