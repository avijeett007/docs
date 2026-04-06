import { NextRequest, NextResponse } from 'next/server';
import { verifyCustomerAuth } from '@/lib/auth/customerAuth';
import { prisma } from '@/lib/prisma';
import { createCustomerApiKey, revokeApiKey } from '@/lib/apiKeys';
import { decrypt } from '@/lib/encryption';
import { hasApiKeyAccess } from '@/lib/customers';

export const dynamic = 'force-dynamic'; // Required to make the GET request work correctly

/**
 * GET /api/whitelabel/customer/api-keys
 * Get all API keys for the authenticated customer
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

    // Check if customer has API key access
    const hasAccess = await hasApiKeyAccess(customerAuth.customerId);

    if (!hasAccess) {
      return NextResponse.json(
        { error: 'API key access not enabled for this customer' },
        { status: 403 }
      );
    }

    // Get all API keys for this customer
    const apiKeys = await prisma.customerApiKey.findMany({
      where: {
        customerId: customerAuth.customerId,
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
 * POST /api/whitelabel/customer/api-keys
 * Create a new API key for the authenticated customer
 */
export async function POST(request: NextRequest) {
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

    // Parse request body
    const { name, description, expiresAt } = await request.json();

    // Validate required fields
    if (!name) {
      return NextResponse.json(
        { error: 'Name is required' },
        { status: 400 }
      );
    }

    // Create the API key
    const apiKey = await createCustomerApiKey(
      customerAuth.customerId,
      customerAuth.partnerId,
      name,
      description,
      expiresAt ? new Date(expiresAt) : undefined
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
    });
  } catch (error) {
    console.error('Error creating customer API key:', error);
    return NextResponse.json(
      { error: 'Failed to create API key' },
      { status: 500 }
    );
  }
}
