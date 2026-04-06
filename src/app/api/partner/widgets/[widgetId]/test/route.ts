import { NextRequest, NextResponse } from 'next/server';
import { verifyPartnerJWT } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { decrypt } from '@/lib/encryption';
import axios from 'axios';

export const dynamic = 'force-dynamic';

export async function POST(
  req: NextRequest,
  { params }: { params: { widgetId: string } }
) {
  try {
    // Verify the partner JWT
    const decoded = await verifyPartnerJWT(req);
    if (!decoded || !decoded.payload || !decoded.isValid) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const partnerId = decoded.payload.partnerId;
    const widgetId = params.widgetId;

    console.log('[widget-test/route] Preparing test for widget:', widgetId);

    // Get the widget from database
    const widget = await prisma.agentWidget.findUnique({
      where: {
        id: widgetId,
        partnerId: partnerId, // Ensure partner owns this widget
      },
      include: {
        partner: {
          select: {
            id: true,
            businessName: true,
            vapiApiKey: true,
            vapiPublicKey: true,
            retellApiKey: true,
            ultravoxApiKey: true,
          }
        }
      }
    });

    if (!widget) {
      return NextResponse.json({
        error: 'Widget not found or not owned by partner'
      }, { status: 404 });
    }

    // Get the agent details based on agent type
    let agentData: any = null;
    let providerConfig: any = {};

    try {
      switch (widget.agentType) {
        case 'vapi':
          agentData = await getVapiAgentData(widget.agentId, partnerId);
          providerConfig = await getVapiProviderConfig(agentData, widget.partner);
          break;
        case 'retell':
          agentData = await getRetellAgentData(widget.agentId, partnerId);
          providerConfig = await getRetellProviderConfig(agentData, widget.partner, widget.agentId);
          break;
        case 'ultravox':
          agentData = await getUltravoxAgentData(widget.agentId, partnerId);
          providerConfig = await getUltravoxProviderConfig(agentData, widget.partner);
          break;
        case 'elevenlabs':
          agentData = await getElevenLabsAgentData(widget.agentId, partnerId);
          providerConfig = await getElevenLabsProviderConfig(agentData, widget.partner);
          break;
        case 'knova':
          agentData = await getKnovaAgentData(widget.agentId, partnerId);
          providerConfig = await getKnovaProviderConfig(agentData, widget.partner);
          break;
        default:
          throw new Error(`Unsupported agent type: ${widget.agentType}`);
      }
    } catch (error: any) {
      console.error('[widget-test/route] Error getting agent data:', error);
      return NextResponse.json({
        error: 'Agent configuration error',
        message: error.message || 'Failed to get agent configuration'
      }, { status: 400 });
    }

    // Build widget configuration for testing
    const widgetConfig = {
      widgetType: widget.widgetType,
      agentType: widget.agentType,
      agentId: widget.agentId,
      providerConfig,
      customization: {
        appearance: {
          primaryColor: widget.primaryColor,
          secondaryColor: widget.secondaryColor,
          backgroundColor: widget.backgroundColor,
          textColor: widget.textColor,
          borderRadius: widget.borderRadius
        },
        behavior: {
          position: widget.position,
          size: widget.size,
          autoStart: widget.autoStart,
          showBranding: widget.showBranding,
          showTranscript: widget.showTranscript
        },
        messages: {
          welcomeMessage: widget.welcomeMessage,
          buttonText: widget.buttonText,
          endCallText: widget.endCallText
        }
      },
      security: {
        widgetToken: widget.widgetToken,
        allowedDomains: ['localhost:3000', 'localhost:3001', '127.0.0.1:3000'] // Allow local testing
      }
    };

    console.log('[widget-test/route] Widget test configuration prepared for:', widgetId);

    return NextResponse.json({
      success: true,
      config: widgetConfig,
      agentName: agentData?.name || 'Unknown Agent',
      testInstructions: {
        message: `Test your ${widget.widgetType} widget with ${widget.agentType} agent integration.`,
        steps: [
          'Click the widget to start testing',
          'Speak to test the agent\'s responses',
          'Verify the widget appearance and behavior',
          'Test different interaction patterns'
        ]
      }
    });

  } catch (error: any) {
    console.error('[widget-test/route] Error preparing widget test:', error);

    return NextResponse.json({
      error: 'Failed to prepare widget test',
      message: error.message || 'An unexpected error occurred'
    }, { status: 500 });
  }
}

// Helper functions to get agent data
async function getVapiAgentData(agentId: string, partnerId: string) {
  const agent = await prisma.vapiAgent.findUnique({
    where: { id: agentId, partnerId },
    select: { id: true, name: true, apiKey: true, publicKey: true }
  });
  
  if (!agent) {
    throw new Error('VAPI agent not found');
  }
  
  return agent;
}

