import { NextRequest, NextResponse } from 'next/server';
import { verifyCustomerAuth } from '@/lib/auth/customerAuth';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

/**
 * GET /api/whitelabel/credits/plans
 * Get available credit plans for the customer's partner
 */
export async function GET(request: NextRequest) {
  try {
    // Verify customer authentication
    const customerAuth = await verifyCustomerAuth(request);

    if (!customerAuth) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const partnerId = customerAuth.partnerId;

    // Get active credit plans for this partner
    const creditPlans = await prisma.customerCreditPlan.findMany({
      where: {
        partnerId: partnerId,
        isActive: true,
      },
      orderBy: [
        { isPopular: 'desc' },
        { sortOrder: 'asc' },
        { priceCents: 'asc' },
      ],
      select: {
        id: true,
        name: true,
        credits: true,
        priceCents: true,
        discountPercentage: true,
        isPopular: true,
        description: true,
      },
    });

    return NextResponse.json({
      success: true,
      data: creditPlans,
    });

  } catch (error) {
    console.error('Error getting credit plans:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
