import { NextRequest, NextResponse } from 'next/server';

// This route uses dynamic features, so it must be server-rendered
export const dynamic = 'force-dynamic';

import { prisma } from '@/lib/prisma';
import { verifyPartnerJWT } from '@/lib/auth';

// GET /api/partner/video-tutorials
export async function GET(req: NextRequest) {
  try {
    // Verify the partner JWT token
    const decoded = await verifyPartnerJWT(req);
    if (!decoded || !decoded.payload || !decoded.isValid) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const partnerId = decoded.payload.partnerId;

    // Get partner videos (active only)
    const videos = await prisma.videoTutorial.findMany({
      where: {
        audience: 'partner',
        isActive: true,
      },
      orderBy: {
        sequence: 'asc',
      },
    });

    return NextResponse.json({ videos });
  } catch (error) {
    console.error('Error fetching partner video tutorials:', error);
    return NextResponse.json(
      { error: 'Failed to fetch video tutorials' },
      { status: 500 }
    );
  }
}
