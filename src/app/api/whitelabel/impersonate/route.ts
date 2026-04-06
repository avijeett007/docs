import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyCustomerJWT } from '@/lib/customerJwt';
import { prisma } from '@/lib/prisma';
import { AuditTrailService } from '@/lib/billing/auditTrail';

export const dynamic = 'force-dynamic';

/**
 * API route to process impersonation token and set customer authentication cookie
 * This validates the impersonation token and establishes the customer session
 */
export async function POST(request: NextRequest) {
  try {
    const { token } = await request.json();

    if (!token) {
      return NextResponse.json(
        { error: 'Impersonation token is required' },
        { status: 400 }
      );
    }

    // Verify the impersonation token
    const payload = await verifyCustomerJWT(token);

    if (!payload) {
      return NextResponse.json(
        { error: 'Invalid or expired impersonation token' },
        { status: 401 }
      );
    }

    // Verify this is actually an impersonation token
    if (!payload.isImpersonating || !payload.impersonatedBy || !payload.impersonationSessionId) {
      return NextResponse.json(
        { error: 'Invalid impersonation token format' },
        { status: 401 }
      );
    }

    // Verify the customer and partner exist and are associated
    const customer = await prisma.customer.findUnique({
      where: { id: payload.customerId }
    });

    if (!customer) {
      return NextResponse.json(
        { error: 'Customer not found' },
        { status: 404 }
      );
    }

    const partner = await prisma.partner.findUnique({
      where: { id: payload.impersonatedBy }
    });

    if (!partner) {
      return NextResponse.json(
        { error: 'Impersonating partner not found' },
        { status: 404 }
      );
    }

    // Verify customer credentials exist for this partner
    const customerCredential = await prisma.customerCredential.findFirst({
      where: {
        customerId: payload.customerId,
        partnerId: payload.partnerId,
        status: 'active'
      }
    });

    if (!customerCredential) {
      return NextResponse.json(
        { error: 'Customer credentials not found or inactive' },
        { status: 404 }
      );
    }

    // Log impersonation session activation
    console.log(`Impersonation session activated:`, {
      sessionId: payload.impersonationSessionId,
      partnerId: payload.impersonatedBy,
      customerId: payload.customerId,
      customerEmail: payload.email
    });

    // Set the customer authentication cookie with the impersonation token
    console.log('Setting customer_token cookie for impersonation');
    const cookieStore = cookies();

    // Determine the correct domain for the cookie based on partner settings
    let cookieDomain: string | undefined = undefined;
    const isDevelopment = process.env.NODE_ENV === 'development';
    const isPreviewMode = process.env.NEXT_PUBLIC_PREVIEW_MODE === 'development';

    if (isDevelopment || isPreviewMode) {
      // Development mode: set domain to .lvh.me to work across subdomains
      if (partner.subdomain) {
        cookieDomain = '.lvh.me';
      }
      // For localhost, don't set domain (defaults to current domain)
    } else {
      // Production mode: set domain based on partner configuration
      if (partner.customDomainVerified && partner.customDomain) {
        // For custom domains, set the domain to the custom domain
        cookieDomain = partner.customDomain;
      } else if (partner.subdomain) {
        // For subdomains, set domain to .knotie-ai.pro to work across subdomains
        cookieDomain = '.knotie-ai.pro';
      }
    }

    console.log('Setting cookie with domain:', cookieDomain);

    const cookieOptions: any = {
      name: 'customer_token',
      value: token,
      httpOnly: true,
      path: '/',
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      maxAge: 30 * 60 // 30 minutes to match token expiration
    };

    // Only set domain if we determined one
    if (cookieDomain) {
      cookieOptions.domain = cookieDomain;
    }

    cookieStore.set(cookieOptions);
    console.log('Cookie set successfully with options:', cookieOptions);

    // Store impersonation session activation in audit table
    try {
      await AuditTrailService.logImpersonationActivation(
        payload.impersonationSessionId!,
        payload.impersonatedBy!,
        payload.customerId,
        payload.email,
        request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || undefined,
        request.headers.get('user-agent') || undefined
      );
    } catch (auditError) {
      console.error('Failed to log impersonation activation:', auditError);
      // Don't fail the request if audit logging fails
    }

    return NextResponse.json({
      success: true,
      message: 'Impersonation session established',
      customer: {
        id: customer.id,
        email: customer.email,
        firstName: customer.firstName,
        lastName: customer.lastName
      },
      impersonationContext: {
        sessionId: payload.impersonationSessionId,
        impersonatedBy: payload.impersonatedBy,
        partnerName: partner.businessName || partner.contactName
      }
    });

  } catch (error: any) {
    console.error('Error processing impersonation token:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to process impersonation token' },
      { status: 500 }
    );
  }
}
