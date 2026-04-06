import { NextRequest, NextResponse } from 'next/server';
import { verifyWhitelabelAuth } from '@/lib/whitelabelAuth';
import { prisma } from '@/lib/prisma';
import { parseStoredCredential, serializeCredential } from '@/lib/passkey';

export const dynamic = 'force-dynamic';

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const credentialId = params.id;

    // Verify whitelabel authentication
    const authResult = await verifyWhitelabelAuth(request);
    if (!authResult) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    // Get customer credential's current credentials
    const customerCredential = await prisma.customerCredential.findFirst({
      where: {
        customerId: authResult.customerId,
        partnerId: authResult.partnerId,
      },
      select: {
        id: true,
        passkeyCredentials: true,
      },
    });

    if (!customerCredential) {
      return NextResponse.json(
        { error: 'Customer credential not found' },
        { status: 404 }
      );
    }

    // Find and remove the credential
    const currentCredentials = customerCredential.passkeyCredentials.map(parseStoredCredential);
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

    // Update customer credential record
    await prisma.customerCredential.update({
      where: { id: customerCredential.id },
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
    console.error('Delete customer passkey credential error:', error);
    return NextResponse.json(
      { error: 'Failed to remove passkey credential' },
      { status: 500 }
    );
  }
}
