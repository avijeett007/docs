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
    const body = await request.json();
    const { stepId } = body;

    if (!stepId) {
      return NextResponse.json({ error: 'Step ID is required' }, { status: 400 });
    }

    // Get current progress
    const progress = await prisma.partnerChallengeProgress.findUnique({
      where: {
        partnerId_challengeId: {
          partnerId,
          challengeId
        }
      }
    });

    if (!progress) {
      return NextResponse.json({ error: 'Challenge not started' }, { status: 400 });
    }

    if (progress.status === 'completed') {
      return NextResponse.json({ error: 'Challenge already completed' }, { status: 400 });
    }

    // Get challenge details to validate step
    const challenge = await prisma.dailyChallenge.findUnique({
      where: { id: challengeId }
    });

    if (!challenge) {
      return NextResponse.json({ error: 'Challenge not found' }, { status: 404 });
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

    const stepExists = steps.some((step: any) => step.id === stepId);

    if (!stepExists) {
      return NextResponse.json({ error: 'Invalid step ID' }, { status: 400 });
    }

    // Add step to completed steps if not already completed
    const completedSteps = progress.completedSteps as string[];
    if (!completedSteps.includes(stepId)) {
      const updatedCompletedSteps = [...completedSteps, stepId];

      await prisma.partnerChallengeProgress.update({
        where: { id: progress.id },
        data: {
          completedSteps: updatedCompletedSteps,
          updatedAt: new Date()
        }
      });

      return NextResponse.json({
        success: true,
        data: {
          stepId,
          completedSteps: updatedCompletedSteps,
          totalSteps: steps.length,
          message: 'Step completed successfully'
        }
      });
    } else {
      return NextResponse.json({
        success: true,
        data: {
          stepId,
          completedSteps,
          totalSteps: steps.length,
          message: 'Step already completed'
        }
      });
    }

  } catch (error) {
    console.error('Error completing challenge step:', error);
    return NextResponse.json({ 
      error: 'Internal server error',
      details: process.env.NODE_ENV === 'development' ? error : undefined
    }, { status: 500 });
  }
}
