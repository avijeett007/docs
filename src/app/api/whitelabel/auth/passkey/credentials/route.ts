import { NextRequest, NextResponse } from 'next/server';
import { verifyWhitelabelAuth } from '@/lib/whitelabelAuth';
import { prisma } from '@/lib/prisma';
import { parseStoredCredential } from '@/lib/passkey';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    // Verify whitelabel authentication
    const authResult = await verifyWhitelabelAuth(request);
    if (!authResult) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    // Get customer credential's passkey credentials
    const customerCredential = await prisma.customerCredential.findFirst({
      where: {
        customerId: authResult.customerId,
        partnerId: authResult.partnerId,
      },
      select: {
        id: true,
        passkeyEnabled: true,
        passkeyCredentials: true,
        passkeySetupAt: true,
        passkeyLastUsedAt: true,
      },
    });

    if (!customerCredential) {
      return NextResponse.json(
        { error: 'Customer credential not found' },
        { status: 404 }
      );
    }

    // Parse and format credentials for response
    const credentials = customerCredential.passkeyCredentials.map(cred => {
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
      passkeyEnabled: customerCredential.passkeyEnabled,
      setupAt: customerCredential.passkeySetupAt,
      lastUsedAt: customerCredential.passkeyLastUsedAt,
      credentials,
      totalCredentials: credentials.length,
    });

  } catch (error) {
    console.error('Get customer passkey credentials error:', error);
    return NextResponse.json(
      { error: 'Failed to retrieve passkey credentials' },
      { status: 500 }
    );
  }
}
