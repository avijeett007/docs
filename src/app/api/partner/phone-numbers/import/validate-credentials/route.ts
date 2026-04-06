import { NextRequest, NextResponse } from 'next/server';
import { verifyPartnerJWT } from '@/lib/auth';
import PhoneNumberProviderFactory, { ProviderUtils, SupportedProvider } from '@/lib/services/phoneNumberProviders';
import { z } from 'zod';

const validateCredentialsSchema = z.object({
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

    const body = await req.json();
    const validationResult = validateCredentialsSchema.safeParse(body);

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

    // Validate credentials
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

    return NextResponse.json({
      success: true,
      message: 'Credentials validated successfully',
      data: {
        provider: {
          name: provider,
          displayName: ProviderUtils.getProviderDisplayName(provider as SupportedProvider),
          accountInfo: validation.accountInfo
        },
        isValid: true
      }
    });

  } catch (error: any) {
    console.error('Error validating credentials:', error);
    
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
        message: 'An error occurred while validating credentials'
      },
      { status: 500 }
    );
  }
}
