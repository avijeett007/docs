import { NextRequest, NextResponse } from 'next/server';
import { signProspectJWT } from '@/lib/prospectJwt';
import { prisma } from '@/lib/prisma';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { prospectId, customerId, partnerId, email } = body;

    // Validate required fields
    if (!prospectId || !customerId || !partnerId || !email) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Verify that the customer and partner exist
    const [customer, partner] = await Promise.all([
      prisma.customer.findUnique({
        where: { id: customerId }
      }),
      prisma.partner.findUnique({
        where: { id: partnerId }
      })
    ]);

    if (!customer || !partner) {
      return NextResponse.json(
        { error: 'Invalid customer or partner' },
        { status: 400 }
      );
    }

    // Generate prospect token
    const prospectToken = await signProspectJWT({
      prospectId,
      customerId,
      partnerId,
      email: email.trim(),
      type: 'prospect'
    });

    return NextResponse.json({
      success: true,
      prospectToken
    });

  } catch (error) {
    console.error('Error generating prospect token:', error);
    return NextResponse.json(
      { error: 'Failed to generate prospect token' },
      { status: 500 }
    );
  }
}