async function getRetellAgentData(agentId: string, partnerId: string) {
  const agent = await prisma.retellAgent.findUnique({
    where: { id: agentId, partnerId },
    select: { id: true, name: true, apiKey: true }
  });
  
  if (!agent) {
    throw new Error('Retell agent not found');
  }
  
  return agent;
}

async function getUltravoxAgentData(agentId: string, partnerId: string) {
  const agent = await prisma.ultravoxAgent.findUnique({
    where: { id: agentId, partnerId },
    select: { id: true, name: true, apiKey: true }
  });
  
  if (!agent) {
    throw new Error('Ultravox agent not found');
  }
  
  return agent;
}

async function getKnovaAgentData(agentId: string, partnerId: string) {
  const agent = await prisma.knovaAgent.findUnique({
    where: { id: agentId, partnerId },
    select: { id: true, name: true, voiceConfig: true }
  });

  if (!agent) {
    throw new Error('Knova agent not found');
  }

  return agent;
}

// Helper functions to get provider configurations
async function getVapiProviderConfig(agentData: any, partner: any) {
  // Use agent-specific public key or partner-level public key
  const publicKey = agentData.publicKey || partner.vapiPublicKey;

  if (!publicKey) {
    throw new Error('VAPI public key is required for testing. Please configure a public key.');
  }

  return {
    publicKey,
    agentId: agentData.id  // Use agentId to match ProviderConfig interface
  };
}

async function getRetellProviderConfig(agentData: any, partner: any, agentId: string) {
  // Get API key for creating test call
  const apiKey = agentData.apiKey ? await decrypt(agentData.apiKey) : 
                 partner.retellApiKey ? await decrypt(partner.retellApiKey) : null;
  
  if (!apiKey) {
    throw new Error('Retell API key is required for testing');
  }

  // Create a test call for the widget
  try {
    const webCallResponse = await axios.post(
      'https://api.retellai.com/v2/create-web-call',
      {
        agent_id: agentId,
        metadata: {
          test_call: true,
          widget_test: true,
          created_at: new Date().toISOString(),
        }
      },
      {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
      }
    );

    return {
      accessToken: webCallResponse.data.access_token,
      callId: webCallResponse.data.call_id
    };
  } catch (error: any) {
    console.error('Error creating Retell test call:', error.response?.data || error.message);
    throw new Error('Failed to create Retell test call. Please check your API key and agent configuration.');
  }
}

async function getUltravoxProviderConfig(agentData: any, partner: any) {
  const apiKey = agentData.apiKey ? await decrypt(agentData.apiKey) :
                 partner.ultravoxApiKey ? await decrypt(partner.ultravoxApiKey) : null;

  if (!apiKey) {
    throw new Error('Ultravox API key is required for testing');
  }

  return {
    apiKey,
    agentId: agentData.id
  };
}

async function getKnovaProviderConfig(agentData: any, partner: any) {
  // For Knova/LiveKit, we use the voice configuration from the agent
  // This typically includes LiveKit server configuration
  const voiceConfig = agentData.voiceConfig || {};

  return {
    wsUrl: voiceConfig.livekitUrl || process.env.LIVEKIT_WS_URL || 'wss://your-livekit-server.com',
    accessToken: 'temp-access-token', // This should be generated dynamically based on LiveKit JWT
    agentId: agentData.id,
    voiceConfig: voiceConfig
  };
}

async function getElevenLabsAgentData(agentId: string, partnerId: string) {
  const agent = await prisma.elevenLabsAgent.findUnique({
    where: { id: agentId, partnerId },
    select: { id: true, name: true, conversationConfig: true }
  });

  if (!agent) {
    throw new Error('ElevenLabs agent not found');
  }

  return agent;
}

async function getElevenLabsProviderConfig(agentData: any, partner: any) {
  // ElevenLabs uses the existing test endpoint pattern
  try {
    const token = partner.elevenLabsApiKey ? await decrypt(partner.elevenLabsApiKey) : null;

    if (!token) {
      throw new Error('ElevenLabs API key is required for testing');
    }

    // Call the existing ElevenLabs test endpoint to get signed URL
    // Use INTERNAL_API_URL for server-to-server calls to prevent redirect loops
    const internalApiUrl = process.env.INTERNAL_API_URL || 'http://localhost:3000';
    const response = await axios.post(`${internalApiUrl}/api/partner/elevenlabs-agents/${agentData.id}/test`, {}, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      }
    });

    if (!response.data.success) {
      throw new Error(response.data.message || 'Failed to get ElevenLabs test configuration');
    }

    return {
      signedUrl: response.data.signedUrl,
      agentId: agentData.id
    };
  } catch (error: any) {
    console.error('Error getting ElevenLabs test configuration:', error.response?.data || error.message);
    throw new Error('Failed to get ElevenLabs test configuration. Please check your API key and agent configuration.');
  }
}
