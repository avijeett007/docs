export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { verifyPartnerJWT } from '@/lib/auth';
import { decrypt, encrypt } from '@/lib/encryption';
import { prisma } from '@/lib/prisma';
import { addTrackingToSystemPrompt } from '@/lib/ultravox-tracking';

export async function GET(req: NextRequest) {
  try {
    const decoded = await verifyPartnerJWT(req);
    if (!decoded || !decoded.payload || !decoded.isValid) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const partnerId = decoded.payload.partnerId;

    const partner = await prisma.partner.findUnique({
      where: { id: partnerId },
      select: {
        id: true,
        ultravoxApiKey: true,
        ultravoxAgents: {
          where: {
            isActive: true,
          },
          select: {
            id: true,
            partnerId: true,
            customerId: true,
            name: true,
            systemPrompt: true,
            temperature: true,
            model: true,
            voice: true,
            externalVoice: true,
            languageHint: true,
            recordingEnabled: true,
            maxDuration: true,
            timeExceededMessage: true,
            selectedTools: true,
            callTemplate: true,
            firstSpeakerSettings: true,
            vadSettings: true,
            inactivityMessages: true,
            medium: true,
            initialOutputMedium: true,
            joinTimeout: true,
            importedAt: true,
            lastSyncedAt: true,
            createdAt: true,
            updatedAt: true,
            isActive: true,
            profitMultiplier: true,
            analyticsAgentId: true,
            webhookEnabled: true,
            webhookMode: true,
            webhookUrl: true,
            preExistingWebhookUrl: true,
            forwardToPreExisting: true,
            apiKey: true,
            apiKeyStatus: true,
            apiKeyLastVerified: true,
            apiKeyErrorMessage: true,
            customer: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true
              },
            },
          },
        },
      },
    });

    if (!partner) {
      return NextResponse.json({ error: 'Partner not found' }, { status: 404 });
    }

    const agentsWithStatus = partner.ultravoxAgents.map(agent => {
      const hasAgentKey = !!agent.apiKey;
      const hasPartnerKey = !!partner.ultravoxApiKey;
      
      return {
        id: agent.id,
        name: agent.name,
        systemPrompt: agent.systemPrompt,
        temperature: agent.temperature,
        model: agent.model,
        voice: agent.voice,
        externalVoice: agent.externalVoice,
        languageHint: agent.languageHint,
        recordingEnabled: agent.recordingEnabled,
        maxDuration: agent.maxDuration,
        timeExceededMessage: agent.timeExceededMessage,
        selectedTools: agent.selectedTools,
        callTemplate: agent.callTemplate,
        firstSpeakerSettings: agent.firstSpeakerSettings,
        vadSettings: agent.vadSettings,
        inactivityMessages: agent.inactivityMessages,
        medium: agent.medium,
        initialOutputMedium: agent.initialOutputMedium,
        joinTimeout: agent.joinTimeout,
        customerId: agent.customerId,
        customer: agent.customer,
        profitMultiplier: agent.profitMultiplier,
        analyticsAgentId: agent.analyticsAgentId,
        webhookEnabled: agent.webhookEnabled || false,
        webhookMode: agent.webhookMode || 'manual',
        webhookUrl: agent.webhookUrl,
        preExistingWebhookUrl: agent.preExistingWebhookUrl || null,
        forwardToPreExisting: agent.forwardToPreExisting || true,
        apiKeyStatus: agent.apiKeyStatus || 'not_set',
        apiKeyLastVerified: agent.apiKeyLastVerified,
        apiKeyErrorMessage: agent.apiKeyErrorMessage,
        hasAgentKey: hasAgentKey,
        hasPartnerKey: hasPartnerKey,
        usingPartnerKey: !hasAgentKey && hasPartnerKey,
        hasPartnerKeyFallback: hasPartnerKey,
        importedAt: agent.importedAt,
        lastSyncedAt: agent.lastSyncedAt,
        createdAt: agent.createdAt,
        updatedAt: agent.updatedAt,
        isActive: agent.isActive,
        apiKey: undefined // Don't expose the actual API key
      };
    });

    return NextResponse.json(agentsWithStatus);
  } catch (error) {
    console.error('[ultravox-agents/route] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST - Create a new Ultravox agent
export async function POST(request: NextRequest) {
  try {
    const decoded = await verifyPartnerJWT(request);
    if (!decoded || !decoded.payload || !decoded.isValid) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const partnerId = decoded.payload.partnerId;
    const body = await request.json();

    const {
      agentName,
      systemPrompt,
      temperature = 0.7,
      model = 'fixie-ai/ultravox',
      voice,
      languageHint = 'en-US',
      recordingEnabled = true,
      maxDuration = '1800s',
      timeExceededMessage = 'I apologize, but our conversation time has ended. Thank you for chatting with me!',
      apiKey
    } = body;

    // Validate required fields
    if (!agentName || !systemPrompt) {
      return NextResponse.json(
        { error: 'Agent name and system prompt are required' },
        { status: 400 }
      );
    }

    // Get partner's API key if no agent-specific key provided
    let ultravoxApiKey = apiKey;
    if (!ultravoxApiKey) {
      const partner = await prisma.partner.findUnique({
        where: { id: partnerId },
        select: { ultravoxApiKey: true }
      });

      if (!partner?.ultravoxApiKey) {
        return NextResponse.json(
          { error: 'No Ultravox API key found. Please provide an API key or set one in your partner settings.' },
          { status: 400 }
        );
      }

      ultravoxApiKey = decrypt(partner.ultravoxApiKey);
    }

    // Create agent in Ultravox platform first
    const ultravoxAgentData = {
      name: agentName,
      callTemplate: {
        systemPrompt,
        model,
        voice: voice || null,
        temperature,
        languageHint,
        recordingEnabled,
        maxDuration,
        timeExceededMessage: timeExceededMessage || null,
        medium: {
          webRtc: {} // Default to WebRTC for web calls
        }
      }
    };

    const ultravoxResponse = await fetch('https://api.ultravox.ai/api/agents', {
      method: 'POST',
      headers: {
        'X-API-Key': ultravoxApiKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(ultravoxAgentData)
    });

    if (!ultravoxResponse.ok) {
      const errorText = await ultravoxResponse.text();
      throw new Error(`Failed to create agent in Ultravox: ${ultravoxResponse.status} ${errorText}`);
    }

    const ultravoxAgent = await ultravoxResponse.json();

    // Encrypt API key if provided
    const encryptedApiKey = apiKey ? await encrypt(apiKey) : null;

    // Create agent in our database with the Ultravox agent ID
    const agent = await prisma.ultravoxAgent.create({
      data: {
        id: ultravoxAgent.agentId,
        partnerId,
        name: agentName,
        systemPrompt,
        model,
        voice,
        temperature,
        languageHint,
        recordingEnabled,
        maxDuration,
        timeExceededMessage,
        apiKey: encryptedApiKey, // Store encrypted agent-specific API key if provided
        apiKeyStatus: 'valid', // Assume valid for now, will be verified later
        apiKeyLastVerified: new Date(),
        isActive: true,
        profitMultiplier: 1.2,
        createdAt: new Date(ultravoxAgent.created),
        updatedAt: new Date()
      },
      include: {
        customer: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true
          }
        }
      }
    });

    // Add tracking identifier to system prompt for webhook identification
    await addTrackingToUltravoxAgentAfterCreation(ultravoxAgent.agentId, ultravoxApiKey, agent.id);

    // Transform response to match expected format
    const transformedAgent = {
      id: agent.id,
      name: agent.name,
      model: agent.model,
      systemPrompt: agent.systemPrompt,
      voice: agent.voice,
      temperature: agent.temperature,
      recordingEnabled: agent.recordingEnabled,
      maxDuration: agent.maxDuration,
      timeExceededMessage: agent.timeExceededMessage,
      languageHint: agent.languageHint,
      isActive: agent.isActive,
      createdAt: agent.createdAt,
      updatedAt: agent.updatedAt,
      customer: agent.customer,
      profitMultiplier: agent.profitMultiplier,
      apiKeyStatus: agent.apiKeyStatus,
      apiKeyLastVerified: agent.apiKeyLastVerified,
      usingPartnerKey: !agent.apiKey,
      webhookEnabled: agent.webhookEnabled || false,
      webhookUrl: agent.webhookUrl,
      webhookMode: agent.webhookMode || 'manual',
      analyticsAgentId: agent.analyticsAgentId
    };

    return NextResponse.json({ agent: transformedAgent }, { status: 201 });

  } catch (error) {
    console.error('[ultravox-agents/route] Error creating agent:', error);
    return NextResponse.json(
      { error: 'Failed to create agent' },
      { status: 500 }
    );
  }
}

// Function to add tracking identifier to newly created Ultravox agent
async function addTrackingToUltravoxAgentAfterCreation(ultravoxAgentId: string, apiKey: string, databaseAgentId: string) {
  try {
    // Get current agent details
    const response = await fetch(`https://api.ultravox.ai/api/agents/${ultravoxAgentId}`, {
      headers: {
        'X-API-Key': apiKey,
        'Accept': 'application/json'
      }
    });

    if (!response.ok) {
      console.error(`Failed to fetch newly created Ultravox agent ${ultravoxAgentId} for tracking update:`, response.statusText);
      return false;
    }

    const agentData = await response.json();
    const currentSystemPrompt = agentData.callTemplate?.systemPrompt || 'You are a helpful AI assistant.';

    // Add tracking identifier to system prompt
    const updatedSystemPrompt = addTrackingToSystemPrompt(currentSystemPrompt, databaseAgentId);

    // Update agent with tracking identifier
    const updateResponse = await fetch(`https://api.ultravox.ai/api/agents/${ultravoxAgentId}`, {
      method: 'PATCH',
      headers: {
        'X-API-Key': apiKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        callTemplate: {
          ...agentData.callTemplate,
          systemPrompt: updatedSystemPrompt
        }
      })
    });

    if (!updateResponse.ok) {
      console.error(`Failed to update newly created Ultravox agent ${ultravoxAgentId} with tracking:`, updateResponse.statusText);
      return false;
    }

    console.log(`✅ Successfully added tracking identifier to newly created Ultravox agent ${ultravoxAgentId}`);

    // Update our database record with the new system prompt
    await prisma.ultravoxAgent.update({
      where: { id: ultravoxAgentId },
      data: { systemPrompt: updatedSystemPrompt }
    });

    return true;
  } catch (error) {
    console.error(`Error adding tracking to newly created Ultravox agent ${ultravoxAgentId}:`, error);
    return false;
  }
}
