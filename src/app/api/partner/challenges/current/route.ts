import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import jwt from 'jsonwebtoken';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
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

    // Check if partner should see daily challenges (onboarding completed)
    const partner = await prisma.partner.findUnique({
      where: { id: partnerId },
      select: {
        walkthroughCompletedAt: true,
      }
    });

    if (!partner) {
      return NextResponse.json({ error: 'Partner not found' }, { status: 404 });
    }

    // Only show daily challenges if onboarding is completed
    if (!partner.walkthroughCompletedAt) {
      return NextResponse.json({
        success: true,
        data: null,
        message: 'Complete onboarding to unlock daily challenges'
      });
    }

    // Check if enough time has passed since onboarding completion (1 day delay in production)
    const nodeEnv = process.env.NODE_ENV || '';
    const isDevelopment = ['development', 'local'].includes(nodeEnv) ||
                         process.env.DATABASE_PROVIDER === 'sqlite';
    if (!isDevelopment) {
      const oneDayAfterCompletion = new Date(partner.walkthroughCompletedAt);
      oneDayAfterCompletion.setDate(oneDayAfterCompletion.getDate() + 1);

      if (new Date() < oneDayAfterCompletion) {
        return NextResponse.json({
          success: true,
          data: null,
          message: 'Daily challenges will be available tomorrow'
        });
      }
    }

    // Get all active challenges in creation order
    const allChallenges = await prisma.dailyChallenge.findMany({
      where: {
        isActive: true
      },
      orderBy: {
        createdAt: 'asc' // Sequential order based on creation time
      }
    });

    if (allChallenges.length === 0) {
      return NextResponse.json({
        success: true,
        data: null,
        message: 'No challenges available'
      });
    }

    // Get all partner's progress records
    const allProgress = await prisma.partnerChallengeProgress.findMany({
      where: {
        partnerId: partnerId
      },
      orderBy: {
        completedAt: 'desc'
      }
    });

    // Create a map of completed challenges for quick lookup
    const completedChallenges = new Set(
      allProgress
        .filter(p => p.status === 'completed')
        .map(p => p.challengeId)
    );

    // Check if we need to wait before showing the next challenge
    if (!isDevelopment && completedChallenges.size > 0) {
      // Find the most recent completion
      const lastCompletion = allProgress.find(p => p.status === 'completed' && p.completedAt);

      if (lastCompletion && lastCompletion.completedAt) {
        const oneDayAfterLastCompletion = new Date(lastCompletion.completedAt);
        oneDayAfterLastCompletion.setDate(oneDayAfterLastCompletion.getDate() + 1);

        if (new Date() < oneDayAfterLastCompletion) {
          return NextResponse.json({
            success: true,
            data: null,
            message: 'Next challenge will be available tomorrow'
          });
        }
      }
    }

    // Find the current challenge to show
    let currentChallenge;

    // Always try to find the next uncompleted challenge first
    currentChallenge = allChallenges.find(challenge =>
      !completedChallenges.has(challenge.id)
    );

    // In development mode, if no uncompleted challenges, show the first one for retesting
    if (!currentChallenge && isDevelopment && allChallenges.length > 0) {
      currentChallenge = allChallenges[0];
      console.log('Development mode: Showing first challenge for retesting');
    }

    if (!currentChallenge) {
      return NextResponse.json({
        success: true,
        data: null,
        message: isDevelopment
          ? 'No challenges available for testing'
          : 'All challenges completed! Check back for new challenges.'
      });
    }

    // Get partner's progress for the current challenge
    const progress = allProgress.find(p => p.challengeId === currentChallenge.id);

    // Parse steps from JSON string to array
    let parsedSteps;
    try {
      parsedSteps = typeof currentChallenge.steps === 'string'
        ? JSON.parse(currentChallenge.steps)
        : currentChallenge.steps;
    } catch (error) {
      console.error('Error parsing challenge steps:', error);
      parsedSteps = [];
    }

    return NextResponse.json({
      success: true,
      data: {
        id: currentChallenge.id,
        title: currentChallenge.title,
        description: currentChallenge.description,
        steps: parsedSteps,
        rewardCredits: currentChallenge.rewardCredits,
        requiresProof: currentChallenge.requiresProof,
        scheduledDate: currentChallenge.scheduledDate,
        createdAt: currentChallenge.createdAt,
        partnerProgress: progress ? {
          status: progress.status,
          completedSteps: progress.completedSteps,
          startedAt: progress.startedAt,
          completedAt: progress.completedAt,
          creditsAwarded: progress.creditsAwarded
        } : null
      }
    });

  } catch (error) {
    console.error('Error fetching current challenge:', error);
    return NextResponse.json({ 
      error: 'Internal server error',
      details: process.env.NODE_ENV === 'development' ? error : undefined
    }, { status: 500 });
  }
}
