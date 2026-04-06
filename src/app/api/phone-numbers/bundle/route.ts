import { NextRequest, NextResponse } from 'next/server';
import { verifyWhitelabelAuth } from '@/lib/whitelabelAuth';
import { getCustomerTwilioClient } from '@/lib/twilio-subaccount';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

const bundleSchema = z.object({
  businessName: z.string().optional(),
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
  }).optional(),
  phoneNumber: z.string(),
  numberType: z.string(),
});

// Create a new bundle for phone number purchase
export async function POST(req: NextRequest) {
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

    // Get customer and partner information for business name
    const customer = await prisma.customer.findUnique({
      where: { id: customerId },
      include: {
        credentials: {
          include: {
            partner: {
              select: { businessName: true }
            }
          },
          take: 1,
        },
      },
    });

    if (!customer || !customer.credentials[0]) {
      return NextResponse.json(
        { error: 'Customer not found' },
        { status: 404 }
      );
    }

    const partnerBusinessName = customer.credentials[0].partner.businessName;

    // Parse and validate request body
    const body = await req.json();
    console.log('Bundle creation request:', JSON.stringify(body, null, 2));
    
    const validationResult = bundleSchema.safeParse(body);
    
    if (!validationResult.success) {
      console.log('Bundle validation failed:', validationResult.error.errors);
      return NextResponse.json(
        { error: 'Invalid request data', details: validationResult.error.errors },
        { status: 400 }
      );
    }

    const bundleData = validationResult.data;

    // Get customer's Twilio client
    const twilioClient = await getCustomerTwilioClient(customerId);

    // Create business address in Twilio
    const businessName = bundleData.businessName || partnerBusinessName;
    const businessAddress = await twilioClient.createAddress({
      FriendlyName: `${businessName} - Business Address`,
      CustomerName: businessName,
      Street: bundleData.businessAddress.street,
      City: bundleData.businessAddress.city,
      Region: bundleData.businessAddress.state,
      PostalCode: bundleData.businessAddress.postalCode,
      IsoCountry: bundleData.businessAddress.country,
    });

    console.log('Business address created:', businessAddress.sid);

    // Create emergency address if provided
    let emergencyAddress = null;
    if (bundleData.emergencyAddress) {
      emergencyAddress = await twilioClient.createAddress({
        FriendlyName: `${businessName} - Emergency Address`,
        CustomerName: businessName,
        Street: bundleData.emergencyAddress.street,
        City: bundleData.emergencyAddress.city,
        Region: bundleData.emergencyAddress.state,
        PostalCode: bundleData.emergencyAddress.postalCode,
        IsoCountry: bundleData.emergencyAddress.country,
      });
      console.log('Emergency address created:', emergencyAddress.sid);
    }

    // Create bundle in Twilio
    let bundle;
    try {
      bundle = await twilioClient.createRegulatoryBundle({
        FriendlyName: `${businessName} - Phone Number Bundle`,
        Email: '', // Will be populated from customer data
        StatusCallback: `${process.env.NEXT_PUBLIC_APP_URL}/api/webhooks/twilio/bundle-status`,
        RegulationType: 'phone_number',
        IsoCountry: bundleData.businessAddress.country,
      });
      console.log('Bundle created:', bundle.sid);
    } catch (bundleError: any) {
      console.error('Regulatory bundle creation failed:', bundleError);

      // Check if regulatory bundles are not supported for this account/region
      if (bundleError.message?.includes('was not found') || bundleError.message?.includes('404')) {
        return NextResponse.json({
          error: 'Regulatory compliance not required',
          message: 'This phone number does not require regulatory compliance verification. You can proceed with the purchase directly.',
          skipVerification: true
        }, { status: 200 });
      }

      // Check if it's an account limitation
      if (bundleError.message?.includes('not authorized') || bundleError.message?.includes('403')) {
        return NextResponse.json({
          error: 'Account limitation',
          message: 'Your Twilio account does not have regulatory compliance features enabled. Please contact Twilio support to enable this feature.',
          details: 'This is required for purchasing phone numbers in certain regions.'
        }, { status: 400 });
      }

      // Generic error
      throw bundleError;
    }

    // Assign business address to bundle
    await twilioClient.assignItemToBundle(bundle.sid, {
      ObjectSid: businessAddress.sid,
    });

    // Assign emergency address to bundle if provided
    if (emergencyAddress) {
      await twilioClient.assignItemToBundle(bundle.sid, {
        ObjectSid: emergencyAddress.sid,
      });
    }

    // Store bundle information in database
    const bundleRecord = await prisma.twilioBundle.create({
      data: {
        customerId,
        partnerId,
        bundleSid: bundle.sid,
        businessAddressSid: businessAddress.sid,
        emergencyAddressSid: emergencyAddress?.sid,
        phoneNumber: bundleData.phoneNumber,
        numberType: bundleData.numberType,
        status: 'pending-review',
        businessName: businessName,
        businessAddress: bundleData.businessAddress,
        emergencyAddress: bundleData.emergencyAddress,
      },
    });

    return NextResponse.json({
      success: true,
      bundle: {
        id: bundleRecord.id,
        bundleSid: bundle.sid,
        status: 'pending-review',
        businessAddressSid: businessAddress.sid,
        emergencyAddressSid: emergencyAddress?.sid,
        message: 'Bundle created successfully. It will be reviewed by Twilio and you will be notified when approved.',
      },
    });

  } catch (error: any) {
    console.error('Bundle creation error:', error);

    // Handle specific Twilio errors with more detailed messages
    if (error.message?.includes('Twilio API Error')) {
      if (error.message.includes('was not found')) {
        return NextResponse.json(
          {
            error: 'Regulatory bundles are not available for your account. Please contact support to enable this feature.',
            details: 'This feature may not be available in your region or account type.'
          },
          { status: 400 }
        );
      } else if (error.message.includes('Invalid address')) {
        return NextResponse.json(
          {
            error: 'Invalid address information provided. Please check your address details and try again.',
            details: 'Ensure all address fields are correctly filled and the address exists.'
          },
          { status: 400 }
        );
      } else {
        return NextResponse.json(
          {
            error: 'Failed to create regulatory bundle with Twilio.',
            details: 'Please verify your address information is correct and try again. If the problem persists, contact support.'
          },
          { status: 400 }
        );
      }
    }

    // Handle network or other errors
    if (error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED') {
      return NextResponse.json(
        {
          error: 'Unable to connect to verification service.',
          details: 'Please check your internet connection and try again.'
        },
        { status: 503 }
      );
    }

    return NextResponse.json(
      {
        error: 'Failed to create regulatory bundle.',
        details: 'An unexpected error occurred. Please try again or contact support if the problem persists.'
      },
      { status: 500 }
    );
  }
}

