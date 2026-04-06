import { NextRequest, NextResponse } from 'next/server';
import { verifyPartnerAuth } from '@/lib/auth/partnerAuth';
import { prisma } from '@/lib/prisma';
import walkthroughConfig from '@/config/walkthroughJourney.json';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    // Verify partner authentication
    const partner = await verifyPartnerAuth(request);
    if (!partner) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get partner's walkthrough data
    const partnerData = await prisma.partner.findUnique({
      where: { id: partner.id },
      select: {
        id: true,
        walkthroughProgress: true,
        walkthroughStartedAt: true,
        walkthroughCompletedAt: true,
        currentWalkthroughStep: true,
        walkthroughSkipped: true,
        walkthroughVersion: true,
      },
    });

    if (!partnerData) {
      return NextResponse.json(
        { error: 'Partner not found' },
        { status: 404 }
      );
    }

    // Parse progress data
    const progress = partnerData.walkthroughProgress as any || {};
    const currentStep = partnerData.currentWalkthroughStep || 0;
    const isCompleted = !!partnerData.walkthroughCompletedAt;
    const isSkipped = partnerData.walkthroughSkipped;
    const completedSteps = progress.completedSteps || 0;

    // Get next step information
    let nextStep = null;
    if (!isCompleted && !isSkipped && currentStep < walkthroughConfig.totalSteps) {
      const nextStepConfig = walkthroughConfig.steps.find(step => step.stepNumber === currentStep + 1);
      if (nextStepConfig) {
        nextStep = {
          id: nextStepConfig.id,
          stepNumber: nextStepConfig.stepNumber,
          title: nextStepConfig.title,
          description: nextStepConfig.description,
          targetPage: nextStepConfig.targetPage,
          videoUrl: nextStepConfig.videoUrl,
        };
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        partnerId: partner.id,
        currentStep,
        totalSteps: walkthroughConfig.totalSteps,
        completedSteps,
        isCompleted,
        isSkipped,
        startedAt: partnerData.walkthroughStartedAt?.toISOString() || null,
        completedAt: partnerData.walkthroughCompletedAt?.toISOString() || null,
        version: partnerData.walkthroughVersion || '1.0',
        progress,
        nextStep,
      },
    });

  } catch (error) {
    console.error('Error fetching walkthrough progress:', error);
    return NextResponse.json(
      { error: 'Failed to fetch walkthrough progress' },
      { status: 500 }
    );
  }
}
