import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { verifyPartnerToken } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import crypto from 'crypto';

// Utility function to create secure token hash
function createTokenHash(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex').substring(0, 32);
}

// Error response helper
function errorResponse(message: string, status: number, details?: any) {
  console.error(`[MCP-TOKEN-API] Error (${status}):`, message, details || '');
  return NextResponse.json(
    { success: false, error: message, ...(details && { details }) },
    { status }
  );
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
 * POST /api/partner/mcp-tokens
 * Create a new MCP token for a partner
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
    const customer = await prisma.userOnboarding.findFirst({
      where: {
        customerId: customerId,
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
      customerId: customerId,
      scope,
      options: {
        expiresIn: expiresIn || 2592000, // 30 days default
        usageLimit: usageLimit || 1000, // 1000 requests/hour default
        tokenType: 'mcp', // MCP token type
        metadata: {
          name,
          description: sanitizedDescription || undefined,
          createdBy: partner.id
        }
      }
    };

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
    const tokenRecord = await prisma.n8nToken.create({
      data: {
        partnerId: partner.id,
        customerId: customer.id,
        name,
        description: sanitizedDescription,
        scope: JSON.stringify(scope),
        tokenHash: createTokenHash(tokenData.token),
        tokenType: 'mcp', // MCP token type
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
    console.error('[MCP-TOKEN-API] Token creation error:', {
      message: error?.message,
      stack: error?.stack,
      name: error?.name,
      code: error?.code
    });

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: 'Validation error', details: error.errors },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { success: false, error: error?.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/partner/mcp-tokens
 * List all MCP tokens for a partner
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

    // Build where clause - filter by tokenType: 'mcp'
    const whereClause: any = {
      partnerId: partner.id,
      tokenType: 'mcp',
      isActive: true
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
      tokenHash: token.tokenHash,
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
    console.error('MCP token listing error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

