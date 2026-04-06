import { NextRequest, NextResponse } from 'next/server';
import { verifyCustomerAuth } from '@/lib/auth/customerAuth';
import { prisma } from '@/lib/prisma';
import { createCustomerApiKey } from '@/lib/apiKeys';
import { decrypt } from '@/lib/encryption';

// Define the return type for verifyCustomerAuth
interface CustomerAuthResult {
  customerId: string;
  credentialId: string;
  partnerId: string;
  email: string;
}

export const dynamic = 'force-dynamic';

// GET /api/whitelabel/[subdomain]/customer/api-keys
export async function GET(
  request: NextRequest,
  { params }: { params: { subdomain: string } }
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

    // Use the customerId directly from customerAuth
    const customerId = customerAuth.customerId;

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

    // Parse query parameters
    const url = new URL(request.url);
    const includeRevoked = url.searchParams.get('includeRevoked') === 'true';

    // Build the query
    const where: any = {
      customerId,
    };

    // Only include active keys by default
    if (!includeRevoked) {
      where.status = 'active';
    }

    // Get all API keys for this customer
    const apiKeys = await prisma.customerApiKey.findMany({
      where,
      orderBy: {
        createdAt: 'desc',
      },
    });

    // Return the API keys without the actual key
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
        allowedIps: key.allowedIps,
      })),
    });
  } catch (error) {
    console.error('Error fetching API keys:', error);
    return NextResponse.json(
      { error: 'Failed to fetch API keys' },
      { status: 500 }
    );
  }
}

// POST /api/whitelabel/[subdomain]/customer/api-keys
export async function POST(
  request: NextRequest,
  { params }: { params: { subdomain: string } }
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
    // We'll get the partnerId from the customer data to ensure it's correct

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

    // Get the customer data to verify
    const customerData = await prisma.customer.findUnique({
      where: {
        id: customerId,
      },
      include: {
        userOnboarding: {
          select: {
            partnerId: true,
          },
        },
      },
    });

    if (!customerData || !customerData.userOnboarding || !customerData.userOnboarding[0]?.partnerId) {
      return NextResponse.json(
        { error: 'Partner information not found for this customer' },
        { status: 404 }
      );
    }

    // Get the partnerId from the customer data
    const partnerIdFromDb = customerData.userOnboarding[0].partnerId;

    // Parse the request body
    const body = await request.json();
    const { name, description, expiresAt, rateLimit, dailyLimit, monthlyLimit, allowedIps } = body;

    // Validate required fields
    if (!name) {
      return NextResponse.json(
        { error: 'Name is required' },
        { status: 400 }
      );
    }

    // Create the API key
    const apiKeyRecord = await createCustomerApiKey(
      customerId,
      partnerIdFromDb,
      name,
      description,
      expiresAt ? new Date(expiresAt) : undefined,
      {
        rateLimit: rateLimit || undefined,
        dailyLimit: dailyLimit || undefined,
        monthlyLimit: monthlyLimit || undefined,
        allowedIps: allowedIps || undefined,
      }
    );

    // Get the decrypted API key
    const decryptedKey = await decrypt(apiKeyRecord.apiKey);

    return NextResponse.json({
      message: 'API key created successfully',
      apiKey: decryptedKey,
      prefix: apiKeyRecord.prefix,
    });
  } catch (error) {
    console.error('Error creating API key:', error);
    return NextResponse.json(
      { error: 'Failed to create API key' },
      { status: 500 }
    );
  }
}
