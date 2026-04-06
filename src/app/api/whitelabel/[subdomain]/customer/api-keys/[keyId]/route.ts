import { NextRequest, NextResponse } from 'next/server';
import { verifyCustomerAuth } from '@/lib/auth/customerAuth';
import { prisma } from '@/lib/prisma';
import { revokeApiKey } from '@/lib/apiKeys';

// Define the return type for verifyCustomerAuth
interface CustomerAuthResult {
  customerId: string;
  credentialId: string;
  partnerId: string;
  email: string;
}

export const dynamic = 'force-dynamic';

// DELETE /api/whitelabel/[subdomain]/customer/api-keys/[keyId]
export async function DELETE(
  request: NextRequest,
  { params }: { params: { subdomain: string; keyId: string } }
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

    const customerId = customerAuth.customerId;
    const { keyId } = params;

    // Check if the customer has API access enabled
    const userOnboarding = await prisma.userOnboarding.findFirst({
      where: {
        customerId,
      },
    });

    if (!userOnboarding || !userOnboarding.enableApiAccess || !userOnboarding.showApiKeys) {
      return NextResponse.json(
        { error: 'API access not enabled for this customer' },
        { status: 403 }
      );
    }

    // Check if the API key exists and belongs to the customer
    const apiKey = await prisma.customerApiKey.findUnique({
      where: {
        id: keyId,
        customerId,
      },
    });

    if (!apiKey) {
      return NextResponse.json(
        { error: 'API key not found' },
        { status: 404 }
      );
    }

    // Revoke the API key
    await revokeApiKey(keyId, 'customer');

    return NextResponse.json({
      message: 'API key revoked successfully',
    });
  } catch (error) {
    console.error('Error revoking API key:', error);
    return NextResponse.json(
      { error: 'Failed to revoke API key' },
      { status: 500 }
    );
  }
}
