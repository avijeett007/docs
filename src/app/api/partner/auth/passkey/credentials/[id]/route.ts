import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { prisma } from '@/lib/prisma';
import { verifyJWT } from '@/lib/jwt';
import { parseStoredCredential, serializeCredential } from '@/lib/passkey';

export const dynamic = 'force-dynamic';

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const credentialId = params.id;

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

    // Get partner's current credentials
    const partner = await prisma.partner.findUnique({
      where: { id: payload.partnerId },
      select: {
        id: true,
        passkeyCredentials: true,
      },
    });

    if (!partner) {
      return NextResponse.json(
        { error: 'Partner not found' },
        { status: 404 }
      );
    }

    // Find and remove the credential
    const currentCredentials = partner.passkeyCredentials.map(parseStoredCredential);
    const credentialIndex = currentCredentials.findIndex(cred => cred.id === credentialId);

    if (credentialIndex === -1) {
      return NextResponse.json(
        { error: 'Credential not found' },
        { status: 404 }
      );
    }

    // Remove the credential
    const updatedCredentials = currentCredentials.filter(cred => cred.id !== credentialId);
    const serializedCredentials = updatedCredentials.map(serializeCredential);

    // Update partner record
    await prisma.partner.update({
      where: { id: partner.id },
      data: {
        passkeyCredentials: serializedCredentials,
        passkeyEnabled: serializedCredentials.length > 0, // Disable if no credentials left
      },
    });

    return NextResponse.json({
      success: true,
      message: 'Passkey credential removed successfully',
      remainingCredentials: serializedCredentials.length,
    });

  } catch (error) {
    console.error('Delete passkey credential error:', error);
    return NextResponse.json(
      { error: 'Failed to remove passkey credential' },
      { status: 500 }
    );
  }
}
