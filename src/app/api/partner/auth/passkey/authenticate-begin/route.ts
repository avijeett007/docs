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
    if (!checkRateLimit(`partner-passkey-auth:${clientIP}`, 5, 15 * 60 * 1000)) {
      return NextResponse.json(
        { error: 'Too many authentication attempts. Please try again later.' },
        { status: 429 }
      );
    }

    // Parse request body
    const body = await request.json();
    const { email } = requestSchema.parse(body);

    // Find partner by email
    const partner = await prisma.partner.findUnique({
      where: { emailAddress: email },
      select: {
        id: true,
        emailAddress: true,
        approvalStatus: true,
        passkeyEnabled: true,
        passkeyCredentials: true,
      },
    });

    if (!partner) {
      return NextResponse.json(
        { error: 'Partner not found' },
        { status: 404 }
      );
    }

    // Check approval status (allow APPROVED as well as ACTIVE)
    if (partner.approvalStatus !== 'ACTIVE' && partner.approvalStatus !== 'APPROVED') {
      return NextResponse.json(
        { error: 'Partner account is not active' },
        { status: 403 }
      );
    }

    // Check if passkeys are enabled
    if (!partner.passkeyEnabled || !partner.passkeyCredentials.length) {
      return NextResponse.json(
        { error: 'No passkeys registered for this account' },
        { status: 404 }
      );
    }

    // Parse existing credentials
    const userCredentials = partner.passkeyCredentials.map(parseStoredCredential);

    // Generate authentication options
    const options = await generatePasskeyAuthenticationOptions(userCredentials);

    // Store challenge and user ID for verification
    const cookieStore = cookies();
    cookieStore.set('passkey_auth_challenge', options.challenge, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 5 * 60, // 5 minutes
      path: '/',
    });

    cookieStore.set('passkey_auth_user_id', partner.id, {
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
    console.error('Passkey authentication begin error:', error);
    
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
