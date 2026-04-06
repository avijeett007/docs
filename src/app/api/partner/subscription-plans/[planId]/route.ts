import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyPartnerAuth } from '@/lib/auth/partnerAuth';
import Stripe from 'stripe';
import { z } from 'zod';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2023-10-16',
});

// Validation schema for updating subscription plans
const updatePlanSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().optional(),
  isActive: z.boolean().optional(),
  requireCardForTrial: z.boolean().optional(),
  showOnLandingPage: z.boolean().optional(),
  features: z.array(z.string()).optional(),
  planFeatures: z.object({
    enableAdvancedAnalytics: z.boolean().optional(),
    enableDetailedCallAnalysis: z.boolean().optional(),
    enableActionPointAnalysis: z.boolean().optional(),
    showIntegration: z.boolean().optional(),
    showDocsAndMedia: z.boolean().optional(),
    showPhoneNumbers: z.boolean().optional(),
    allowedApps: z.array(z.string()).optional(),
    aiCreditsEnabled: z.boolean().optional(),
    lowCreditNotificationsEnabled: z.boolean().optional(),
    lowCreditThreshold: z.number().int().min(0).optional(),
    initialAiCredits: z.number().int().min(0).optional(),
  }).optional(),
  metadata: z.record(z.string()).optional(),
});

/**
 * Get a specific subscription plan
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { planId: string } }
) {
  try {
    // Verify partner authentication
    const authResult = await verifyPartnerAuth(request);
    if (!authResult) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const partnerId = authResult.id;
    const planId = params.planId;

    // Get the subscription plan
    const plan = await prisma.subscriptionPlan.findFirst({
      where: {
        id: planId,
        partnerId,
      },
      include: {
        subscriptions: {
          select: {
            id: true,
            status: true,
            createdAt: true,
            customer: {
              select: {
                id: true,
                email: true,
                firstName: true,
                lastName: true,
              },
            },
          },
          orderBy: { createdAt: 'desc' },
          take: 10,
        },
      },
    });

    if (!plan) {
      return NextResponse.json(
        { success: false, error: 'Subscription plan not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: plan,
    });
  } catch (error) {
    logger.error(
      'Error fetching subscription plan',
      error instanceof Error ? error : new Error(String(error)),
      { operation: 'subscription-plans-get', planId: params.planId }
    );
    return NextResponse.json(
      { success: false, error: 'Failed to fetch subscription plan' },
      { status: 500 }
    );
  }
}

/**
 * Update a subscription plan
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { planId: string } }
) {
  try {
    // Verify partner authentication
    const authResult = await verifyPartnerAuth(request);
    if (!authResult) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const partnerId = authResult.id;
    const planId = params.planId;
    const body = await request.json();

    // Validate request body
    const validationResult = updatePlanSchema.safeParse(body);
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

    const updateData = validationResult.data;

    // Check if plan exists and belongs to partner
    const existingPlan = await prisma.subscriptionPlan.findFirst({
      where: {
        id: planId,
        partnerId,
      },
    });

    if (!existingPlan) {
      return NextResponse.json(
        { success: false, error: 'Subscription plan not found' },
        { status: 404 }
      );
    }

    // Update the plan
    const updatedPlan = await prisma.subscriptionPlan.update({
      where: { id: planId },
      data: updateData,
    });

    return NextResponse.json({
      success: true,
      data: updatedPlan,
      message: 'Subscription plan updated successfully',
    });
  } catch (error) {
    logger.error(
      'Error updating subscription plan',
      error instanceof Error ? error : new Error(String(error)),
      { operation: 'subscription-plans-update', planId: params.planId }
    );
    return NextResponse.json(
      { success: false, error: 'Failed to update subscription plan' },
      { status: 500 }
    );
  }
}

/**
 * Delete a subscription plan
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { planId: string } }
) {
  try {
    // Verify partner authentication
    const authResult = await verifyPartnerAuth(request);
    if (!authResult) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const partnerId = authResult.id;
    const planId = params.planId;

    // Check if plan exists and belongs to partner
    const existingPlan = await prisma.subscriptionPlan.findFirst({
      where: {
        id: planId,
        partnerId,
      },
      include: {
        subscriptions: {
          where: {
            status: {
              in: ['active', 'trialing', 'past_due'],
            },
          },
        },
      },
    });

    if (!existingPlan) {
      return NextResponse.json(
        { success: false, error: 'Subscription plan not found' },
        { status: 404 }
      );
    }

    // Check if plan has active subscriptions
    if (existingPlan.subscriptions.length > 0) {
      return NextResponse.json(
        {
          success: false,
          error: 'Cannot delete plan with active subscriptions. Please cancel all subscriptions first.'
        },
        { status: 400 }
      );
    }

    // Get partner details for Stripe Connect
    const partner = await prisma.partner.findUnique({
      where: { id: partnerId },
      select: { stripeAccountId: true },
    });

    // Archive the Stripe price (can't delete, but can archive)
    try {
      const stripeOptions = partner?.stripeAccountId
        ? { stripeAccount: partner.stripeAccountId }
        : {};

      await stripe.prices.update(
        existingPlan.stripePriceId,
        { active: false },
        stripeOptions
      );
    } catch (stripeError) {
      logger.warn('Failed to archive Stripe price', {
        operation: 'subscription-plans-delete',
        planId: params.planId,
        error: stripeError instanceof Error ? stripeError.message : String(stripeError)
      });
      // Continue with deletion even if Stripe update fails
    }

    // Delete the plan from database
    await prisma.subscriptionPlan.delete({
      where: { id: planId },
    });

    return NextResponse.json({
      success: true,
      message: 'Subscription plan deleted successfully',
    });
  } catch (error) {
    logger.error(
      'Error deleting subscription plan',
      error instanceof Error ? error : new Error(String(error)),
      { operation: 'subscription-plans-delete', planId: params.planId }
    );
    return NextResponse.json(
      { success: false, error: 'Failed to delete subscription plan' },
      { status: 500 }
    );
  }
}
