import { NextRequest, NextResponse } from 'next/server';
import { verifyWhitelabelAuth } from '@/lib/whitelabelAuth';
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

export async function POST(req: NextRequest) {
  try {
    // Authenticate the request
    const authResult = await verifyWhitelabelAuth(req);
    if (!authResult || !authResult.customerId) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
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

    // Check which numbers are already imported (globally, since phone_number has unique constraint)
    const phoneNumbers = listResult.numbers.map(n => n.phoneNumber);
    const existingNumbers = await prisma.phoneNumber.findMany({
      where: {
        phoneNumber: { in: phoneNumbers }
      },
      select: {
        phoneNumber: true,
        provider: true,
        importedAt: true,
        customerId: true
      }
    });

    const existingNumbersSet = new Set(existingNumbers.map(n => n.phoneNumber));
    const existingNumbersMap = new Map(existingNumbers.map(n => [n.phoneNumber, n]));

    // Mark numbers as already imported and add additional metadata
    const numbersWithImportStatus = listResult.numbers.map(number => {
      const isAlreadyImported = existingNumbersSet.has(number.phoneNumber);
      const existingNumber = existingNumbersMap.get(number.phoneNumber);
      const isOwnNumber = existingNumber?.customerId === authResult.customerId;

      // Enhanced import logic - more permissive (same as partner portal)
      const canImport = !isAlreadyImported && (
        number.status === 'active' ||
        number.status === 'in-use' ||
        number.status === 'pending' ||
        !number.status
      );

      // Determine availability status for UI
      let availabilityStatus = 'available';
      let availabilityMessage = 'Available for import';

      if (isAlreadyImported) {
        if (isOwnNumber) {
          availabilityStatus = 'already_imported_by_you';
          availabilityMessage = 'Already imported by you';
        } else {
          availabilityStatus = 'already_imported_by_other';
          availabilityMessage = 'Already imported by another customer';
        }
      } else if (!canImport) {
        availabilityStatus = 'unavailable';
        availabilityMessage = `Cannot import (status: ${number.status || 'unknown'})`;
      }

      return {
        ...number,
        isAlreadyImported,
        importedAt: existingNumber?.importedAt || null,
        importedProvider: existingNumber?.provider || null,
        canImport,
        availabilityStatus,
        availabilityMessage
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
        }
      }
    });

  } catch (error: any) {
    
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
