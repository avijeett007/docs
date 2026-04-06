import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyJWT } from '@/lib/jwt';
import { cookies } from 'next/headers';

// Mark this route as dynamic
export const dynamic = 'force-dynamic';

// Debug endpoint to check customers for a partner
export async function GET(_request: NextRequest) {
  try {
    // Verify partner authentication
    const cookieStore = cookies();
    const token = cookieStore.get('partner_token')?.value;

    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const payload = await verifyJWT(token);
    if (!payload || !payload.email) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    // Get partner using the JWT token's email
    const partner = await prisma.partner.findFirst({
      where: {
        AND: [
          { emailAddress: payload.email },
          { approvalStatus: 'ACTIVE' }
        ]
      }
    });

    if (!partner) {
      return NextResponse.json({ error: 'Partner not found' }, { status: 403 });
    }

    // Get all customer credentials for this partner
    const customerCredentials = await prisma.customerCredential.findMany({
      where: {
        partnerId: partner.id,
      },
      include: {
        customer: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    // Get all customers that have user onboarding records for this partner
    const allCustomers = await prisma.customer.findMany({
      where: {
        userOnboarding: {
          some: {
            partnerId: partner.id,
          },
        },
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        createdAt: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    // Get all user onboarding records for this partner
    const userOnboardings = await prisma.userOnboarding.findMany({
      where: {
        partnerId: partner.id,
      },
      select: {
        id: true,
        userId: true,
        email: true,
        firstName: true,
        lastName: true,
        customerId: true,
        partnerId: true,
        isOnboardingCompleted: true,
        customerPortalEnabled: true,
        createdAt: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return NextResponse.json({
      partner: {
        id: partner.id,
        businessName: partner.businessName,
        email: partner.emailAddress,
      },
      customerCredentials: customerCredentials.map(cred => ({
        id: cred.id,
        customerId: cred.customerId,
        email: cred.email,
        status: cred.status,
        customer: cred.customer,
      })),
      allCustomers: allCustomers,
      userOnboardings: userOnboardings,
      summary: {
        totalCustomers: allCustomers.length,
        totalCredentials: customerCredentials.length,
        activeCredentials: customerCredentials.filter(c => c.status === 'active').length,
        totalUserOnboardings: userOnboardings.length,
        completedOnboardings: userOnboardings.filter(u => u.isOnboardingCompleted).length,
        portalEnabledOnboardings: userOnboardings.filter(u => u.customerPortalEnabled).length,
      },
    });
  } catch (error) {
    console.error('Error in debug endpoint:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
