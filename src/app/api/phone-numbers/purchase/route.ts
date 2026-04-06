import { NextRequest, NextResponse } from 'next/server';
import { initTwilioClient, formatCapabilities } from '@/lib/twilio';
import { verifyWhitelabelAuth } from '@/lib/whitelabelAuth';
import { verifyPartnerAuth } from '@/lib/auth/partnerAuth';
import { getCustomerTwilioClient, createSubaccountForExistingCustomer } from '@/lib/twilio-subaccount';
import { getPreferredProvider } from '@/lib/services/phoneNumberProviders/providerSelection';
import { PhoneNumberProviderFactory } from '@/lib/services/phoneNumberProviders/BaseProvider';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';
import { logger } from '@/lib/logger';

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

// Helper function to determine if a bundle is required for a country/number type
// Cache for bundle availability checks to avoid repeated API calls
const bundleAvailabilityCache = new Map<string, { available: boolean; timestamp: number }>();
const CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours

// Intelligent function to check if bundles are actually available/required
async function checkBundleAvailability(countryCode: string): Promise<boolean> {
  const cacheKey = `bundle_${countryCode}`;
  const cached = bundleAvailabilityCache.get(cacheKey);

  // Return cached result if still valid
  if (cached && (Date.now() - cached.timestamp) < CACHE_DURATION) {
    console.log(`Bundle availability for ${countryCode}: ${cached.available} (cached)`);
    return cached.available;
  }

  try {
    const twilioClient = initTwilioClient();

    // Try to create a minimal test bundle to check if the feature is available
    const testBundle = await twilioClient.createRegulatoryBundle({
      FriendlyName: `Test-${countryCode}-${Date.now()}`,
      RegulationType: 'phone_number',
      IsoCountry: countryCode,
    });

    // If successful, bundles are available - clean up the test bundle
    if (testBundle && testBundle.sid) {
      console.log(`Bundles available for ${countryCode}, cleaning up test bundle: ${testBundle.sid}`);

      // Cache the positive result
      bundleAvailabilityCache.set(cacheKey, { available: true, timestamp: Date.now() });

      // Note: We could delete the test bundle here, but Twilio might charge for it
      // For now, we'll leave it as it's just a test record

      return true;
    }

    return false;
  } catch (error: any) {
    console.log(`Bundle availability check for ${countryCode} failed:`, error.message);

    // Check specific error types to determine if bundles are not available
    if (error.message?.includes('was not found') ||
        error.message?.includes('404') ||
        error.message?.includes('not authorized') ||
        error.message?.includes('403') ||
        error.message?.includes('not available')) {

      console.log(`Bundles not available for ${countryCode} - caching result`);
      bundleAvailabilityCache.set(cacheKey, { available: false, timestamp: Date.now() });
      return false;
    }

    // For other errors (network, temporary issues), assume bundles might be required
    // but don't cache the result
    console.log(`Temporary error checking bundles for ${countryCode}, assuming required`);
    return true;
  }
}

// Helper function to determine if a bundle is required for a country/number type
async function needsBundle(countryCode: string, numberType: string): Promise<boolean> {
  // US has special handling - no bundles but needs 10DLC verification
  if (countryCode === 'US') {
    return false; // US numbers can be purchased without bundles
  }

  // Countries that typically don't require bundles
  const noBundleCountries = ['CA', 'AU', 'NZ', 'SG', 'HK', 'JP', 'KR'];
  if (noBundleCountries.includes(countryCode)) {
    return false;
  }

  // For European and other countries, intelligently check if bundles are available
  const potentialBundleCountries = [
    'GB', 'DE', 'FR', 'IT', 'ES', 'NL', 'BE', 'AT', 'CH', 'SE', 'NO', 'DK', 'FI',
    'IE', 'PT', 'PL', 'CZ', 'HU', 'SK', 'SI', 'HR', 'RO', 'BG', 'GR', 'CY',
    'MT', 'LU', 'LV', 'LT', 'EE'
  ];

  if (potentialBundleCountries.includes(countryCode)) {
    // Intelligently check if bundles are actually available for this country
    return await checkBundleAvailability(countryCode);
  }

  // For unknown countries, default to no bundle requirement
  return false;
}

