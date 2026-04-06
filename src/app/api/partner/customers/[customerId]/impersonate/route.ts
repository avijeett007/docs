import { NextRequest, NextResponse } from 'next/server';

// This route uses dynamic features, so it must be server-rendered
export const dynamic = 'force-dynamic';

import { prisma } from '@/lib/prisma';
import { verifyPartnerAuth } from '@/lib/auth/partnerAuth';
import { createImpersonationToken } from '@/lib/customerJwt';
import { checkMCPAuthIfPresent, PERMISSIONS } from '@/lib/auth/mcpAuthHelper';
import { AuditTrailService } from '@/lib/billing/auditTrail';

/**
 * API route to create impersonation token for partner to preview customer portal
 * This generates a temporary customer JWT token with impersonation context
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { customerId: string } }
) {
  try {
    console.log('Impersonation API called for customer ID:', params.customerId);

    // Check for MCP authentication first
    const mcpAuth = await checkMCPAuthIfPresent(request, PERMISSIONS.CUSTOMER_PORTAL);

    // Handle MCP authentication errors
    if (mcpAuth.isMCP && mcpAuth.error) {
      return NextResponse.json({
        error: 'MCP Authentication Failed',
        message: mcpAuth.error
      }, { status: 401 });
    }

    let partner;

    if (mcpAuth.isMCP && !mcpAuth.error) {
      // Handle MCP request - find partner by ID
      partner = await prisma.partner.findFirst({
        where: {
          AND: [
            { id: mcpAuth.partnerId },
            { approvalStatus: 'ACTIVE' }
          ]
        }
      });

      if (!partner) {
        return NextResponse.json({
          error: 'Partner not found or not active',
          message: 'MCP partner account not found or not active.'
        }, { status: 403 });
      }
    } else {
      // Handle regular JWT request
      partner = await verifyPartnerAuth(request);
      if (!partner) {
        console.log('Partner authentication failed');
        return NextResponse.json(
          { error: 'Unauthorized' },
          { status: 401 }
        );
      }
    }

    console.log('Partner authenticated successfully:', partner.id);

    const { customerId } = params;

    // Verify that the customer is associated with this partner through UserOnboarding
    console.log(`Looking for customer with ID: ${customerId} for partner: ${partner.id}`);

    const userOnboarding = await prisma.userOnboarding.findFirst({
      where: {
        partnerId: partner.id,
        id: customerId
      },
      include: {
        partner: {
          select: {
            businessName: true,
            subdomain: true,
            customDomain: true,
            customDomainVerified: true
          }
        }
      }
    });

    if (!userOnboarding) {
      console.log(`UserOnboarding with ID ${customerId} not found for partner ${partner.id}`);
      return NextResponse.json(
        { error: 'Customer not found or not associated with this partner' },
        { status: 404 }
      );
    }

    // Check if customer portal is enabled
    if (!userOnboarding.customerPortalEnabled) {
      return NextResponse.json(
        { error: 'Customer portal is not enabled for this customer' },
        { status: 403 }
      );
    }

    // Get the Customer record
    const customer = await prisma.customer.findFirst({
      where: {
        userId: userOnboarding.userId
      }
    });

    if (!customer) {
      return NextResponse.json(
        { error: 'Customer record not found' },
        { status: 404 }
      );
    }

    // Get customer credentials for this partner
    const customerCredential = await prisma.customerCredential.findFirst({
      where: {
        customerId: customer.id,
        partnerId: partner.id,
        status: 'active'
      }
    });

    if (!customerCredential) {
      return NextResponse.json(
        { error: 'Customer credentials not found or inactive' },
        { status: 404 }
      );
    }

    // Create impersonation token (30 minutes expiration)
    const { token, sessionId } = await createImpersonationToken(
      customer.id,
      customerCredential.id,
      partner.id,
      customer.email,
      partner.id, // impersonatedBy
      30 // 30 minutes
    );

    // Determine the portal URL based on environment
    let portalUrl;
    const partnerData = userOnboarding.partner;
    const isDevelopment = process.env.NODE_ENV === 'development';
    const isPreviewMode = process.env.NEXT_PUBLIC_PREVIEW_MODE === 'development';

    if (isDevelopment || isPreviewMode) {
      // Development mode: use lvh.me with subdomain for local testing
      const devPort = process.env.PORT || '3000';
      if (partnerData?.subdomain) {
        portalUrl = `http://${partnerData.subdomain}.lvh.me:${devPort}`;
      } else {
        // Fallback to main lvh.me domain
        portalUrl = `http://lvh.me:${devPort}`;
      }
    } else {
      // Production mode: use actual domains
      if (partnerData?.customDomainVerified && partnerData?.customDomain) {
        portalUrl = `https://${partnerData.customDomain}`;
      } else if (partnerData?.subdomain) {
        portalUrl = `https://${partnerData.subdomain}.knotie-ai.pro`;
      } else {
        // Fallback to main domain
        portalUrl = `https://knotie-ai.pro`;
      }
    }

    // Return base portal URL for secure popup (token will be passed via postMessage)
    const impersonationUrl = `${portalUrl}/whitelabel/secure-preview`;

    // Log impersonation session start for audit trail
    console.log(`Impersonation session started:`, {
      sessionId,
      partnerId: partner.id,
      customerId: customer.id,
      customerEmail: customer.email,
      portalUrl: impersonationUrl
    });

    // Store impersonation session start in audit table
    try {
      await AuditTrailService.logImpersonationStart(
        sessionId,
        partner.id,
        customer.id,
        customer.email,
        impersonationUrl,
        request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || undefined,
        request.headers.get('user-agent') || undefined
      );
    } catch (auditError) {
      console.error('Failed to log impersonation start:', auditError);
      // Don't fail the request if audit logging fails
    }

    // Always provide URL with token as fallback for cross-domain postMessage issues
    const fallbackUrl = `${impersonationUrl}?token=${encodeURIComponent(token)}`;

    return NextResponse.json({
      success: true,
      impersonationUrl: fallbackUrl, // URL with token for development fallback
      baseUrl: impersonationUrl, // Clean URL for postMessage approach
      token: token, // Send token separately for secure postMessage
      sessionId,
      expiresIn: 30 * 60, // 30 minutes in seconds
      customer: {
        id: customer.id,
        email: customer.email,
        firstName: customer.firstName,
        lastName: customer.lastName
      }
    });

  } catch (error: any) {
    console.error('Error creating impersonation token:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to create impersonation token' },
      { status: 500 }
    );
  }
}
