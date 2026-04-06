import { NextRequest, NextResponse } from 'next/server';
import { verifyPartnerAuth } from '@/lib/auth/partnerAuth';
import { prisma } from '@/lib/prisma';
import { renewApiKey } from '@/lib/apiKeys';

export const dynamic = 'force-dynamic'; // Required to make the PUT request work correctly

// PUT /api/partner/api-keys/[keyId]/renew
export async function PUT(
  request: NextRequest,
  { params }: { params: { keyId: string } }
) {
  try {
    // Verify partner authentication
    const partner = await verifyPartnerAuth(request);
    if (!partner) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }
    const { keyId } = params;

    // Check if the API key exists and belongs to the partner
    const apiKey = await prisma.partnerApiKey.findUnique({
      where: {
        id: keyId,
        partnerId: partner.id,
      },
    });

    if (!apiKey) {
      return NextResponse.json(
        { error: 'API key not found' },
        { status: 404 }
      );
    }

    // Renew the API key
    const newApiKey = await renewApiKey(keyId, 'partner');

    return NextResponse.json({
      message: 'API key renewed successfully',
      apiKey: newApiKey,
    });
  } catch (error) {
    console.error('Error renewing API key:', error);
    return NextResponse.json(
      { error: 'Failed to renew API key' },
      { status: 500 }
    );
  }
}
