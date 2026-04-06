import { NextRequest, NextResponse } from 'next/server';
// import { initTwilioClient } from '@/lib/twilio'; // Unused import
import { getCustomerTwilioClient, createSubaccountForExistingCustomer } from '@/lib/twilio-subaccount';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

// Schema for business verification
const businessVerificationSchema = z.object({
  businessAddress: z.object({
    street: z.string().min(1),
    city: z.string().min(1),
    state: z.string().min(1),
    postalCode: z.string().min(1),
    country: z.string().min(2).max(2),
  }),
  emergencyAddress: z.object({
    street: z.string().min(1),
    city: z.string().min(1),
    state: z.string().min(1),
    postalCode: z.string().min(1),
    country: z.string().min(2).max(2),
  }),
  phoneNumber: z.string(),
  numberType: z.enum(['local', 'mobile', 'tollfree']),
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

    // Parse and validate request body
    const body = await req.json();
    const validationResult = businessVerificationSchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json(
        { error: 'Invalid request data', details: validationResult.error.errors },
        { status: 400 }
      );
    }

    const { businessAddress, emergencyAddress, phoneNumber, numberType } = validationResult.data;

    console.log(`Partner ${partnerId} creating business verification for customer ${customerId}: ${phoneNumber}`);

    // Get or create Twilio subaccount for the customer
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

    // Create bundle with Twilio
    const bundleData = {
      FriendlyName: `Bundle for ${customer.firstName} ${customer.lastName} - ${phoneNumber}`,
      Email: customer.email,
      StatusCallback: process.env.TWILIO_BUNDLE_WEBHOOK_URL,
      RegulationType: 'phone_number',
      EndUserType: 'business',
      NumberType: numberType,
      IsoCountry: businessAddress.country,
    };

    console.log('Creating Twilio bundle with data:', bundleData);

    // Create bundle using customer's Twilio subaccount
    const bundle = await customerTwilioClient.createRegulatoryBundle(bundleData);

    console.log('Twilio bundle created:', bundle.sid);

    // Create addresses in Twilio
    const businessAddressData = {
      CustomerName: `${customer.firstName} ${customer.lastName}`,
      Street: businessAddress.street,
      City: businessAddress.city,
      Region: businessAddress.state,
      PostalCode: businessAddress.postalCode,
      IsoCountry: businessAddress.country,
    };

    const emergencyAddressData = {
      CustomerName: `${customer.firstName} ${customer.lastName}`,
      Street: emergencyAddress.street,
      City: emergencyAddress.city,
      Region: emergencyAddress.state,
      PostalCode: emergencyAddress.postalCode,
      IsoCountry: emergencyAddress.country,
    };

    const [twilioBusinessAddress, twilioEmergencyAddress] = await Promise.all([
      customerTwilioClient.createAddress(businessAddressData),
      customerTwilioClient.createAddress(emergencyAddressData),
    ]);

    console.log('Twilio addresses created:', {
      business: twilioBusinessAddress.sid,
      emergency: twilioEmergencyAddress.sid,
    });

    // Store bundle in database
    const bundleRecord = await prisma.twilioBundle.create({
      data: {
        customerId: customerId,
        partnerId: partnerId,
        bundleSid: bundle.sid,
        phoneNumber: phoneNumber,
        numberType: numberType,
        status: 'pending-review',
        businessAddress: businessAddress,
        emergencyAddress: emergencyAddress,
        businessAddressSid: twilioBusinessAddress.sid,
        emergencyAddressSid: twilioEmergencyAddress.sid,
        businessName: `${customer.firstName} ${customer.lastName}`,
        // Note: partnerId field already tracks who created this
      },
    });

    console.log('Bundle record created in database:', bundleRecord.id);

    return NextResponse.json({
      success: true,
      data: {
        bundleId: bundleRecord.id,
        bundleSid: bundle.sid,
        status: bundleRecord.status,
        phoneNumber: phoneNumber,
        businessAddress: businessAddress,
        emergencyAddress: emergencyAddress,
        createdBy: 'partner',
      },
      message: 'Business verification submitted successfully. You will be notified when approved.',
    });

  } catch (error: any) {
    console.error('Partner business verification error:', error);

    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    // Handle different types of errors gracefully
    let responseError = 'Failed to submit business verification';
    let userMessage = 'Something went wrong while submitting business verification. Please try again later.';
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
        userMessage = 'Our verification service is experiencing issues. Please try again in a few minutes.';
      }
      // Invalid address data
      else if (errorMsg.includes('address') || errorMsg.includes('postal code') || errorMsg.includes('region')) {
        statusCode = 400;
        responseError = 'Invalid address information';
        userMessage = 'Please check the address information and try again. Make sure all fields are filled correctly.';
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
