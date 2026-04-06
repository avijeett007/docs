import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { prisma } from '@/lib/prisma';
import { verifyJWT } from '@/lib/jwt';
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
    if (!checkRateLimit(`partner-passkey-register:${clientIP}`, 3, 15 * 60 * 1000)) {
      return NextResponse.json(
        { error: 'Too many registration attempts. Please try again later.' },
        { status: 429 }
      );
    }

    // Get partner token from cookies
    const cookieStore = cookies();
    const token = cookieStore.get('partner_token')?.value;

    if (!token) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    // Verify JWT token
    const payload = await verifyJWT(token);
    if (!payload) {
      return NextResponse.json(
        { error: 'Invalid authentication token' },
        { status: 401 }
      );
    }

    // Parse request body
    const body = await request.json();
    const { userDisplayName } = requestSchema.parse(body);

    // Get partner details
    const partner = await prisma.partner.findUnique({
      where: { id: payload.partnerId },
      select: {
        id: true,
        emailAddress: true,
        contactName: true,
        businessName: true,
        passkeyCredentials: true,
      },
    });

    if (!partner) {
      return NextResponse.json(
        { error: 'Partner not found' },
        { status: 404 }
      );
    }

    // Parse existing credentials
    const existingCredentials = partner.passkeyCredentials.map(parseStoredCredential);

    // Generate registration options
    const displayName = userDisplayName || partner.contactName || partner.businessName || 'Partner';
    const options = await generatePasskeyRegistrationOptions(
      partner.id,
      partner.emailAddress,
      displayName,
      existingCredentials
    );

    // Store challenge in session/cache for verification
    // In production, you might want to use Redis or a more robust session store
    // For now, we'll store it in a cookie (in production, consider Redis)
    cookieStore.set('passkey_challenge', options.challenge, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 5 * 60, // 5 minutes
      path: '/',
    });

    cookieStore.set('passkey_user_id', partner.id, {
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
    console.error('Passkey registration begin error:', error);
    
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
