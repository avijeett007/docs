import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';

export async function POST(request: NextRequest) {
  let partnerId: string | undefined;
  let step: number | undefined;
  let prospectId: string | undefined;

  try {
    const body = await request.json();
    const { data } = body;
    partnerId = body.partnerId;
    step = body.step;
    prospectId = body.prospectId;

    if (!partnerId || !step) {
      return NextResponse.json(
        { error: 'partnerId and step are required' },
        { status: 400 }
      );
    }

    // Filter data to only include valid prospect fields (keep camelCase as Prisma uses camelCase)
    const validData: any = {};
    if (data) {
      // Valid prospect fields in camelCase (as used by Prisma)
      const validFields = [
        'businessName',
        'businessWebsite',
        'hasNoWebsite',
        'websiteAnalysis',
        // Business Lookup Data fields
        'businessLookupData',
        'businessCountry',
        'businessPlaceId',
        'businessRating',
        'businessPhone',
        'businessAddress',
        'businessTypes',
        'businessReviewsCount',
        'businessWebsiteVerified',
        'businessLookupTimestamp',
        'firstName',
        'lastName',
        'email',
        'phone',
        'serviceCategories',
        'knowledgeBaseFiles',
        'knowledgeBaseUrls',
        'greetingText',
        'voiceType',
        'selectedVoiceId',
        'voicePreviewCount',
        'informationSettings',
        'meetingUrl',
        'smsEnabled',
        'callTransferEnabled',
        'transferNumber',
        'deploymentSettings',
        'selectedPricingPlan',
        'billingModel',
        'currentStep',
        'isCompleted'
      ];

      Object.keys(data).forEach(key => {
        if (validFields.includes(key)) {
          validData[key] = data[key];
        }
        // Skip invalid fields like knowledgeBaseId
      });
    }

    // Get or create prospect based on step and prospectId
    let prospect;

    if (step === 1) {
      // Step 1: Always create a new prospect for each business entry
      prospect = await prisma.prospect.create({
        data: {
          partnerId: partnerId,
          currentStep: step,
          completedSteps: JSON.stringify([]),
          ...validData
        }
      });

      logger.info('Created new prospect for business entry', {
        operation: 'prospect_creation',
        prospectId: prospect.id,
        partnerId,
        step,
        businessName: validData.businessName
      });
    } else if (prospectId) {
      // Subsequent steps with specific prospect ID: Update the specific prospect
      prospect = await prisma.prospect.findUnique({
        where: { id: prospectId }
      });

      if (!prospect) {
        return NextResponse.json(
          { error: 'Prospect not found' },
          { status: 404 }
        );
      }

      if (prospect.partnerId !== partnerId) {
        return NextResponse.json(
          { error: 'Prospect does not belong to this partner' },
          { status: 403 }
        );
      }

      // Update the specific prospect
      const completedSteps = JSON.parse(prospect.completedSteps as string || '[]');
      if (!completedSteps.includes(step)) {
        completedSteps.push(step);
      }

      prospect = await prisma.prospect.update({
        where: { id: prospect.id },
        data: {
          currentStep: Math.max(step, prospect.currentStep),
          completedSteps: JSON.stringify(completedSteps),
          ...validData
        }
      });

      logger.info('Updated specific prospect', {
        operation: 'prospect_update',
        prospectId: prospect.id,
        partnerId,
        step,
        businessName: validData.businessName || prospect.businessName
      });
    } else {
      // Fallback: Look for any incomplete prospect for this partner (legacy behavior)
      prospect = await prisma.prospect.findFirst({
        where: {
          partnerId: partnerId,
          isCompleted: false
        },
        orderBy: {
          updatedAt: 'desc'
        }
      });

      if (!prospect) {
        // Create new prospect if none found
        prospect = await prisma.prospect.create({
          data: {
            partnerId: partnerId,
            currentStep: step,
            completedSteps: JSON.stringify([]),
            ...validData
          }
        });
      } else {
        // Update existing prospect
        const completedSteps = JSON.parse(prospect.completedSteps as string || '[]');
        if (!completedSteps.includes(step)) {
          completedSteps.push(step);
        }

        prospect = await prisma.prospect.update({
          where: { id: prospect.id },
          data: {
            currentStep: Math.max(step, prospect.currentStep),
            completedSteps: JSON.stringify(completedSteps),
            ...validData
          }
        });
      }
    }

    return NextResponse.json({
      success: true,
      prospect: prospect
    });

  } catch (error) {
    logger.error('Error managing prospect', error as Error, {
      operation: 'prospect_management',
      partnerId,
      step,
      prospectId
    });
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  let partnerId: string | null = null;

  try {
    const { searchParams } = new URL(request.url);
    partnerId = searchParams.get('partnerId');

    if (!partnerId) {
      return NextResponse.json(
        { error: 'partnerId is required' },
        { status: 400 }
      );
    }

    // Get current prospect for this partner
    const prospect = await prisma.prospect.findFirst({
      where: {
        partnerId: partnerId,
        isCompleted: false
      },
      orderBy: {
        updatedAt: 'desc'
      }
    });

    return NextResponse.json({
      success: true,
      prospect: prospect
    });

  } catch (error) {
    logger.error('Error fetching prospect', error as Error, {
      operation: 'prospect_fetch',
      partnerId: partnerId || undefined
    });
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
