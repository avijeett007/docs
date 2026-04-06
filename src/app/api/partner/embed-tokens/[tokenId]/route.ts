import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyJWT } from '@/lib/jwt';
import { cookies } from 'next/headers';
import { randomUUID } from 'crypto';

// Helper function to generate embed URL using partner's whitelabel domain
function generateEmbedUrl(token: string, partner: any): string {
  if (partner.customDomain && partner.customDomainVerified) {
    // Use verified custom domain
    return `https://${partner.customDomain}/whitelabel/embed/${token}`;
  } else if (partner.subdomain) {
    // Use subdomain
    const baseUrl = process.env.NODE_ENV === 'production'
      ? 'knotie-ai.pro'
      : 'localhost:3000';
    const protocol = process.env.NODE_ENV === 'production' ? 'https' : 'http';
    return `${protocol}://${partner.subdomain}.${baseUrl}/whitelabel/embed/${token}`;
  } else {
    // Fallback to main domain (shouldn't happen if whitelabel is properly configured)
    const baseUrl = process.env.NODE_ENV === 'production'
      ? 'https://knotie-ai.pro'
      : 'http://localhost:3000';
    return `${baseUrl}/whitelabel/embed/${token}`;
  }
}

// Mark this route as dynamic
export const dynamic = 'force-dynamic';

