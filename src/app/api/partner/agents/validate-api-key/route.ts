import { NextRequest, NextResponse } from 'next/server';
import { verifyPartnerJWT } from '@/lib/auth';

export const dynamic = 'force-dynamic';

interface ValidateApiKeyRequest {
  apiKey: string;
  provider: 'vapi' | 'retell' | 'elevenlabs' | 'ultravox';
  testEndpoint?: string;
  agentId?: string;
}

// Validate API key by making a test call to the provider
export async function POST(request: NextRequest) {
  try {
    // Verify JWT and get partner
    const auth = await verifyPartnerJWT(request);
    if (!auth.isValid) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Parse request body
    const body = await request.json();
    const { apiKey, provider, agentId }: ValidateApiKeyRequest = body;

    if (!apiKey || !provider) {
      return NextResponse.json(
        { error: 'API key and provider are required' },
        { status: 400 }
      );
    }

    let isValid = false;
    let errorMessage = '';
    let details: any = {};

    try {
      if (provider === 'vapi') {
        // Test VAPI API key by listing assistants
        const response = await fetch('https://api.vapi.ai/assistant', {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${apiKey.trim()}`,
            'Accept': 'application/json'
          }
        });

        if (response.ok) {
          const data = await response.json();
          isValid = true;
          details = {
            assistantCount: Array.isArray(data) ? data.length : 0,
            responseStatus: response.status
          };
        } else {
          const errorData = await response.json().catch(() => ({}));
          errorMessage = errorData.message || `VAPI API returned ${response.status}: ${response.statusText}`;
          details = {
            responseStatus: response.status,
            responseText: response.statusText
          };
        }
      } else if (provider === 'retell') {
        // Test Retell API key by listing agents
        const response = await fetch('https://api.retellai.com/list-agents', {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${apiKey.trim()}`,
            'Accept': 'application/json'
          }
        });

        if (response.ok) {
          const data = await response.json();
          isValid = true;
          details = {
            agentCount: Array.isArray(data) ? data.length : 0,
            responseStatus: response.status
          };
        } else {
          const errorData = await response.json().catch(() => ({}));
          errorMessage = errorData.message || `Retell API returned ${response.status}: ${response.statusText}`;
          details = {
            responseStatus: response.status,
            responseText: response.statusText
          };
        }
      } else if (provider === 'elevenlabs') {
        // Test ElevenLabs API key - use agent-specific endpoint if agentId provided
        let testUrl = 'https://api.elevenlabs.io/v1/user'; // fallback

        if (agentId) {
          // First get the ElevenLabs agent ID from our database
          const { prisma } = await import('@/lib/prisma');

          try {
            const agent = await prisma.elevenLabsAgent.findUnique({
              where: { id: agentId },
              select: { id: true }
            });

            if (agent?.id) {
              testUrl = `https://api.elevenlabs.io/v1/convai/agents/${agent.id}`;
            }
          } catch (dbError) {
            console.error('Error fetching agent from database:', dbError);
            // Continue with fallback URL
          }
        }

        const response = await fetch(testUrl, {
          method: 'GET',
          headers: {
            'xi-api-key': apiKey.trim(),
            'Accept': 'application/json'
          }
        });

        if (response.ok) {
          const data = await response.json();
          isValid = true;
          details = {
            testEndpoint: testUrl,
            agentValidated: testUrl.includes('/agents/'),
            responseStatus: response.status
          };
        } else {
          const errorData = await response.json().catch(() => ({}));
          errorMessage = errorData.detail || `ElevenLabs API returned ${response.status}: ${response.statusText}`;
          details = {
            testEndpoint: testUrl,
            responseStatus: response.status,
            responseText: response.statusText
          };
        }
      } else if (provider === 'ultravox') {
        // Test Ultravox API key by listing agents
        const response = await fetch('https://api.ultravox.ai/api/agents', {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${apiKey.trim()}`,
            'Accept': 'application/json'
          }
        });

        if (response.ok) {
          const data = await response.json();
          isValid = true;
          details = {
            agentCount: Array.isArray(data.results) ? data.results.length : 0,
            responseStatus: response.status
          };
        } else {
          const errorData = await response.json().catch(() => ({}));
          errorMessage = errorData.message || `Ultravox API returned ${response.status}: ${response.statusText}`;
          details = {
            responseStatus: response.status,
            responseText: response.statusText
          };
        }
      } else {
        return NextResponse.json(
          { error: 'Unsupported provider' },
          { status: 400 }
        );
      }
    } catch (error) {
      console.error(`Error validating ${provider} API key:`, error);
      errorMessage = `Failed to connect to ${provider.toUpperCase()} API. Please check your internet connection and try again.`;
      details = {
        networkError: true,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }

    return NextResponse.json({
      valid: isValid,
      provider,
      error: errorMessage || null,
      details,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error in API key validation:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
