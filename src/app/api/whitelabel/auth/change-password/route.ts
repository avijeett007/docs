import { NextRequest, NextResponse } from 'next/server';

// This route uses dynamic features, so it must be server-rendered
export const dynamic = 'force-dynamic';

import { cookies } from 'next/headers';
import { verifyCustomerJWT } from '@/lib/customerJwt';
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcrypt';
import { hashPassword } from '@/lib/auth/password';
import { createCustomerToken } from '@/lib/customerJwt';

export async function POST(request: NextRequest) {
  try {
    // Get the customer token from cookies
    const cookieStore = cookies();
    const token = cookieStore.get('customer_token')?.value;

    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Verify the token
    const payload = await verifyCustomerJWT(token);
    if (!payload) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    // Get request body
    const { currentPassword, newPassword, isFirstLogin, isFromMagicLinkReset } = await request.json();

    // Validate new password
    if (!newPassword || newPassword.length < 8) {
      return NextResponse.json(
        { error: 'New password must be at least 8 characters long' },
        { status: 400 }
      );
    }

    // Get the customer credential
    let customerCredential;

    if (payload.credentialId) {
      // If credentialId is available in the token, use it
      customerCredential = await prisma.customerCredential.findUnique({
        where: { id: payload.credentialId },
      });
    } else {
      // Fallback to finding by partnerId and email
      customerCredential = await prisma.customerCredential.findFirst({
        where: {
          partnerId: payload.partnerId,
          email: payload.email,
          customerId: payload.customerId
        },
      });
    }

    console.log('Found credential:', customerCredential ? `ID: ${customerCredential.id}` : 'Not found');

    if (!customerCredential) {
      return NextResponse.json(
        { error: 'Customer credential not found' },
        { status: 404 }
      );
    }

    // If not first login and not from magic link reset, verify current password
    if (!isFirstLogin && !isFromMagicLinkReset) {
      const isPasswordValid = await bcrypt.compare(
        currentPassword,
        customerCredential.passwordHash
      );

      if (!isPasswordValid) {
        return NextResponse.json(
          { error: 'Current password is incorrect' },
          { status: 401 }
        );
      }
    }

    // Hash the new password
    const newPasswordHash = await hashPassword(newPassword);

    // Update the password
    await prisma.customerCredential.update({
      where: { id: customerCredential.id },
      data: {
        passwordHash: newPasswordHash,
        lastReset: new Date(),
        failedLoginAttempts: 0
      },
    });

    // If this was from a magic link reset, create a new token without the magic link type
    if (isFromMagicLinkReset) {
      const newToken = await createCustomerToken({
        customerId: payload.customerId,
        credentialId: payload.credentialId,
        partnerId: payload.partnerId,
        email: payload.email,
        // Don't include magicLinkType in the new token
      });

      // Set the new token in cookies
      const cookieStore = cookies();
      cookieStore.set('customer_token', newToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 60 * 60 * 24 * 7, // 1 week
        path: '/',
      });
    }

    return NextResponse.json({
      success: true,
      message: 'Password changed successfully',
      isFirstLogin: isFirstLogin || isFromMagicLinkReset,
      redirectUrl: '/whitelabel/dashboard'
    });
  } catch (error) {
    console.error('Error changing password:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
