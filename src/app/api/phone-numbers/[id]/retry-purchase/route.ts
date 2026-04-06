import { NextRequest, NextResponse } from 'next/server';
import { verifyWhitelabelAuth } from '@/lib/whitelabelAuth';
import { verifyPartnerAuth } from '@/lib/auth/partnerAuth';
import { prisma } from '@/lib/prisma';
import { getCustomerTwilioClient } from '@/lib/twilio-subaccount';
import { formatCapabilities } from '@/lib/twilio';

export const dynamic = 'force-dynamic';

// Handle CORS preflight requests
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}

export async function POST(
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

    // Only allow retry for pending or failed numbers
    if (!['pending', 'failed'].includes(phoneNumber.status)) {
      return NextResponse.json(
        { 
          error: 'Cannot retry purchase for this number',
          message: 'Only pending or failed purchases can be retried.'
        },
        { status: 400 }
      );
    }

    // Check if customer has sufficient telephony credits
    const customer = await prisma.customer.findUnique({
      where: { id: customerId },
      include: {
        credentials: {
          include: {
            partner: true,
          },
          take: 1,
        },
      },
    });

    if (!customer) {
      return NextResponse.json(
        { error: 'Customer not found' },
        { status: 404 }
      );
    }

    const partner = customer.credentials[0]?.partner;
    if (!partner) {
      return NextResponse.json(
        { error: 'Partner not found' },
        { status: 404 }
      );
    }

    // Calculate total cost (setup fee + first month)
    const latestPurchase = phoneNumber.purchases?.[0];
    const totalCost = (latestPurchase?.setupFee || 0) + phoneNumber.monthlyRecurringCost;
    const telephonyBalance = partner.telephonyCreditBalanceCents || 0;

    if (telephonyBalance < totalCost) {
      return NextResponse.json(
        {
          success: false,
          error: 'Insufficient credits',
          message: `Unable to complete purchase. Please contact support for assistance.`
        },
        { status: 400 }
      );
    }

    // Check if bundle is required and approved
    const requiresBundle = ['GB', 'DE', 'FR'].includes(phoneNumber.countryCode) && 
                          ['local', 'mobile'].includes(phoneNumber.type);
    
    if (requiresBundle) {
      const approvedBundle = await prisma.twilioBundle.findFirst({
        where: {
          customerId,
          status: 'approved',
          numberType: phoneNumber.type,
        },
        orderBy: { createdAt: 'desc' },
      });

      if (!approvedBundle) {
        return NextResponse.json(
          {
            success: false,
            error: 'Bundle required',
            message: 'Business address verification is required and must be approved before completing this purchase.',
          },
          { status: 400 }
        );
      }
    }

    // Attempt to purchase the number from Twilio
    try {
      const twilioClient = await getCustomerTwilioClient(customerId);
      
      const purchaseOptions: any = {
        phoneNumber: phoneNumber.phoneNumber,
        friendlyName: phoneNumber.friendlyName,
        voiceUrl: process.env.TWILIO_VOICE_WEBHOOK_URL,
        voiceMethod: 'POST',
        smsUrl: process.env.TWILIO_SMS_WEBHOOK_URL,
        smsMethod: 'POST',
      };

      const twilioNumber = await twilioClient.purchasePhoneNumber(purchaseOptions);

      // Update phone number record to active
      await prisma.$transaction(async (tx) => {
        await tx.phoneNumber.update({
          where: { id: phoneNumberId },
          data: {
            phoneNumberSid: twilioNumber.sid,
            status: 'active',
            region: twilioNumber.region,
            locality: twilioNumber.locality,
          },
        });

        // Update purchase record if it exists
        if (latestPurchase) {
          await tx.phoneNumberPurchase.update({
            where: { id: latestPurchase.id },
            data: {
              status: 'completed',
              twilioOrderSid: twilioNumber.sid,
            },
          });
        }

        // Create telephony credit transaction
        await tx.telephonyCreditTransaction.create({
          data: {
            partnerId,
            customerId,
            type: 'phone_number_purchase',
            amount: -totalCost,
            balanceAfter: telephonyBalance - totalCost,
            description: `Phone number purchase retry: ${phoneNumber.phoneNumber}`,
            referenceId: latestPurchase?.id || phoneNumberId,
            metadata: {
              phoneNumber: phoneNumber.phoneNumber,
              phoneNumberId: phoneNumberId,
              isRetry: true,
            },
          },
        });

        // Update partner telephony balance
        await tx.partner.update({
          where: { id: partnerId },
          data: {
            telephonyCreditBalanceCents: {
              decrement: totalCost,
            },
            totalTelephonyDollarsUsed: {
              increment: totalCost / 100,
            },
          },
        });
      });

      const response = NextResponse.json({
        success: true,
        message: 'Phone number purchase completed successfully!',
        data: {
          phoneNumberId: phoneNumberId,
          twilioSid: twilioNumber.sid,
          status: 'active',
        },
      });

      // Add CORS headers
      response.headers.set('Access-Control-Allow-Origin', '*');
      response.headers.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
      response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');

      return response;

    } catch (twilioError) {
      // Update status to failed
      await prisma.phoneNumber.update({
        where: { id: phoneNumberId },
        data: { status: 'failed' },
      });

      console.error('Twilio purchase retry error:', twilioError);
      return NextResponse.json(
        { 
          error: 'Failed to complete purchase with provider',
          details: twilioError instanceof Error ? twilioError.message : 'Unknown error'
        },
        { status: 500 }
      );
    }

  } catch (error) {
    console.error('Phone number purchase retry error:', error);
    return NextResponse.json(
      { 
        error: 'Failed to retry phone number purchase',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
