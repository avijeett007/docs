import { NextRequest, NextResponse } from 'next/server';
import { verifyCustomerAuth } from '@/lib/auth/customerAuth';
import { prisma } from '@/lib/prisma';
import { renewApiKey } from '@/lib/apiKeys';
import { decrypt } from '@/lib/encryption';

// Define the return type for verifyCustomerAuth
interface CustomerAuthResult {
  customerId: string;
  credentialId: string;
  partnerId: string;
  email: string;
}

export const dynamic = 'force-dynamic';

// PUT /api/whitelabel/[subdomain]/customer/api-keys/[keyId]/renew
export async function PUT(
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

    // Renew the API key
    const newApiKeyRecord = await renewApiKey(keyId, 'customer');

    if (!newApiKeyRecord) {
      return NextResponse.json(
        { error: 'Failed to renew API key' },
        { status: 500 }
      );
    }

    // Get the decrypted API key
    const decryptedKey = await decrypt(newApiKeyRecord.apiKey);

    return NextResponse.json({
      message: 'API key renewed successfully',
      apiKey: decryptedKey,
    });
  } catch (error) {
    console.error('Error renewing API key:', error);
    return NextResponse.json(
      { error: 'Failed to renew API key' },
      { status: 500 }
    );
  }
}
