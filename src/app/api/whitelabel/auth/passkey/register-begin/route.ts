import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { prisma } from '@/lib/prisma';
import { verifyCustomerJWT } from '@/lib/customerJwt';
import { 
  generatePasskeyRegistrationOptions, 
  parseStoredCredential,
  checkRateLimit 
} from '@/lib/passkey';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

const requestSchema = z.object({
  userDisplayName: z.string().optional(),
});

export async function POST(request: NextRequest) {
  try {
    // Rate limiting
    const clientIP = request.headers.get('x-forwarded-for') || 'unknown';
    if (!checkRateLimit(`customer-passkey-register:${clientIP}`, 3, 15 * 60 * 1000)) {
      return NextResponse.json(
        { error: 'Too many registration attempts. Please try again later.' },
        { status: 429 }
      );
    }

    // Get customer token from cookies
    const cookieStore = cookies();
    const token = cookieStore.get('customer_token')?.value;

    if (!token) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    // Verify JWT token
    const payload = await verifyCustomerJWT(token);
    if (!payload) {
      return NextResponse.json(
        { error: 'Invalid authentication token' },
        { status: 401 }
      );
    }

    // Parse request body
    const body = await request.json();
    const { userDisplayName } = requestSchema.parse(body);

    // Get customer credential details
    const customerCredential = await prisma.customerCredential.findUnique({
      where: { id: payload.credentialId },
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

    if (!customerCredential) {
      return NextResponse.json(
        { error: 'Customer credential not found' },
        { status: 404 }
      );
    }

    // Parse existing credentials
    const existingCredentials = customerCredential.passkeyCredentials.map(parseStoredCredential);

    // Generate registration options
    const displayName = userDisplayName || 
      `${customerCredential.customer.firstName || ''} ${customerCredential.customer.lastName || ''}`.trim() || 
      'Customer';
    
    const options = await generatePasskeyRegistrationOptions(
      customerCredential.id,
      customerCredential.email,
      displayName,
      existingCredentials
    );

    // Store challenge in session/cache for verification
    cookieStore.set('passkey_challenge', options.challenge, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax', // Changed from 'strict' to 'lax' for consistency
      maxAge: 5 * 60, // 5 minutes
      path: '/',
    });

    cookieStore.set('passkey_credential_id', customerCredential.id, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 5 * 60, // 5 minutes
      path: '/',
    });

    return NextResponse.json({
      success: true,
      options,
      message: 'Registration options generated successfully',
    });

  } catch (error) {
    console.error('Customer passkey registration begin error:', error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request data', details: error.errors },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to generate registration options' },
      { status: 500 }
    );
  }
}
