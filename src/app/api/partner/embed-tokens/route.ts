import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyJWT } from '@/lib/jwt';
import { cookies } from 'next/headers';
import { createEmbedJWT } from '@/lib/embedJwt';

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

// GET /api/partner/embed-tokens
// List all embed tokens for a partner
export async function GET(request: NextRequest) {
  console.log('GET /api/partner/embed-tokens called');
  try {
    // Verify partner authentication
    const cookieStore = cookies();
    const token = cookieStore.get('partner_token')?.value;
    console.log('Partner token found:', !!token);

    if (!token) {
      console.log('No partner token found, returning 401');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const payload = await verifyJWT(token);
    console.log('JWT verification result:', !!payload);
    if (!payload || !payload.email) {
      console.log('Invalid JWT token, returning 401');
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
      console.log('Partner not found or not approved');
      return NextResponse.json({ error: 'Partner not found or not approved' }, { status: 403 });
    }

    const partnerId = partner.id;

    // Get query parameters for filtering
    const url = new URL(request.url);
    const customerId = url.searchParams.get('customerId');
    const status = url.searchParams.get('status');

    // Build where clause
    const where: any = {
      partnerId: partnerId,
    };

    if (customerId) {
      // The customerId might be either a UserOnboarding ID or actual Customer ID
      // First, try to resolve it via UserOnboarding
      const userOnboarding = await prisma.userOnboarding.findFirst({
        where: {
          OR: [
            { id: customerId, partnerId: partnerId }, // customerId is actually UserOnboarding ID
            { customerId: customerId, partnerId: partnerId }, // customerId is actual Customer ID
          ],
        },
      });

      if (userOnboarding) {
        where.customerId = userOnboarding.customerId; // Use the actual customer ID
      } else {
        where.customerId = customerId; // Fallback to the provided ID
      }
    }

    if (status) {
      where.status = status;
    }

    // Fetch embed tokens with related data
    const embedTokens = await prisma.embedToken.findMany({
      where,
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
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return NextResponse.json({
      embedTokens: embedTokens.map(token => ({
        id: token.id,
        token: token.token,
        name: token.name,
        customerId: token.customerId,
        customerName: `${token.customer.firstName || ''} ${token.customer.lastName || ''}`.trim() || token.customer.email,
        customerEmail: token.customer.email,
        allowedDomains: token.allowedDomains,
        accessMode: token.accessMode,
        status: token.status,
        expiresAt: token.expiresAt,
        lastAccessedAt: token.lastAccessedAt,
        accessCount: token.accessCount,
        createdAt: token.createdAt,
        updatedAt: token.updatedAt,
        revokedAt: token.revokedAt,
        revokedBy: token.revokedBy,
      })),
    });
  } catch (error) {
    console.error('Error fetching embed tokens:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

// POST /api/partner/embed-tokens
// Create a new embed token
export async function POST(request: NextRequest) {
  console.log('POST /api/partner/embed-tokens called');
  try {
    // Verify partner authentication
    const cookieStore = cookies();
    const token = cookieStore.get('partner_token')?.value;
    console.log('Partner token found:', !!token);

    if (!token) {
      console.log('No partner token found, returning 401');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const payload = await verifyJWT(token);
    console.log('JWT verification result:', !!payload);
    if (!payload || !payload.email) {
      console.log('Invalid JWT token, returning 401');
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
      console.log('Partner not found or not approved');
      return NextResponse.json({ error: 'Partner not found or not approved' }, { status: 403 });
    }

    const partnerId = partner.id;

    // Parse request body
    const body = await request.json();
    console.log('Request body:', body);
    const {
      name,
      customerId,
      allowedDomains = [],
      accessMode = 'full',
      expiresAt,
    } = body;

    console.log('Parsed fields:', { name, customerId, allowedDomains, accessMode, expiresAt });

    // Validate required fields
    if (!name || !customerId) {
      console.log('Missing required fields:', { name: !!name, customerId: !!customerId });
      return NextResponse.json(
        { error: 'Name and customer ID are required' },
        { status: 400 }
      );
    }

    // Validate access mode
    if (!['full', 'readonly', 'lite'].includes(accessMode)) {
      return NextResponse.json(
        { error: 'Invalid access mode. Must be full, readonly, or lite' },
        { status: 400 }
      );
    }

    // The customerId might be either a UserOnboarding ID or actual Customer ID
    // First, try to find it as a UserOnboarding ID
    console.log('Looking for user onboarding with ID or customerId:', { customerId, partnerId });

    const userOnboarding = await prisma.userOnboarding.findFirst({
      where: {
        OR: [
          { id: customerId, partnerId: partnerId }, // customerId is actually UserOnboarding ID
          { customerId: customerId, partnerId: partnerId }, // customerId is actual Customer ID
        ],
      },
    });

    console.log('User onboarding found:', !!userOnboarding);
    if (!userOnboarding) {
      console.log('Customer not found in user onboarding or not associated with this partner');
      return NextResponse.json(
        { error: 'Customer not found or not associated with this partner' },
        { status: 404 }
      );
    }

    // Use the actual customer ID from the UserOnboarding record
    const actualCustomerId = userOnboarding.customerId;
    console.log('Resolved actual customer ID:', actualCustomerId);

    if (!actualCustomerId) {
      console.log('UserOnboarding record has no customerId');
      return NextResponse.json(
        { error: 'Invalid customer data in user onboarding' },
        { status: 400 }
      );
    }

    // Now find the customer credential using the actual customer ID
    console.log('Looking for customer credential with:', { customerId: actualCustomerId, partnerId });
    const customerCredential = await prisma.customerCredential.findFirst({
      where: {
        customerId: actualCustomerId,
        partnerId: partnerId,
        status: 'active',
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
      },
    });

    console.log('Customer credential found:', !!customerCredential);
    if (!customerCredential) {
      console.log('Customer credential not found - customer may not have portal access set up');
      return NextResponse.json(
        { error: 'Customer portal access not set up. Please create customer credentials first.' },
        { status: 404 }
      );
    }

    // Check if partner has reached the limit (soft limit of 5 for now)
    const existingTokensCount = await prisma.embedToken.count({
      where: {
        partnerId: partnerId,
        customerId: customerId,
        status: 'active',
      },
    });

    if (existingTokensCount >= 5) {
      return NextResponse.json(
        { error: 'Maximum number of embed tokens reached (5 per customer)' },
        { status: 400 }
      );
    }

    // Get partner information to automatically add their whitelabel domain
    const partnerInfo = await prisma.partner.findUnique({
      where: { id: partnerId },
      select: {
        subdomain: true,
        customDomain: true,
        customDomainVerified: true,
      },
    });

    if (!partnerInfo) {
      return NextResponse.json(
        { error: 'Partner not found' },
        { status: 404 }
      );
    }

    // Automatically add partner's whitelabel domain to allowed domains
    const enhancedAllowedDomains = [...allowedDomains];

    // Add partner's custom domain if verified
    if (partnerInfo.customDomain && partnerInfo.customDomainVerified) {
      if (!enhancedAllowedDomains.includes(partnerInfo.customDomain)) {
        enhancedAllowedDomains.push(partnerInfo.customDomain);
        console.log(`Auto-added partner custom domain: ${partnerInfo.customDomain}`);
      }
    }

    // Add partner's subdomain if available
    if (partnerInfo.subdomain) {
      const subdomainUrl = `${partnerInfo.subdomain}.knotie-ai.pro`;
      if (!enhancedAllowedDomains.includes(subdomainUrl)) {
        enhancedAllowedDomains.push(subdomainUrl);
        console.log(`Auto-added partner subdomain: ${subdomainUrl}`);
      }
    }

    console.log('Final allowed domains:', enhancedAllowedDomains);

    // Validate expiration date if provided
    let expirationDate = null;
    if (expiresAt) {
      expirationDate = new Date(expiresAt);
      if (expirationDate <= new Date()) {
        return NextResponse.json(
          { error: 'Expiration date must be in the future' },
          { status: 400 }
        );
      }
    }

    // Create the embed token record first (without the JWT token)
    const newEmbedToken = await prisma.embedToken.create({
      data: {
        token: 'temp', // Temporary token, will be updated with JWT
        name: name,
        customerId: actualCustomerId,
        partnerId: partnerId,
        customerCredentialId: customerCredential.id,
        allowedDomains: enhancedAllowedDomains,
        accessMode: accessMode,
        expiresAt: expirationDate,
        status: 'active',
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
      },
    });

    // Generate a secure JWT-based embed token
    const embedJWT = createEmbedJWT({
      embedTokenId: newEmbedToken.id,
      customerId: actualCustomerId,
      partnerId: partnerId,
      customerCredentialId: customerCredential.id,
      accessMode: accessMode,
      allowedDomains: enhancedAllowedDomains,
    });

    // Update the token with the actual JWT
    const updatedEmbedToken = await prisma.embedToken.update({
      where: { id: newEmbedToken.id },
      data: { token: embedJWT },
      include: {
        customer: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
    });

    // Generate the embed URL using partner's whitelabel domain
    const embedUrl = generateEmbedUrl(embedJWT, partner);
    console.log('Generated embed URL:', embedUrl);

    return NextResponse.json({
      embedToken: {
        id: updatedEmbedToken.id,
        token: updatedEmbedToken.token,
        name: updatedEmbedToken.name,
        customerId: updatedEmbedToken.customerId,
        customerName: `${updatedEmbedToken.customer.firstName || ''} ${updatedEmbedToken.customer.lastName || ''}`.trim() || updatedEmbedToken.customer.email,
        customerEmail: updatedEmbedToken.customer.email,
        allowedDomains: updatedEmbedToken.allowedDomains,
        accessMode: updatedEmbedToken.accessMode,
        status: updatedEmbedToken.status,
        expiresAt: updatedEmbedToken.expiresAt,
        createdAt: updatedEmbedToken.createdAt,
        embedUrl: embedUrl,
      },
    });
  } catch (error) {
    console.error('Error creating embed token:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