// Helper function to determine if US 10DLC verification is needed
function needsUSVerification(countryCode: string, numberType: string): boolean {
  return countryCode === 'US' && (numberType === 'local' || numberType === 'mobile');
}

const purchaseSchema = z.object({
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
  // Optional customerId for partner portal usage
  customerId: z.string().optional(),
  // Optional provider override
  provider: z.enum(['twilio', 'telnyx']).optional(),
});

export async function POST(req: NextRequest) {
  try {
    // Parse request body first to check if customerId is provided
    const body = await req.json();
    const validationResult = purchaseSchema.safeParse(body);

    if (!validationResult.success) {
      console.log('Validation failed:', validationResult.error.errors);
      return NextResponse.json(
        { error: 'Invalid request data', details: validationResult.error.errors },
        { status: 400 }
      );
    }

    const purchaseData = validationResult.data;
    let customerId: string;
    let partnerId: string;

    // Determine authentication method based on whether customerId is provided
    if (purchaseData.customerId) {
      // Partner portal usage - verify partner auth and validate customer access
      const partnerAuth = await verifyPartnerAuth(req);
      if (!partnerAuth || !partnerAuth.id) {
        return NextResponse.json(
          { error: 'Unauthorized - Partner authentication required' },
          { status: 401 }
        );
      }

      // Verify the customer belongs to this partner
      const customer = await prisma.customer.findFirst({
        where: {
          id: purchaseData.customerId,
          credentials: {
            some: {
              partnerId: partnerAuth.id,
            },
          },
        },
      });

      if (!customer) {
        return NextResponse.json(
          { error: 'Customer not found or access denied' },
          { status: 404 }
        );
      }

      customerId = purchaseData.customerId;
      partnerId = partnerAuth.id;
    } else {
      // Whitelabel portal usage - verify customer auth
      const authResult = await verifyWhitelabelAuth(req);
      if (!authResult || !authResult.customerId) {
        return NextResponse.json(
          { error: 'Unauthorized - Customer authentication required' },
          { status: 401 }
        );
      }

      customerId = authResult.customerId;
      partnerId = authResult.partnerId;
    }

    console.log('Purchase request body:', JSON.stringify(body, null, 2));

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

    // Calculate total cost (setup fee + first month)
    const totalCost = purchaseData.setupFee + purchaseData.monthlyPrice;
    const partner = customer.credentials[0]?.partner;
    
    if (!partner) {
      return NextResponse.json(
        { error: 'Partner not found' },
        { status: 404 }
      );
    }
    
    const telephonyBalance = partner.telephonyCreditBalanceCents || 0;

    console.log('Credit check:', {
      partnerId,
      totalCost,
      telephonyBalance,
      hasEnoughCredits: telephonyBalance >= totalCost
    });

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

    // Check if bundle is required for this country/number type (intelligent check)
    const requiresBundle = await needsBundle(purchaseData.countryCode, purchaseData.type);
    const requiresUSVerification = needsUSVerification(purchaseData.countryCode, purchaseData.type);
    let bundleSid = null;

    console.log(`Bundle requirement check for ${purchaseData.countryCode}: ${requiresBundle}`);

    if (requiresBundle) {
      // Check if customer has an approved bundle
      const approvedBundle = await prisma.twilioBundle.findFirst({
        where: {
          customerId,
          status: 'approved',
          numberType: purchaseData.type,
        },
        orderBy: { createdAt: 'desc' },
      });

      if (!approvedBundle) {
        return NextResponse.json(
          {
            success: false,
            error: 'Bundle required',
            message: 'Business address verification is required for this phone number type. Please complete the verification process first.',
            requiresBundle: true,
            phoneNumber: purchaseData.phoneNumber,
            numberType: purchaseData.type,
            countryCode: purchaseData.countryCode,
          },
          { status: 400 }
        );
      }

      bundleSid = approvedBundle.bundleSid;
      console.log('Using approved bundle:', bundleSid);
    }

    // Check if phone number record already exists
    let phoneNumberRecord = await prisma.phoneNumber.findUnique({
      where: { phoneNumber: purchaseData.phoneNumber }
    });

    if (phoneNumberRecord) {
      // If number is already active, return error
      if (phoneNumberRecord.status === 'active') {
        return NextResponse.json(
          {
            error: 'Phone number already purchased',
            message: 'This phone number has already been purchased and is active.'
          },
          { status: 400 }
        );
      }

      // If number is failed or pending, reuse the record and update it
      phoneNumberRecord = await prisma.phoneNumber.update({
        where: { id: phoneNumberRecord.id },
        data: {
          customerId,
          partnerId,
          friendlyName: purchaseData.friendlyName || purchaseData.phoneNumber,
          countryCode: purchaseData.countryCode,
          type: purchaseData.type,
          capabilities: formatCapabilities(purchaseData.capabilities),
          monthlyRecurringCost: purchaseData.monthlyPrice,
          status: 'pending',
        }
      });

      console.log(`Reusing existing phone number record ${phoneNumberRecord.id} for retry purchase`);
    } else {
      // Create new phone number record (pending status)
      phoneNumberRecord = await prisma.phoneNumber.create({
        data: {
          customerId,
          partnerId,
          phoneNumber: purchaseData.phoneNumber,
          friendlyName: purchaseData.friendlyName || purchaseData.phoneNumber,
          countryCode: purchaseData.countryCode,
          type: purchaseData.type,
          capabilities: formatCapabilities(purchaseData.capabilities),
          monthlyRecurringCost: purchaseData.monthlyPrice,
          status: 'pending',
        },
      });

      console.log(`Created new phone number record ${phoneNumberRecord.id} for purchase`);
    }

    // Determine which provider to use
    const selectedProvider = purchaseData.provider || getPreferredProvider(purchaseData.countryCode, purchaseData.type);
    console.log(`[PHONE PURCHASE] Using provider: ${selectedProvider} for ${purchaseData.countryCode} ${purchaseData.type}`);

    try {
      let purchasedNumber;
      let providerNumberId;

      if (selectedProvider === 'telnyx') {
        // Use Telnyx provider
        try {
          // Get Telnyx credentials from environment
          const telnyxApiKey = process.env.TELNYX_API_KEY;
          if (!telnyxApiKey) {
            throw new Error('Telnyx API key not configured');
          }

          // Create Telnyx provider instance
          const telnyxProvider = PhoneNumberProviderFactory.createProvider('telnyx', {
            apiKey: telnyxApiKey
          });

          // Purchase the number using Telnyx
          const purchaseResult = await telnyxProvider.purchasePhoneNumber({
            phoneNumber: purchaseData.phoneNumber,
            friendlyName: purchaseData.friendlyName,
            metadata: {
              customerId,
              partnerId,
              countryCode: purchaseData.countryCode,
              type: purchaseData.type
            }
          });

          purchasedNumber = {
            sid: purchaseResult.id,
            phoneNumber: purchaseResult.phoneNumber,
            friendlyName: purchaseResult.friendlyName,
            status: purchaseResult.status,
            dateCreated: purchaseResult.purchasedAt
          };
          providerNumberId = purchaseResult.id;

          logger.info('Successfully purchased phone number via Telnyx', {
            operation: 'phone_purchase',
            provider: 'telnyx',
            phoneNumber: purchaseData.phoneNumber,
            customerId,
            partnerId
          });

        } catch (error) {
          logger.error('Telnyx purchase failed, falling back to Twilio', error as Error, {
            operation: 'phone_purchase'
          });

          // Fallback to Twilio if Telnyx fails
          const twilioResult = await purchaseWithTwilio(customerId, purchaseData, bundleSid, phoneNumberRecord);
          purchasedNumber = twilioResult.purchasedNumber;
          providerNumberId = twilioResult.providerNumberId;
        }
      } else {
        // Use Twilio provider (default)
        const twilioResult = await purchaseWithTwilio(customerId, purchaseData, bundleSid, phoneNumberRecord);
        purchasedNumber = twilioResult.purchasedNumber;
        providerNumberId = twilioResult.providerNumberId;
      }

      // Create SIP trunk for the customer's subaccount (only for Twilio)
      let sipTrunkSid = null;
      if (selectedProvider === 'twilio') {
        try {
          const customer = await prisma.customer.findUnique({
            where: { id: customerId },
            select: { twilioSubaccountSid: true }
          });

          if (customer?.twilioSubaccountSid) {
            const twilioClient = await getCustomerTwilioClient(customerId);
            const sipTrunk = await twilioClient.createSipTrunk(
              `Customer-${customerId}-Trunk`,
              customer.twilioSubaccountSid
            );
            sipTrunkSid = sipTrunk.sid;

            // Assign phone number to SIP trunk
            await twilioClient.assignPhoneNumberToTrunk(
              purchasedNumber.sid,
              sipTrunkSid,
              customer.twilioSubaccountSid
            );
          }
        } catch (sipError) {
          console.error('Failed to create SIP trunk, continuing with purchase:', sipError);
          // Don't fail the purchase if SIP trunk creation fails
        }
      }

      // Begin transaction to update records
      const result = await prisma.$transaction(async (tx) => {
        // Update phone number with provider SID
        const updatedPhoneNumber = await tx.phoneNumber.update({
          where: { id: phoneNumberRecord.id },
          data: {
            phoneNumberSid: providerNumberId,
            status: 'active',
            region: purchasedNumber.region || null,
            locality: purchasedNumber.locality || null,
            provider: selectedProvider,
          },
        });

        // Create purchase record
        const purchase = await tx.phoneNumberPurchase.create({
          data: {
            phoneNumberId: phoneNumberRecord.id,
            customerId,
            partnerId,
            purchasePrice: purchaseData.setupFee,
            setupFee: purchaseData.setupFee,
            monthlyRecurringCost: purchaseData.monthlyPrice,
            twilioOrderSid: selectedProvider === 'twilio' ? purchasedNumber.sid : null,
            telnyxOrderId: selectedProvider === 'telnyx' ? providerNumberId : null,
            status: 'completed',
            consentGiven: purchaseData.consentGiven,
            consentTimestamp: new Date(),
            consentIpAddress: purchaseData.consentIpAddress,
            addressVerified: false,
            outboundEnabled: false,
            sipTrunkSid: sipTrunkSid,
          },
        });

        // Create telephony credit transaction
        const transaction = await tx.telephonyCreditTransaction.create({
          data: {
            partnerId,
            customerId,
            type: 'phone_number_purchase',
            amount: -totalCost,
            balanceAfter: telephonyBalance - totalCost,
            description: `Phone number purchase: ${purchaseData.phoneNumber}`,
            referenceId: purchase.id,
            metadata: {
              phoneNumber: purchaseData.phoneNumber,
              phoneNumberId: phoneNumberRecord.id,
              purchaseId: purchase.id,
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

        return { phoneNumber: updatedPhoneNumber, purchase, transaction };
      });

      const responseMessage = requiresUSVerification
        ? 'Phone number purchased successfully! For outbound calling, please complete 10DLC verification in your phone number settings.'
        : 'Phone number purchased successfully! Please complete address verification to enable outbound calling.';

      const response = NextResponse.json({
        success: true,
        data: {
          phoneNumber: result.phoneNumber,
          purchase: result.purchase,
          transaction: result.transaction,
          sipTrunkSid: sipTrunkSid,
          requiresAddressVerification: !requiresUSVerification,
          requires10DLC: requiresUSVerification,
          outboundEnabled: false,
          message: responseMessage,
        },
      });

      // Add CORS headers for custom domains
      response.headers.set('Access-Control-Allow-Origin', '*');
      response.headers.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
      response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');

      return response;

    } catch (twilioError) {
      // If Twilio purchase fails, clean up the pending record
      await prisma.phoneNumber.update({
        where: { id: phoneNumberRecord.id },
        data: { status: 'failed' },
      });

      console.error('Twilio purchase error:', twilioError);
      return NextResponse.json(
        { error: 'Failed to purchase phone number from provider', details: twilioError instanceof Error ? twilioError.message : 'Unknown error' },
        { status: 500 }
      );
    }

  } catch (error) {
    console.error('Phone number purchase error:', error);
    return NextResponse.json(
      { error: 'Failed to purchase phone number', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

// Helper function to purchase with Twilio (extracted for reuse)
async function purchaseWithTwilio(customerId: string, purchaseData: any, bundleSid: string | null, phoneNumberRecord: any) {
  // Get customer's Twilio client (create subaccount if needed)
  let twilioClient;
  try {
    twilioClient = await getCustomerTwilioClient(customerId);
  } catch (error) {
    console.warn(`Customer ${customerId} doesn't have a Twilio subaccount, creating one for purchase...`);

    try {
      // Try to create a subaccount for existing customer
      await createSubaccountForExistingCustomer(customerId);
      // Now try to get the client again
      twilioClient = await getCustomerTwilioClient(customerId);
      console.log(`Successfully created and configured Twilio subaccount for customer ${customerId}`);
    } catch (subaccountError) {
      console.error(`Failed to create subaccount for customer ${customerId}:`, subaccountError);

      // Update phone number record to failed
      await prisma.phoneNumber.update({
        where: { id: phoneNumberRecord.id },
        data: { status: 'failed' },
      });

      throw new Error('Failed to create Twilio subaccount. Please contact support.');
    }
  }

  const purchaseOptions: any = {
    phoneNumber: purchaseData.phoneNumber,
    friendlyName: purchaseData.friendlyName,
    voiceUrl: process.env.TWILIO_VOICE_WEBHOOK_URL,
    voiceMethod: 'POST',
    smsUrl: process.env.TWILIO_SMS_WEBHOOK_URL,
    smsMethod: 'POST',
  };

  // Add bundle SID if required
  if (bundleSid) {
    purchaseOptions.bundleSid = bundleSid;
    console.log('Including bundle SID in purchase:', bundleSid);
  } else {
    // Check if we have a basic address for this phone number using Prisma model
    try {
      const basicAddress = await prisma.phoneNumberAddress.findFirst({
        where: {
          phoneNumber: purchaseData.phoneNumber,
          customerId: customerId
        },
        select: {
          addressSid: true
        },
        orderBy: {
          createdAt: 'desc'
        }
      });

      if (basicAddress) {
        purchaseOptions.addressSid = basicAddress.addressSid;
        console.log('Using stored basic address:', basicAddress.addressSid);
      }
    } catch (addressError) {
      console.log('No basic address found, will attempt purchase without address');
    }
  }

  // Try to purchase the phone number
  let twilioNumber;
  try {
    twilioNumber = await twilioClient.purchasePhoneNumber(purchaseOptions);
  } catch (purchaseError: any) {
    // If purchase fails due to missing address, provide helpful error message
    if (purchaseError.message?.includes('Phone Number Requires an Address') ||
        purchaseError.message?.includes('AddressSid')) {

      console.log('Phone number purchase failed due to missing address:', purchaseError.message);

      throw new Error('ADDRESS_REQUIRED: This phone number requires a basic address for purchase. Please provide your address information.');
    }

    // If purchase fails due to missing bundle, provide helpful error message
    if (purchaseError.message?.includes('Bundle required') ||
        purchaseError.message?.includes('bundle') ||
        purchaseError.message?.includes('regulatory')) {

      console.log('Phone number purchase failed due to missing bundle:', purchaseError.message);

      throw new Error('BUNDLE_REQUIRED: Business address verification is required for this phone number type. Please complete the verification process first.');
    }

    // Re-throw other purchase errors
    throw purchaseError;
  }

  return {
    purchasedNumber: twilioNumber,
    providerNumberId: twilioNumber.sid
  };
}