import { NextRequest, NextResponse } from 'next/server';
import { MeteredBillingService } from '@/lib/billing/meteredBilling';
import { verifyPartnerAuth } from '@/lib/auth/partnerAuth';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';
import Stripe from 'stripe';

export const dynamic = 'force-dynamic';

// Validation schemas
const pricingTierSchema = z.object({
  upTo: z.coerce.number().nullable(),
  price: z.coerce.number().min(0, 'Price must be non-negative'),
});

const updatePlanSchema = z.object({
  name: z.string().min(1, 'Plan name is required').optional(),
  description: z.string().optional(),
  metricType: z.string().min(1, 'Metric type is required').optional(),
  metricName: z.string().min(1, 'Metric name is required').optional(),
  pricingModel: z.enum(['flat', 'tiered', 'volume']).optional(),
  pricingTiers: z.array(pricingTierSchema).min(1, 'At least one pricing tier is required').optional(),
  billingCycle: z.enum(['daily', 'weekly', 'monthly', 'quarterly']).optional(),
  billingDay: z.coerce.number().min(1).max(31).optional(),
  minimumCharge: z.coerce.number().min(0).optional(),
  maximumCharge: z.coerce.number().min(0).nullable().optional(),
  includedUnits: z.coerce.number().min(0).optional(),
  prorationEnabled: z.coerce.boolean().optional(),
  usageAggregation: z.enum(['sum', 'max', 'avg', 'count']).optional(),
  isActive: z.coerce.boolean().optional(),
  metadata: z.record(z.string()).optional(),
});

interface RouteParams {
  params: { planId: string };
}

/**
 * GET /api/partner/metered-billing/plans/[planId]
 * Get a specific metered billing plan
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

    const { planId } = params;

    // Get the plan
    const plan = await prisma.meteredBillingPlan.findFirst({
      where: {
        id: planId,
        partnerId: partner.id,
      },
      include: {
        subscriptions: {
          select: {
            id: true,
            customerId: true,
            status: true,
            createdAt: true,
            customer: {
              select: {
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
        { success: false, error: 'Plan not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: { plan },
    });
  } catch (error: any) {
    console.error('Error fetching metered billing plan:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/partner/metered-billing/plans/[planId]
 * Update a metered billing plan
 */
export async function PATCH(
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

    const { planId } = params;
    const body = await request.json();

    // Validate request body
    const validationResult = updatePlanSchema.safeParse(body);
    if (!validationResult.success) {
      console.error('Validation failed for metered billing plan update:', validationResult.error.errors);
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
    const existingPlan = await prisma.meteredBillingPlan.findFirst({
      where: {
        id: planId,
        partnerId: partner.id,
      },
    });

    if (!existingPlan) {
      return NextResponse.json(
        { success: false, error: 'Plan not found' },
        { status: 404 }
      );
    }

    // Prevent updates to plans with Stripe integration
    if (existingPlan.stripeProductId) {
      return NextResponse.json(
        {
          success: false,
          error: 'Cannot update plan with Stripe integration',
          message: 'Plans with Stripe products cannot be modified. Create a new plan instead.'
        },
        { status: 400 }
      );
    }

    // Validate pricing tiers logic if provided
    if (updateData.pricingModel === 'tiered' && updateData.pricingTiers) {
      for (let i = 1; i < updateData.pricingTiers.length; i++) {
        const prevTier = updateData.pricingTiers[i - 1];
        const currentTier = updateData.pricingTiers[i];
        
        if (prevTier.upTo && currentTier.upTo && prevTier.upTo >= currentTier.upTo) {
          return NextResponse.json(
            { 
              success: false, 
              error: 'Tiered pricing tiers must be in ascending order' 
            },
            { status: 400 }
          );
        }
      }
    }

    // Update the plan
    const updatedPlan = await MeteredBillingService.updatePlan(planId, {
      ...updateData,
      partnerId: partner.id,
    });

    return NextResponse.json({
      success: true,
      data: { plan: updatedPlan },
    });
  } catch (error: any) {
    console.error('Error updating metered billing plan:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/partner/metered-billing/plans/[planId]
 * Delete a metered billing plan
 */
export async function DELETE(
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

    const { planId } = params;

    // Check if plan exists and belongs to partner
    const existingPlan = await prisma.meteredBillingPlan.findFirst({
      where: {
        id: planId,
        partnerId: partner.id,
      },
      include: {
        subscriptions: {
          where: {
            status: 'active',
          },
        },
      },
    });

    if (!existingPlan) {
      return NextResponse.json(
        { success: false, error: 'Plan not found' },
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

    // Archive Stripe product if it exists (Stripe doesn't allow deletion, only archiving)
    if (existingPlan.stripeProductId && partner.stripeAccountId) {
      try {
        const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
          apiVersion: '2023-10-16',
        });
        await stripe.products.update(existingPlan.stripeProductId, {
          active: false,
          metadata: {
            ...(existingPlan.metadata as Record<string, string> || {}),
            archived_at: new Date().toISOString(),
            archived_reason: 'plan_deleted',
          },
        }, {
          stripeAccount: partner.stripeAccountId,
        });

        console.log(`Archived Stripe product ${existingPlan.stripeProductId} for deleted plan ${planId}`);
      } catch (stripeError) {
        console.error('Error archiving Stripe product:', stripeError);
        // Continue with plan deletion even if Stripe archiving fails
      }
    }

    // Delete the plan
    await prisma.meteredBillingPlan.delete({
      where: {
        id: planId,
      },
    });

    return NextResponse.json({
      success: true,
      message: 'Plan deleted successfully',
    });
  } catch (error: any) {
    console.error('Error deleting metered billing plan:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
