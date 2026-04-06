import { NextRequest, NextResponse } from 'next/server';
import { verifyWhitelabelAuth } from '@/lib/whitelabelAuth';
import { prisma } from '@/lib/prisma';
import { initTwilioClient } from '@/lib/twilio';
import { getPreferredProvider } from '@/lib/services/phoneNumberProviders/providerSelection';
import PhoneNumberProviderFactory from '@/lib/services/phoneNumberProviders';

export const dynamic = 'force-dynamic';

interface GetAvailableRequest {
  countryCode: string; // e.g., "US", "GB", "CA"
  areaCode?: string;   // Optional area code preference
  numberType?: 'mobile' | 'local'; // Number type selection
}

export async function POST(req: NextRequest) {
  try {
    // Use whitelabel authentication
    const authResult = await verifyWhitelabelAuth(req);

    if (!authResult) {
      return new NextResponse('Unauthorized', { status: 401 });
    }

    const { customerId, partnerId } = authResult;
    const body: GetAvailableRequest = await req.json();
    const { countryCode, areaCode, numberType = 'mobile' } = body;

    if (!countryCode) {
      return new NextResponse('Country code is required', { status: 400 });
    }

    // Step 1: Check partner-specific pool for available numbers
    const partnerPoolNumber = await prisma.phoneNumberPool.findFirst({
      where: {
        partnerId: partnerId,
        status: 'available',
        poolType: 'partner',
        phoneNumber: {
          countryCode: countryCode,
          ...(areaCode && {
            phoneNumber: {
              contains: areaCode
            }
          })
        }
      },
      include: {
        phoneNumber: true
      }
    });

    if (partnerPoolNumber) {
      return NextResponse.json({
        success: true,
        data: {
          source: 'partner_pool',
          phoneNumber: partnerPoolNumber.phoneNumber.phoneNumber,
          friendlyName: partnerPoolNumber.phoneNumber.friendlyName,
          capabilities: partnerPoolNumber.phoneNumber.capabilities,
          poolId: partnerPoolNumber.id,
          countryCode: partnerPoolNumber.phoneNumber.countryCode,
          region: partnerPoolNumber.phoneNumber.region,
          locality: partnerPoolNumber.phoneNumber.locality,
          type: partnerPoolNumber.phoneNumber.type,
          message: 'This number is ready to use for your business calls.'
        }
      });
    }

    // Step 2: Check global pool for available numbers
    const globalPoolNumber = await prisma.phoneNumberPool.findFirst({
      where: {
        partnerId: null, // Global pool
        status: 'available',
        poolType: 'global',
        phoneNumber: {
          countryCode: countryCode,
          ...(areaCode && {
            phoneNumber: {
              contains: areaCode
            }
          })
        }
      },
      include: {
        phoneNumber: true
      }
    });

    if (globalPoolNumber) {
      return NextResponse.json({
        success: true,
        data: {
          source: 'global_pool',
          phoneNumber: globalPoolNumber.phoneNumber.phoneNumber,
          friendlyName: globalPoolNumber.phoneNumber.friendlyName,
          capabilities: globalPoolNumber.phoneNumber.capabilities,
          poolId: globalPoolNumber.id,
          countryCode: globalPoolNumber.phoneNumber.countryCode,
          region: globalPoolNumber.phoneNumber.region,
          locality: globalPoolNumber.phoneNumber.locality,
          type: globalPoolNumber.phoneNumber.type,
          message: 'This number is available and ready for your business calls.'
        }
      });
    }

    // Step 3: Search for fresh numbers using provider selection
    try {
      // Determine which provider to use based on country
      const selectedProvider = getPreferredProvider(countryCode, numberType);

      let availableNumbers = [];

      if (selectedProvider === 'telnyx') {
        // Use Telnyx provider
        const telnyxApiKey = process.env.TELNYX_API_KEY;
        if (!telnyxApiKey) {
          throw new Error('Telnyx API key not configured');
        }

        const telnyxProvider = PhoneNumberProviderFactory.createProvider('telnyx', {
          apiKey: telnyxApiKey
        });

        const searchResult = await telnyxProvider.searchAvailablePhoneNumbers({
          countryCode: countryCode,
          type: numberType,
          areaCode: areaCode,
          limit: 1,
          voiceEnabled: true,
          smsEnabled: numberType === 'mobile'
        });

        availableNumbers = searchResult.numbers;
      } else {
        // Use Twilio provider (fallback)
        const twilioClient = initTwilioClient();

        const searchParams = {
          voiceEnabled: true,
          smsEnabled: numberType === 'mobile',
          limit: 1,
          ...(areaCode && numberType === 'local' && { areaCode })
        };

        availableNumbers = await twilioClient.searchAvailablePhoneNumbers(
          countryCode,
          numberType,
          searchParams
        );
      }

      if (availableNumbers.length === 0) {
        return NextResponse.json({
          success: false,
          message: 'No numbers available in this area. Please try a different area code or contact us for help.'
        });
      }

      const selectedNumber = availableNumbers[0];

      return NextResponse.json({
        success: true,
        data: {
          source: `${selectedProvider}_search`,
          provider: selectedProvider,
          phoneNumber: selectedNumber.phoneNumber,
          friendlyName: `${selectedNumber.locality || countryCode} Number`,
          capabilities: {
            voice: selectedNumber.capabilities?.voice || true,
            sms: numberType === 'mobile' ? (
              (selectedNumber.capabilities as any)?.SMS ||
              (selectedNumber.capabilities as any)?.sms ||
              false
            ) : false,
            mms: numberType === 'mobile' ? (
              (selectedNumber.capabilities as any)?.MMS ||
              (selectedNumber.capabilities as any)?.mms ||
              false
            ) : false,
            fax: selectedNumber.capabilities?.fax || false
          },
          poolId: null,
          countryCode: countryCode,
          region: selectedNumber.region,
          locality: selectedNumber.locality,
          type: numberType,
          message: `This is a new number from ${selectedProvider} that will be set up for your business calls.`,
          hideFromCustomer: true // Hide business numbers from customer portal by default
        }
      });

    } catch (providerError) {
      console.error('Provider search error:', providerError);
      return NextResponse.json({
        success: false,
        message: 'Unable to search for numbers right now. Please try again in a moment or contact us for help.'
      });
    }

  } catch (error) {
    console.error('Error getting available phone number:', error);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}
