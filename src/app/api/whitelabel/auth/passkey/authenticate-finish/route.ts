import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { prisma } from '@/lib/prisma';
import { createCustomerToken } from '@/lib/customerJwt';
import {
  verifyPasskeyAuthentication,
  parseStoredCredential,
  serializeCredential,
  clearRateLimit,
  type PasskeyCredential
} from '@/lib/passkey';
import type { AuthenticationResponseJSON } from '@simplewebauthn/server';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

const requestSchema = z.object({
  response: z.object({
    id: z.string(),
    rawId: z.string(),
    response: z.object({
      authenticatorData: z.string(),
      clientDataJSON: z.string(),
      signature: z.string(),
      userHandle: z.string().optional(),
    }),
    type: z.literal('public-key'),
    clientExtensionResults: z.object({}).optional(),
    authenticatorAttachment: z.enum(['platform', 'cross-platform']).optional(),
  }),
});

export async function POST(request: NextRequest) {
  try {
    // Get challenge and credential ID from cookies
    const cookieStore = cookies();
    const challenge = cookieStore.get('passkey_auth_challenge')?.value;
    const credentialId = cookieStore.get('passkey_auth_credential_id')?.value;

    if (!challenge || !credentialId) {
      return NextResponse.json(
        { error: 'Missing authentication data or expired session' },
        { status: 401 }
      );
    }

    // Parse request body
    const body = await request.json();
    const { response: authenticationResponse } = requestSchema.parse(body);

    // Get customer credential details
    const customerCredential = await prisma.customerCredential.findUnique({
      where: { id: credentialId },
      include: {
        customer: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            customerPortalEnabled: true,
          },
        },
      },
    });

    if (!customerCredential) {
      return NextResponse.json(
        { error: 'Customer credential not found' },
        { status: 404 }
      );
    }

    // Check if customer portal is enabled
    if (!customerCredential.customer.customerPortalEnabled) {
      return NextResponse.json(
        { error: 'Customer portal access is not enabled' },
        { status: 403 }
      );
    }

    // Find the credential used for authentication
    const passkeyCredentialId = authenticationResponse.id;
    const userCredentials = customerCredential.passkeyCredentials.map(parseStoredCredential);
    const credential = userCredentials.find(cred => cred.id === passkeyCredentialId);

    if (!credential) {
      return NextResponse.json(
        { error: 'Credential not found' },
        { status: 404 }
      );
    }

    // Get request origin for WebAuthn configuration
    const origin = request.headers.get('origin') || request.headers.get('referer') || 'https://knotie-ai.pro';

    // Verify the authentication response
    const verification = await verifyPasskeyAuthentication(
      authenticationResponse as AuthenticationResponseJSON,
      challenge,
      credential,
      [origin] // Pass origin as array for verification
    );

    if (!verification.verified || !verification.authenticationInfo) {
      return NextResponse.json(
        { error: 'Passkey authentication verification failed' },
        { status: 400 }
      );
    }

    // Update credential counter and last used timestamp
    const updatedCredential: PasskeyCredential = {
      ...credential,
      counter: verification.authenticationInfo.newCounter,
      lastUsedAt: new Date(),
    };

    // Update all credentials in the database
    const updatedCredentials = userCredentials.map(cred => 
      cred.id === passkeyCredentialId ? serializeCredential(updatedCredential) : serializeCredential(cred)
    );

    // Update customer credential and customer records
    await prisma.customerCredential.update({
      where: { id: customerCredential.id },
      data: {
        passkeyCredentials: updatedCredentials,
        passkeyLastUsedAt: new Date(),
        lastLogin: new Date(),
        failedLoginAttempts: 0,
      },
    });

    await prisma.customer.update({
      where: { id: customerCredential.customerId },
      data: {
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
    cookieStore.set('customer_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax', // Changed from 'strict' to 'lax' for better compatibility
      maxAge: 60 * 60 * 24 * 7, // 1 week
      path: '/',
    });

    // Clear authentication cookies
    cookieStore.delete('passkey_auth_challenge');
    cookieStore.delete('passkey_auth_credential_id');

    // Clear rate limiting on successful authentication
    const clientIP = request.headers.get('x-forwarded-for') || 'unknown';
    clearRateLimit(`customer-passkey-auth:${clientIP}`);

    // Check if this is the first login
    const isFirstLogin = !customerCredential.lastLogin || !customerCredential.lastReset;

    return NextResponse.json({
      success: true,
      customer: {
        id: customerCredential.customer.id,
        name: `${customerCredential.customer.firstName || ''} ${customerCredential.customer.lastName || ''}`.trim() || 'Customer',
        email: customerCredential.email,
      },
      isFirstLogin,
      authenticatedWith: 'passkey',
      deviceName: credential.deviceName,
      redirectUrl: isFirstLogin ? '/whitelabel/change-password' : '/whitelabel/dashboard'
    });

  } catch (error) {
    console.error('Customer passkey authentication finish error:', error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request data', details: error.errors },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to complete passkey authentication' },
      { status: 500 }
    );
  }
}
