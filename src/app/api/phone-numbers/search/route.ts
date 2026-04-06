import { NextRequest, NextResponse } from 'next/server';
import { initTwilioClient } from '@/lib/twilio';
import { verifyWhitelabelAuth } from '@/lib/whitelabelAuth';
import { getCustomerTwilioClient, createSubaccountForExistingCustomer } from '@/lib/twilio-subaccount';
import { getPreferredProvider } from '@/lib/services/phoneNumberProviders/providerSelection';
import { PhoneNumberProviderFactory } from '@/lib/services/phoneNumberProviders/BaseProvider';
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

const searchSchema = z.object({
  countryCode: z.string().min(2).max(2),
  type: z.enum(['local', 'mobile', 'tollfree']),
  areaCode: z.string().optional(),
  contains: z.string().optional(),
  inLocality: z.string().optional(),
  inRegion: z.string().optional(),
  smsEnabled: z.boolean().optional(),
  voiceEnabled: z.boolean().optional(),
  mmsEnabled: z.boolean().optional(),
  faxEnabled: z.boolean().optional(),
  limit: z.number().min(1).max(50).optional().default(20),
  provider: z.enum(['twilio', 'telnyx']).optional(), // Allow manual provider override
});

export async function POST(req: NextRequest) {
  try {
    console.log('[PHONE SEARCH] Request received from:', req.headers.get('host'));
    console.log('[PHONE SEARCH] Request URL:', req.url);

    // Authenticate the request
    const authResult = await verifyWhitelabelAuth(req);
    console.log('[PHONE SEARCH] Auth result:', authResult ? 'Success' : 'Failed');

    if (!authResult || !authResult.customerId) {
      console.log('[PHONE SEARCH] Authentication failed');
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { customerId, partnerId } = authResult;
    console.log('[PHONE SEARCH] Customer ID:', customerId, 'Partner ID:', partnerId);

    // Parse and validate request body
    const body = await req.json();
    console.log('[PHONE SEARCH] Request body:', body);

    const validationResult = searchSchema.safeParse(body);

    if (!validationResult.success) {
      console.log('[PHONE SEARCH] Validation failed:', validationResult.error.errors);
      return NextResponse.json(
        { error: 'Invalid request data', details: validationResult.error.errors },
        { status: 400 }
      );
    }

    const searchParams = validationResult.data;

    // Determine which provider to use
    const selectedProvider = searchParams.provider || getPreferredProvider(searchParams.countryCode, searchParams.type);
    console.log(`[PHONE SEARCH] Using provider: ${selectedProvider} for ${searchParams.countryCode} ${searchParams.type}`);

    let numbersWithPricing;

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

        // Search for available numbers using Telnyx
        const searchResult = await telnyxProvider.searchAvailablePhoneNumbers({
          countryCode: searchParams.countryCode,
          type: searchParams.type,
          areaCode: searchParams.areaCode,
          contains: searchParams.contains,
          locality: searchParams.inLocality,
          region: searchParams.inRegion,
          limit: searchParams.limit,
          voiceEnabled: searchParams.voiceEnabled,
          smsEnabled: searchParams.smsEnabled,
          mmsEnabled: searchParams.mmsEnabled,
          faxEnabled: searchParams.faxEnabled
        });

        numbersWithPricing = searchResult.numbers.map(number => ({
          phoneNumber: number.phoneNumber,
          friendlyName: number.friendlyName,
          locality: number.locality,
          region: number.region,
          countryCode: number.countryCode,
          capabilities: number.capabilities,
          monthlyPrice: Math.round((number.monthlyPrice || 0) * 100), // Convert to cents
          setupFee: Math.round((number.setupFee || 0) * 100), // Convert to cents
          currency: number.currency || 'USD',
          pricingNote: `Telnyx pricing - ${number.currency || 'USD'}`,
          provider: 'telnyx',
          metadata: number.metadata
        }));

        logger.info(`Found ${numbersWithPricing.length} available numbers via Telnyx`, {
          operation: 'phone_search',
          provider: 'telnyx',
          countryCode: searchParams.countryCode,
          type: searchParams.type
        });

      } catch (error) {
        logger.error('Telnyx search failed, falling back to Twilio', error as Error, {
          operation: 'phone_search'
        });

        // Fallback to Twilio if Telnyx fails
        numbersWithPricing = await searchWithTwilio(customerId, searchParams);
      }
    } else {
      // Use Twilio provider (default)
      numbersWithPricing = await searchWithTwilio(customerId, searchParams);
    }

    const response = NextResponse.json({
      success: true,
      data: {
        numbers: numbersWithPricing,
        total: numbersWithPricing.length,
        countryCode: searchParams.countryCode,
        type: searchParams.type,
        provider: selectedProvider,
      }
    });

    // Add CORS headers for custom domains
    response.headers.set('Access-Control-Allow-Origin', '*');
    response.headers.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
    response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    return response;

  } catch (error) {
    console.error('Phone number search error:', error);

    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    // Handle different types of errors gracefully
    let responseError = 'Failed to search phone numbers';
    let userMessage = 'Something went wrong while searching for phone numbers. Please try again later.';
    let statusCode = 500;
    let isKnownIssue = false;

    if (errorMessage) {
      const errorMsg = errorMessage.toLowerCase();

      // Handle specific US Local error
      if (errorMessage.includes('TWILIO_US_LOCAL_ERROR')) {
        statusCode = 503;
        responseError = 'US Local Number Issue';
        userMessage = errorMessage.replace('TWILIO_US_LOCAL_ERROR: ', '');
        isKnownIssue = true;
      }
      // Country not supported by Twilio
      else if (errorMsg.includes('not available for country code') ||
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
      // Twilio API rate limiting
      else if (errorMsg.includes('rate limit') || errorMsg.includes('429')) {
        statusCode = 429;
        responseError = 'Rate limit exceeded';
        userMessage = 'Too many requests. Please wait a moment and try again.';
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
      // Network/timeout issues
      else if (errorMsg.includes('timeout') ||
               errorMsg.includes('network') ||
               errorMsg.includes('connection')) {
        statusCode = 408;
        responseError = 'Request timeout';
        userMessage = 'The request timed out. Please check your connection and try again.';
        isKnownIssue = true;
      }
      // Pricing API specific errors
      else if (errorMsg.includes('pricing api error')) {
        statusCode = 503;
        responseError = 'Pricing unavailable';
        userMessage = 'Unable to get current pricing. Please try again later or contact support for pricing information.';
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

// Helper function to search with Twilio (extracted for reuse)
async function searchWithTwilio(customerId: string, searchParams: any) {
  // Get customer's Twilio client (create subaccount if needed)
  let twilioClient;
  try {
    twilioClient = await getCustomerTwilioClient(customerId);
  } catch (error) {
    console.warn(`Customer ${customerId} doesn't have a Twilio subaccount, creating one...`);

    // Try to create a subaccount for existing customer
    try {
      await createSubaccountForExistingCustomer(customerId);
      // Now try to get the client again
      twilioClient = await getCustomerTwilioClient(customerId);
      console.log(`Successfully created and configured Twilio subaccount for customer ${customerId}`);
    } catch (subaccountError) {
      console.error(`Failed to create subaccount for customer ${customerId}:`, subaccountError);
      // Fallback to main account as last resort
      twilioClient = initTwilioClient();
    }
  }

  // Search for available phone numbers
  const availableNumbers = await twilioClient.searchAvailablePhoneNumbers(
    searchParams.countryCode,
    searchParams.type,
    {
      areaCode: searchParams.areaCode,
      contains: searchParams.contains,
      inLocality: searchParams.inLocality,
      inRegion: searchParams.inRegion,
      smsEnabled: searchParams.smsEnabled,
      voiceEnabled: searchParams.voiceEnabled,
      mmsEnabled: searchParams.mmsEnabled,
      faxEnabled: searchParams.faxEnabled,
    }
  );

  // Limit results
  const limitedNumbers = availableNumbers.slice(0, searchParams.limit);

  // Get real pricing from Twilio
  let pricing;
  try {
    pricing = await twilioClient.getPhoneNumberPricing(searchParams.countryCode);
  } catch (error) {
    console.error('Failed to get pricing:', error);
    // Fallback to indicate pricing unavailable
    pricing = null;
  }

  // Add pricing information to each number
  return limitedNumbers.map(number => {
    const priceInfo = getRealPricing(pricing, searchParams.type);
    return {
      ...number,
      monthlyPrice: priceInfo.monthlyPrice,
      setupFee: priceInfo.setupFee,
      currency: priceInfo.currency,
      pricingNote: priceInfo.note,
      provider: 'twilio'
    };
  });
}

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
    const usdPrice = gbpPrice * 1.40; // Convert to USD
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