import { NextRequest, NextResponse } from 'next/server';
import { verifyPartnerJWT } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import PhoneNumberProviderFactory, { ProviderUtils, SupportedProvider } from '@/lib/services/phoneNumberProviders';
import { z } from 'zod';

const listNumbersSchema = z.object({
  provider: z.enum(['twilio', 'telnyx']),
  credentials: z.object({
    // Twilio credentials
    accountSid: z.string().optional(),
    authToken: z.string().optional(),
    // Telnyx credentials
    apiKey: z.string().optional()
  })
});

export async function POST(req: NextRequest) {
  try {
    // Authenticate partner
    const partnerAuth = await verifyPartnerJWT(req);
    if (!partnerAuth || !partnerAuth.isValid || !partnerAuth.payload?.partnerId) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const partnerId = partnerAuth.payload.partnerId;

    const body = await req.json();
    const validationResult = listNumbersSchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'INVALID_REQUEST_DATA', 
          message: 'Invalid request data',
          details: validationResult.error.errors 
        },
        { status: 400 }
      );
    }

    const { provider, credentials } = validationResult.data;

    // Validate credential format
    if (!ProviderUtils.validateCredentialsFormat(provider as SupportedProvider, credentials)) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'INVALID_CREDENTIALS_FORMAT',
          message: `Invalid credential format for ${ProviderUtils.getProviderDisplayName(provider as SupportedProvider)}`
        },
        { status: 400 }
      );
    }

    // Create provider instance
    let providerInstance;
    try {
      providerInstance = PhoneNumberProviderFactory.createProvider(provider, credentials);
    } catch (error: any) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'PROVIDER_CREATION_FAILED',
          message: error.message || 'Failed to create provider instance'
        },
        { status: 400 }
      );
    }

    // Validate credentials first
    const validation = await providerInstance.validateCredentials();
    if (!validation.isValid) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'INVALID_CREDENTIALS',
          message: validation.error || 'Invalid provider credentials'
        },
        { status: 401 }
      );
    }

    // Get phone numbers from provider
    const listResult = await providerInstance.listPhoneNumbers();
    const providerNumbers = listResult.numbers;

    // Get already imported numbers to check for duplicates
    const existingNumbers = await prisma.phoneNumber.findMany({
      where: {
        phoneNumber: { in: providerNumbers.map(n => n.phoneNumber) }
      },
      select: { phoneNumber: true }
    });

    const existingNumbersSet = new Set(existingNumbers.map(n => n.phoneNumber));

    // Process and enhance numbers with import capability
    const enhancedNumbers = providerNumbers.map(number => {
      const isAlreadyImported = existingNumbersSet.has(number.phoneNumber);
      
      // Enhanced import logic - more permissive
      const canImport = !isAlreadyImported && (
        number.status === 'active' || 
        number.status === 'in-use' || 
        number.status === 'pending' ||
        !number.status
      );

      return {
        id: number.id,
        phoneNumber: number.phoneNumber,
        friendlyName: number.friendlyName,
        status: number.status,
        capabilities: number.capabilities,
        monthlyRecurringCost: number.monthlyRecurringCost,
        canImport,
        isAlreadyImported,
        reason: isAlreadyImported ? 'Already imported' : canImport ? 'Available for import' : 'Not available for import'
      };
    });

    const availableCount = enhancedNumbers.filter(n => n.canImport).length;
    const unavailableCount = enhancedNumbers.filter(n => !n.canImport).length;

    return NextResponse.json({
      success: true,
      message: `Found ${providerNumbers.length} phone numbers`,
      data: {
        numbers: enhancedNumbers,
        pagination: listResult.pagination,
        summary: {
          total: providerNumbers.length,
          available: availableCount,
          unavailable: unavailableCount,
          alreadyImported: enhancedNumbers.filter(n => n.isAlreadyImported).length
        },
        provider: {
          name: provider,
          displayName: ProviderUtils.getProviderDisplayName(provider as SupportedProvider),
          accountInfo: validation.accountInfo
        }
      }
    });

  } catch (error: any) {
    console.error('Error listing phone numbers:', error);
    
    // Handle specific provider errors
    if (error.name === 'ProviderAuthenticationError') {
      return NextResponse.json(
        { 
          success: false, 
          error: 'AUTHENTICATION_FAILED',
          message: error.message,
          provider: error.provider
        },
        { status: 401 }
      );
    }
    
    if (error.name === 'ProviderRateLimitError') {
      return NextResponse.json(
        { 
          success: false, 
          error: 'RATE_LIMIT_EXCEEDED',
          message: error.message,
          provider: error.provider,
          retryAfter: error.retryAfter
        },
        { status: 429 }
      );
    }

    return NextResponse.json(
      { 
        success: false, 
        error: 'INTERNAL_ERROR',
        message: 'An error occurred while listing phone numbers'
      },
      { status: 500 }
    );
  }
}
