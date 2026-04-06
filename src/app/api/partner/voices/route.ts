export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyPartnerJWT } from '@/lib/auth';

// GET /api/partner/voices - Get available voices for partner
export async function GET(request: NextRequest) {
  try {
    // Verify partner authentication
    const auth = await verifyPartnerJWT(request);
    if (!auth.isValid) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    console.log('[partner/voices] Fetching available voices for partner');

    // Get all active voices available to partners
    const voices = await prisma.voice.findMany({
      where: {
        isActive: true
      },
      orderBy: {
        displayName: 'asc'
      },
      select: {
        id: true,
        name: true,
        displayName: true,
        provider: true,
        voiceModelId: true,
        sampleUrl: true,
        sex: true,
        voiceType: true,
        language: true,
        accent: true,
        description: true
      }
    });

    console.log(`[partner/voices] Found ${voices.length} available voices`);

    return NextResponse.json(voices);

  } catch (error: any) {
    console.error('[partner/voices] Error fetching voices:', error);
    return NextResponse.json(
      { 
        error: 'Failed to fetch voices',
        message: error.message || 'An unexpected error occurred'
      },
      { status: 500 }
    );
  }
}