// Get bundle status for customer
export async function GET(req: NextRequest) {
  try {
    // Authenticate the request
    const authResult = await verifyWhitelabelAuth(req);
    if (!authResult || !authResult.customerId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { customerId } = authResult;
    const { searchParams } = new URL(req.url);
    const phoneNumber = searchParams.get('phoneNumber');
    const numberType = searchParams.get('numberType');

    // Find existing bundle for this customer and phone number type
    const bundle = await prisma.twilioBundle.findFirst({
      where: {
        customerId,
        ...(phoneNumber && { phoneNumber }),
        ...(numberType && { numberType }),
        status: { in: ['pending-review', 'approved'] },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!bundle) {
      return NextResponse.json({
        success: true,
        hasBundle: false,
        requiresBundle: true,
      });
    }

    // Check current status with Twilio if bundle exists
    try {
      const twilioClient = await getCustomerTwilioClient(customerId);
      const twilioBundle = await twilioClient.getRegulatoryBundle(bundle.bundleSid);
      
      // Update local status if it changed
      if (twilioBundle.status !== bundle.status) {
        await prisma.twilioBundle.update({
          where: { id: bundle.id },
          data: { status: twilioBundle.status },
        });
      }

      return NextResponse.json({
        success: true,
        hasBundle: true,
        bundle: {
          id: bundle.id,
          bundleSid: bundle.bundleSid,
          status: twilioBundle.status,
          businessName: bundle.businessName,
          canPurchase: twilioBundle.status === 'approved',
        },
      });
    } catch (error) {
      console.error('Error checking bundle status:', error);
      return NextResponse.json({
        success: true,
        hasBundle: true,
        bundle: {
          id: bundle.id,
          bundleSid: bundle.bundleSid,
          status: bundle.status,
          businessName: bundle.businessName,
          canPurchase: bundle.status === 'approved',
        },
      });
    }

  } catch (error: any) {
    console.error('Error checking bundle status:', error);
    return NextResponse.json(
      { error: 'Failed to check bundle status' },
      { status: 500 }
    );
  }
}
