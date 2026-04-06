import { NextResponse } from 'next/server';
import { verifyJWT } from '@/lib/jwt';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    // Get the token from the Authorization header
    const authHeader = request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'No token provided' }, { status: 401 });
    }

    const token = authHeader.split(' ')[1];
    const payload = await verifyJWT(token);

    if (!payload || !payload.partnerId) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    // Fetch partner data from the database
    const partner = await prisma.partner.findUnique({
      where: {
        id: payload.partnerId
      },
      select: {
        id: true,
        businessName: true,
        contactName: true,
        emailAddress: true,
        approvalStatus: true,
        hasChangedPassword: true,
        retellApiKey: true
      }
    });

    if (!partner) {
      return NextResponse.json({ error: 'Partner not found' }, { status: 404 });
    }

    // Update last login time
    await prisma.partner.update({
      where: { id: payload.partnerId },
      data: { lastLoginAt: new Date() }
    });

    return NextResponse.json({
      id: partner.id,
      name: partner.contactName || partner.businessName,
      email: partner.emailAddress,
      approvalStatus: partner.approvalStatus,
      hasChangedPassword: partner.hasChangedPassword,
      retellApiKey: !!partner.retellApiKey
    });
  } catch (error) {
    console.error('Error in /api/partner/me:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}