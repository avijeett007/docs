import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { validateEmbedToken } from '@/lib/embedTokenAuth';
import { createCustomerToken } from '@/lib/customerJwt';
import { getSecurityHeaders, validateRefererDomain } from '@/lib/embedTokenSecurity';
import { verifyEmbedJWT } from '@/lib/embedJwt';
import { prisma } from '@/lib/prisma';

// Mark this route as dynamic
export const dynamic = 'force-dynamic';

// POST /api/whitelabel/embed/auth/[token]
// Authenticate user via embed token and set customer JWT cookie
export async function POST(
  request: NextRequest,
  { params }: { params: { token: string } }
) {
  try {
    const { token } = params;

    if (!token) {
      return NextResponse.json(
        { error: 'Token is required' },
        { status: 400 }
      );
    }

    // First try to verify as JWT token
    const jwtPayload = verifyEmbedJWT(token);

    if (jwtPayload) {
      console.log('Processing JWT-based embed token');

      // Validate referer domain against allowed domains in JWT
      console.log('Validating referer domain for JWT token...');
      const domainValidation = validateRefererDomain(request, jwtPayload.allowedDomains);

      if (!domainValidation.isValid) {
        console.error('Domain validation failed for JWT token:', domainValidation.error);
        return NextResponse.json(
          {
            error: 'Access denied: Invalid domain',
            details: domainValidation.error
          },
          { status: 403 }
        );
      }

      console.log('Domain validation successful for JWT token');

      // Verify the embed token still exists and is active in database
      const embedTokenRecord = await prisma.embedToken.findUnique({
        where: { id: jwtPayload.embedTokenId },
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
            },
          },
        },
      });

      if (!embedTokenRecord || embedTokenRecord.status !== 'active') {
        return NextResponse.json(
          { error: 'Embed token has been revoked or is inactive' },
          { status: 401 }
        );
      }

      // Create a customer JWT token with embed context
      const customerJWT = await createCustomerToken({
        customerId: jwtPayload.customerId,
        credentialId: jwtPayload.customerCredentialId,
        partnerId: jwtPayload.partnerId,
        email: embedTokenRecord.customerCredential.email,
        embedContext: {
          isEmbedded: true,
          accessMode: jwtPayload.accessMode,
          embedTokenId: jwtPayload.embedTokenId,
        },
      });

      // Set the customer token cookie
      // For embed contexts, use more permissive cookie settings to work in iframes
      const cookieStore = cookies();
      cookieStore.set('customer_token', customerJWT, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax', // 'none' for iframe support in production
        maxAge: 60 * 60 * 24 * 7, // 1 week
        path: '/',
      });

      // Set embed context cookie for UI customization
      const embedContext = {
        isEmbedded: true,
        accessMode: jwtPayload.accessMode,
        embedTokenId: jwtPayload.embedTokenId,
        embedTokenName: embedTokenRecord.name,
      };

      cookieStore.set('embed_context', JSON.stringify(embedContext), {
        httpOnly: false, // Allow client-side access for UI customization
        secure: process.env.NODE_ENV === 'production',
        sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax', // 'none' for iframe support in production
        maxAge: 60 * 60 * 24 * 7, // 1 week
        path: '/',
      });

      // Update access tracking
      await prisma.embedToken.update({
        where: { id: jwtPayload.embedTokenId },
        data: {
          lastAccessedAt: new Date(),
          accessCount: {
            increment: 1,
          },
        },
      });

      console.log(`JWT embed token authentication successful for customer ${jwtPayload.customerId}`);

      const response = NextResponse.json({
        success: true,
        customer: {
          id: embedTokenRecord.customer.id,
          name: `${embedTokenRecord.customer.firstName || ''} ${embedTokenRecord.customer.lastName || ''}`.trim() || embedTokenRecord.customer.email,
          email: embedTokenRecord.customer.email,
        },
        embedContext,
        redirectUrl: '/whitelabel/dashboard',
      });

      // Add security headers
      const securityHeaders = getSecurityHeaders();
      Object.entries(securityHeaders).forEach(([key, value]) => {
        response.headers.set(key, value);
      });

      return response;
    }

    // Fallback to legacy UUID-based token validation
    console.log('Processing legacy UUID-based embed token');

    // Validate the embed token
    const validationResult = await validateEmbedToken(token, request);

    if (!validationResult.isValid || !validationResult.embedToken) {
      return NextResponse.json(
        { error: validationResult.error || 'Invalid token' },
        { status: 401 }
      );
    }

    const { embedToken } = validationResult;

    // Create a customer JWT token
    const customerJWT = await createCustomerToken({
      customerId: embedToken.customerId,
      credentialId: embedToken.customerCredentialId,
      partnerId: embedToken.partnerId,
      email: embedToken.customerCredential.email,
    });

    // Set the customer token cookie
    // For embed contexts, use more permissive cookie settings to work in iframes
    const cookieStore = cookies();
    cookieStore.set('customer_token', customerJWT, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax', // 'none' for iframe support in production
      maxAge: 60 * 60 * 24 * 7, // 1 week
      path: '/',
    });

    // Set embed context cookie for UI customization
    const embedContext = {
      isEmbedded: true,
      accessMode: embedToken.accessMode,
      embedTokenId: embedToken.id,
      embedTokenName: embedToken.name,
    };

    cookieStore.set('embed_context', JSON.stringify(embedContext), {
      httpOnly: false, // Allow client-side access for UI customization
      secure: process.env.NODE_ENV === 'production',
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax', // 'none' for iframe support in production
      maxAge: 60 * 60 * 24 * 7, // 1 week
      path: '/',
    });

    // Log the successful authentication
    console.log(`Embed token authentication successful for customer ${embedToken.customerId} via token ${embedToken.id}`);

    const response = NextResponse.json({
      success: true,
      customer: {
        id: embedToken.customer.id,
        name: `${embedToken.customer.firstName || ''} ${embedToken.customer.lastName || ''}`.trim() || embedToken.customer.email,
        email: embedToken.customer.email,
      },
      embedContext,
      redirectUrl: '/whitelabel/dashboard',
    });

    // Add security headers
    const securityHeaders = getSecurityHeaders();
    Object.entries(securityHeaders).forEach(([key, value]) => {
      response.headers.set(key, value);
    });

    return response;
  } catch (error) {
    console.error('Error during embed token authentication:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// GET /api/whitelabel/embed/auth/[token]
// Get embed token information without authentication (for validation)
export async function GET(
  request: NextRequest,
  { params }: { params: { token: string } }
) {
  try {
    const { token } = params;

    if (!token) {
      return NextResponse.json(
        { error: 'Token is required' },
        { status: 400 }
      );
    }

    // Validate the embed token (without updating access count)
    const validationResult = await validateEmbedToken(token, request);

    if (!validationResult.isValid || !validationResult.embedToken) {
      return NextResponse.json(
        { error: validationResult.error || 'Invalid token' },
        { status: 401 }
      );
    }

    const { embedToken } = validationResult;

    return NextResponse.json({
      valid: true,
      tokenInfo: {
        id: embedToken.id,
        name: embedToken.name,
        accessMode: embedToken.accessMode,
        allowedDomains: embedToken.allowedDomains,
        expiresAt: embedToken.expiresAt,
        customer: {
          id: embedToken.customer.id,
          name: `${embedToken.customer.firstName || ''} ${embedToken.customer.lastName || ''}`.trim() || embedToken.customer.email,
          email: embedToken.customer.email,
        },
        partner: {
          id: embedToken.partner.id,
          businessName: embedToken.partner.businessName,
        },
      },
    });
  } catch (error) {
    console.error('Error validating embed token:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
