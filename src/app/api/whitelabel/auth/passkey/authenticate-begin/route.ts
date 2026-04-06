import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { prisma } from '@/lib/prisma';
import { 
  generatePasskeyAuthenticationOptions, 
  parseStoredCredential,
  checkRateLimit 
} from '@/lib/passkey';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

const requestSchema = z.object({
  email: z.string().email(),
});

export async function POST(request: NextRequest) {
  try {
    // Rate limiting
    const clientIP = request.headers.get('x-forwarded-for') || 'unknown';
    if (!checkRateLimit(`customer-passkey-auth:${clientIP}`, 5, 15 * 60 * 1000)) {
      return NextResponse.json(
        { error: 'Too many authentication attempts. Please try again later.' },
        { status: 429 }
      );
    }

    // Get the partner ID from the x-partner-id header (set by middleware)
    const partnerId = request.headers.get('x-partner-id');
    if (!partnerId) {
      return NextResponse.json(
        { error: 'Partner not found' },
        { status: 404 }
      );
    }

    // Parse request body
    const body = await request.json();
    const { email: rawEmail } = requestSchema.parse(body);
    // Normalize email to lowercase for case insensitive comparison
    const email = rawEmail?.toLowerCase().trim();

    // Find customer credential by email and partner
    const customerCredential = await prisma.customerCredential.findFirst({
      where: {
        email: email,
        partnerId: partnerId,
      },
      include: {
        customer: {
          select: {
            id: true,
            customerPortalEnabled: true,
          },
        },
      },
    });

    if (!customerCredential) {
      return NextResponse.json(
        { error: 'Customer not found' },
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

    // Check if passkeys are enabled
    if (!customerCredential.passkeyEnabled || !customerCredential.passkeyCredentials.length) {
      return NextResponse.json(
        { error: 'No passkeys registered for this account' },
        { status: 404 }
      );
    }

    // Parse existing credentials
    const userCredentials = customerCredential.passkeyCredentials.map(parseStoredCredential);

    // Generate authentication options
    const options = await generatePasskeyAuthenticationOptions(userCredentials);

    // Store challenge and credential ID for verification
    const cookieStore = cookies();
    cookieStore.set('passkey_auth_challenge', options.challenge, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax', // Changed from 'strict' to 'lax' for consistency
      maxAge: 5 * 60, // 5 minutes
      path: '/',
    });

    cookieStore.set('passkey_auth_credential_id', customerCredential.id, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 5 * 60, // 5 minutes
      path: '/',
    });

    return NextResponse.json({
      success: true,
      options,
      message: 'Authentication options generated successfully',
    });

  } catch (error) {
    console.error('Customer passkey authentication begin error:', error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request data', details: error.errors },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to generate authentication options' },
      { status: 500 }
    );
  }
}