// GET /api/partner/embed-tokens/[tokenId]
// Get a specific embed token
export async function GET(
  request: NextRequest,
  { params }: { params: { tokenId: string } }
) {
  try {
    // Verify partner authentication
    const cookieStore = cookies();
    const token = cookieStore.get('partner_token')?.value;

    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const payload = await verifyJWT(token);
    if (!payload || !payload.email) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    // Get partner using the JWT token's email
    const partner = await prisma.partner.findFirst({
      where: {
        AND: [
          { emailAddress: payload.email },
          { approvalStatus: 'ACTIVE' }
        ]
      }
    });

    if (!partner) {
      return NextResponse.json({ error: 'Partner not found or not approved' }, { status: 403 });
    }

    const partnerId = partner.id;
    const { tokenId } = params;

    // Fetch the embed token
    const embedToken = await prisma.embedToken.findFirst({
      where: {
        id: tokenId,
        partnerId: partnerId,
      },
      include: {
        customer: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        customerCredential: {
          select: {
            id: true,
            email: true,
          },
        },
        partner: {
          select: {
            id: true,
            businessName: true,
            subdomain: true,
            customDomain: true,
            customDomainVerified: true,
          },
        },
      },
    });

    if (!embedToken) {
      return NextResponse.json(
        { error: 'Embed token not found' },
        { status: 404 }
      );
    }

    // Generate the embed URL using partner's whitelabel domain
    const embedUrl = generateEmbedUrl(embedToken.token, embedToken.partner);

    return NextResponse.json({
      embedToken: {
        id: embedToken.id,
        token: embedToken.token,
        name: embedToken.name,
        customerId: embedToken.customerId,
        customerName: `${embedToken.customer.firstName || ''} ${embedToken.customer.lastName || ''}`.trim() || embedToken.customer.email,
        customerEmail: embedToken.customer.email,
        allowedDomains: embedToken.allowedDomains,
        accessMode: embedToken.accessMode,
        status: embedToken.status,
        expiresAt: embedToken.expiresAt,
        lastAccessedAt: embedToken.lastAccessedAt,
        accessCount: embedToken.accessCount,
        createdAt: embedToken.createdAt,
        updatedAt: embedToken.updatedAt,
        revokedAt: embedToken.revokedAt,
        revokedBy: embedToken.revokedBy,
        embedUrl: embedUrl,
      },
    });
  } catch (error) {
    console.error('Error fetching embed token:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// PATCH /api/partner/embed-tokens/[tokenId]
// Update an embed token (revoke, regenerate, etc.)
export async function PATCH(
  request: NextRequest,
  { params }: { params: { tokenId: string } }
) {
  try {
    // Verify partner authentication
    const cookieStore = cookies();
    const token = cookieStore.get('partner_token')?.value;

    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const payload = await verifyJWT(token);
    if (!payload || !payload.email) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    // Get partner using the JWT token's email
    const partner = await prisma.partner.findFirst({
      where: {
        AND: [
          { emailAddress: payload.email },
          { approvalStatus: 'ACTIVE' }
        ]
      }
    });

    if (!partner) {
      return NextResponse.json({ error: 'Partner not found or not approved' }, { status: 403 });
    }

    const partnerId = partner.id;
    const { tokenId } = params;

    // Parse request body
    const body = await request.json();
    const { action, name, allowedDomains, accessMode, expiresAt } = body;

    // Fetch the embed token
    const embedToken = await prisma.embedToken.findFirst({
      where: {
        id: tokenId,
        partnerId: partnerId,
      },
      include: {
        customer: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        partner: {
          select: {
            id: true,
            businessName: true,
            subdomain: true,
            customDomain: true,
            customDomainVerified: true,
          },
        },
      },
    });

    if (!embedToken) {
      return NextResponse.json(
        { error: 'Embed token not found' },
        { status: 404 }
      );
    }

    let updatedToken;

    if (action === 'revoke') {
      // Revoke the token
      updatedToken = await prisma.embedToken.update({
        where: { id: tokenId },
        data: {
          status: 'revoked',
          revokedAt: new Date(),
          revokedBy: payload.email || 'partner',
        },
        include: {
          customer: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
            },
          },
          partner: {
            select: {
              id: true,
              businessName: true,
              subdomain: true,
              customDomain: true,
              customDomainVerified: true,
            },
          },
        },
      });
    } else if (action === 'regenerate') {
      // Generate a new token and update
      const newToken = randomUUID();
      
      updatedToken = await prisma.embedToken.update({
        where: { id: tokenId },
        data: {
          token: newToken,
          status: 'active',
          revokedAt: null,
          revokedBy: null,
          lastAccessedAt: null,
          accessCount: 0,
          updatedAt: new Date(),
        },
        include: {
          customer: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
            },
          },
          partner: {
            select: {
              id: true,
              businessName: true,
              subdomain: true,
              customDomain: true,
              customDomainVerified: true,
            },
          },
        },
      });
    } else if (action === 'update') {
      // Update token properties
      const updateData: any = {};

      if (name !== undefined) updateData.name = name;
      if (allowedDomains !== undefined) updateData.allowedDomains = allowedDomains;
      if (accessMode !== undefined) {
        if (!['full', 'readonly', 'lite'].includes(accessMode)) {
          return NextResponse.json(
            { error: 'Invalid access mode. Must be full, readonly, or lite' },
            { status: 400 }
          );
        }
        updateData.accessMode = accessMode;
      }
      if (expiresAt !== undefined) {
        if (expiresAt) {
          const expirationDate = new Date(expiresAt);
          if (expirationDate <= new Date()) {
            return NextResponse.json(
              { error: 'Expiration date must be in the future' },
              { status: 400 }
            );
          }
          updateData.expiresAt = expirationDate;
        } else {
          updateData.expiresAt = null;
        }
      }

      updatedToken = await prisma.embedToken.update({
        where: { id: tokenId },
        data: updateData,
        include: {
          customer: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
            },
          },
          partner: {
            select: {
              id: true,
              businessName: true,
              subdomain: true,
              customDomain: true,
              customDomainVerified: true,
            },
          },
        },
      });
    } else {
      return NextResponse.json(
        { error: 'Invalid action. Must be revoke, regenerate, or update' },
        { status: 400 }
      );
    }

    // Generate the embed URL using partner's whitelabel domain
    const embedUrl = generateEmbedUrl(updatedToken.token, updatedToken.partner);

    return NextResponse.json({
      embedToken: {
        id: updatedToken.id,
        token: updatedToken.token,
        name: updatedToken.name,
        customerId: updatedToken.customerId,
        customerName: `${updatedToken.customer.firstName || ''} ${updatedToken.customer.lastName || ''}`.trim() || updatedToken.customer.email,
        customerEmail: updatedToken.customer.email,
        allowedDomains: updatedToken.allowedDomains,
        accessMode: updatedToken.accessMode,
        status: updatedToken.status,
        expiresAt: updatedToken.expiresAt,
        lastAccessedAt: updatedToken.lastAccessedAt,
        accessCount: updatedToken.accessCount,
        createdAt: updatedToken.createdAt,
        updatedAt: updatedToken.updatedAt,
        revokedAt: updatedToken.revokedAt,
        revokedBy: updatedToken.revokedBy,
        embedUrl: embedUrl,
      },
    });
  } catch (error) {
    console.error('Error updating embed token:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// DELETE /api/partner/embed-tokens/[tokenId]
// Delete an embed token permanently
export async function DELETE(
  request: NextRequest,
  { params }: { params: { tokenId: string } }
) {
  try {
    // Verify partner authentication
    const cookieStore = cookies();
    const token = cookieStore.get('partner_token')?.value;

    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const payload = await verifyJWT(token);
    if (!payload || !payload.email) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    // Get partner using the JWT token's email
    const partner = await prisma.partner.findFirst({
      where: {
        AND: [
          { emailAddress: payload.email },
          { approvalStatus: 'ACTIVE' }
        ]
      }
    });

    if (!partner) {
      return NextResponse.json({ error: 'Partner not found or not approved' }, { status: 403 });
    }

    const partnerId = partner.id;
    const { tokenId } = params;

    // Verify the token belongs to this partner
    const embedToken = await prisma.embedToken.findFirst({
      where: {
        id: tokenId,
        partnerId: partnerId,
      },
    });

    if (!embedToken) {
      return NextResponse.json(
        { error: 'Embed token not found' },
        { status: 404 }
      );
    }

    // Delete the token
    await prisma.embedToken.delete({
      where: { id: tokenId },
    });

    return NextResponse.json({
      message: 'Embed token deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting embed token:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
