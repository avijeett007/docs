import { NextRequest, NextResponse } from 'next/server';
import { MeteredBillingService } from '@/lib/billing/meteredBilling';
import { verifyJWT } from '@/lib/jwt';
import { cookies } from 'next/headers';
import { z } from 'zod';
import { partnerRateLimit } from '@/lib/rateLimit';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

// Validation schemas
const changePlanSchema = z.object({
  newPlanId: z.string().min(1, 'New plan ID is required'),
  changeDate: z.string().optional().transform(val => val ? new Date(val) : undefined),
});

const pauseSubscriptionSchema = z.object({
  reason: z.string().optional(),
  pauseUntil: z.string().optional().transform(val => val ? new Date(val) : undefined),
});

const cancelSubscriptionSchema = z.object({
  immediate: z.boolean().optional().default(false),
  gracePeriodDays: z.number().min(0).max(365).optional(),
  reason: z.string().optional(),
  refundUnusedPortion: z.boolean().optional().default(false),
});

/**
 * PATCH /api/partner/metered-billing/subscriptions/[id]
 * Update subscription (change plan, pause, resume, cancel)
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
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

    // Authentication
    let token = cookies().get('partner_token')?.value;

    if (!token) {
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

    const decodedToken = await verifyJWT(token);
    if (!decodedToken || !decodedToken.email) {
      return NextResponse.json(
        { success: false, error: 'Invalid token' },
        { status: 401 }
      );
    }

    // Get partner
    const partner = await prisma.partner.findUnique({
      where: { emailAddress: decodedToken.email },
    });

    if (!partner) {
      return NextResponse.json(
        { success: false, error: 'Partner not found' },
        { status: 404 }
      );
    }

    const subscriptionId = params.id;
    const body = await request.json();
    const action = body.action;

    // Get audit information
    const ipAddress = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown';
    const userAgent = request.headers.get('user-agent') || 'unknown';

    let result;

    switch (action) {
      case 'change_plan':
        const changePlanData = changePlanSchema.parse(body);
        result = await MeteredBillingService.changePlan(
          subscriptionId,
          changePlanData.newPlanId,
          changePlanData.changeDate,
          partner.id,
          ipAddress,
          userAgent
        );
        break;

      case 'pause':
        const pauseData = pauseSubscriptionSchema.parse(body);
        result = await MeteredBillingService.pauseSubscription(
          subscriptionId,
          {
            reason: pauseData.reason,
            pauseUntil: pauseData.pauseUntil,
            userId: partner.id,
            ipAddress,
            userAgent,
          }
        );
        break;

      case 'resume':
        result = await MeteredBillingService.resumeSubscription(
          subscriptionId,
          partner.id,
          ipAddress,
          userAgent
        );
        break;

      case 'cancel':
        const cancelData = cancelSubscriptionSchema.parse(body);
        result = await MeteredBillingService.cancelSubscription(
          subscriptionId,
          {
            immediate: cancelData.immediate,
            gracePeriodDays: cancelData.gracePeriodDays,
            reason: cancelData.reason,
            refundUnusedPortion: cancelData.refundUnusedPortion,
          },
          partner.id,
          ipAddress,
          userAgent
        );
        break;

      default:
        return NextResponse.json(
          { success: false, error: 'Invalid action' },
          { status: 400 }
        );
    }

    return NextResponse.json({
      success: true,
      data: result,
    });

  } catch (error) {
    console.error('Error updating subscription:', error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Validation error',
          details: error.errors 
        },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to update subscription'
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/partner/metered-billing/subscriptions/[id]
 * Get subscription details including lifecycle history
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
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

    // Authentication
    let token = cookies().get('partner_token')?.value;

    if (!token) {
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

    const decodedToken = await verifyJWT(token);
    if (!decodedToken || !decodedToken.email) {
      return NextResponse.json(
        { success: false, error: 'Invalid token' },
        { status: 401 }
      );
    }

    // Get partner
    const partner = await prisma.partner.findUnique({
      where: { emailAddress: decodedToken.email },
    });

    if (!partner) {
      return NextResponse.json(
        { success: false, error: 'Partner not found' },
        { status: 404 }
      );
    }

    const subscriptionId = params.id;

    // Get subscription with full details
    const subscription = await prisma.customerMeteredSubscription.findFirst({
      where: {
        id: subscriptionId,
        partnerId: partner.id,
      },
      include: {
        plan: true,
        customer: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
        partner: {
          select: {
            id: true,
            businessName: true,
          },
        },
      },
    });

    if (!subscription) {
      return NextResponse.json(
        { success: false, error: 'Subscription not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: subscription,
    });

  } catch (error) {
    console.error('Error getting subscription:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to get subscription'
      },
      { status: 500 }
    );
  }
}
