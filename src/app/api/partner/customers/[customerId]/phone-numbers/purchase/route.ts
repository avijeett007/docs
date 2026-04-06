import { NextRequest, NextResponse } from 'next/server';
import { formatCapabilities } from '@/lib/twilio';
import { getCustomerTwilioClient, createSubaccountForExistingCustomer } from '@/lib/twilio-subaccount';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

// Schema for partner phone number purchase
const partnerPurchaseSchema = z.object({
  phoneNumber: z.string(),
  friendlyName: z.string().optional(),
  type: z.enum(['local', 'mobile', 'tollfree']),
  countryCode: z.string().min(2).max(2),
  monthlyPrice: z.number(),
  setupFee: z.number(),
  capabilities: z.object({
    voice: z.boolean(),
    SMS: z.boolean(),
    MMS: z.boolean(),
    fax: z.boolean(),
  }),
  // Consent tracking
  consentGiven: z.boolean().refine(val => val === true, 'Consent must be given'),
  consentIpAddress: z.string().optional(),
});

export async function POST(
  req: NextRequest,
  { params }: { params: { customerId: string } }
) {
  try {
    // Partner authentication is handled by middleware
    // Extract partner ID from JWT token in Authorization header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Unauthorized - No token provided' },
        { status: 401 }
      );
    }

    const token = authHeader.split(' ')[1];
    
    // Decode JWT to get partner ID (middleware already verified the token)
    let partnerId: string;
    try {
      const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString());
      partnerId = payload.partnerId; // JWT always uses partnerId field

      if (!partnerId) {
        throw new Error('Partner ID not found in token');
      }
    } catch (error) {
      return NextResponse.json(
        { error: 'Invalid token format' },
        { status: 401 }
      );
    }

    const { customerId } = params;

    // Parse and validate request body
    const body = await req.json();

    const validationResult = partnerPurchaseSchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json(
        { error: 'Invalid request data', details: validationResult.error.errors },
        { status: 400 }
      );
    }

    const purchaseData = validationResult.data;

    // Find the customer and verify partner access through UserOnboarding
    const customer = await prisma.customer.findUnique({
      where: {
        id: customerId,
      },
      include: {
        userOnboarding: {
          where: {
            partnerId: partnerId,
          },
        },
        credentials: {
          where: {
            partnerId: partnerId,
          },
        },
      },
    });

    if (!customer) {
      return NextResponse.json(
        { error: 'Customer not found' },
        { status: 404 }
      );
    }

    // Verify that this partner has access to this customer
    // Check both UserOnboarding relationship and CustomerCredential relationship
    const hasUserOnboardingAccess = customer.userOnboarding.length > 0;
    const hasCredentialAccess = customer.credentials.length > 0;

    if (!hasUserOnboardingAccess && !hasCredentialAccess) {
      return NextResponse.json(
        { error: 'Access denied' },
        { status: 403 }
      );
    }

    // Get partner to check telephony credits
    const partner = await prisma.partner.findUnique({
      where: { id: partnerId }
    });

    if (!partner) {
      return NextResponse.json(
        { error: 'Partner not found' },
        { status: 404 }
      );
    }

    // Calculate total cost (monthly price for first month)
    const monthlyPrice = purchaseData.monthlyPrice; // In cents (e.g., 300 for $3.00)

    // Check if partner has sufficient telephony credits
    if (partner.telephonyCreditBalanceCents < monthlyPrice) {
      return NextResponse.json(
        {
          error: 'Insufficient telephony credits',
          message: `You need at least $${(monthlyPrice / 100).toFixed(2)} in telephony credits to purchase this number. Your current balance is $${(partner.telephonyCreditBalanceCents / 100).toFixed(2)}.`,
          requiredAmount: monthlyPrice,
          currentBalance: partner.telephonyCreditBalanceCents
        },
        { status: 402 } // Payment Required
      );
    }

    // Get or create Twilio subaccount for the customer
    let customerTwilioClient;
    try {
      customerTwilioClient = await getCustomerTwilioClient(customerId);
    } catch (error: any) {
      if (error.message.includes('No Twilio subaccount found')) {
        await createSubaccountForExistingCustomer(customerId);
        customerTwilioClient = await getCustomerTwilioClient(customerId);
      } else {
        throw error;
      }
    }

    // Purchase the phone number using customer's Twilio subaccount
    const purchaseOptions = {
      phoneNumber: purchaseData.phoneNumber,
      friendlyName: purchaseData.friendlyName || purchaseData.phoneNumber,
      voiceUrl: process.env.TWILIO_VOICE_WEBHOOK_URL,
      voiceMethod: 'POST' as const,
      smsUrl: process.env.TWILIO_SMS_WEBHOOK_URL,
      smsMethod: 'POST' as const,
    };

    const purchasedNumber = await customerTwilioClient.purchasePhoneNumber(purchaseOptions);

    // Use transaction to ensure all database operations succeed or fail together
    const result = await prisma.$transaction(async (tx) => {
      // Store phone number in database
      const phoneNumberRecord = await tx.phoneNumber.create({
        data: {
          customerId: customerId,
          partnerId: partnerId,
          phoneNumber: purchaseData.phoneNumber,
          friendlyName: purchaseData.friendlyName || purchaseData.phoneNumber,
          phoneNumberSid: purchasedNumber.sid,
          countryCode: purchaseData.countryCode,
          region: purchasedNumber.region || '',
          locality: purchasedNumber.locality || '',
          capabilities: formatCapabilities(purchaseData.capabilities),
          type: purchaseData.type,
          status: 'active',
          monthlyRecurringCost: purchaseData.monthlyPrice,
          purchasedAt: new Date(),
        },
      });

      // Deduct telephony credits from partner
      await tx.partner.update({
        where: { id: partnerId },
        data: {
          telephonyCreditBalanceCents: {
            decrement: monthlyPrice
          },
          totalTelephonyDollarsUsed: {
            increment: monthlyPrice / 100
          }
        }
      });

      // Create telephony credit transaction record
      await tx.telephonyCreditTransaction.create({
        data: {
          partnerId: partnerId,
          customerId: customerId,
          type: 'phone_number_purchase',
          amount: -monthlyPrice, // Negative for deduction
          balanceAfter: partner.telephonyCreditBalanceCents - monthlyPrice,
          description: `Phone number purchase: ${purchaseData.phoneNumber}`,
          referenceId: phoneNumberRecord.id,
          metadata: {
            phoneNumber: purchaseData.phoneNumber,
            phoneNumberId: phoneNumberRecord.id,
            source: 'partner_purchase',
            provider: 'twilio',
            countryCode: purchaseData.countryCode,
            type: purchaseData.type,
            originalCost: 100, // $1.00 Twilio base cost
            profitMargin: 200, // $2.00 markup
            monthlyAmount: monthlyPrice,
            purchasedBy: 'partner'
          }
        }
      });

      // Create billing entry for monthly recurring charges
      await tx.phoneNumberBilling.create({
        data: {
          phoneNumberId: phoneNumberRecord.id,
          partnerId: partnerId,
          customerId: customerId,
          monthlyAmount: monthlyPrice,
          originalCost: 100, // $1.00 Twilio base cost
          profitMargin: 200, // $2.00 markup
          nextBillingDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
          status: 'active'
        }
      });

      return phoneNumberRecord;
    });

    return NextResponse.json({
      success: true,
      message: 'Phone number purchased successfully',
      data: {
        id: result.id,
        phoneNumber: result.phoneNumber,
        friendlyName: result.friendlyName,
        phoneNumberSid: result.phoneNumberSid,
        status: result.status,
        monthlyRecurringCost: result.monthlyRecurringCost,
        purchasedAt: result.purchasedAt,
        purchasedBy: 'partner', // Indicate this was purchased by partner
        telephonyCreditDeducted: monthlyPrice / 100, // Show amount deducted in dollars
      },
    });

  } catch (error: any) {
    console.error('Partner phone number purchase error:', error);

    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    // Handle different types of errors gracefully
    let responseError = 'Failed to purchase phone number';
    let userMessage = 'Something went wrong while purchasing the phone number. Please try again later.';
    let statusCode = 500;
    let isKnownIssue = false;

    if (errorMessage) {
      const errorMsg = errorMessage.toLowerCase();
      
      // Handle specific errors
      if (errorMsg.includes('not available for country code') || 
          errorMsg.includes('country code') || 
          errorMsg.includes('not found') ||
          errorMsg.includes('404')) {
        statusCode = 400;
        responseError = 'Country not supported';
        userMessage = 'It seems our telephony provider doesn\'t support this country yet. Please try a different country or contact support if you need numbers from this region.';
        isKnownIssue = true;
      }
      // Twilio service issues
      else if (errorMsg.includes('internal server error') || 
               errorMsg.includes('service unavailable') || 
               errorMsg.includes('502') || 
               errorMsg.includes('503')) {
        statusCode = 503;
        responseError = 'Service temporarily unavailable';
        userMessage = 'Our telephony provider is experiencing issues. Please try again in a few minutes. If the issue persists, please raise a support request.';
        isKnownIssue = true;
      }
      // Authentication/permission issues
      else if (errorMsg.includes('unauthorized') || 
               errorMsg.includes('forbidden') || 
               errorMsg.includes('401') || 
               errorMsg.includes('403')) {
        statusCode = 403;
        responseError = 'Access denied';
        userMessage = 'There seems to be an authentication issue with our telephony provider. Please contact support.';
        isKnownIssue = true;
      }
    }
    
    return NextResponse.json(
      { 
        success: false,
        error: responseError,
        message: userMessage,
        isKnownIssue,
        details: process.env.NODE_ENV === 'development' ? errorMessage : undefined
      },
      { status: statusCode }
    );
  }
}
