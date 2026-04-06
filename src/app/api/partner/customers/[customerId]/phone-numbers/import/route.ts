import { NextRequest, NextResponse } from 'next/server';
import { verifyPartnerJWT } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import PhoneNumberProviderFactory, { ProviderUtils, SupportedProvider } from '@/lib/services/phoneNumberProviders';
import { CredentialManager } from '@/lib/services/phoneNumberProviders/CredentialManager';
import { z } from 'zod';

const importNumbersSchema = z.object({
  provider: z.enum(['twilio', 'telnyx']),
  credentials: z.object({
    // Twilio credentials
    accountSid: z.string().optional(),
    authToken: z.string().optional(),
    // Telnyx credentials
    apiKey: z.string().optional()
  }),
  numbers: z.array(z.object({
    id: z.string(),
    phoneNumber: z.string(),
    friendlyName: z.string().optional()
  })).min(1).max(50), // Limit batch size
  saveCredentials: z.boolean().optional().default(true)
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
      },
      include: {
        userOnboarding: {
          where: {
            partnerId: partnerId
          },
          include: {
            partner: true
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
    const validationResult = importNumbersSchema.safeParse(body);

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

    const { provider, credentials, numbers, saveCredentials } = validationResult.data;

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

    const imported: any[] = [];
    const failed: any[] = [];
    const skipped: any[] = [];

    // Use database transaction for consistency
    await prisma.$transaction(async (tx) => {
      // Check for existing numbers
      const existingNumbers = await tx.phoneNumber.findMany({
        where: {
          phoneNumber: { in: numbers.map(n => n.phoneNumber) },
          customerId: params.customerId
        },
        select: { phoneNumber: true }
      });

      const existingNumbersSet = new Set(existingNumbers.map(n => n.phoneNumber));

      // Save provider credentials if requested
      let providerCredentialRecord = null;
      if (saveCredentials && validation.accountInfo) {
        const accountIdentifier = validation.accountInfo.accountId;
        
        // Check if credentials already exist
        const existingCredentials = await tx.phoneNumberProvider.findFirst({
          where: {
            partnerId: partnerId,
            customerId: params.customerId,
            provider,
            accountIdentifier
          }
        });

        if (existingCredentials) {
          // Update existing credentials
          const updateData = await CredentialManager.updateCredentials(existingCredentials, credentials);
          providerCredentialRecord = await tx.phoneNumberProvider.update({
            where: { id: existingCredentials.id },
            data: {
              ...updateData,
              isActive: true,
              validationError: null
            }
          });
        } else {
          // Create new credential record
          const credentialData = await CredentialManager.createCredentialRecord(
            partnerId,
            params.customerId,
            provider,
            accountIdentifier,
            credentials
          );

          providerCredentialRecord = await tx.phoneNumberProvider.create({
            data: {
              ...credentialData,
              lastValidated: new Date(),
              isActive: true
            }
          });
        }
      }

      // Process each number
      for (const numberToImport of numbers) {
        try {
          // Skip if already exists
          if (existingNumbersSet.has(numberToImport.phoneNumber)) {
            skipped.push({
              phoneNumber: numberToImport.phoneNumber,
              reason: 'Already imported'
            });
            continue;
          }

          // Get detailed number info from provider
          const numberInfo = await providerInstance.getPhoneNumber(numberToImport.id);
          if (!numberInfo) {
            failed.push({
              phoneNumber: numberToImport.phoneNumber,
              reason: 'Number not found in provider account'
            });
            continue;
          }

          // Parse phone number for country code and region
          const phoneNumber = numberInfo.phoneNumber;
          let countryCode = 'US'; // Default
          const region = null;
          const locality = null;

          // Basic parsing for US numbers
          if (phoneNumber.startsWith('+1')) {
            countryCode = 'US';
            // Could add more sophisticated parsing here
          }

          // Create phone number record
          const importedNumber = await tx.phoneNumber.create({
            data: {
              customerId: params.customerId,
              partnerId: partnerId,
              phoneNumber: numberInfo.phoneNumber,
              phoneNumberSid: numberInfo.id, // Store provider ID
              friendlyName: numberToImport.friendlyName || numberInfo.friendlyName || numberInfo.phoneNumber,
              countryCode,
              region,
              locality,
              capabilities: numberInfo.capabilities,
              type: 'local', // Default, could be enhanced
              status: numberInfo.status,
              monthlyRecurringCost: numberInfo.monthlyRecurringCost || 0,
              
              // Import-specific fields
              provider: `imported_${provider}`,
              isImported: true,
              importedAt: new Date(),
              providerAccountId: validation.accountInfo?.accountId,
              originalProvider: provider,
              importMetadata: {
                importedFrom: provider,
                originalId: numberInfo.id,
                importedAt: new Date().toISOString(),
                providerMetadata: numberInfo.metadata,
                credentialRecordId: providerCredentialRecord?.id
              },
              
              purchasedAt: numberInfo.purchasedAt || new Date()
            }
          });

          imported.push({
            id: importedNumber.id,
            phoneNumber: importedNumber.phoneNumber,
            friendlyName: importedNumber.friendlyName,
            provider: importedNumber.provider,
            isImported: importedNumber.isImported,
            importedAt: importedNumber.importedAt,
            status: importedNumber.status,
            capabilities: importedNumber.capabilities
          });

        } catch (error: any) {
          console.error(`Failed to import number ${numberToImport.phoneNumber}:`, error);
          failed.push({
            phoneNumber: numberToImport.phoneNumber,
            reason: error.message || 'Import failed'
          });
        }
      }
    });

    return NextResponse.json({
      success: true,
      message: `Successfully imported ${imported.length} phone numbers for customer`,
      data: {
        imported,
        failed,
        skipped,
        summary: {
          total: numbers.length,
          imported: imported.length,
          failed: failed.length,
          skipped: skipped.length
        },
        provider: {
          name: provider,
          displayName: ProviderUtils.getProviderDisplayName(provider as SupportedProvider),
          accountInfo: validation.accountInfo
        },
        credentialsSaved: saveCredentials,
        customerId: params.customerId
      }
    });

  } catch (error: any) {
    console.error('Error importing phone numbers:', error);
    
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
        message: 'An error occurred while importing phone numbers'
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
