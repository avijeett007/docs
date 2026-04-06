import { NextRequest, NextResponse } from 'next/server';
import { MeteredBillingService } from '@/lib/billing/meteredBilling';
import { verifyPartnerAuth } from '@/lib/auth/partnerAuth';
import { verifyJWT } from '@/lib/jwt';
import { prisma } from '@/lib/prisma';
import { cookies } from 'next/headers';
import { z } from 'zod';
import { partnerRateLimit } from '@/lib/rateLimit';

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

// Validation schemas
const pricingTierSchema = z.object({
  upTo: z.coerce.number().nullable(),
  price: z.coerce.number().min(0, 'Price must be non-negative'),
});

const createPlanSchema = z.object({
  name: z.string().min(1, 'Plan name is required'),
  description: z.string().optional(),
  metricType: z.string().min(1, 'Metric type is required'),
  metricName: z.string().min(1, 'Metric name is required'),
  pricingModel: z.enum(['flat', 'tiered', 'volume']),
  pricingTiers: z.array(pricingTierSchema).min(1, 'At least one pricing tier is required'),
  billingCycle: z.enum(['daily', 'weekly', 'monthly', 'quarterly']),
  billingDay: z.coerce.number().min(1).max(31).optional(),
  minimumCharge: z.coerce.number().min(0).optional(),
  maximumCharge: z.coerce.number().min(0).nullable().optional(),
  includedUnits: z.coerce.number().min(0).optional(),
  prorationEnabled: z.coerce.boolean().optional(),
  usageAggregation: z.enum(['sum', 'max', 'avg', 'count']).optional(),
  metadata: z.record(z.string()).optional(),
});

/**
 * GET /api/partner/metered-billing/plans
 * Get partner's metered billing plans
 */
