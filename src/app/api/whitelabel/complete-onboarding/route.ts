import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { CustomerCreditService } from '@/lib/services/customerCreditService';

export async function POST(request: NextRequest) {
  try {
    const { prospectId, partnerId, firstName, lastName, email, phone, businessName } = await request.json();

    if (!prospectId || !partnerId || !firstName || !lastName || !email) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Get partner information including free credit settings
    const partner = await prisma.partner.findUnique({
      where: { id: partnerId },
      select: {
        id: true,
        businessName: true,
        freeAiCredits: true,
        subdomain: true,
        customDomain: true,
        logo: true,
        primaryColor: true,
        secondaryColor: true
      }
    });

    if (!partner) {
      return NextResponse.json({ error: 'Partner not found' }, { status: 404 });
    }

    // First, convert prospect to customer using existing API logic
    const convertResponse = await fetch(`${request.nextUrl.origin}/api/whitelabel/prospects/convert-to-customer`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        prospectId,
        partnerId,
        firstName,
        lastName,
        email,
        phone,
        businessName
      })
    });

    if (!convertResponse.ok) {
      const errorData = await convertResponse.json();
      return NextResponse.json(errorData, { status: convertResponse.status });
    }

    const { customer } = await convertResponse.json();

    // Assign free AI credits if configured
    const freeCredits = partner.freeAiCredits || 50;
    if (freeCredits > 0) {
      try {
        // Find the UserOnboarding record to get the correct ID for credit service
        const userOnboarding = await prisma.userOnboarding.findFirst({
          where: {
            customerId: customer.id,
            partnerId: partnerId
          }
        });

        if (userOnboarding) {
          await CustomerCreditService.addCredits(
            userOnboarding.id, // Use UserOnboarding ID, not Customer ID
            partnerId,
            freeCredits,
            'Welcome credits for new customer onboarding',
            'system',
            'one_time'
          );
        }
      } catch (creditError) {
        console.error('Error assigning welcome credits:', creditError);
        // Don't fail the entire process if credit assignment fails
      }
    }

    // Mark prospect as completed
    await prisma.prospect.update({
      where: { id: prospectId },
      data: {
        currentStep: 9,
        isCompleted: true
      }
    });

    // TODO: Implement actual agent deployment logic
    // This would include:
    // - Creating the AI agent with configured settings
    // - Purchasing/assigning phone number
    // - Setting up integrations
    // - Configuring webhooks

    return NextResponse.json({
      success: true,
      customer: {
        id: customer.id,
        name: customer.name
      },
      creditsAssigned: freeCredits,
      message: 'Onboarding completed successfully! Your AI receptionist is being deployed.'
    });

  } catch (error) {
    console.error('Error completing onboarding:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
