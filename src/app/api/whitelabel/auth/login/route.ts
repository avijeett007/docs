import { NextRequest, NextResponse } from 'next/server';

// This route uses dynamic features, so it must be server-rendered
export const dynamic = 'force-dynamic';

import { prisma } from '@/lib/prisma';
import bcrypt from 'bcrypt';
import { cookies } from 'next/headers';
import { createCustomerToken } from '@/lib/customerJwt';

export async function POST(request: NextRequest) {
  try {
    const { email: rawEmail, password } = await request.json();
    // Normalize email to lowercase for case insensitive comparison
    const email = rawEmail?.toLowerCase().trim();
    console.log(`Login attempt for email: ${email}`);

    // Get the partner ID from the x-partner-id header (set by our middleware)
    const partnerId = request.headers.get('x-partner-id');
    console.log(`Partner ID from header: ${partnerId}`);

    if (!partnerId) {
      console.log('No partner ID found in request headers');
      return NextResponse.json(
        { error: 'Partner not found' },
        { status: 404 }
      );
    }

    // Find the customer credentials
    // First try with findFirst to avoid unique constraint issues
    console.log(`Looking for customer credentials with partnerId: ${partnerId} and email: ${email}`);

    // First check if the partner exists
    const partner = await prisma.partner.findUnique({
      where: { id: partnerId },
      select: { id: true, businessName: true }
    });

    if (!partner) {
      console.log(`Partner with ID ${partnerId} not found in database`);
      return NextResponse.json(
        { error: 'Partner not found in database' },
        { status: 404 }
      );
    }

    console.log(`Partner found: ${partner.id} (${partner.businessName})`);

    const customerCredential = await prisma.customerCredential.findFirst({
      where: {
        partnerId: partnerId,
        email: email,
      },
      include: {
        customer: true,
      },
    });

    console.log(`Customer credential found: ${!!customerCredential}`);
    if (customerCredential) {
      console.log(`Credential ID: ${customerCredential.id}, Status: ${customerCredential.status}`);
    } else {
      // Try to find if the customer exists at all
      const customer = await prisma.customer.findFirst({
        where: { email: email },
      });

      if (customer) {
        console.log(`Customer exists with ID ${customer.id} but no credentials for this partner`);
      } else {
        console.log(`No customer found with email ${email}`);
      }

      // Check if there are any credentials for this partner
      const partnerCredentials = await prisma.customerCredential.findMany({
        where: { partnerId: partnerId },
        select: { id: true, email: true },
        take: 5
      });

      console.log(`Found ${partnerCredentials.length} credentials for partner ${partnerId}`);
      if (partnerCredentials.length > 0) {
        console.log(`Sample emails: ${partnerCredentials.map(c => c.email).join(', ')}`);
      }
    }

    if (!customerCredential) {
      return NextResponse.json(
        { error: 'Invalid email or password' },
        { status: 401 }
      );
    }

    // Check if the account is active
    if (customerCredential.status !== 'active') {
      return NextResponse.json(
        { error: 'Account is not active. Please contact support.' },
        { status: 403 }
      );
    }

    // Auto-verify email on first login (temporary solution)
    // TODO: Re-enable proper email verification flow later
    const shouldAutoVerify = !customerCredential.emailVerified;

    // Verify password
    console.log(`Verifying password for user ${email}`);
    console.log(`Password hash length: ${customerCredential.passwordHash.length}`);
    console.log(`Password hash starts with: ${customerCredential.passwordHash.substring(0, 10)}...`);

    let isPasswordValid = false;
    try {
      isPasswordValid = await bcrypt.compare(
        password,
        customerCredential.passwordHash
      );
      console.log(`Password verification result: ${isPasswordValid}`);
    } catch (error) {
      console.error('Error comparing passwords:', error);
      return NextResponse.json(
        { error: 'Error verifying password. Please try again.' },
        { status: 500 }
      );
    }

    if (!isPasswordValid) {
      console.log(`Invalid password for user ${email}`);
      // Update failed login attempts
      await prisma.customerCredential.update({
        where: { id: customerCredential.id },
        data: {
          failedLoginAttempts: {
            increment: 1,
          },
        },
      });

      return NextResponse.json(
        { error: 'Invalid email or password' },
        { status: 401 }
      );
    }

    console.log(`Password verified successfully for user ${email}`);

    // Reset failed login attempts and update last login
    // Auto-verify email if not already verified (temporary solution)
    const updateData: any = {
      failedLoginAttempts: 0,
      lastLogin: new Date(),
    };

    if (shouldAutoVerify) {
      updateData.emailVerified = true;
      updateData.emailVerifiedAt = new Date();
      console.log(`Auto-verifying email for customer: ${customerCredential.email}`);
    }

    // @ts-ignore
    await prisma.customerCredential.update({
      where: { id: customerCredential.id },
      data: updateData,
    });

    // Update login count on customer record
    await prisma.customer.update({
      where: { id: customerCredential.customerId },
      data: {
        // Temporarily remove lastLogin field which might not exist in the model
        // lastLogin: new Date(),
        loginCount: {
          increment: 1,
        },
      },
    });

    // Create JWT token
    const token = await createCustomerToken({
      customerId: customerCredential.customerId,
      credentialId: customerCredential.id,
      partnerId: customerCredential.partnerId,
      email: customerCredential.email
    });

    // Set the token in a cookie for client-side access
    const cookieStore = cookies();
    cookieStore.set('customer_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax', // Changed from 'strict' to 'lax' for better compatibility
      maxAge: 60 * 60 * 24 * 7, // 1 week
      path: '/',
    });

    // Check if this is the first login or if password has never been reset
    // We'll consider it a first login ONLY if:
    // - There's no lastReset record (password has never been changed by user)
    // This means system-generated passwords require change, but self-registered users don't
    const isFirstLogin = !customerCredential.lastReset;

    return NextResponse.json({
      success: true,
      customer: {
        id: customerCredential.customer.id,
        // Use firstName + lastName instead of name which might not exist
        name: `${customerCredential.customer.firstName || ''} ${customerCredential.customer.lastName || ''}`.trim() || 'Customer',
        email: customerCredential.email,
      },
      isFirstLogin,
      redirectUrl: isFirstLogin ? '/whitelabel/change-password' : '/whitelabel/dashboard'
    });
  } catch (error) {
    console.error('Error during customer login:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
