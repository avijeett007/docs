import { NextRequest, NextResponse } from 'next/server';

// This route uses dynamic features, so it must be server-rendered
export const dynamic = 'force-dynamic';

import { prisma } from '@/lib/prisma';
import { createCustomerToken } from '@/lib/customerJwt';

export async function POST(request: NextRequest) {
  try {
    const { token } = await request.json();
    
    if (!token) {
      return NextResponse.json(
        { error: 'Magic link token is required' },
        { status: 400 }
      );
    }
    
    // Find the customer credential with this magic link token
    const customerCredential = await prisma.customerCredential.findFirst({
      where: {
        magicLinkToken: token,
        magicLinkExpiry: {
          gt: new Date() // Token must not be expired
        },
        magicLinkUsed: false, // Token must not have been used
        status: 'active'
      },
      include: {
        customer: true,
      }
    });
    
    if (!customerCredential) {
      return NextResponse.json(
        { error: 'Invalid, expired, or already used magic link' },
        { status: 400 }
      );
    }
    
    // Prepare update data based on magic link type
    const updateData: any = {
      magicLinkUsed: true,
      magicLinkToken: null, // Clear the token for security
      magicLinkExpiry: null,
      failedLoginAttempts: 0, // Reset failed attempts on successful login
    };

    // If this is an email verification link, mark email as verified
    if (customerCredential.magicLinkType === 'email_verification') {
      updateData.emailVerified = true;
      updateData.emailVerifiedAt = new Date();
    } else {
      // For login/password reset links, update last login
      updateData.lastLogin = new Date();
    }

    // Mark the magic link as used to prevent reuse
    await prisma.customerCredential.update({
      where: { id: customerCredential.id },
      data: updateData,
    });

    // Update login count on customer record
    await prisma.customer.update({
      where: { id: customerCredential.customerId },
      data: {
        loginCount: {
          increment: 1,
        },
      },
    });

    // Create JWT token for the customer
    // Add magic link context to the token
    const jwtToken = await createCustomerToken({
      customerId: customerCredential.customerId,
      credentialId: customerCredential.id,
      partnerId: customerCredential.partnerId,
      email: customerCredential.email,
      magicLinkType: customerCredential.magicLinkType || undefined
    });

    // Set the JWT token as an HTTP-only cookie
    const response = NextResponse.json({
      success: true,
      customer: {
        id: customerCredential.customer.id,
        name: `${customerCredential.customer.firstName || ''} ${customerCredential.customer.lastName || ''}`.trim() || 'Customer',
        email: customerCredential.email,
      },
      magicLinkType: customerCredential.magicLinkType,
      // Determine redirect URL based on magic link type
      redirectUrl: customerCredential.magicLinkType === 'password_reset'
        ? '/whitelabel/change-password'
        : customerCredential.magicLinkType === 'email_verification'
        ? '/whitelabel/login'
        : '/whitelabel/dashboard'
    });

    // Set the JWT token as an HTTP-only cookie
    response.cookies.set('customer_token', jwtToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60, // 7 days
      path: '/',
    });

    return response;
  } catch (error) {
    console.error('Error verifying magic link:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
