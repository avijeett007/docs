import { NextRequest, NextResponse } from 'next/server';
import { verifyPartnerAuth } from '@/lib/auth/partnerAuth';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';
import Stripe from 'stripe';

export const dynamic = 'force-dynamic';

const updatePlanSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100, 'Name too long').optional(),
  credits: z.number().int().min(1, 'Credits must be at least 1').max(1000000, 'Credits too high').optional(),
  priceCents: z.number().int().min(1, 'Price must be at least 1 cent').max(100000000, 'Price too high').optional(),
  discountPercentage: z.number().min(0).max(100).optional(),
  isActive: z.boolean().optional(),
  isPopular: z.boolean().optional(),
  description: z.string().max(500, 'Description too long').optional(),
  sortOrder: z.number().int().min(0).optional(),
});

/**
 * PUT /api/partner/customer-credit-plans/[planId]
 * Update a customer credit plan
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: { planId: string } }
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

    const partnerId = partner.id;
    const planId = params.planId;

    // Parse and validate request body
    const body = await request.json();
    const validation = updatePlanSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Invalid request data',
          details: validation.error.errors
        },
        { status: 400 }
      );
    }

    const updateData = validation.data;

    // Check if plan exists and belongs to partner
    const existingPlan = await prisma.customerCreditPlan.findFirst({
      where: {
        id: planId,
        partnerId: partnerId,
      },
      include: {
        partner: {
          select: {
            stripeAccountId: true,
            stripeChargesEnabled: true,
            stripeOnboardingCompleted: true,
          },
        },
      },
    });

    if (!existingPlan) {
      return NextResponse.json(
        { success: false, error: 'Credit plan not found' },
        { status: 404 }
      );
    }

    // Update Stripe product if name or description changed
    if ((updateData.name || updateData.description) && existingPlan.stripeProductId && existingPlan.partner.stripeAccountId) {
      try {
        const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
          apiVersion: '2023-10-16',
        });

        const updateProductData: any = {};
        if (updateData.name) {
          updateProductData.name = updateData.name;
        }
        if (updateData.description !== undefined) {
          updateProductData.description = `${updateData.credits || existingPlan.credits} AI Credits${updateData.description ? ` - ${updateData.description}` : ''}`;
        }

        if (Object.keys(updateProductData).length > 0) {
          await stripe.products.update(
            existingPlan.stripeProductId,
            updateProductData,
            {
              stripeAccount: existingPlan.partner.stripeAccountId,
            }
          );
        }
      } catch (stripeError) {
        console.error('Stripe product update error:', stripeError);
        // Continue with database update even if Stripe update fails
      }
    }

    // If this plan is being marked as popular, unmark other popular plans
    if (updateData.isPopular === true) {
      await prisma.customerCreditPlan.updateMany({
        where: {
          partnerId: partnerId,
          isPopular: true,
          id: { not: planId },
        },
        data: {
          isPopular: false,
        },
      });
    }

    // Update the credit plan
    const updatedPlan = await prisma.customerCreditPlan.update({
      where: {
        id: planId,
      },
      data: updateData,
      select: {
        id: true,
        name: true,
        credits: true,
        priceCents: true,
        discountPercentage: true,
        isActive: true,
        isPopular: true,
        description: true,
        sortOrder: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return NextResponse.json({
      success: true,
      data: updatedPlan,
    });

  } catch (error) {
    console.error('Error updating customer credit plan:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/partner/customer-credit-plans/[planId]
 * Delete a customer credit plan
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { planId: string } }
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

    const partnerId = partner.id;
    const planId = params.planId;

    // Check if plan exists and belongs to partner
    const existingPlan = await prisma.customerCreditPlan.findFirst({
      where: {
        id: planId,
        partnerId: partnerId,
      },
      include: {
        _count: {
          select: {
            purchases: true,
          },
        },
        partner: {
          select: {
            stripeAccountId: true,
            stripeChargesEnabled: true,
            stripeOnboardingCompleted: true,
          },
        },
      },
    });

    if (!existingPlan) {
      return NextResponse.json(
        { success: false, error: 'Credit plan not found' },
        { status: 404 }
      );
    }

    // Check if plan has any purchases
    if (existingPlan._count.purchases > 0) {
      return NextResponse.json(
        {
          success: false,
          error: 'Cannot delete credit plan with existing purchases. Deactivate it instead.'
        },
        { status: 400 }
      );
    }

    // Archive Stripe product if it exists
    if (existingPlan.stripeProductId && existingPlan.partner.stripeAccountId) {
      try {
        const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
          apiVersion: '2023-10-16',
        });

        await stripe.products.update(
          existingPlan.stripeProductId,
          { active: false },
          {
            stripeAccount: existingPlan.partner.stripeAccountId,
          }
        );
      } catch (stripeError) {
        console.error('Stripe product archive error:', stripeError);
        // Continue with database deletion even if Stripe update fails
      }
    }

    // Delete the credit plan
    await prisma.customerCreditPlan.delete({
      where: {
        id: planId,
      },
    });

    return NextResponse.json({
      success: true,
      message: 'Credit plan deleted successfully',
    });

  } catch (error) {
    console.error('Error deleting customer credit plan:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
