import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';

// This route uses dynamic features, so it must be server-rendered
export const dynamic = 'force-dynamic';

import { prisma } from '@/lib/prisma';
import { Voice } from '@prisma/client';
import { verifyJWT } from '@/lib/jwt';

// GET /api/voices - Get all voices (protected, requires partner authentication)
export async function GET(req: NextRequest) {
  try {
    // Check for partner token in Authorization header first, then cookies
    let token = req.headers.get('Authorization')?.replace('Bearer ', '');

    if (!token) {
      // Fallback to checking cookies
      token = cookies().get('partner_token')?.value;
    }

    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Verify partner JWT token
    const decodedToken = await verifyJWT(token);
    if (!decodedToken || !decodedToken.partnerId) {
      return NextResponse.json({
        error: 'Invalid token',
        message: 'Your session has expired. Please log in again.'
      }, { status: 401 });
    }

    // Verify partner exists
    const partner = await prisma.partner.findUnique({
      where: { id: decodedToken.partnerId }
    });

    if (!partner) {
      return NextResponse.json({
        error: 'Partner not found',
        message: 'Your account could not be found.'
      }, { status: 401 });
    }

    const voices = await prisma.voice.findMany({
      where: {
        isActive: true,
      },
      orderBy: {
        displayName: 'asc',
      },
    });

    return NextResponse.json({ voices });
  } catch (error) {
    console.error('Error fetching voices:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// POST /api/voices - Add a new voice (protected, requires admin API key)
export async function POST(req: NextRequest) {
  try {
    const adminApiKey = req.headers.get('x-admin-api-key');
    if (adminApiKey !== process.env.ADMIN_API_KEY) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const data = await req.json();
    const voice: Voice = await prisma.voice.create({
      data: {
        name: data.name,
        displayName: data.displayName,
        sex: data.sex,
        voiceType: data.voiceType,
        provider: data.provider,
        voiceModelId: data.voiceModelId || null,
        sampleUrl: data.sampleUrl,
        language: data.language || 'en',
        languageCapabilities: data.languageCapabilities || ['en'],
        useCases: data.useCases || [],
        accent: data.accent,
        ageRange: data.ageRange,
        description: data.description,
        tags: data.tags || [],
      } as any, // Temporary type assertion until Prisma client is updated
    });

    return NextResponse.json({ voice });
  } catch (error) {
    console.error('Error creating voice:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
