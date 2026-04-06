import { NextRequest, NextResponse } from 'next/server';
import { verifyPartnerAuth } from '@/lib/auth/partnerAuth';
import { prisma } from '@/lib/prisma';
import walkthroughConfig from '@/config/walkthroughJourney.json';

export async function POST(
  request: NextRequest,
  { params }: { params: { stepId: string } }
) {
  try {
    // Verify partner authentication
    const partner = await verifyPartnerAuth(request);
    if (!partner) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { stepId } = params;
    const body = await request.json();
    const { videoWatched = false, watchPercentage = 0, completionData = {}, skipped = false } = body;

    // Find the step configuration
    const stepConfig = walkthroughConfig.steps.find(step => step.id === stepId);
    if (!stepConfig) {
      return NextResponse.json(
        { error: 'Invalid step ID' },
        { status: 400 }
      );
    }

    // Get current partner data
    const partnerData = await prisma.partner.findUnique({
      where: { id: partner.id },
      select: {
        walkthroughProgress: true,
        currentWalkthroughStep: true,
        walkthroughSkipped: true,
        walkthroughCompletedAt: true,
      },
    });

    if (!partnerData) {
      return NextResponse.json(
        { error: 'Partner not found' },
        { status: 404 }
      );
    }

    // Check if walkthrough is already completed or skipped
    if (partnerData.walkthroughSkipped || partnerData.walkthroughCompletedAt) {
      return NextResponse.json(
        { error: 'Walkthrough is already completed or skipped' },
        { status: 400 }
      );
    }

    // Parse current progress
    const currentProgress = partnerData.walkthroughProgress as any || {
      steps: {},
      unlockedMenus: ['dashboard'],
      totalSteps: walkthroughConfig.totalSteps,
      completedSteps: 0,
    };

    // Check if step is already completed
    if (currentProgress.steps[stepConfig.stepNumber]?.completed) {
      return NextResponse.json(
        { error: 'Step already completed' },
        { status: 400 }
      );
    }

    // Update step progress
    const now = new Date().toISOString();
    currentProgress.steps[stepConfig.stepNumber] = {
      stepId: stepConfig.id,
      completed: true,
      completedAt: now,
      videoWatched,
      watchPercentage,
      skipped,
      data: completionData,
    };

    // Update completed steps count
    currentProgress.completedSteps = Object.values(currentProgress.steps).filter(
      (step: any) => step.completed
    ).length;

    // Add newly unlocked menus
    const newlyUnlockedMenus = stepConfig.unlocksMenus || [];
    const existingUnlockedMenus = currentProgress.unlockedMenus || ['dashboard'];
    const updatedUnlockedMenus = [...new Set([...existingUnlockedMenus, ...newlyUnlockedMenus])];
    currentProgress.unlockedMenus = updatedUnlockedMenus;

    // Determine next step
    const nextStepNumber = stepConfig.stepNumber + 1;
    const isLastStep = stepConfig.isLastStep || nextStepNumber > walkthroughConfig.totalSteps;
    
    let nextStep = null;
    if (!isLastStep) {
      const nextStepConfig = walkthroughConfig.steps.find(step => step.stepNumber === nextStepNumber);
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

    // Update database
    const updateData: any = {
      walkthroughProgress: currentProgress,
      currentWalkthroughStep: isLastStep ? walkthroughConfig.totalSteps : nextStepNumber - 1,
    };

    // If this is the last step, mark walkthrough as completed
    if (isLastStep) {
      updateData.walkthroughCompletedAt = new Date();
      // Unlock all remaining menus
      const allMenus = Object.keys(walkthroughConfig.menuUnlockRules);
      currentProgress.unlockedMenus = allMenus;
      updateData.walkthroughProgress = currentProgress;
    }

    await prisma.partner.update({
      where: { id: partner.id },
      data: updateData,
    });

    return NextResponse.json({
      success: true,
      data: {
        stepCompleted: {
          stepId: stepConfig.id,
          completed: true,
          completedAt: now,
        },
        newlyUnlockedMenus,
        nextStep,
        walkthroughCompleted: isLastStep,
      },
      message: isLastStep ? 'Walkthrough completed!' : 'Step completed successfully',
    });

  } catch (error) {
    console.error('Error completing walkthrough step:', error);
    return NextResponse.json(
      { error: 'Failed to complete step' },
      { status: 500 }
    );
  }
}
