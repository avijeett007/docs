import { NextRequest, NextResponse } from 'next/server';
import { verifyPartnerToken } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { decrypt } from '@/lib/encryption';



export async function POST(
  request: NextRequest,
  { params }: { params: { agentId: string } }
) {
  try {
    console.log('[elevenlabs-test/route] Starting test configuration for agent:', params.agentId);

    // Debug: Log request headers
    const authHeader = request.headers.get('Authorization');
    console.log('[elevenlabs-test/route] Authorization header present:', !!authHeader);
    console.log('[elevenlabs-test/route] Authorization header value:', authHeader ? authHeader.substring(0, 20) + '...' : 'none');

    // Verify partner authentication
    const authResult = await verifyPartnerToken(request);
    console.log('[elevenlabs-test/route] Auth result:', {
      success: authResult.success,
      hasPartner: !!authResult.partner,
      hasError: !!authResult.error
    });

    if (!authResult.success || !authResult.partner) {
      console.log('[elevenlabs-test/route] Authentication failed - returning 401');
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const partnerId = authResult.partner.id;
    console.log('[elevenlabs-test/route] Authenticated partner:', partnerId);

    // Get the ElevenLabs agent from database
    const agent = await prisma.elevenLabsAgent.findFirst({
      where: {
        id: params.agentId,
        partnerId: partnerId
      }
    });

    if (!agent) {
      console.log('[elevenlabs-test/route] Agent not found:', params.agentId);
      return NextResponse.json(
        { error: 'Agent not found' },
        { status: 404 }
      );
    }

    console.log('[elevenlabs-test/route] Found agent:', agent.name);

    // Check if agent has API key
    if (!agent.apiKey) {
      console.log('[elevenlabs-test/route] Agent has no API key');
      return NextResponse.json(
        {
          error: 'No API key configured',
          message: 'This agent needs an API key to be tested. Please configure the API key first.'
        },
        { status: 400 }
      );
    }

    // Decrypt the API key
    let decryptedApiKey: string;
    try {
      decryptedApiKey = await decrypt(agent.apiKey);
      console.log('[elevenlabs-test/route] Successfully decrypted API key');
    } catch (error) {
      console.error('[elevenlabs-test/route] Error decrypting API key:', error);
      return NextResponse.json(
        {
          error: 'API key configuration error',
          message: 'Failed to decrypt API key. Please reconfigure the API key.'
        },
        { status: 500 }
      );
    }

    // Get signed URL from ElevenLabs API
    try {
      console.log('[elevenlabs-test/route] Requesting signed URL from ElevenLabs API');

      const elevenLabsResponse = await fetch(
        `https://api.elevenlabs.io/v1/convai/conversation/get-signed-url?agent_id=${agent.id}`,
        {
          method: 'GET',
          headers: {
            'xi-api-key': decryptedApiKey,
            'Content-Type': 'application/json'
          }
        }
      );

      if (!elevenLabsResponse.ok) {
        const errorText = await elevenLabsResponse.text();
        console.error('[elevenlabs-test/route] ElevenLabs API error:', elevenLabsResponse.status, errorText);
        
        if (elevenLabsResponse.status === 401) {
          return NextResponse.json(
            { 
              error: 'Invalid API key',
              message: 'The API key for this agent is invalid or expired. Please update the API key.'
            },
            { status: 400 }
          );
        }
        
        if (elevenLabsResponse.status === 404) {
          return NextResponse.json(
            { 
              error: 'Agent not found',
              message: 'This agent was not found in ElevenLabs. It may have been deleted.'
            },
            { status: 400 }
          );
        }

        throw new Error(`ElevenLabs API error: ${elevenLabsResponse.status} ${errorText}`);
      }

      const elevenLabsData = await elevenLabsResponse.json();
      console.log('[elevenlabs-test/route] Successfully got signed URL from ElevenLabs');

      // Return the test configuration
      return NextResponse.json({
        success: true,
        signedUrl: elevenLabsData.signed_url,
        agentId: agent.id,
        agentName: agent.name,
        testInstructions: {
          message: 'Use the ElevenLabs React SDK to test this agent directly in your browser.',
          steps: [
            'Click the "Start Test Call" button to begin',
            'Allow microphone access when prompted by your browser',
            'Speak naturally to test the agent\'s responses',
            'Use the mute button to control your microphone',
            'Click "End Call" when you\'re finished testing'
          ],
          keyInfo: 'Using agent-specific API key for testing.'
        }
      });

    } catch (elevenLabsError: any) {
      console.error('[elevenlabs-test/route] Error calling ElevenLabs API:', elevenLabsError);
      return NextResponse.json(
        { 
          error: 'ElevenLabs API error',
          message: 'Failed to get test configuration from ElevenLabs. Please try again.'
        },
        { status: 500 }
      );
    }

  } catch (error: any) {
    console.error('[elevenlabs-test/route] Unexpected error:', error);
    return NextResponse.json(
      { 
        error: 'Internal server error',
        message: 'An unexpected error occurred while setting up the test.'
      },
      { status: 500 }
    );
  }
}

// GET method for retrieving test configuration (if needed)
export async function GET(
  request: NextRequest,
  { params }: { params: { agentId: string } }
) {
  try {
    console.log('[elevenlabs-test/route] Getting test info for agent:', params.agentId);

    // Verify partner authentication
    const authResult = await verifyPartnerToken(request);
    if (!authResult.success || !authResult.partner) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const partnerId = authResult.partner.id;

    // Get the ElevenLabs agent from database
    const agent = await prisma.elevenLabsAgent.findFirst({
      where: {
        id: params.agentId,
        partnerId: partnerId
      }
    });

    if (!agent) {
      return NextResponse.json(
        { error: 'Agent not found' },
        { status: 404 }
      );
    }

    // Return basic test information
    return NextResponse.json({
      success: true,
      agentId: agent.id,
      agentName: agent.name,
      hasApiKey: !!agent.apiKey,
      canTest: !!agent.apiKey,
      testInstructions: {
        message: 'This agent can be tested using the ElevenLabs React SDK.',
        requirements: [
          'Agent must have a valid API key configured',
          'Browser must support microphone access',
          'Stable internet connection required'
        ]
      }
    });

  } catch (error: any) {
    console.error('[elevenlabs-test/route] Error getting test info:', error);
    return NextResponse.json(
      { 
        error: 'Internal server error',
        message: 'Failed to get test information.'
      },
      { status: 500 }
    );
  }
}
