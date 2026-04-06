import { NextRequest, NextResponse } from 'next/server';
import { verifyCustomerAuth } from '@/lib/auth/customerAuth';
import { hasApiKeyAccess } from '@/lib/customers';

// This route uses cookies for authentication, so it must be dynamic
export const dynamic = 'force-dynamic';

/**
 * GET /api/whitelabel/customer/api-access
 * Check if the authenticated customer has API key access
 */
export async function GET(request: NextRequest) {
  try {
    // Verify customer authentication
    const customerAuth = await verifyCustomerAuth(request);

    if (!customerAuth) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    console.log('Customer auth for API access check:', customerAuth);

    // Check if customer has API key access
    const hasAccess = await hasApiKeyAccess(customerAuth.customerId);

    return NextResponse.json({
      hasApiAccess: hasAccess,
      customerId: customerAuth.customerId,
    });
  } catch (error) {
    console.error('Error checking API key access:', error);
    return NextResponse.json(
      { error: 'Failed to check API key access' },
      { status: 500 }
    );
  }
}
