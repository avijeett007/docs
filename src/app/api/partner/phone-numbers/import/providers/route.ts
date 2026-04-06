import { NextRequest, NextResponse } from 'next/server';
import { verifyPartnerJWT } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { isFeatureEnabled } from '@/config/featureFlags';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
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

    // Get saved provider credentials for this partner
    const savedProviders = await prisma.phoneNumberProvider.findMany({
      where: {
        partnerId: partnerId,
        customerId: null, // Partner-level credentials only
        isActive: true
      },
      select: {
        id: true,
        provider: true,
        accountIdentifier: true,
        lastValidated: true,
        createdAt: true
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    // Available providers with their display information
    const availableProviders = [
      {
        id: 'twilio',
        name: 'Twilio',
        displayName: 'Twilio',
        description: 'Import phone numbers from your Twilio account',
        icon: 'twilio',
        category: 'telephony',
        credentialFields: [
          {
            key: 'accountSid',
            label: 'Account SID',
            type: 'text',
            placeholder: 'AC...',
            required: true,
            description: 'Your Twilio Account SID (starts with AC)'
          },
          {
            key: 'authToken',
            label: 'Auth Token',
            type: 'password',
            placeholder: 'Your Auth Token',
            required: true,
            description: 'Your Twilio Auth Token'
          }
        ],
        validationRules: {
          accountSid: {
            pattern: '^AC[a-f0-9]{32}$',
            message: 'Account SID must start with AC and be 34 characters long'
          },
          authToken: {
            minLength: 32,
            message: 'Auth Token must be at least 32 characters long'
          }
        }
      },
      {
        id: 'telnyx',
        name: 'Telnyx',
        displayName: 'Telnyx',
        description: 'Import phone numbers from your Telnyx account',
        icon: 'telnyx',
        category: 'telephony',
        disabled: !process.env.NEXT_PUBLIC_ENABLE_TELNYX_PROVIDER,
        disabledReason: process.env.NEXT_PUBLIC_ENABLE_TELNYX_PROVIDER ? undefined : 'Coming Soon',
        credentialFields: [
          {
            key: 'apiKey',
            label: 'API Key',
            type: 'password',
            placeholder: 'KEY...',
            required: true,
            description: 'Your Telnyx API Key (starts with KEY)'
          }
        ],
        validationRules: {
          apiKey: {
            pattern: '^KEY[a-f0-9]{40}$',
            message: 'API Key must start with KEY and be 43 characters long'
          }
        }
      }
    ];

    // Agent provider phone numbers (provider-locked — can only be used with agents from the same provider account)
    const providerPhoneImportEnabled = isFeatureEnabled('providerPhoneImport.enabled');

    if (providerPhoneImportEnabled) {
      availableProviders.push(
        {
          id: 'retell',
          name: 'Retell',
          displayName: 'Retell',
          description: 'Import phone numbers purchased directly in your Retell account. These numbers are locked to Retell agents from the same account.',
          icon: 'retell',
          category: 'agent_provider',
          disabled: false,
          disabledReason: undefined,
          credentialFields: [
            {
              key: 'apiKey',
              label: 'Retell API Key',
              type: 'password',
              placeholder: 'key_...',
              required: true,
              description: 'Your Retell API Key (found in Retell Dashboard → Settings → API Keys)'
            }
          ],
          validationRules: {
            apiKey: {
              pattern: '^key_',
              message: 'Retell API Key must start with key_'
            }
          }
        } as any,
        {
          id: 'vapi',
          name: 'VAPI',
          displayName: 'VAPI',
          description: 'Import phone numbers from your VAPI account',
          icon: 'vapi',
          category: 'agent_provider',
          disabled: true,
          disabledReason: 'Coming Soon',
          credentialFields: [],
          validationRules: {}
        } as any,
        {
          id: 'elevenlabs',
          name: 'ElevenLabs',
          displayName: 'ElevenLabs',
          description: 'Import phone numbers from your ElevenLabs account',
          icon: 'elevenlabs',
          category: 'agent_provider',
          disabled: true,
          disabledReason: 'Coming Soon',
          credentialFields: [],
          validationRules: {}
        } as any
      );
    }

    // Enhance available providers with saved credential info
    const enhancedProviders = availableProviders.map(provider => {
      const savedCredential = savedProviders.find(saved => saved.provider === provider.id);
      
      return {
        ...provider,
        hasSavedCredentials: !!savedCredential,
        savedCredential: savedCredential ? {
          id: savedCredential.id,
          accountIdentifier: savedCredential.accountIdentifier,
          lastValidated: savedCredential.lastValidated,
          createdAt: savedCredential.createdAt
        } : null
      };
    });

    return NextResponse.json({
      success: true,
      data: {
        providers: enhancedProviders,
        savedProviders: savedProviders.length,
        totalProviders: availableProviders.length
      }
    });

  } catch (error: any) {
    console.error('Error fetching import providers:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'INTERNAL_ERROR',
        message: 'An error occurred while fetching providers'
      },
      { status: 500 }
    );
  }
}
