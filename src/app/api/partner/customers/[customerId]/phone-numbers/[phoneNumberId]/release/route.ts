import { NextRequest, NextResponse } from 'next/server';
import { getCustomerTwilioClient, createSubaccountForExistingCustomer } from '@/lib/twilio-subaccount';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function POST(
  req: NextRequest,
  { params }: { params: { customerId: string; phoneNumberId: string } }
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

    const { customerId, phoneNumberId } = params;

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

    if (!customer) {
      return NextResponse.json(
        { error: 'Customer not found or access denied' },
        { status: 404 }
      );
    }

    // Verify the phone number belongs to this customer and partner
    const phoneNumber = await prisma.phoneNumber.findFirst({
      where: {
        id: phoneNumberId,
        customerId: customerId,
        partnerId: partnerId,
      },
    });

    if (!phoneNumber) {
      return NextResponse.json(
        { error: 'Phone number not found or access denied' },
        { status: 404 }
      );
    }

    // Check if phone number is already released
    if (phoneNumber.status === 'released') {
      return NextResponse.json(
        { error: 'Phone number is already released' },
        { status: 400 }
      );
    }

    console.log(`Partner ${partnerId} releasing phone number ${phoneNumber.phoneNumber} for customer ${customerId}`);

    // Get customer's Twilio subaccount
    let customerTwilioClient;
    try {
      customerTwilioClient = await getCustomerTwilioClient(customerId);
    } catch (error: any) {
      if (error.message.includes('No Twilio subaccount found')) {
        console.log(`Creating Twilio subaccount for existing customer: ${customerId}`);
        await createSubaccountForExistingCustomer(customerId);
        customerTwilioClient = await getCustomerTwilioClient(customerId);
      } else {
        throw error;
      }
    }

    // Release the phone number in Twilio
    if (phoneNumber.phoneNumberSid) {
      try {
        await customerTwilioClient.releasePhoneNumber(phoneNumber.phoneNumberSid);
        console.log('Phone number released in Twilio:', phoneNumber.phoneNumberSid);
      } catch (twilioError: any) {
        console.error('Twilio release error:', twilioError);
        // Continue with database update even if Twilio fails
        // The number might already be released in Twilio
      }
    } else {
      console.log('No Twilio SID found for phone number, skipping Twilio release');
    }

    // Update phone number status in database
    const updatedPhoneNumber = await prisma.phoneNumber.update({
      where: {
        id: phoneNumberId,
      },
      data: {
        status: 'released',
        releasedAt: new Date(),
      },
    });

    console.log('Phone number status updated in database:', updatedPhoneNumber.id);

    return NextResponse.json({
      success: true,
      data: {
        id: updatedPhoneNumber.id,
        phoneNumber: updatedPhoneNumber.phoneNumber,
        status: updatedPhoneNumber.status,
        releasedAt: updatedPhoneNumber.releasedAt,
        releasedBy: 'partner',
      },
      message: 'Phone number released successfully',
    });

  } catch (error: any) {
    console.error('Partner phone number release error:', error);

    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    // Handle different types of errors gracefully
    let responseError = 'Failed to release phone number';
    let userMessage = 'Something went wrong while releasing the phone number. Please try again later.';
    let statusCode = 500;

    if (errorMessage) {
      const errorMsg = errorMessage.toLowerCase();
      
      // Twilio service issues
      if (errorMsg.includes('internal server error') || 
          errorMsg.includes('service unavailable') || 
          errorMsg.includes('502') || 
          errorMsg.includes('503')) {
        statusCode = 503;
        responseError = 'Service temporarily unavailable';
        userMessage = 'Our telephony provider is experiencing issues. Please try again in a few minutes.';
      }
      // Number not found in Twilio (might already be released)
      else if (errorMsg.includes('not found') || errorMsg.includes('404')) {
        // This is actually OK - number might already be released in Twilio
        // We should still update our database
        console.log('Number not found in Twilio, but continuing with database update');
      }
    }
    
    return NextResponse.json(
      { 
        success: false,
        error: responseError,
        message: userMessage,
        details: process.env.NODE_ENV === 'development' ? errorMessage : undefined
      },
      { status: statusCode }
    );
  }
}
