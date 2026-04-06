import { NextRequest, NextResponse } from 'next/server';
import { verifyWhitelabelAuth } from '@/lib/whitelabelAuth';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    // Verify whitelabel authentication
    const authResult = await verifyWhitelabelAuth(req);
    if (!authResult) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { customerId, partnerId } = authResult;
    const body = await req.json();
    const { countryCode } = body;

    if (!countryCode) {
      return NextResponse.json(
        { error: 'Country code is required' },
        { status: 400 }
      );
    }

    // Check if customer has any stored addresses for this country
    const existingAddress = await prisma.phoneNumberAddress.findFirst({
      where: {
        customerId: customerId,
        partnerId: partnerId,
        country: countryCode
      },
      select: {
        id: true,
        addressSid: true,
        street: true,
        city: true,
        state: true,
        postalCode: true,
        country: true
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    return NextResponse.json({
      success: true,
      hasAddress: !!existingAddress,
      address: existingAddress ? {
        street: existingAddress.street,
        city: existingAddress.city,
        state: existingAddress.state,
        postalCode: existingAddress.postalCode,
        country: existingAddress.country
      } : null
    });

  } catch (error: any) {
    console.error('Address check error:', error);
    return NextResponse.json(
      { 
        error: 'Failed to check address',
        details: error.message 
      },
      { status: 500 }
    );
  }
}
