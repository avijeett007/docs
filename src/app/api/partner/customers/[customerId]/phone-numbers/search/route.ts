import { NextRequest, NextResponse } from 'next/server';
// import { initTwilioClient } from '@/lib/twilio'; // Unused import
import { getCustomerTwilioClient, createSubaccountForExistingCustomer } from '@/lib/twilio-subaccount';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';
import { obfuscateEmail } from '@/lib/pii-obfuscation';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

// GBP to USD conversion rate
const GBP_TO_USD_RATE = 1.40;

// Schema for partner phone number search
const partnerSearchSchema = z.object({
  countryCode: z.string().min(2).max(2),
  phoneType: z.enum(['local', 'mobile', 'tollfree']),
  limit: z.number().min(1).max(50).optional().default(10),
  voiceEnabled: z.boolean().optional(),
  smsEnabled: z.boolean().optional(),
  mmsEnabled: z.boolean().optional(),
  faxEnabled: z.boolean().optional(),
});

// Helper function to extract real pricing from Twilio pricing API response
function getRealPricing(pricingData: any, numberType: string) {
  if (!pricingData || !pricingData.phone_number_prices) {
    return {
      monthlyPrice: 0,
      setupFee: 0,
      currency: 'USD',
      note: 'Pricing unavailable - contact support for accurate pricing'
    };
  }

  // Map our internal types to Twilio's pricing types
  const typeMapping: Record<string, string> = {
    'local': 'local',
    'mobile': 'mobile', 
    'tollfree': 'toll free'
  };

  const twilioType = typeMapping[numberType] || 'local';
  
  // Find the pricing for this number type
  const priceInfo = pricingData.phone_number_prices.find(
    (price: any) => price.number_type === twilioType
  );

  if (!priceInfo) {
    return {
      monthlyPrice: 0,
      setupFee: 0,
      currency: 'USD',
      note: `Pricing not available for ${numberType} numbers in this country`
    };
  }

  // Convert price to cents (Twilio returns dollars as string)
  const monthlyPriceCents = Math.round(parseFloat(priceInfo.current_price || priceInfo.base_price || '0') * 100);
  
  // Handle currency conversion to USD
  const originalCurrency = (pricingData.price_unit || 'USD').toUpperCase();
  let finalPrice = monthlyPriceCents;
  let finalCurrency = 'USD';
  let note = null;

  // Convert GBP to USD at 1.40 rate
  if (originalCurrency === 'GBP') {
    const gbpPrice = monthlyPriceCents / 100; // Convert cents to pounds
    const usdPrice = gbpPrice * GBP_TO_USD_RATE; // Convert to USD
    finalPrice = Math.round(usdPrice * 100); // Convert back to cents
    finalCurrency = 'USD';
    note = `Converted from £${gbpPrice.toFixed(2)} GBP at 1.40 rate. Exchange rates may vary.`;
  } else if (originalCurrency !== 'USD') {
    // For other currencies, show original with note
    finalCurrency = originalCurrency;
    note = `Pricing in ${originalCurrency}. Contact support for USD equivalent.`;
  }
  
  return {
    monthlyPrice: finalPrice,
    setupFee: 0, // Most numbers don't have setup fees
    currency: finalCurrency,
    note: note
  };
}

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
    const validationResult = partnerSearchSchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json(
        { error: 'Invalid request data', details: validationResult.error.errors },
        { status: 400 }
      );
    }

    const { countryCode, phoneType, limit, voiceEnabled, smsEnabled, mmsEnabled, faxEnabled } = validationResult.data;

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

    logger.debug('Partner searching phone numbers for customer', {
      partnerId: partnerId,
      customerId: customerId,
      countryCode,
      phoneType,
      operation: 'search_phone_numbers'
    });

    logger.debug('Customer found for phone number search', {
      customerId: customer.id,
      customerEmail: obfuscateEmail(customer.email),
      userOnboardingCount: customer.userOnboarding.length,
      credentialsCount: customer.credentials.length,
      hasUserOnboardingAccess,
      hasCredentialAccess,
      operation: 'search_phone_numbers'
    });

    // Get or create Twilio subaccount for the customer
    let customerTwilioClient;
    try {
      customerTwilioClient = await getCustomerTwilioClient(customerId);
    } catch (error: any) {
      if (error.message.includes('No Twilio subaccount found') || error.message.includes('Customer does not have a Twilio subaccount')) {
        logger.info('Creating Twilio subaccount for existing customer', {
          customerId: customerId,
          partnerId: partnerId,
          operation: 'search_phone_numbers'
        });
        await createSubaccountForExistingCustomer(customerId);
        customerTwilioClient = await getCustomerTwilioClient(customerId);
      } else {
        throw error;
      }
    }

    // Search for available phone numbers with capability filters
    const searchOptions: any = {};
    if (voiceEnabled !== undefined) searchOptions.voiceEnabled = voiceEnabled;
    if (smsEnabled !== undefined) searchOptions.smsEnabled = smsEnabled;
    if (mmsEnabled !== undefined) searchOptions.mmsEnabled = mmsEnabled;
    if (faxEnabled !== undefined) searchOptions.faxEnabled = faxEnabled;

    const availableNumbers = await customerTwilioClient.searchAvailablePhoneNumbers(
      countryCode,
      phoneType,
      searchOptions
    );

    // Limit results
    const limitedNumbers = availableNumbers.slice(0, limit);

    // Get pricing information
    let pricingData;
    try {
      pricingData = await customerTwilioClient.getPhoneNumberPricing(countryCode);
    } catch (error) {
      console.warn(`Failed to get pricing for ${countryCode}:`, error);
      pricingData = null;
    }

    // Format results with pricing
    const formattedNumbers = limitedNumbers.map((number: any) => {
      const pricing = getRealPricing(pricingData, phoneType);
      
      return {
        phoneNumber: number.phoneNumber,
        friendlyName: number.friendlyName,
        locality: number.locality,
        region: number.region,
        countryCode: countryCode,
        capabilities: {
          voice: number.capabilities.voice,
          sms: number.capabilities.SMS,
          mms: number.capabilities.MMS,
          fax: number.capabilities.fax,
        },
        monthlyPrice: pricing.monthlyPrice,
        setupFee: pricing.setupFee,
        currency: pricing.currency,
        pricingNote: pricing.note,
      };
    });

    return NextResponse.json({
      success: true,
      data: {
        numbers: formattedNumbers,
        total: formattedNumbers.length,
        searchParams: {
          countryCode,
          phoneType,
          limit,
        },
        customer: {
          id: customer.id,
          firstName: customer.firstName,
          lastName: customer.lastName,
        },
      },
    });

  } catch (error: any) {
    console.error('Partner phone number search error:', error);

    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    // Handle different types of errors gracefully
    let responseError = 'Failed to search phone numbers';
    let userMessage = 'Something went wrong while searching for phone numbers. Please try again later.';
    let statusCode = 500;
    let isKnownIssue = false;

    if (errorMessage) {
      const errorMsg = errorMessage.toLowerCase();
      
      // Country not supported by Twilio
      if (errorMsg.includes('not available for country code') || 
          errorMsg.includes('country code') || 
          errorMsg.includes('not found') ||
          errorMsg.includes('404')) {
        statusCode = 400;
        responseError = 'Country not supported';
        userMessage = 'It seems our telephony provider doesn\'t support this country yet. Please try a different country or contact support if you need numbers from this region.';
        isKnownIssue = true;
      }
      // Number type not available for country
      else if (errorMsg.includes('not available for') && errorMsg.includes('numbers')) {
        statusCode = 400;
        responseError = 'Number type not supported';
        userMessage = 'This type of phone number is not available for the selected country. Please try selecting "Local" numbers instead.';
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
