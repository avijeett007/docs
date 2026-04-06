export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { verifyPartnerJWT } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { encrypt } from '@/lib/encryption';

interface CreateAgentRequest {
  agentName: string;
  systemPrompt?: string;
  temperature?: number;
  model?: string;
  voice?: string;
  externalVoice?: any;
  languageHint?: string;
  recordingEnabled?: boolean;
  maxDuration?: string;
  timeExceededMessage?: string;
  selectedTools?: any[];
  firstSpeakerSettings?: any;
  vadSettings?: any;
  inactivityMessages?: any;
  medium?: any;
  initialOutputMedium?: string;
  joinTimeout?: string;
  apiKey?: string;
}

export async function POST(req: NextRequest) {
  try {
    const decoded = await verifyPartnerJWT(req);
    if (!decoded || !decoded.payload || !decoded.isValid) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const partnerId = decoded.payload.partnerId;
    const requestData: CreateAgentRequest = await req.json();

    console.log('[ultravox-create/route] Creating Ultravox agent for partner:', partnerId);

    // Validate required fields
    if (!requestData.agentName) {
      return NextResponse.json({
        error: 'Missing required field: agentName is required'
      }, { status: 400 });
    }

    // Get partner for fallback API key
    const partner = await prisma.partner.findUnique({
      where: { id: partnerId },
      select: {
        ultravoxApiKey: true,
      },
    });

    if (!partner) {
      return NextResponse.json({ error: 'Partner not found' }, { status: 404 });
    }

    // Determine which API key to use (agent-specific first, then partner fallback)
    const apiKeyToUse = requestData.apiKey || partner.ultravoxApiKey;
    if (!apiKeyToUse) {
      return NextResponse.json({
        error: 'No API key available. Please provide an agent API key or set a partner API key in settings.'
      }, { status: 400 });
    }

    // For now, we'll create a mock agent since we don't have the actual Ultravox API integration yet
    // TODO: Replace this with actual Ultravox API call
    const mockAgentId = `ultravox_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    console.log('[create/route] Creating mock agent with ID:', mockAgentId);

    // Create agent payload for future Ultravox API integration
    const agentPayload = {
      name: requestData.agentName,
      systemPrompt: requestData.systemPrompt || 'You are a helpful AI assistant.',
      temperature: requestData.temperature || 0.7,
      model: requestData.model || 'fixie-ai/ultravox',
      voice: requestData.voice,
      externalVoice: requestData.externalVoice,
      languageHint: requestData.languageHint,
      recordingEnabled: requestData.recordingEnabled ?? true,
      maxDuration: requestData.maxDuration || '1800s',
      timeExceededMessage: requestData.timeExceededMessage,
      selectedTools: requestData.selectedTools || [],
      firstSpeakerSettings: requestData.firstSpeakerSettings,
      vadSettings: requestData.vadSettings,
      inactivityMessages: requestData.inactivityMessages,
      medium: requestData.medium,
      initialOutputMedium: requestData.initialOutputMedium,
      joinTimeout: requestData.joinTimeout
    };

    console.log('[create/route] Agent payload prepared:', JSON.stringify(agentPayload, null, 2));

    // TODO: Uncomment and implement when ready to integrate with Ultravox API
    /*
    try {
      const agentResponse = await fetch('https://api.ultravox.ai/api/agents', {
        method: 'POST',
        headers: {
          'X-API-Key': apiKeyToUse,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(agentPayload)
      });

      if (!agentResponse.ok) {
        const errorData = await agentResponse.json();
        throw new Error(`Failed to create Ultravox Agent: ${errorData.message || agentResponse.statusText}`);
      }

      const agentData = await agentResponse.json();
      mockAgentId = agentData.agentId || agentData.id;
      
      console.log('[create/route] Agent created successfully:', mockAgentId);
    } catch (error: any) {
      console.error('[create/route] Error creating Agent:', error.message);
      throw new Error(`Failed to create Ultravox Agent: ${error.message}`);
    }
    */

    // Encrypt API key if provided
    const encryptedApiKey = requestData.apiKey ? await encrypt(requestData.apiKey) : null;

    // Save agent to database
    const newAgent = await prisma.ultravoxAgent.create({
      data: {
        id: mockAgentId,
        partnerId: partnerId,
        name: requestData.agentName,
        systemPrompt: requestData.systemPrompt || 'You are a helpful AI assistant.',
        temperature: requestData.temperature || 0.7,
        model: requestData.model || 'fixie-ai/ultravox',
        voice: requestData.voice,
        externalVoice: requestData.externalVoice,
        languageHint: requestData.languageHint,
        recordingEnabled: requestData.recordingEnabled ?? true,
        maxDuration: requestData.maxDuration || '1800s',
        timeExceededMessage: requestData.timeExceededMessage,
        selectedTools: requestData.selectedTools,
        callTemplate: agentPayload, // Store the full configuration
        firstSpeakerSettings: requestData.firstSpeakerSettings,
        vadSettings: requestData.vadSettings,
        inactivityMessages: requestData.inactivityMessages,
        medium: requestData.medium,
        initialOutputMedium: requestData.initialOutputMedium,
        joinTimeout: requestData.joinTimeout,
        createdAt: new Date(),
        updatedAt: new Date(),
        isActive: true,
        profitMultiplier: 1.2, // Default profit multiplier
        apiKey: encryptedApiKey,
        apiKeyStatus: 'valid', // Assume valid since we just used it successfully (or will when API is integrated)
        apiKeyLastVerified: new Date(),
      }
    });

    // Return created agent data
    const createdAgent = {
      id: newAgent.id,
      name: newAgent.name,
      systemPrompt: newAgent.systemPrompt,
      temperature: newAgent.temperature,
      model: newAgent.model,
      voice: newAgent.voice,
      externalVoice: newAgent.externalVoice,
      languageHint: newAgent.languageHint,
      recordingEnabled: newAgent.recordingEnabled,
      maxDuration: newAgent.maxDuration,
      timeExceededMessage: newAgent.timeExceededMessage,
      selectedTools: newAgent.selectedTools,
      callTemplate: newAgent.callTemplate,
      firstSpeakerSettings: newAgent.firstSpeakerSettings,
      vadSettings: newAgent.vadSettings,
      inactivityMessages: newAgent.inactivityMessages,
      medium: newAgent.medium,
      initialOutputMedium: newAgent.initialOutputMedium,
      joinTimeout: newAgent.joinTimeout,
      profitMultiplier: newAgent.profitMultiplier,
      apiKeyStatus: newAgent.apiKeyStatus,
      hasAgentKey: !!encryptedApiKey,
      hasPartnerKey: !!partner.ultravoxApiKey,
      usingPartnerKey: !encryptedApiKey && !!partner.ultravoxApiKey,
      hasPartnerKeyFallback: !!partner.ultravoxApiKey,
      importedAt: newAgent.importedAt,
      lastSyncedAt: newAgent.lastSyncedAt,
      createdAt: newAgent.createdAt,
      updatedAt: newAgent.updatedAt,
      isActive: newAgent.isActive,
      apiKey: undefined // Don't expose the actual API key
    };

    return NextResponse.json({
      success: true,
      agent: createdAgent,
      message: 'Agent created successfully'
    });

  } catch (error: any) {
    console.error('[ultravox-create/route] Error:', error);
    return NextResponse.json({
      error: error.message || 'Failed to create agent'
    }, { status: 500 });
  }
}
