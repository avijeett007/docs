import { NextRequest, NextResponse } from 'next/server';
import { verifyCustomerAuth } from '@/lib/auth/customerAuth';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  // We need to include params in the function signature for Next.js routing
  // even though we don't use it in this function
  _: { params: { subdomain: string } }
) {
  try {
    // Verify customer authentication
    const customerAuth = await verifyCustomerAuth(request);
    if (!customerAuth) {
      return NextResponse.json(
        { error: 'Authentication failed' },
        { status: 401 }
      );
    }

    // Get the customer's onboarding data to check if API access is enabled
    const userOnboarding = await prisma.userOnboarding.findFirst({
      where: {
        customerId: customerAuth.customerId,
      },
    });

    if (!userOnboarding) {
      return NextResponse.json(
        { error: 'Customer onboarding data not found' },
        { status: 404 }
      );
    }

    // Check if API access is enabled
    const apiAccessEnabled = userOnboarding.enableApiAccess || false;
    const showApiKeys = userOnboarding.showApiKeys || false;

    return NextResponse.json({
      apiAccessEnabled,
      showApiKeys,
    });
  } catch (error) {
    console.error('Error checking API access:', error);
    return NextResponse.json(
      { error: 'Failed to check API access' },
      { status: 500 }
    );
  }
}
