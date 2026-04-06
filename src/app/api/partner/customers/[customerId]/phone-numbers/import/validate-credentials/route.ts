import { NextRequest, NextResponse } from 'next/server';
import { verifyPartnerJWT } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
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

    // Validate credential format first
    if (!ProviderUtils.validateCredentialsFormat(provider as SupportedProvider, credentials)) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'INVALID_CREDENTIALS_FORMAT',
          message: `Invalid credential format for ${ProviderUtils.getProviderDisplayName(provider as SupportedProvider)}`,
          requirements: ProviderUtils.getCredentialRequirements(provider as SupportedProvider)
        },
        { status: 400 }
      );
    }

    // Create provider instance and validate credentials
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

    // Validate credentials with the provider
    const validation = await providerInstance.validateCredentials();

    if (validation.isValid) {
      return NextResponse.json({
        success: true,
        message: 'Credentials validated successfully',
        data: {
          provider,
          providerDisplayName: ProviderUtils.getProviderDisplayName(provider as SupportedProvider),
          accountInfo: validation.accountInfo,
          capabilities: ProviderUtils.getProviderCapabilities(provider as SupportedProvider),
          customerId: params.customerId
        }
      });
    } else {
      return NextResponse.json(
        { 
          success: false, 
          error: 'INVALID_CREDENTIALS',
          message: ProviderUtils.getProviderErrorMessage(provider as SupportedProvider, { message: validation.error }),
          details: {
            provider,
            error: validation.error
          }
        },
        { status: 400 }
      );
    }

  } catch (error: any) {
    console.error('Error validating phone number provider credentials:', error);
    
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
        message: 'An error occurred while validating credentials'
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
