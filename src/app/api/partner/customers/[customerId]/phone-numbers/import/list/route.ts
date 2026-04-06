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
  }),
  page: z.number().min(0).optional(),
  limit: z.number().min(1).max(100).optional(),
  filter: z.object({
    status: z.string().optional(),
    phoneNumber: z.string().optional()
  }).optional()
});

export async function POST(
  req: NextRequest,
  { params }: { params: { customerId: string } }
) {
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

    // Verify customer belongs to partner through UserOnboarding
    const customer = await prisma.customer.findFirst({
      where: {
        id: params.customerId,
        userOnboarding: {
          some: {
            partnerId: partnerId
          }
        }
      }
    });

    if (!customer) {
      return NextResponse.json(
        { success: false, error: 'Customer not found' },
        { status: 404 }
      );
    }

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

    const { provider, credentials, page = 0, limit = 20, filter } = validationResult.data;

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

    // List phone numbers from provider
    const listResult = await providerInstance.listPhoneNumbers({
      page,
      limit,
      filter
    });

    // Check which numbers are already imported for this customer
    const phoneNumbers = listResult.numbers.map(n => n.phoneNumber);
    const existingNumbers = await prisma.phoneNumber.findMany({
      where: {
        phoneNumber: { in: phoneNumbers },
        customerId: params.customerId,
        isImported: true
      },
      select: {
        phoneNumber: true,
        provider: true,
        importedAt: true
      }
    });

    const existingNumbersSet = new Set(existingNumbers.map(n => n.phoneNumber));

    // Mark numbers as already imported and add additional metadata
    const numbersWithImportStatus = listResult.numbers.map(number => {
      const isAlreadyImported = existingNumbersSet.has(number.phoneNumber);
      const existingNumber = existingNumbers.find(n => n.phoneNumber === number.phoneNumber);

      // Debug logging
      console.log(`[DEBUG] Phone number ${number.phoneNumber}:`, {
        status: number.status,
        isAlreadyImported,
        canImport: !isAlreadyImported && (number.status === 'active' || number.status === 'in-use' || !number.status)
      });

      return {
        ...number,
        isAlreadyImported,
        importedAt: existingNumber?.importedAt || null,
        importedProvider: existingNumber?.provider || null,
        // Allow import if not already imported and status is active, in-use, or undefined
        canImport: !isAlreadyImported && (number.status === 'active' || number.status === 'in-use' || !number.status)
      };
    });

    return NextResponse.json({
      success: true,
      data: {
        numbers: numbersWithImportStatus,
        pagination: listResult.pagination,
        provider: {
          name: provider,
          displayName: ProviderUtils.getProviderDisplayName(provider as SupportedProvider),
          capabilities: ProviderUtils.getProviderCapabilities(provider as SupportedProvider)
        },
        summary: {
          total: listResult.pagination.total,
          available: numbersWithImportStatus.filter(n => n.canImport).length,
          alreadyImported: numbersWithImportStatus.filter(n => n.isAlreadyImported).length,
          unavailable: numbersWithImportStatus.filter(n => !n.canImport && !n.isAlreadyImported).length
        },
        customerId: params.customerId
      }
    });

  } catch (error: any) {
    console.error('Error listing phone numbers for import:', error);
    
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
    
    if (error.name === 'ProviderServiceError') {
      return NextResponse.json(
        { 
          success: false, 
          error: 'PROVIDER_SERVICE_ERROR',
          message: error.message,
          provider: error.provider,
          statusCode: error.statusCode
        },
        { status: 502 }
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

// Handle OPTIONS request for CORS
export async function OPTIONS(req: NextRequest) {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}
