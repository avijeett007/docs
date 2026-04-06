import { NextResponse, NextRequest } from 'next/server';

// This route uses dynamic features, so it must be server-rendered
export const dynamic = 'force-dynamic';

import { prisma } from '@/lib/prisma';
import { getAuth } from '@clerk/nextjs/server';
import { syncUserWithGHL } from '@/lib/ghl';

export async function POST(req: NextRequest) {
  try {
    const { userId } = getAuth(req);

    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const data = await req.json();
    console.log('Received onboarding data:', data);
    
    // If partner code is provided, validate it
    let partnerId = null;
    if (data.isPartnerReferred === 'Yes' && data.partnerCode) {
      try {
        const partner = await prisma.partner.findFirst({
          where: {
            partnerCode: data.partnerCode,
            approvalStatus: 'ACTIVE'
          }
        });

        if (partner) {
          partnerId = partner.id;
        }
      } catch (error) {
        console.error('Error finding partner:', error);
        // Continue without partner if there's an error
      }
    }

    // Prepare the data for upsert
    const upsertData = {
      email: data.email || null,
      firstName: data.firstName || null,
      lastName: data.lastName || null,
      companyName: data.business?.companyName || null,
      businessPhone: data.business?.phone || null,
      monthlyCallVolume: data.callVolume?.monthlyCallVolume || null,
      peakHours: data.callVolume?.peakHours || null,
      primaryUseCase: data.useCase?.primaryUseCase || null,
      callComplexity: data.useCase?.callComplexity || null,
      crmSystem: data.integration?.crm || null,
      phoneSystem: data.integration?.existingPhone || null,
      scriptComplexity: data.customization?.scriptComplexity || null,
      languages: JSON.stringify(data.customization?.languages || []),
      deploymentTimeline: data.scheduling?.timeline || null,
      wantsDemo: data.scheduling?.existingAppointment === 'Yes',
      customAutomation: data.workflowAutomation?.customAutomation || null,
      isOnboardingCompleted: data.isOnboardingCompleted || false,
      estimatedPrice: data.estimatedPrice || 0,
      priceBreakdown: data.priceBreakdown || '{}',
      ...(partnerId && {
        partner: {
          connect: {
            id: partnerId
          }
        }
      }),
    };

    console.log('Preparing to upsert with data:', upsertData);

    // Create or update onboarding data
    const onboardingData = await prisma.userOnboarding.upsert({
      where: {
        userId,
      },
      update: upsertData,
      create: {
        userId,
        ...upsertData,
      },
    });

    console.log('Successfully saved onboarding data:', onboardingData);

    // Asynchronously sync with GHL
    if (data.isOnboardingCompleted) {
      syncUserWithGHL(userId).catch(error => {
        console.error('Error syncing user with GHL:', error);
      });
    }

    return NextResponse.json(onboardingData);
  } catch (error) {
    console.error('Error in onboarding POST:', error);
    return NextResponse.json(
      { error: 'Failed to save onboarding data', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  try {
    const { userId } = getAuth(req);

    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const userOnboarding = await prisma.userOnboarding.findUnique({
      where: {
        userId,
      },
    });

    if (!userOnboarding) {
      return NextResponse.json({});
    }

    return NextResponse.json(userOnboarding);
  } catch (error) {
    console.error('Error in onboarding GET:', error);
    return NextResponse.json(
      { error: 'Failed to fetch onboarding data', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
