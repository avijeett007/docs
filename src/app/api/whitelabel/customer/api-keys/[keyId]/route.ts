import { NextRequest, NextResponse } from 'next/server';
import { verifyCustomerAuth } from '@/lib/auth/customerAuth';
import { prisma } from '@/lib/prisma';
import { revokeApiKey } from '@/lib/apiKeys';
import { hasApiKeyAccess } from '@/lib/customers';

export const dynamic = 'force-dynamic'; // Required to make the GET request work correctly

/**
 * DELETE /api/whitelabel/customer/api-keys/[keyId]
 * Revoke an API key
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { keyId: string } }
) {
  try {
    // Verify customer authentication
    const customerAuth = await verifyCustomerAuth(request);

    if (!customerAuth) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Check if customer has API key access
    const hasAccess = await hasApiKeyAccess(customerAuth.customerId);

    if (!hasAccess) {
      return NextResponse.json(
        { error: 'API key access not enabled for this customer' },
        { status: 403 }
      );
    }

    // Get the API key ID from the URL
    const keyId = params.keyId;

    // Check if the API key belongs to this customer
    const apiKey = await prisma.customerApiKey.findUnique({
      where: {
        id: keyId,
        customerId: customerAuth.customerId,
      },
    });

    if (!apiKey) {
      return NextResponse.json(
        { error: 'API key not found' },
        { status: 404 }
      );
    }

    // Revoke the API key
    const success = await revokeApiKey(keyId, 'customer');

    if (!success) {
      return NextResponse.json(
        { error: 'Failed to revoke API key' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      message: 'API key revoked successfully',
    });
  } catch (error) {
    console.error('Error revoking customer API key:', error);
    return NextResponse.json(
      { error: 'Failed to revoke API key' },
      { status: 500 }
    );
  }
}
