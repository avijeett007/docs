import { NextRequest, NextResponse } from 'next/server';
import { verifyPartnerJWT } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import PhoneNumberProviderFactory, { ProviderUtils, SupportedProvider } from '@/lib/services/phoneNumberProviders';
import { CredentialManager } from '@/lib/services/phoneNumberProviders/CredentialManager';
import { TierValidationService } from '@/lib/services/tierValidationService';
import { z } from 'zod';

// Cost per phone number for free tier users importing beyond free limit (in cents)
const PHONE_NUMBER_IMPORT_COST_CENTS = 1000; // $10

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

    // Check tier limits for phone number import
    const tierValidation = await TierValidationService.validatePhoneNumberImport(partnerId);

    // Calculate how many numbers will require payment
    let numbersRequiringPayment = 0;
    let totalCostCents = 0;

    if (!tierValidation.allowed && tierValidation.limit !== null) {
      // User is on free tier and has exceeded free limit
      // All new imports will cost $10 each
      numbersRequiringPayment = numbers.length;
      totalCostCents = numbersRequiringPayment * PHONE_NUMBER_IMPORT_COST_CENTS;
    } else if (tierValidation.remaining !== null && tierValidation.remaining < numbers.length) {
      // User is on free tier and some imports will be paid
      numbersRequiringPayment = numbers.length - tierValidation.remaining;
      totalCostCents = numbersRequiringPayment * PHONE_NUMBER_IMPORT_COST_CENTS;
    }

    // If payment required, check telephony credits balance
    if (totalCostCents > 0) {
      const partner = await prisma.partner.findUnique({
        where: { id: partnerId },
        select: { telephonyCreditBalanceCents: true }
      });

      if (!partner || (partner.telephonyCreditBalanceCents || 0) < totalCostCents) {
        return NextResponse.json(
          {
            success: false,
            error: 'INSUFFICIENT_CREDITS',
            message: `Insufficient telephony credits. You need $${(totalCostCents / 100).toFixed(2)} to import ${numbersRequiringPayment} phone number(s). Each number costs $10. Please add credits to proceed.`,
            requiredCredits: totalCostCents,
            currentBalance: partner?.telephonyCreditBalanceCents || 0,
            numbersRequiringPayment
          },
          { status: 402 }
        );
      }
    }

    const imported: any[] = [];
    const failed: any[] = [];
    const skipped: any[] = [];

    // Track how many free imports are available
    // If remaining is null, user is not on free tier (unlimited free imports)
    // If remaining is a number, that's how many free imports they have left
    const freeImportsAvailable = tierValidation.remaining;
    let freeImportsUsed = 0;

    // Use database transaction for consistency
    await prisma.$transaction(async (tx) => {
      // Deduct telephony credits if payment is required
      if (totalCostCents > 0) {
        await tx.partner.update({
          where: { id: partnerId },
          data: {
            telephonyCreditBalanceCents: {
              decrement: totalCostCents
            }
          }
        });
      }
      // Check for existing numbers (by phone number, not customer-specific)
      const existingNumbers = await tx.phoneNumber.findMany({
        where: {
          phoneNumber: { in: numbers.map(n => n.phoneNumber) }
        },
        select: { phoneNumber: true }
      });

      const existingNumbersSet = new Set(existingNumbers.map(n => n.phoneNumber));

      // Save provider credentials if requested (partner-level)
      let providerCredentialRecord = null;
      if (saveCredentials && validation.accountInfo) {
        const accountIdentifier = validation.accountInfo.accountId;
        
        // Check if credentials already exist (partner-level, no customer)
        const existingCredentials = await tx.phoneNumberProvider.findFirst({
          where: {
            partnerId: partnerId,
            customerId: null, // Partner-level credentials
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
          // Create new credential record (partner-level)
          const credentialData = await CredentialManager.createCredentialRecord(
            partnerId,
            null, // No customer - partner-level
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

          // Determine if this import is free or paid
          // If freeImportsAvailable is null, user is not on free tier (all imports are free)
          // If freeImportsAvailable is a number, use free imports first, then paid
          let isPaidImport = false;
          if (freeImportsAvailable !== null) {
            if (freeImportsUsed < freeImportsAvailable) {
              // This import is free
              freeImportsUsed++;
              isPaidImport = false;
            } else {
              // This import is paid ($10)
              isPaidImport = true;
            }
          }

          // Create phone number record (unassigned to customer)
          const importedNumber = await tx.phoneNumber.create({
            data: {
              customerId: null, // Unassigned initially
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
              // For paid imports, set the one-time import cost; for free imports, use provider cost or 0
              monthlyRecurringCost: isPaidImport ? PHONE_NUMBER_IMPORT_COST_CENTS : (numberInfo.monthlyRecurringCost || 0),

              // Import-specific fields
              provider: `imported_${provider}`,
              // Paid imports are marked as not imported (chargeable), free imports are marked as imported
              isImported: !isPaidImport,
              importedAt: new Date(),
              providerAccountId: validation.accountInfo?.accountId,
              originalProvider: provider,
              importMetadata: {
                importedFrom: provider,
                originalId: numberInfo.id,
                importedAt: new Date().toISOString(),
                providerMetadata: numberInfo.metadata,
                credentialRecordId: providerCredentialRecord?.id,
                importLevel: 'partner', // Indicates partner-level import
                isPaidImport: isPaidImport, // Track if this was a paid import
                importCostCents: isPaidImport ? PHONE_NUMBER_IMPORT_COST_CENTS : 0
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
            capabilities: importedNumber.capabilities,
            isAssigned: false, // Unassigned initially
            isPaidImport: isPaidImport
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
      message: `Successfully imported ${imported.length} phone numbers to partner inventory`,
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
        importLevel: 'partner',
        billing: totalCostCents > 0 ? {
          charged: true,
          amountCents: totalCostCents,
          amountDisplay: `$${(totalCostCents / 100).toFixed(2)}`,
          paidNumbers: numbersRequiringPayment
        } : null
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
