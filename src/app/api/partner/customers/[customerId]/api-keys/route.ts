import { NextRequest, NextResponse } from 'next/server';
import { verifyPartnerAuth } from '@/lib/auth/partnerAuth';
import { prisma } from '@/lib/prisma';
import { createCustomerApiKey, revokeApiKey, renewApiKey } from '@/lib/apiKeys';
import { decrypt } from '@/lib/encryption';

export const dynamic = 'force-dynamic'; // Required to make the GET request work correctly

/**
 * GET /api/partner/customers/[customerId]/api-keys
 * Get all API keys for a specific customer
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { customerId: string } }
) {
  try {
    // Verify partner authentication
    const partner = await verifyPartnerAuth(request);

    if (!partner) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { customerId } = params;

    // Verify the customer belongs to this partner
    const customer = await prisma.customer.findFirst({
      where: {
        id: customerId,
        userOnboarding: {
          some: {
            partnerId: partner.id
          }
        }
      }
    });

    if (!customer) {
      return NextResponse.json(
        { error: 'Customer not found or does not belong to this partner' },
        { status: 404 }
      );
    }

    // Get all API keys for this customer
    const apiKeys = await prisma.customerApiKey.findMany({
      where: {
        customerId: customer.id,
        partnerId: partner.id,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    // Return the API keys (without the encrypted key)
    return NextResponse.json({
      apiKeys: apiKeys.map(key => ({
        id: key.id,
        name: key.name,
        description: key.description,
        prefix: key.prefix,
        status: key.status,
        expiresAt: key.expiresAt,
        lastUsedAt: key.lastUsedAt,
        createdAt: key.createdAt,
        rateLimit: key.rateLimit,
        dailyLimit: key.dailyLimit,
        monthlyLimit: key.monthlyLimit,
        usageCount: key.usageCount,
        dailyUsage: key.dailyUsage,
        monthlyUsage: key.monthlyUsage,
      }))
    });
  } catch (error) {
    console.error('Error getting customer API keys:', error);
    return NextResponse.json(
      { error: 'Failed to get API keys' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/partner/customers/[customerId]/api-keys
 * Create a new API key for a specific customer
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { customerId: string } }
) {
  try {
    // Verify partner authentication
    const partner = await verifyPartnerAuth(request);

    if (!partner) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { customerId } = params;

    // Verify the customer belongs to this partner
    const customer = await prisma.customer.findFirst({
      where: {
        id: customerId,
        userOnboarding: {
          some: {
            partnerId: partner.id
          }
        }
      }
    });

    if (!customer) {
      return NextResponse.json(
        { error: 'Customer not found or does not belong to this partner' },
        { status: 404 }
      );
    }

    // Parse request body
    const { name, description, expiresAt, rateLimit, dailyLimit, monthlyLimit, allowedIps } = await request.json();

    // Validate required fields
    if (!name) {
      return NextResponse.json(
        { error: 'Name is required' },
        { status: 400 }
      );
    }

    // Create the API key
    const apiKey = await createCustomerApiKey(
      customer.id,
      partner.id,
      name,
      description,
      expiresAt ? new Date(expiresAt) : undefined,
      {
        rateLimit,
        dailyLimit,
        monthlyLimit,
        allowedIps,
      }
    );

    // Decrypt the API key to return to the client
    const decryptedApiKey = await decrypt(apiKey.apiKey);

    // Return the API key details
    return NextResponse.json({
      id: apiKey.id,
      name: apiKey.name,
      description: apiKey.description,
      prefix: apiKey.prefix,
      apiKey: decryptedApiKey, // Only return the full API key on creation
      status: apiKey.status,
      expiresAt: apiKey.expiresAt,
      createdAt: apiKey.createdAt,
      rateLimit: apiKey.rateLimit,
      dailyLimit: apiKey.dailyLimit,
      monthlyLimit: apiKey.monthlyLimit,
    });
  } catch (error) {
    console.error('Error creating customer API key:', error);
    return NextResponse.json(
      { error: 'Failed to create API key' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/partner/customers/[customerId]/api-keys/[keyId]
 * Revoke a customer API key
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { customerId: string; keyId: string } }
) {
  try {
    // Verify partner authentication
    const partner = await verifyPartnerAuth(request);

    if (!partner) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { customerId, keyId } = params;

    // Verify the customer belongs to this partner
    const customer = await prisma.customer.findFirst({
      where: {
        id: customerId,
        userOnboarding: {
          some: {
            partnerId: partner.id
          }
        }
      }
    });

    if (!customer) {
      return NextResponse.json(
        { error: 'Customer not found or does not belong to this partner' },
        { status: 404 }
      );
    }

    // Check if the API key belongs to this customer and partner
    const apiKey = await prisma.customerApiKey.findUnique({
      where: {
        id: keyId,
        customerId: customer.id,
        partnerId: partner.id,
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

/**
 * PUT /api/partner/customers/[customerId]/api-keys/[keyId]/renew
 * Renew a customer API key
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: { customerId: string; keyId: string } }
) {
  try {
    // Verify partner authentication
    const partner = await verifyPartnerAuth(request);

    if (!partner) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { customerId, keyId } = params;

    // Verify the customer belongs to this partner
    const customer = await prisma.customer.findFirst({
      where: {
        id: customerId,
        userOnboarding: {
          some: {
            partnerId: partner.id
          }
        }
      }
    });

    if (!customer) {
      return NextResponse.json(
        { error: 'Customer not found or does not belong to this partner' },
        { status: 404 }
      );
    }

    // Check if the API key belongs to this customer and partner
    const apiKey = await prisma.customerApiKey.findUnique({
      where: {
        id: keyId,
        customerId: customer.id,
        partnerId: partner.id,
      },
    });

    if (!apiKey) {
      return NextResponse.json(
        { error: 'API key not found' },
        { status: 404 }
      );
    }

    // Renew the API key
    const newApiKey = await renewApiKey(keyId, 'customer');

    if (!newApiKey) {
      return NextResponse.json(
        { error: 'Failed to renew API key' },
        { status: 500 }
      );
    }

    // Decrypt the API key to return to the client
    const decryptedApiKey = await decrypt(newApiKey.apiKey);

    return NextResponse.json({
      id: newApiKey.id,
      name: newApiKey.name,
      description: newApiKey.description,
      prefix: newApiKey.prefix,
      apiKey: decryptedApiKey, // Only return the full API key on renewal
      status: newApiKey.status,
      expiresAt: newApiKey.expiresAt,
      createdAt: newApiKey.createdAt,
      rateLimit: newApiKey.rateLimit,
      dailyLimit: newApiKey.dailyLimit,
      monthlyLimit: newApiKey.monthlyLimit,
    });
  } catch (error) {
    console.error('Error renewing customer API key:', error);
    return NextResponse.json(
      { error: 'Failed to renew API key' },
      { status: 500 }
    );
  }
}
