import { NextRequest, NextResponse } from 'next/server';
import { verifyWhitelabelAuth } from '@/lib/whitelabelAuth';
import { verifyPartnerAuth } from '@/lib/auth/partnerAuth';
import { prisma } from '@/lib/prisma';
import { getCustomerTwilioClient } from '@/lib/twilio-subaccount';

export const dynamic = 'force-dynamic';

// Handle CORS preflight requests
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const phoneNumberId = params.id;

    // Try whitelabel auth first, then partner auth
    let customerId: string | undefined;
    let partnerId: string;
    let isPartnerRequest = false;

    try {
      const authResult = await verifyWhitelabelAuth(req);
      if (authResult && authResult.customerId) {
        customerId = authResult.customerId;
        partnerId = authResult.partnerId;
      } else {
        throw new Error('Whitelabel auth failed');
      }
    } catch {
      // Try partner auth
      const partnerAuth = await verifyPartnerAuth(req);
      if (!partnerAuth || !partnerAuth.id) {
        return NextResponse.json(
          { error: 'Unauthorized' },
          { status: 401 }
        );
      }
      partnerId = partnerAuth.id;
      isPartnerRequest = true;
    }

    // Get the phone number record
    const phoneNumber = await prisma.phoneNumber.findUnique({
      where: { id: phoneNumberId },
      include: {
        customer: true,
        purchases: true,
      },
    });

    if (!phoneNumber) {
      return NextResponse.json(
        { error: 'Phone number not found' },
        { status: 404 }
      );
    }

    // Verify ownership
    if (isPartnerRequest) {
      if (phoneNumber.partnerId !== partnerId) {
        return NextResponse.json(
          { error: 'Access denied' },
          { status: 403 }
        );
      }
      if (phoneNumber.customerId) {
        customerId = phoneNumber.customerId;
      } else {
        return NextResponse.json(
          { error: 'Customer ID required for this operation' },
          { status: 400 }
        );
      }
    } else {
      if (!customerId || phoneNumber.customerId !== customerId || phoneNumber.partnerId !== partnerId) {
        return NextResponse.json(
          { error: 'Access denied' },
          { status: 403 }
        );
      }
    }

    // CRITICAL: Never allow deletion of imported numbers, regardless of status
    if (phoneNumber.isImported) {
      return NextResponse.json(
        {
          error: 'Cannot remove imported phone numbers',
          message: 'Imported numbers cannot be deleted. Please use the release function if you no longer need this number.'
        },
        { status: 400 }
      );
    }

    // Only allow deletion of pending or failed PURCHASED numbers
    if (!['pending', 'failed'].includes(phoneNumber.status)) {
      return NextResponse.json(
        {
          error: 'Cannot remove active phone numbers',
          message: 'Only incomplete or failed purchases can be removed. Please release active numbers instead.'
        },
        { status: 400 }
      );
    }

    // Check if number has active agent mappings
    const activeAgents = await prisma.agentPhoneMapping.count({
      where: {
        phoneNumberId: phoneNumberId,
        status: 'active',
      },
    });

    if (activeAgents > 0) {
      return NextResponse.json(
        { 
          error: 'Cannot remove phone number with active agents',
          message: 'Please unassign all agents before removing this number.'
        },
        { status: 400 }
      );
    }

    // If there's a Twilio number, try to release it
    if (phoneNumber.phoneNumberSid && phoneNumber.status !== 'failed') {
      try {
        const twilioClient = await getCustomerTwilioClient(customerId);
        await twilioClient.releasePhoneNumber(phoneNumber.phoneNumberSid);
        console.log(`Released Twilio number: ${phoneNumber.phoneNumberSid}`);
      } catch (error) {
        console.warn(`Failed to release Twilio number ${phoneNumber.phoneNumberSid}:`, error);
        // Continue with database cleanup even if Twilio release fails
      }
    }

    // Remove from database
    await prisma.$transaction(async (tx) => {
      // Delete related records first
      if (phoneNumber.purchases && phoneNumber.purchases.length > 0) {
        await tx.phoneNumberPurchase.deleteMany({
          where: { phoneNumberId: phoneNumberId },
        });
      }

      // Delete any SIP configurations
      await tx.phoneNumberSipConfig.deleteMany({
        where: { phoneNumberId: phoneNumberId },
      });

      // Delete any agent phone mappings
      await tx.agentPhoneMapping.deleteMany({
        where: { phoneNumberId: phoneNumberId },
      });

      // Delete the phone number record
      await tx.phoneNumber.delete({
        where: { id: phoneNumberId },
      });
    });

    const response = NextResponse.json({
      success: true,
      message: 'Phone number removed successfully',
    });

    // Add CORS headers
    response.headers.set('Access-Control-Allow-Origin', '*');
    response.headers.set('Access-Control-Allow-Methods', 'DELETE, OPTIONS');
    response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    return response;

  } catch (error) {
    console.error('Phone number deletion error:', error);
    return NextResponse.json(
      { 
        error: 'Failed to remove phone number',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
