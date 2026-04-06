import { NextRequest, NextResponse } from 'next/server';
import { verifyWhitelabelAuth } from '@/lib/whitelabelAuth';
import { getCustomerTwilioClient } from '@/lib/twilio-subaccount';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Authenticate the request
    const authResult = await verifyWhitelabelAuth(req);
    if (!authResult || !authResult.customerId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { customerId, partnerId } = authResult;
    const phoneNumberId = params.id;

    // Find the phone number
    const phoneNumber = await prisma.phoneNumber.findFirst({
      where: {
        id: phoneNumberId,
        customerId,
      },
      include: {
        purchases: true,
      },
    });

    if (!phoneNumber) {
      return NextResponse.json(
        { error: 'Phone number not found' },
        { status: 404 }
      );
    }

    // Check if phone number has active agents
    const activeAgents = await prisma.knovaAgent.count({
      where: {
        phoneNumbers: {
          some: {
            id: phoneNumber.id,
          },
        },
        status: { in: ['active'] },
        isActive: true,
      },
    });

    if (activeAgents > 0) {
      return NextResponse.json(
        { 
          error: 'Cannot release number with active agents',
          message: `This phone number has ${activeAgents} active agent(s). Please deactivate all agents before releasing the number.`
        },
        { status: 400 }
      );
    }

    // Get customer's Twilio client
    const twilioClient = await getCustomerTwilioClient(customerId);

    try {
      // Release the phone number in Twilio
      if (phoneNumber.phoneNumberSid) {
        await twilioClient.releasePhoneNumber(phoneNumber.phoneNumberSid);
        console.log(`Phone number ${phoneNumber.phoneNumber} released from Twilio`);
      } else {
        console.log(`Phone number ${phoneNumber.phoneNumber} has no Twilio SID, skipping Twilio release`);
      }
    } catch (twilioError: any) {
      console.error('Twilio release error:', twilioError);
      // Continue with database cleanup even if Twilio fails
      // The number might already be released or the SID might be invalid
    }

    // Update phone number status in database
    await prisma.phoneNumber.update({
      where: { id: phoneNumberId },
      data: {
        status: 'released',
        releasedAt: new Date(),
        updatedAt: new Date(),
      },
    });

    // Update purchase records if they exist
    if (phoneNumber.purchases && phoneNumber.purchases.length > 0) {
      // Update the most recent purchase record
      const latestPurchase = phoneNumber.purchases[phoneNumber.purchases.length - 1];
      await prisma.phoneNumberPurchase.update({
        where: { id: latestPurchase.id },
        data: {
          status: 'released',
          updatedAt: new Date(),
        },
      });
    }

    // Get current partner balance to set balanceAfter
    const partner = await prisma.partner.findUnique({
      where: { id: partnerId },
      select: { telephonyCreditBalanceCents: true },
    });

    // Create a transaction record for the release
    await prisma.telephonyCreditTransaction.create({
      data: {
        customerId,
        partnerId,
        type: 'phone_number_release',
        amount: 0, // No refund for releases
        balanceAfter: partner?.telephonyCreditBalanceCents || 0,
        description: `Phone number ${phoneNumber.phoneNumber} released`,
        referenceId: phoneNumber.id,
      },
    });

    console.log(`Phone number ${phoneNumber.phoneNumber} successfully released for customer ${customerId}`);

    return NextResponse.json({
      success: true,
      message: 'Phone number released successfully',
      phoneNumber: {
        id: phoneNumber.id,
        phoneNumber: phoneNumber.phoneNumber,
        status: 'released',
        releasedAt: new Date().toISOString(),
      },
    });

  } catch (error: any) {
    console.error('Phone number release error:', error);
    
    return NextResponse.json(
      { 
        error: 'Failed to release phone number',
        message: 'An error occurred while releasing the phone number. Please try again or contact support.'
      },
      { status: 500 }
    );
  }
}
