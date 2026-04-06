import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { verifyPartnerToken } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import crypto from 'crypto';

// Utility function to create secure token hash
function createTokenHash(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex').substring(0, 32);
}

// Validation schemas
const createTokenSchema = z.object({
  customerId: z.string().min(1, 'Customer ID is required'),
  scope: z.union([
    z.literal('all'),
    z.array(z.object({
      appName: z.string().min(1),
      toolName: z.string().min(1)
    })).min(1, 'At least one tool must be selected')
  ]),
  name: z.string().min(1, 'Token name is required'),
  description: z.string().max(500, 'Description must be less than 500 characters').optional(),
  expiresIn: z.number().optional(), // seconds
  usageLimit: z.number().optional() // requests per hour
});

/**
 * POST /api/partner/n8n-tokens
 * Create a new N8N token for a partner
 */
export async function POST(request: NextRequest) {
  try {
    // Verify partner authentication
    const authResult = await verifyPartnerToken(request);
    if (!authResult.success || !authResult.partner) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const partner = authResult.partner;
    const body = await request.json();
    const { customerId, scope, name, description, expiresIn, usageLimit } = createTokenSchema.parse(body);

    // Sanitize description input
    const sanitizedDescription = description?.trim().replace(/[<>]/g, '') || null;

    // Verify customer belongs to this partner
    // customerId is now the actual Customer.id from the frontend (following RetellAgentModal pattern)
    const customer = await prisma.userOnboarding.findFirst({
      where: {
        customerId: customerId, // customerId is the actual Customer.id
        partnerId: partner.id
      }
    });

    if (!customer) {
      return NextResponse.json(
        { success: false, error: 'Customer not found or not accessible' },
        { status: 404 }
      );
    }

    // Generate token via ConnectHub
    const connectHubUrl = process.env.CONNECT_HUB_URL;
    if (!connectHubUrl) {
      return NextResponse.json(
        { success: false, error: 'ConnectHub not configured' },
        { status: 500 }
      );
    }

    const requestPayload = {
      partnerId: partner.id,
      customerId: customerId, // customerId is already the actual Customer.id
      scope,
      options: {
        expiresIn: expiresIn || 2592000, // 30 days default
        usageLimit: usageLimit || 1000, // 1000 requests/hour default
        tokenType: 'n8n',
        metadata: {
          name,
          description: sanitizedDescription || undefined, // Convert null to undefined for Zod
          createdBy: partner.id
        }
      }
    };

    // console.log('Sending to ConnectHub:', JSON.stringify(requestPayload, null, 2)); // Debug logging

    const tokenResponse = await fetch(`${connectHubUrl}/api/tokens/multi-tool`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.CONNECT_HUB_API_KEY || ''}`
      },
      body: JSON.stringify(requestPayload)
    });

    if (!tokenResponse.ok) {
      const errorData = await tokenResponse.json().catch(() => ({ error: 'Unknown error' }));
      return NextResponse.json(
        { success: false, error: errorData.error || 'Failed to generate token' },
        { status: 500 }
      );
    }

    const tokenData = await tokenResponse.json();

    // Validate Connect Hub response structure
    if (!tokenData.success || !tokenData.token || !tokenData.metadata?.expiresAt) {
      return NextResponse.json(
        { success: false, error: 'Invalid response from Connect Hub' },
        { status: 500 }
      );
    }

    // Store token metadata in database
    // Use UserOnboarding ID for database storage (existing schema)
    // customerId sent to ConnectHub is Customer.id, but we store UserOnboarding.id in database
    const tokenRecord = await prisma.n8nToken.create({
      data: {
        partnerId: partner.id,
        customerId: customer.id, // Use UserOnboarding ID for database storage
        name,
        description: sanitizedDescription,
        scope: JSON.stringify(scope),
        tokenHash: createTokenHash(tokenData.token), // ✅ SECURITY FIX: Use proper hash instead of substring
        tokenType: 'n8n', // Explicitly set token type for N8N tokens
        expiresAt: new Date(tokenData.metadata.expiresAt),
        usageLimit: usageLimit || 1000,
        isActive: true
      }
    });

    return NextResponse.json({
      success: true,
      data: {
        id: tokenRecord.id,
        token: tokenData.token, // Return full token only on creation
        name: tokenRecord.name,
        description: tokenRecord.description,
        scope: scope,
        expiresAt: tokenRecord.expiresAt,
        usageLimit: tokenRecord.usageLimit,
        createdAt: tokenRecord.createdAt
      }
    });

  } catch (error: any) {
    console.error('N8N token creation error:', error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: 'Validation error', details: error.errors },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/partner/n8n-tokens
 * List all N8N tokens for a partner
 */
export async function GET(request: NextRequest) {
  try {
    // Verify partner authentication
    const authResult = await verifyPartnerToken(request);
    if (!authResult.success || !authResult.partner) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const partner = authResult.partner;
    const { searchParams } = new URL(request.url);
    const customerId = searchParams.get('customerId');

    // Build where clause - filter by tokenType: 'n8n'
    // Note: Legacy tokens have default 'n8n' tokenType, so no need for null check
    const whereClause: any = {
      partnerId: partner.id,
      isActive: true,
      tokenType: 'n8n'
    };

    if (customerId) {
      whereClause.customerId = customerId;
    }

    // Get tokens with customer info
    const tokens = await prisma.n8nToken.findMany({
      where: whereClause,
      include: {
        customer: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            companyName: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    const formattedTokens = tokens.map(token => ({
      id: token.id,
      name: token.name,
      description: token.description,
      scope: JSON.parse(token.scope as string),
      tokenHash: token.tokenHash, // Partial hash only
      expiresAt: token.expiresAt,
      usageLimit: token.usageLimit,
      isActive: token.isActive,
      createdAt: token.createdAt,
      customer: token.customer
    }));

    return NextResponse.json({
      success: true,
      data: formattedTokens
    });

  } catch (error: any) {
    console.error('N8N token listing error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
