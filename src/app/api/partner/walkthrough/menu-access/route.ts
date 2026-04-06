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
        walkthroughProgress: true,
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

    // If walkthrough is skipped or completed, unlock all menus
    if (partnerData.walkthroughSkipped || partnerData.walkthroughCompletedAt) {
      const allMenus = Object.keys(walkthroughConfig.menuUnlockRules);
      return NextResponse.json({
        success: true,
        data: {
          partnerId: partner.id,
          unlockedMenus: allMenus,
          lockedMenus: [],
          menuStatus: Object.fromEntries(
            allMenus.map(menu => [menu, {
              unlocked: true,
              requiredSteps: [],
              completedRequiredSteps: [],
              pendingSteps: [],
            }])
          ),
        },
      });
    }

    // Parse progress data
    const progress = partnerData.walkthroughProgress as any || {
      steps: {},
      unlockedMenus: ['dashboard'],
      totalSteps: walkthroughConfig.totalSteps,
      completedSteps: 0,
    };

    const unlockedMenus = progress.unlockedMenus || ['dashboard'];
    const completedSteps = Object.keys(progress.steps || {}).filter(
      stepNum => progress.steps[stepNum]?.completed
    );

    // Calculate menu status
    const menuStatus: Record<string, any> = {};
    const allMenus = Object.keys(walkthroughConfig.menuUnlockRules);
    const lockedMenus: string[] = [];

    for (const menuId of allMenus) {
      const rule = walkthroughConfig.menuUnlockRules[menuId as keyof typeof walkthroughConfig.menuUnlockRules];
      if (!rule) continue;

      const isUnlockedByDefault = rule.unlockedByDefault;
      const requiredSteps = rule.requiredSteps || [];
      
      // Check which required steps are completed
      const completedRequiredSteps = requiredSteps.filter(stepId => {
        const stepConfig = walkthroughConfig.steps.find(s => s.id === stepId);
        if (!stepConfig) return false;
        return progress.steps[stepConfig.stepNumber]?.completed || false;
      });

      const pendingSteps = requiredSteps.filter(stepId => !completedRequiredSteps.includes(stepId));
      const isUnlocked = isUnlockedByDefault || 
                        requiredSteps.length === 0 || 
                        completedRequiredSteps.length === requiredSteps.length ||
                        unlockedMenus.includes(menuId);

      menuStatus[menuId] = {
        unlocked: isUnlocked,
        requiredSteps,
        completedRequiredSteps,
        pendingSteps,
      };

      if (!isUnlocked) {
        lockedMenus.push(menuId);
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        partnerId: partner.id,
        unlockedMenus,
        lockedMenus,
        menuStatus,
      },
    });

  } catch (error) {
    console.error('Error fetching menu access status:', error);
    return NextResponse.json(
      { error: 'Failed to fetch menu access status' },
      { status: 500 }
    );
  }
}
