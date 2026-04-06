import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { prisma } from '@/lib/prisma';
import { verifyJWT } from '@/lib/jwt';
import { parseStoredCredential } from '@/lib/passkey';

export const dynamic = 'force-dynamic';

export async function GET(_request: NextRequest) {
  try {
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

    // Get partner's passkey credentials
    const partner = await prisma.partner.findUnique({
      where: { id: payload.partnerId },
      select: {
        id: true,
        passkeyEnabled: true,
        passkeyCredentials: true,
        passkeySetupAt: true,
        passkeyLastUsedAt: true,
      },
    });

    if (!partner) {
      return NextResponse.json(
        { error: 'Partner not found' },
        { status: 404 }
      );
    }

    // Parse and format credentials for response
    const credentials = partner.passkeyCredentials.map(cred => {
      const parsed = parseStoredCredential(cred);
      return {
        id: parsed.id,
        deviceName: parsed.deviceName,
        deviceType: parsed.deviceType,
        createdAt: parsed.createdAt,
        lastUsedAt: parsed.lastUsedAt,
        transports: parsed.transports,
        backedUp: parsed.backedUp,
      };
    });

    return NextResponse.json({
      success: true,
      passkeyEnabled: partner.passkeyEnabled,
      setupAt: partner.passkeySetupAt,
      lastUsedAt: partner.passkeyLastUsedAt,
      credentials,
      totalCredentials: credentials.length,
    });

  } catch (error) {
    console.error('Get passkey credentials error:', error);
    return NextResponse.json(
      { error: 'Failed to retrieve passkey credentials' },
      { status: 500 }
    );
  }
}
