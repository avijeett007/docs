import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import jwt from 'jsonwebtoken';
import { CreditService } from '@/lib/services/creditService';



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
    const body = await request.json();
    const { proofSubmitted } = body;

    // Get challenge and progress
    const [challenge, progress] = await Promise.all([
      prisma.dailyChallenge.findUnique({
        where: { id: challengeId }
      }),
      prisma.partnerChallengeProgress.findUnique({
        where: {
          partnerId_challengeId: {
            partnerId,
            challengeId
          }
        }
      })
    ]);

    if (!challenge) {
      return NextResponse.json({ error: 'Challenge not found' }, { status: 404 });
    }

    if (!progress) {
      return NextResponse.json({ error: 'Challenge not started' }, { status: 400 });
    }

    if (progress.status === 'completed') {
      return NextResponse.json({ error: 'Challenge already completed' }, { status: 400 });
    }

    // Parse steps from JSON string to array
    let steps;
    try {
      steps = typeof challenge.steps === 'string'
        ? JSON.parse(challenge.steps)
        : challenge.steps;
    } catch (error) {
      console.error('Error parsing challenge steps:', error);
      return NextResponse.json({ error: 'Invalid challenge data' }, { status: 500 });
    }

    // Validate all steps are completed
    const completedSteps = progress.completedSteps as string[];

    if (completedSteps.length < steps.length) {
      return NextResponse.json({ 
        error: 'All steps must be completed before finishing the challenge',
        data: {
          completedSteps: completedSteps.length,
          totalSteps: steps.length
        }
      }, { status: 400 });
    }

    // Check if proof is required
    if (challenge.requiresProof && !proofSubmitted) {
      return NextResponse.json({ error: 'Proof submission is required for this challenge' }, { status: 400 });
    }

    // Complete the challenge and award credits
    const updatedProgress = await prisma.partnerChallengeProgress.update({
      where: { id: progress.id },
      data: {
        status: 'completed',
        completedAt: new Date(),
        creditsAwarded: challenge.rewardCredits,
        proofSubmitted: proofSubmitted || null,
        proofStatus: challenge.requiresProof ? 'pending' : 'approved',
        updatedAt: new Date()
      }
    });

    // Credits will be awarded when partner manually claims them
    // This allows for social sharing and better engagement

    return NextResponse.json({
      success: true,
      data: {
        challengeId,
        status: updatedProgress.status,
        completedAt: updatedProgress.completedAt,
        creditsAwarded: updatedProgress.creditsAwarded,
        requiresApproval: challenge.requiresProof,
        message: challenge.requiresProof
          ? 'Challenge completed! Credits will be awarded after proof review.'
          : `Challenge completed! Claim your ${challenge.rewardCredits} credits from the sidebar.`
      }
    });

  } catch (error) {
    console.error('Error completing challenge:', error);
    return NextResponse.json({ 
      error: 'Internal server error',
      details: process.env.NODE_ENV === 'development' ? error : undefined
    }, { status: 500 });
  }
}
