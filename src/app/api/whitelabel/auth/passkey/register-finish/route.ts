import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { prisma } from '@/lib/prisma';
import { verifyCustomerJWT } from '@/lib/customerJwt';
import { 
  verifyPasskeyRegistration, 
  serializeCredential,
  generateDeviceName,
  clearRateLimit,
  type PasskeyCredential 
} from '@/lib/passkey';
import type { RegistrationResponseJSON } from '@simplewebauthn/server';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

const requestSchema = z.object({
  response: z.object({
    id: z.string(),
    rawId: z.string(),
    response: z.object({
      attestationObject: z.string(),
      clientDataJSON: z.string(),
    }),
    type: z.literal('public-key'),
    clientExtensionResults: z.object({}).optional(),
    authenticatorAttachment: z.enum(['platform', 'cross-platform']).optional(),
  }),
  deviceName: z.string().optional(),
});

export async function POST(request: NextRequest) {
  try {
    // Get customer token and challenge from cookies
    const cookieStore = cookies();
    const token = cookieStore.get('customer_token')?.value;
    const challenge = cookieStore.get('passkey_challenge')?.value;
    const credentialId = cookieStore.get('passkey_credential_id')?.value;

    if (!token || !challenge || !credentialId) {
      return NextResponse.json(
        { error: 'Missing authentication data or expired session' },
        { status: 401 }
      );
    }

    // Verify JWT token
    const payload = await verifyCustomerJWT(token);
    if (!payload || payload.credentialId !== credentialId) {
      return NextResponse.json(
        { error: 'Invalid authentication token' },
        { status: 401 }
      );
    }

    // Parse request body
    const body = await request.json();
    const { response: registrationResponse, deviceName } = requestSchema.parse(body);

    // Get customer credential details
    const customerCredential = await prisma.customerCredential.findUnique({
      where: { id: payload.credentialId },
      select: {
        id: true,
        email: true,
        passkeyCredentials: true,
      },
    });

    if (!customerCredential) {
      return NextResponse.json(
        { error: 'Customer credential not found' },
        { status: 404 }
      );
    }

    // Verify the registration response
    const userAgent = request.headers.get('user-agent') || undefined;
    const verification = await verifyPasskeyRegistration(
      registrationResponse as RegistrationResponseJSON,
      challenge
    );

    if (!verification.verified || !verification.registrationInfo) {
      return NextResponse.json(
        { error: 'Passkey registration verification failed' },
        { status: 400 }
      );
    }

    // Extract credential data from the correct location
    const credentialData = verification.registrationInfo.credential;
    if (!credentialData || !credentialData.id) {
      console.error('No credential data found in registration info:', verification.registrationInfo);
      return NextResponse.json(
        { error: 'Invalid credential data received' },
        { status: 400 }
      );
    }

    // Create new credential
    const newCredential: PasskeyCredential = {
      id: credentialData.id, // Already in base64url format
      publicKey: credentialData.publicKey,
      counter: credentialData.counter,
      deviceType: verification.registrationInfo.credentialDeviceType,
      backedUp: verification.registrationInfo.credentialBackedUp,
      transports: (registrationResponse as any).response?.transports || [],
      deviceName: deviceName || generateDeviceName(userAgent),
      createdAt: new Date(),
      userAgent,
    };

    // Check if credential already exists
    const existingCredentials = customerCredential.passkeyCredentials || [];
    const credentialExists = existingCredentials.some(
      (cred: any) => cred.id === newCredential.id
    );

    if (credentialExists) {
      return NextResponse.json(
        { error: 'This passkey is already registered' },
        { status: 409 }
      );
    }

    // Add new credential to existing ones
    const updatedCredentials = [...existingCredentials, serializeCredential(newCredential)];

    // Update customer credential record
    await prisma.customerCredential.update({
      where: { id: customerCredential.id },
      data: {
        passkeyEnabled: true,
        passkeyCredentials: updatedCredentials,
        passkeySetupAt: customerCredential.passkeyCredentials.length === 0 ? new Date() : undefined,
      },
    });

    // Clear rate limiting on successful registration
    const clientIP = request.headers.get('x-forwarded-for') || 'unknown';
    clearRateLimit(`customer-passkey-register:${clientIP}`);

    // Clear challenge cookies
    cookieStore.delete('passkey_challenge');
    cookieStore.delete('passkey_credential_id');

    return NextResponse.json({
      success: true,
      message: 'Passkey registered successfully',
      credential: {
        id: newCredential.id,
        deviceName: newCredential.deviceName,
        createdAt: newCredential.createdAt,
        deviceType: newCredential.deviceType,
      },
    });

  } catch (error) {
    console.error('Customer passkey registration finish error:', error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request data', details: error.errors },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to complete passkey registration' },
      { status: 500 }
    );
  }
}
