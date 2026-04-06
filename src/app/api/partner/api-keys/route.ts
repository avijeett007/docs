import { NextRequest, NextResponse } from 'next/server';
import { verifyPartnerAuth } from '@/lib/auth/partnerAuth';
import { prisma } from '@/lib/prisma';
import { createPartnerApiKey, revokeApiKey, renewApiKey } from '@/lib/apiKeys';
import { decrypt } from '@/lib/encryption';

export const dynamic = 'force-dynamic'; // Required to make the GET request work correctly

/**
 * GET /api/partner/api-keys
 * Get all API keys for the authenticated partner
 */
export async function GET(request: NextRequest) {
  try {
    // Verify partner authentication
    const partner = await verifyPartnerAuth(request);

    if (!partner) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get API keys for this partner
    // Parse query parameters
    const url = new URL(request.url);
    const includeRevoked = url.searchParams.get('includeRevoked') === 'true';

    // Build the query
    const where: any = {
      partnerId: partner.id,
    };

    // Only include active keys by default
    if (!includeRevoked) {
      where.status = 'active';
    }

    const apiKeys = await prisma.partnerApiKey.findMany({
      where,
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
    console.error('Error getting partner API keys:', error);
    return NextResponse.json(
      { error: 'Failed to get API keys' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/partner/api-keys
 * Create a new API key for the authenticated partner
 */
export async function POST(request: NextRequest) {
  try {
    // Verify partner authentication
    const partner = await verifyPartnerAuth(request);

    if (!partner) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
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
    const apiKey = await createPartnerApiKey(
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
    console.error('Error creating partner API key:', error);
    return NextResponse.json(
      { error: 'Failed to create API key' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/partner/api-keys/:id
 * Revoke an API key
 */
export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    // Verify partner authentication
    const partner = await verifyPartnerAuth(request);

    if (!partner) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get the API key ID from the URL
    const keyId = params.id;

    // Check if the API key belongs to this partner
    const apiKey = await prisma.partnerApiKey.findUnique({
      where: {
        id: keyId,
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
    const success = await revokeApiKey(keyId, 'partner');

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
    console.error('Error revoking partner API key:', error);
    return NextResponse.json(
      { error: 'Failed to revoke API key' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/partner/api-keys/:id/renew
 * Renew an API key
 */
export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    // Verify partner authentication
    const partner = await verifyPartnerAuth(request);

    if (!partner) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get the API key ID from the URL
    const keyId = params.id;

    // Check if the API key belongs to this partner
    const apiKey = await prisma.partnerApiKey.findUnique({
      where: {
        id: keyId,
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
    const newApiKey = await renewApiKey(keyId, 'partner');

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
    console.error('Error renewing partner API key:', error);
    return NextResponse.json(
      { error: 'Failed to renew API key' },
      { status: 500 }
    );
  }
}
