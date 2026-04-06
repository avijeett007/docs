import { NextRequest, NextResponse } from 'next/server';
import { verifyPartnerAuth } from '@/lib/auth/partnerAuth';
import { prisma } from '@/lib/prisma';
import walkthroughConfig from '@/config/walkthroughJourney.json';

export async function POST(request: NextRequest) {
  try {
    // Verify partner authentication
    const partner = await verifyPartnerAuth(request);
    if (!partner) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { version = '1.0', resetProgress = false } = body;

    // Initialize progress structure
    const initialProgress = {
      steps: {},
      unlockedMenus: ['dashboard'], // Dashboard is always unlocked
      totalSteps: walkthroughConfig.totalSteps,
      completedSteps: 0,
      version,
    };

    // Update partner's walkthrough data
    const updateData: any = {
      walkthroughProgress: initialProgress,
      walkthroughStartedAt: new Date(),
      currentWalkthroughStep: 0,
      walkthroughSkipped: false,
      walkthroughVersion: version,
    };

    // If resetting, clear completion date
    if (resetProgress) {
      updateData.walkthroughCompletedAt = null;
    }

    await prisma.partner.update({
      where: { id: partner.id },
      data: updateData,
    });

    // Get first step information
    const firstStep = walkthroughConfig.steps[0];

    return NextResponse.json({
      success: true,
      data: {
        partnerId: partner.id,
        startedAt: updateData.walkthroughStartedAt.toISOString(),
        currentStep: 0,
        firstStep: {
          id: firstStep.id,
          stepNumber: firstStep.stepNumber,
          title: firstStep.title,
          description: firstStep.description,
          videoUrl: firstStep.videoUrl,
          targetPage: firstStep.targetPage,
        },
      },
      message: resetProgress ? 'Walkthrough restarted successfully' : 'Walkthrough started successfully',
    });

  } catch (error) {
    console.error('Error starting walkthrough:', error);
    return NextResponse.json(
      { error: 'Failed to start walkthrough' },
      { status: 500 }
    );
  }
}
