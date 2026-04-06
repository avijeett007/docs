import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import jwt from 'jsonwebtoken';



export async function POST(
  request: NextRequest,
  { params }: { params: { challengeId: string } }
) {
  try {
    // Extract JWT token from Authorization header
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Missing or invalid authorization header' }, { status: 401 });
    }

    const token = authHeader.substring(7);
    let partnerId: string;

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET!) as { partnerId: string };
      partnerId = decoded.partnerId;
    } catch (error) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    const { challengeId } = params;

    // Verify challenge exists and is active
    const challenge = await prisma.dailyChallenge.findUnique({
      where: { id: challengeId }
    });

    if (!challenge) {
      return NextResponse.json({ error: 'Challenge not found' }, { status: 404 });
    }

    if (!challenge.isActive) {
      return NextResponse.json({ error: 'Challenge is not active' }, { status: 400 });
    }

    // Check if challenge is scheduled for today (skip in development mode)
    const nodeEnv = process.env.NODE_ENV || '';
    const isDevelopment = ['development', 'local'].includes(nodeEnv) ||
                         process.env.DATABASE_PROVIDER === 'sqlite';

    if (!isDevelopment) {
      const today = new Date().toISOString().split('T')[0];
      const challengeDate = challenge.scheduledDate?.toISOString().split('T')[0];

      if (challengeDate !== today) {
        return NextResponse.json({ error: 'Challenge is not available today' }, { status: 400 });
      }
    }

    // Start or update challenge progress
    // In development mode, allow restarting completed challenges
    const progress = await prisma.partnerChallengeProgress.upsert({
      where: {
        partnerId_challengeId: {
          partnerId,
          challengeId
        }
      },
      update: isDevelopment ? {
        // In development mode, reset everything to allow retesting
        status: 'in_progress',
        startedAt: new Date(),
        updatedAt: new Date(),
        completedAt: null,
        creditsAwarded: 0,
        completedSteps: []
      } : {
        // In production mode, just update status and timing
        status: 'in_progress',
        startedAt: new Date(),
        updatedAt: new Date()
      },
      create: {
        partnerId,
        challengeId,
        status: 'in_progress',
        startedAt: new Date(),
        completedSteps: []
      }
    });

    return NextResponse.json({
      success: true,
      data: {
        progressId: progress.id,
        status: progress.status,
        startedAt: progress.startedAt,
        message: 'Challenge started successfully'
      }
    });

  } catch (error) {
    console.error('Error starting challenge:', error);
    return NextResponse.json({ 
      error: 'Internal server error',
      details: process.env.NODE_ENV === 'development' ? error : undefined
    }, { status: 500 });
  }
}
