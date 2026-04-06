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
    const { reason, confirmSkip } = body;

    // Require confirmation
    if (!confirmSkip) {
      return NextResponse.json(
        { error: 'Confirmation required to skip walkthrough' },
        { status: 400 }
      );
    }

    // Get current partner data
    const partnerData = await prisma.partner.findUnique({
      where: { id: partner.id },
      select: {
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

    // Check if already skipped or completed
    if (partnerData.walkthroughSkipped) {
      return NextResponse.json(
        { error: 'Walkthrough is already skipped' },
        { status: 400 }
      );
    }

    if (partnerData.walkthroughCompletedAt) {
      return NextResponse.json(
        { error: 'Walkthrough is already completed' },
        { status: 400 }
      );
    }

    // Unlock all menus
    const allMenus = Object.keys(walkthroughConfig.menuUnlockRules);
    const skipProgress = {
      steps: {},
      unlockedMenus: allMenus,
      totalSteps: walkthroughConfig.totalSteps,
      completedSteps: 0,
      skippedAt: new Date().toISOString(),
      skipReason: reason || 'User chose to skip walkthrough',
    };

    // Update partner data
    await prisma.partner.update({
      where: { id: partner.id },
      data: {
        walkthroughSkipped: true,
        walkthroughProgress: skipProgress,
        currentWalkthroughStep: walkthroughConfig.totalSteps,
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        partnerId: partner.id,
        skippedAt: skipProgress.skippedAt,
        unlockedMenus: allMenus,
      },
      message: 'Walkthrough skipped successfully. All features are now unlocked.',
    });

  } catch (error) {
    console.error('Error skipping walkthrough:', error);
    return NextResponse.json(
      { error: 'Failed to skip walkthrough' },
      { status: 500 }
    );
  }
}
