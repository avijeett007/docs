import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyWhitelabelAuth } from '@/lib/whitelabelAuth';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  console.log('🚀 RESUME API CALLED - START');
  try {
    // Verify customer authentication
    const authResult = await verifyWhitelabelAuth(request);
    if (!authResult) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { customerId, partnerId } = authResult;

    // Get customer email from database
    const customer = await prisma.customer.findUnique({
      where: { id: customerId },
      select: { email: true }
    });

    if (!customer) {
      return NextResponse.json({ error: 'Customer not found' }, { status: 404 });
    }

    // Debug logging
    console.log('🔍 RESUME API DEBUG:');
    console.log('  Customer ID:', customerId);
    console.log('  Partner ID:', partnerId);
    console.log('  Customer email (raw):', `"${customer.email}"`);
    console.log('  Customer email (lowercase):', `"${customer.email.toLowerCase()}"`);

    // Look for prospect entry with same email and partner (case insensitive)
    const prospect = await prisma.prospect.findFirst({
      where: {
        email: {
          equals: customer.email.toLowerCase(),
          mode: 'insensitive'
        },
        partnerId: partnerId,
        isCompleted: false // Only incomplete prospects
      },
      select: {
        id: true,
        currentStep: true,
        businessName: true,
        businessWebsite: true,
        firstName: true,
        lastName: true,
        email: true,
        phone: true,
        serviceCategories: true,
        greetingText: true,
        voiceType: true,
        selectedVoiceId: true,
        informationSettings: true,
        meetingUrl: true,
        smsEnabled: true,
        callTransferEnabled: true,
        transferNumber: true,
        selectedPricingPlan: true,
        createdAt: true,
        updatedAt: true
      }
    });

    console.log('  Prospect found:', prospect ? 'YES' : 'NO');
    if (prospect) {
      console.log('  Prospect email:', `"${prospect.email}"`);
      console.log('  Prospect step:', prospect.currentStep);
    } else {
      // Let's also check if there are any prospects with this email (case insensitive)
      const allProspects = await prisma.prospect.findMany({
        where: {
          partnerId: partnerId
        },
        select: {
          id: true,
          email: true,
          currentStep: true,
          isCompleted: true
        }
      });
      console.log('  All prospects for this partner:', allProspects.length);
      allProspects.forEach((p, index) => {
        const email = p.email || 'null';
        console.log(`    ${index + 1}. "${email}" (step: ${p.currentStep}, completed: ${p.isCompleted})`);
        if (p.email) {
          console.log(`       Email match: ${p.email.toLowerCase() === customer.email.toLowerCase()}`);
        }
      });
    }

    if (!prospect) {
      return NextResponse.json({
        hasIncompleteOnboarding: false,
        message: 'No incomplete onboarding found'
      });
    }

    // Determine the next step based on current step
    // If at step 3, skip to step 4 since prospect-to-customer conversion already happened
    // (user is logged in, so they're already a customer)
    let nextStep = prospect.currentStep;
    let message = `You have an incomplete onboarding at step ${prospect.currentStep}. Would you like to continue?`;

    if (prospect.currentStep === 3) {
      nextStep = 4;
      message = `You have an incomplete onboarding. Since you're already logged in, we'll continue from step 4.`;
      console.log('🔄 RESUME API - Step 3 detected, skipping to step 4 since user is already a customer');
    }

    // Calculate progress percentage based on next step
    const progressPercentage = Math.round((nextStep / 9) * 100);

    return NextResponse.json({
      hasIncompleteOnboarding: true,
      prospect: {
        ...prospect,
        currentStep: nextStep, // Update to the next step
        progressPercentage: progressPercentage,
        nextStep: nextStep,
        resumeUrl: `/whitelabel/onboarding/${nextStep}`
      },
      message: message
    });

  } catch (error) {
    console.error('Error checking prospect resume:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
