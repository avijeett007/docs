import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { verifyPartnerToken } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

// Validation schemas
const updateTokenSchema = z.object({
  name: z.string().min(1, 'Token name is required').optional(),
  description: z.string().optional(),
  isActive: z.boolean().optional()
});

/**
 * GET /api/partner/mcp-tokens/[tokenId]
 * Get a specific MCP token
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { tokenId: string } }
) {
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
    const { tokenId } = params;

    // Get token with customer info - filter by tokenType: 'mcp'
    const token = await prisma.n8nToken.findFirst({
      where: {
        id: tokenId,
        partnerId: partner.id,
        tokenType: 'mcp'
      },
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
      }
    });

    if (!token) {
      return NextResponse.json(
        { success: false, error: 'Token not found' },
        { status: 404 }
      );
    }

    const formattedToken = {
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
    };

    return NextResponse.json({
      success: true,
      data: formattedToken
    });

  } catch (error: any) {
    console.error('MCP token retrieval error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/partner/mcp-tokens/[tokenId]
 * Update a specific MCP token
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { tokenId: string } }
) {
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
    const { tokenId } = params;
    const body = await request.json();
    const updateData = updateTokenSchema.parse(body);

    // Check if token exists and belongs to partner - filter by tokenType: 'mcp'
    const existingToken = await prisma.n8nToken.findFirst({
      where: {
        id: tokenId,
        partnerId: partner.id,
        tokenType: 'mcp'
      }
    });

    if (!existingToken) {
      return NextResponse.json(
        { success: false, error: 'Token not found' },
        { status: 404 }
      );
    }

    // Update token
    const updatedToken = await prisma.n8nToken.update({
      where: {
        id: tokenId
      },
      data: {
        ...updateData,
        updatedAt: new Date()
      },
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
      }
    });

    const formattedToken = {
      id: updatedToken.id,
      name: updatedToken.name,
      description: updatedToken.description,
      scope: JSON.parse(updatedToken.scope as string),
      tokenHash: updatedToken.tokenHash,
      expiresAt: updatedToken.expiresAt,
      usageLimit: updatedToken.usageLimit,
      isActive: updatedToken.isActive,
      createdAt: updatedToken.createdAt,
      updatedAt: updatedToken.updatedAt,
      customer: updatedToken.customer
    };

    return NextResponse.json({
      success: true,
      data: formattedToken
    });
  } catch (error: any) {
    console.error('MCP token update error:', error);

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
 * DELETE /api/partner/mcp-tokens/[tokenId]
 * Revoke/delete a specific MCP token
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { tokenId: string } }
) {
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
    const { tokenId } = params;

    // Check if token exists and belongs to partner - filter by tokenType: 'mcp'
    const existingToken = await prisma.n8nToken.findFirst({
      where: {
        id: tokenId,
        partnerId: partner.id,
        tokenType: 'mcp'
      }
    });

    if (!existingToken) {
      return NextResponse.json(
        { success: false, error: 'Token not found' },
        { status: 404 }
      );
    }

    // Soft delete by marking as inactive and setting revoked timestamp
    const revokedToken = await prisma.n8nToken.update({
      where: {
        id: tokenId
      },
      data: {
        isActive: false,
        revokedAt: new Date(),
        updatedAt: new Date()
      }
    });

    return NextResponse.json({
      success: true,
      message: 'Token revoked successfully',
      data: {
        id: revokedToken.id,
        revokedAt: revokedToken.revokedAt
      }
    });

  } catch (error: any) {
    console.error('MCP token deletion error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

