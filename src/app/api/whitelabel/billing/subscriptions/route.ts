import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { prisma } from '@/lib/prisma';
import { verifyCustomerAuth } from '@/lib/auth/customerAuth';
import { SubscriptionService } from '@/lib/subscriptions/subscriptionService';
import { CreateSubscriptionRequest } from '@/lib/subscriptions/types';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

// Validation schema for creating subscriptions
const createSubscriptionSchema = z.object({
  planId: z.string().min(1, 'Plan ID is required'),
  trialPeriodDays: z.number().int().min(0).max(365).optional(),
  couponId: z.string().optional(),
  metadata: z.record(z.string()).optional(),
});

/**
 * Get customer's subscriptions
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
    const payload = await verifyCustomerAuth(request);
    if (!payload) {
      return NextResponse.json(
        { success: false, error: 'Invalid token' },
        { status: 401 }
      );
    }

    const { customerId, partnerId } = payload;

    // Get customer's regular subscriptions
    const subscriptions = await prisma.customerSubscription.findMany({
      where: {
        customerId: customerId,
        partnerId: partnerId,
      },
      include: {
        plan: {
          select: {
            id: true,
            name: true,
            description: true,
            amount: true,
            currency: true,
            interval: true,
            intervalCount: true,
            features: true,
          },
        },
        events: {
          orderBy: { createdAt: 'desc' },
          take: 10,
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Get customer's metered billing subscriptions
    const meteredSubscriptions = await prisma.customerMeteredSubscription.findMany({
      where: {
        customerId: customerId,
        status: {
          in: ['active', 'paused'], // Only show active and paused subscriptions
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
            minimumCharge: true,
            pricingTiers: true,
            billingCycle: true,
            includedUnits: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Format metered subscriptions for frontend
    const formattedMeteredSubscriptions = meteredSubscriptions.map(subscription => ({
      id: subscription.id,
      type: 'metered',
      planId: subscription.planId,
      planName: subscription.plan.name,
      description: subscription.plan.description,
      status: subscription.status,
      createdAt: subscription.createdAt,
      updatedAt: subscription.updatedAt,
      metadata: subscription.metadata,
      plan: {
        id: subscription.plan.id,
        name: subscription.plan.name,
        description: subscription.plan.description,
        metricType: subscription.plan.metricType,
        metricName: subscription.plan.metricName,
        pricingModel: subscription.plan.pricingModel,
        minimumCharge: subscription.plan.minimumCharge,
        pricingTiers: subscription.plan.pricingTiers,
        billingCycle: subscription.plan.billingCycle,
        includedUnits: subscription.plan.includedUnits,
      },
    }));

    // Format regular subscriptions
    const formattedSubscriptions = subscriptions.map(subscription => ({
      ...subscription,
      type: 'regular',
      planName: subscription.plan.name,
    }));

    // Combine both types of subscriptions
    const allSubscriptions = [
      ...formattedSubscriptions,
      ...formattedMeteredSubscriptions,
    ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    return NextResponse.json({
      success: true,
      data: {
        subscriptions: allSubscriptions,
      },
    });
  } catch (error) {
    console.error('Error fetching subscriptions:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch subscriptions' },
      { status: 500 }
    );
  }
}

/**
 * Create a new subscription
 */
export async function POST(request: NextRequest) {
  try {
    // Verify customer authentication
    const authResult = await verifyCustomerAuth(request);
    if (!authResult) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { customerId, partnerId } = authResult;
    const body = await request.json();

    // Validate request body
    const validationResult = createSubscriptionSchema.safeParse(body);
    if (!validationResult.success) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Invalid request data',
          details: validationResult.error.errors 
        },
        { status: 400 }
      );
    }

    const { planId, trialPeriodDays, couponId, metadata } = validationResult.data;

    // Check if customer already has an active subscription for this plan
    const existingSubscription = await prisma.customerSubscription.findFirst({
      where: {
        customerId: customerId,
        partnerId: partnerId,
        planId: planId,
        status: {
          in: ['active', 'trialing', 'past_due'],
        },
      },
    });

    if (existingSubscription) {
      return NextResponse.json(
        { success: false, error: 'Customer already has an active subscription for this plan' },
        { status: 400 }
      );
    }

    // Verify the plan belongs to the partner
    const plan = await prisma.subscriptionPlan.findFirst({
      where: {
        id: planId,
        partnerId: partnerId,
        isActive: true,
      },
    });

    if (!plan) {
      return NextResponse.json(
        { success: false, error: 'Plan not found or not available' },
        { status: 404 }
      );
    }

    // Create subscription request
    const subscriptionRequest: CreateSubscriptionRequest = {
      customerId,
      planId,
      trialPeriodDays,
      couponId,
      metadata,
    };

    // Create subscription using the service
    const subscription = await SubscriptionService.createSubscription(
      partnerId,
      subscriptionRequest
    );

    return NextResponse.json({
      success: true,
      data: subscription,
      message: 'Subscription created successfully',
    });
  } catch (error) {
    console.error('Error creating subscription:', error);
    
    // Handle specific Stripe errors
    if (error instanceof Error) {
      if (error.message.includes('card_declined')) {
        return NextResponse.json(
          { success: false, error: 'Payment method declined' },
          { status: 400 }
        );
      }
      if (error.message.includes('incomplete')) {
        return NextResponse.json(
          { success: false, error: 'Payment requires additional authentication' },
          { status: 400 }
        );
      }
    }

    return NextResponse.json(
      { success: false, error: 'Failed to create subscription' },
      { status: 500 }
    );
  }
}
