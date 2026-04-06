import { NextRequest, NextResponse } from 'next/server';
import { verifyPartnerAuth } from '@/lib/auth/partnerAuth';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';
import Stripe from 'stripe';

export const dynamic = 'force-dynamic';

// Helper function to check if partner is on free forever plan
function isFreeForeverPartner(planId: string | null): boolean {
  if (!planId) return false;
  const freeForeverPriceId = process.env.STRIPE_FREE_FOREVER_PRICE_ID;
  return (
    planId === 'free_forever_trial' ||
    planId === 'free_forever' ||
    (freeForeverPriceId !== undefined && planId === freeForeverPriceId)
  );
}

const createPlanSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100, 'Name too long'),
  credits: z.number().int().min(1, 'Credits must be at least 1').max(1000000, 'Credits too high'),
  priceCents: z.number().int()
    .min(50, 'Price must be at least $0.50 to meet Stripe minimum requirements')
    .max(1000000, 'Price cannot exceed $10,000 per plan for security reasons'),
  discountPercentage: z.number().min(0, 'Discount cannot be negative').max(100, 'Discount cannot exceed 100%').optional().default(0),
  isPopular: z.boolean().optional().default(false),
  description: z.string().max(500, 'Description too long').optional(),
  sortOrder: z.number().int().min(0).optional().default(0),
});

/**
 * GET /api/partner/customer-credit-plans
 * Get partner's customer credit plans
 */
export async function GET(request: NextRequest) {
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

    // Get credit plans for this partner
    const creditPlans = await prisma.customerCreditPlan.findMany({
      where: {
        partnerId: partnerId,
      },
      orderBy: [
        { isPopular: 'desc' },
        { sortOrder: 'asc' },
        { createdAt: 'desc' },
      ],
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
        _count: {
          select: {
            purchases: true,
          },
        },
      },
    });

    return NextResponse.json({
      success: true,
      data: creditPlans.map(plan => ({
        ...plan,
        purchaseCount: plan._count.purchases,
        _count: undefined,
      })),
    });

  } catch (error) {
    console.error('Error getting customer credit plans:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/partner/customer-credit-plans
 * Create a new customer credit plan
 */
export async function POST(request: NextRequest) {
  try {
    // Verify partner authentication
    const partner = await verifyPartnerAuth(request);
    if (!partner) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Check if partner is on free forever plan - they cannot create credit plans
    if (isFreeForeverPartner(partner.planId)) {
      return NextResponse.json(
        {
          success: false,
          error: 'Free Forever plan users cannot create credit plans. Please upgrade your plan to access this feature.',
          code: 'FREE_FOREVER_RESTRICTED'
        },
        { status: 403 }
      );
    }

    // Check if partner has Stripe enabled
    if (!partner.stripeChargesEnabled || !partner.stripeOnboardingCompleted || !partner.stripeAccountId) {
      return NextResponse.json(
        { success: false, error: 'Stripe integration must be enabled to create credit plans' },
        { status: 400 }
      );
    }

    const partnerId = partner.id;

    // Parse and validate request body
    const body = await request.json();
    const validation = createPlanSchema.safeParse(body);

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

    const planData = validation.data;

    // Initialize Stripe
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
      apiVersion: '2023-10-16',
    });

    // Create Stripe product and price
    let stripeProductId: string;
    let stripePriceId: string;

    try {
      // Create Stripe product
      const stripeProduct = await stripe.products.create({
        name: planData.name,
        description: `${planData.credits.toLocaleString()} AI Credits${planData.description ? ` - ${planData.description}` : ''}`,
        metadata: {
          partnerId: partnerId,
          credits: planData.credits.toString(),
          type: 'customer_credit_plan',
        },
      }, {
        stripeAccount: partner.stripeAccountId,
      });

      stripeProductId = stripeProduct.id;

      // Create Stripe price
      const stripePrice = await stripe.prices.create({
        product: stripeProductId,
        unit_amount: planData.priceCents,
        currency: 'usd',
        metadata: {
          partnerId: partnerId,
          credits: planData.credits.toString(),
          discountPercentage: planData.discountPercentage.toString(),
        },
      }, {
        stripeAccount: partner.stripeAccountId,
      });

      stripePriceId = stripePrice.id;

    } catch (stripeError) {
      console.error('Stripe error:', stripeError);
      return NextResponse.json(
        { success: false, error: 'Failed to create Stripe product/price' },
        { status: 500 }
      );
    }

    // If this plan is marked as popular, unmark other popular plans
    if (planData.isPopular) {
      await prisma.customerCreditPlan.updateMany({
        where: {
          partnerId: partnerId,
          isPopular: true,
        },
        data: {
          isPopular: false,
        },
      });
    }

    // Create the credit plan with Stripe IDs
    const creditPlan = await prisma.customerCreditPlan.create({
      data: {
        partnerId: partnerId,
        name: planData.name,
        credits: planData.credits,
        priceCents: planData.priceCents,
        discountPercentage: planData.discountPercentage,
        isPopular: planData.isPopular,
        description: planData.description,
        sortOrder: planData.sortOrder,
        stripeProductId: stripeProductId,
        stripePriceId: stripePriceId,
      },
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
      data: creditPlan,
    });

  } catch (error) {
    console.error('Error creating customer credit plan:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