export async function GET(request: NextRequest) {
  try {
    // Apply rate limiting
    const rateLimitResult = partnerRateLimit(request);
    if (!rateLimitResult.success) {
      return NextResponse.json(
        {
          success: false,
          error: 'Rate limit exceeded',
          retryAfter: Math.ceil((rateLimitResult.resetTime - Date.now()) / 1000)
        },
        {
          status: 429,
          headers: {
            'X-RateLimit-Limit': rateLimitResult.total.toString(),
            'X-RateLimit-Remaining': rateLimitResult.remaining.toString(),
            'X-RateLimit-Reset': new Date(rateLimitResult.resetTime).toISOString(),
          }
        }
      );
    }

    // Try cookie-based auth first, then header-based auth as fallback
    let token = cookies().get('partner_token')?.value;

    if (!token) {
      // Fallback to Authorization header
      const authHeader = request.headers.get('Authorization');
      if (authHeader && authHeader.startsWith('Bearer ')) {
        token = authHeader.split(' ')[1];
      }
    }

    if (!token) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Verify JWT token
    const decodedToken = await verifyJWT(token);
    if (!decodedToken || !decodedToken.email) {
      return NextResponse.json(
        { success: false, error: 'Invalid token' },
        { status: 401 }
      );
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
      return NextResponse.json(
        { success: false, error: 'Partner not found' },
        { status: 403 }
      );
    }

    // Get partner's metered billing plans
    const plans = await MeteredBillingService.getPartnerPlans(partner.id);

    return NextResponse.json({
      success: true,
      data: plans, // Return plans directly, not wrapped in { plans }
    });
  } catch (error: any) {
    console.error('Error fetching metered billing plans:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/partner/metered-billing/plans
 * Create a new metered billing plan
 */
export async function POST(request: NextRequest) {
  try {
    // Apply rate limiting
    const rateLimitResult = partnerRateLimit(request);
    if (!rateLimitResult.success) {
      return NextResponse.json(
        {
          success: false,
          error: 'Rate limit exceeded',
          retryAfter: Math.ceil((rateLimitResult.resetTime - Date.now()) / 1000)
        },
        {
          status: 429,
          headers: {
            'X-RateLimit-Limit': rateLimitResult.total.toString(),
            'X-RateLimit-Remaining': rateLimitResult.remaining.toString(),
            'X-RateLimit-Reset': new Date(rateLimitResult.resetTime).toISOString(),
          }
        }
      );
    }

    // Try cookie-based auth first, then header-based auth as fallback
    let token = cookies().get('partner_token')?.value;

    if (!token) {
      // Fallback to Authorization header
      const authHeader = request.headers.get('Authorization');
      if (authHeader && authHeader.startsWith('Bearer ')) {
        token = authHeader.split(' ')[1];
      }
    }

    if (!token) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Verify JWT token
    const decodedToken = await verifyJWT(token);
    if (!decodedToken || !decodedToken.email) {
      return NextResponse.json(
        { success: false, error: 'Invalid token' },
        { status: 401 }
      );
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
      return NextResponse.json(
        { success: false, error: 'Partner not found' },
        { status: 403 }
      );
    }

    // Check if partner is on free forever plan - they cannot create metered billing plans
    if (isFreeForeverPartner(partner.planId)) {
      return NextResponse.json(
        {
          success: false,
          error: 'Free Forever plan users cannot create metered billing plans. Please upgrade your plan to access this feature.',
          code: 'FREE_FOREVER_RESTRICTED'
        },
        { status: 403 }
      );
    }

    const body = await request.json();

    // Validate request body
    const validationResult = createPlanSchema.safeParse(body);
    if (!validationResult.success) {
      console.error('Validation failed for metered billing plan:', validationResult.error.errors);
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid request data',
          details: validationResult.error.errors
        },
        { status: 400 }
      );
    }

    const planData = validationResult.data;

    // Validate pricing tiers for negative prices and other issues
    for (const tier of planData.pricingTiers) {
      if (tier.price < 0) {
        return NextResponse.json(
          {
            success: false,
            error: 'Pricing tier prices cannot be negative'
          },
          { status: 400 }
        );
      }

      if (tier.upTo !== null && tier.upTo <= 0) {
        return NextResponse.json(
          {
            success: false,
            error: 'Pricing tier limits must be positive or null for unlimited'
          },
          { status: 400 }
        );
      }
    }

    // Validate minimum and maximum charges
    if (planData.minimumCharge && planData.minimumCharge < 0) {
      return NextResponse.json(
        {
          success: false,
          error: 'Minimum charge cannot be negative'
        },
        { status: 400 }
      );
    }

    if (planData.maximumCharge && planData.maximumCharge < 0) {
      return NextResponse.json(
        {
          success: false,
          error: 'Maximum charge cannot be negative'
        },
        { status: 400 }
      );
    }

    if (planData.minimumCharge && planData.maximumCharge && planData.minimumCharge > planData.maximumCharge) {
      return NextResponse.json(
        {
          success: false,
          error: 'Minimum charge cannot be greater than maximum charge'
        },
        { status: 400 }
      );
    }

    // Validate included units
    if (planData.includedUnits && planData.includedUnits < 0) {
      return NextResponse.json(
        {
          success: false,
          error: 'Included units cannot be negative'
        },
        { status: 400 }
      );
    }

    // Validate pricing tiers logic
    if (planData.pricingModel === 'tiered') {
      // For tiered pricing, ensure tiers are in ascending order
      for (let i = 1; i < planData.pricingTiers.length; i++) {
        const prevTier = planData.pricingTiers[i - 1];
        const currentTier = planData.pricingTiers[i];

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

    // Create the plan with audit information
    const ipAddress = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown';
    const userAgent = request.headers.get('user-agent') || 'unknown';

    const plan = await MeteredBillingService.createPlan({
      ...planData,
      partnerId: partner.id,
    }, partner.id, ipAddress, userAgent);

    return NextResponse.json({
      success: true,
      data: plan, // Return plan directly for consistency
    });
  } catch (error: any) {
    console.error('Error creating metered billing plan:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
