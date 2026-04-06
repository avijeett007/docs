import { NextRequest, NextResponse } from 'next/server';
import { MeteredBillingService } from '@/lib/billing/meteredBilling';
import { verifyPartnerAuth } from '@/lib/auth/partnerAuth';
import { verifyJWT } from '@/lib/jwt';
import { prisma } from '@/lib/prisma';
import { cookies } from 'next/headers';
import { z } from 'zod';
import { partnerRateLimit } from '@/lib/rateLimit';

export const dynamic = 'force-dynamic';

// Validation schema
const subscribeCustomerSchema = z.object({
  customerId: z.string().min(1, 'Customer ID is required'),
  planId: z.string().min(1, 'Plan ID is required'),
  startDate: z.string().datetime().optional(),
});

/**
 * POST /api/partner/metered-billing/subscriptions
 * Subscribe a customer to a metered billing plan
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

    const body = await request.json();

    // Validate request body
    const validationResult = subscribeCustomerSchema.safeParse(body);
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

    const { customerId, planId, startDate } = validationResult.data;

    // Subscribe customer to the plan
    const subscription = await MeteredBillingService.subscribeCustomer(
      customerId,
      partner.id,
      planId,
      startDate ? new Date(startDate) : undefined
    );

    return NextResponse.json({
      success: true,
      data: { subscription },
    });
  } catch (error: any) {
    console.error('Error subscribing customer to metered plan:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
