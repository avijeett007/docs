import { NextRequest, NextResponse } from 'next/server';
import { verifyPartnerJWT } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { decrypt } from '@/lib/encryption';
import axios from 'axios';

// This route uses dynamic features, so it must be server-rendered
export const dynamic = 'force-dynamic';

export async function GET(
  req: NextRequest,
  { params }: { params: { agentId: string } }
) {
  try {
    // Verify the partner JWT
    const decoded = await verifyPartnerJWT(req);
    if (!decoded || !decoded.payload || !decoded.isValid) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const partnerId = decoded.payload.partnerId;
    const agentId = params.agentId;

    // Get the agent from database with API key
    const agent = await prisma.retellAgent.findUnique({
      where: {
        id: agentId,
        partnerId: partnerId, // Ensure partner owns this agent
      },
      select: {
        id: true,
        name: true,
        voiceId: true,
        language: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
        customerId: true,
        profitMultiplier: true,
        analyticsAgentId: true,
        voiceConfig: true,
        callConfig: true,
        webhookUrl: true,
        apiKey: true,
      },
    });

    if (!agent) {
      return NextResponse.json({
        error: 'Agent not found or not owned by partner'
      }, { status: 404 });
    }

    // Get the partner's Retell API key for fallback
    const partner = await prisma.partner.findUnique({
      where: { id: partnerId },
      select: {
        retellApiKey: true,
      },
    });

    // Determine which API key to use: agent's key first, then partner's key
    let decryptedApiKey: string;

    if (agent.apiKey) {
      // Use agent's individual API key
      decryptedApiKey = await decrypt(agent.apiKey);
      console.log('[details/route] Using agent-specific API key for details fetch');
    } else if (partner?.retellApiKey) {
      // Fallback to partner's API key
      decryptedApiKey = await decrypt(partner.retellApiKey);
      console.log('[details/route] Using partner API key for details fetch (agent has no individual key)');
    } else {
      return NextResponse.json({
        error: 'No API key available',
        message: 'Neither agent-specific nor partner API key found'
      }, { status: 400 });
    }

    // Get current agent configuration from Retell API
    console.log('[details/route] Fetching agent details from Retell API:', agentId);

    let retellAgentData;
    try {
      const agentResponse = await axios.get(
        `https://api.retellai.com/get-agent/${agentId}`,
        {
          headers: {
            'Authorization': `Bearer ${decryptedApiKey}`,
            'Accept': 'application/json',
          },
        }
      );
      retellAgentData = agentResponse.data;
    } catch (error: any) {
      console.error('[details/route] Error fetching agent from Retell:', error.response?.data || error.message);

      if (error.response?.status === 404) {
        return NextResponse.json({
          error: 'Agent not found in Retell API'
        }, { status: 404 });
      }

      throw new Error(`Failed to fetch agent from Retell: ${error.response?.data?.message || error.message}`);
    }

    // Get LLM configuration if available
    let llmData = null;
    if (retellAgentData.response_engine?.llm_id) {
      try {
        console.log('[details/route] Fetching LLM details:', retellAgentData.response_engine.llm_id);
        const llmResponse = await axios.get(
          `https://api.retellai.com/get-retell-llm/${retellAgentData.response_engine.llm_id}`,
          {
            headers: {
              'Authorization': `Bearer ${decryptedApiKey}`,
              'Accept': 'application/json',
            },
          }
        );
        llmData = llmResponse.data;
      } catch (error: any) {
        console.error('[details/route] Error fetching LLM from Retell:', error.response?.data || error.message);
        // Don't fail if LLM fetch fails, just log the error
      }
    }

    // Fetch function calls for the agent if it has a customer
    let functionCalls = [];
    if (agent.customerId) {
      try {
        // Use INTERNAL_API_URL for server-to-server calls to prevent redirect loops
        const baseUrl = process.env.INTERNAL_API_URL || 'http://localhost:3000';
        const functionCallsUrl = `${baseUrl}/api/partner/agents/${agentId}/function-calls`;

        console.log('[details/route] Fetching function calls from:', functionCallsUrl);

        const functionCallsResponse = await fetch(functionCallsUrl, {
          headers: {
            'Authorization': `Bearer ${process.env.INTERNAL_API_KEY || 'internal'}`,
          },
        });

        if (functionCallsResponse.ok) {
          const functionCallsData = await functionCallsResponse.json();
          functionCalls = functionCallsData.data?.functionCalls || [];
          console.log('[details/route] Successfully fetched', functionCalls.length, 'function calls');
        } else {
          console.log('[details/route] Function calls API returned status:', functionCallsResponse.status);
        }
      } catch (error) {
        console.log('[details/route] Could not fetch function calls:', error);
        // Continue without function calls - not critical for agent details
      }
    }

    // Combine data from database and Retell API
    const agentDetails = {
      // Basic Information
      id: agent.id,
      name: retellAgentData.agent_name || agent.name,
      voiceId: retellAgentData.voice_id || agent.voiceId,
      language: retellAgentData.language || agent.language,
      isActive: agent.isActive,
      createdAt: agent.createdAt.toISOString(),
      updatedAt: agent.updatedAt.toISOString(),

      // LLM Configuration
      llm: llmData ? {
        id: llmData.llm_id,
        model: llmData.model,
        temperature: llmData.model_temperature,
        generalPrompt: llmData.general_prompt,
        beginMessage: llmData.begin_message,
        states: llmData.states || [],
        startingState: llmData.starting_state,
        generalTools: llmData.general_tools || [],
        modelHighPriority: llmData.model_high_priority || false,
      } : null,

      // Voice Configuration
      voiceConfig: {
        speed: retellAgentData.voice_speed || (agent.voiceConfig as any)?.speed || 1.0,
        temperature: retellAgentData.voice_temperature || (agent.voiceConfig as any)?.temperature || 1.0,
        model: retellAgentData.voice_model || (agent.voiceConfig as any)?.model || null,
      },

      // Call Configuration
      callConfig: {
        interruptionSensitivity: retellAgentData.interruption_sensitivity || (agent.callConfig as any)?.interruptionSensitivity || 0.7,
        enableBackchannel: retellAgentData.enable_backchannel ?? (agent.callConfig as any)?.enableBackchannel ?? true,
        normalizeForSpeech: retellAgentData.normalize_for_speech ?? (agent.callConfig as any)?.normalizeForSpeech ?? true,
        maxCallDurationMs: retellAgentData.max_call_duration_ms || (agent.callConfig as any)?.maxCallDurationMs || 3600000,
        endCallAfterSilenceMs: retellAgentData.end_call_after_silence_ms || (agent.callConfig as any)?.endCallAfterSilenceMs || 600000,
        responsiveness: retellAgentData.responsiveness || 1.0,
        volume: retellAgentData.volume || 1.0,
        backchannel_frequency: retellAgentData.backchannel_frequency || 0.8,
        backchannel_words: retellAgentData.backchannel_words || [],
        reminder_trigger_ms: retellAgentData.reminder_trigger_ms || 10000,
        reminder_max_count: retellAgentData.reminder_max_count || 1,
        ambient_sound: retellAgentData.ambient_sound || null,
        ambient_sound_volume: retellAgentData.ambient_sound_volume || 1.0,
        boosted_keywords: retellAgentData.boosted_keywords || [],
        enable_transcription_formatting: retellAgentData.enable_transcription_formatting ?? true,
        opt_out_sensitive_data_storage: retellAgentData.opt_out_sensitive_data_storage || false,
        enable_voicemail_detection: retellAgentData.enable_voicemail_detection || false,
        voicemail_message: retellAgentData.voicemail_message || '',
        voicemail_detection_timeout_ms: retellAgentData.voicemail_detection_timeout_ms || 30000,
        begin_message_delay_ms: retellAgentData.begin_message_delay_ms || 0,
        ring_duration_ms: retellAgentData.ring_duration_ms || 30000,
      },

      // Webhook Configuration
      webhookUrl: retellAgentData.webhook_url || agent.webhookUrl || null,

      // Additional metadata
      customerId: agent.customerId,
      profitMultiplier: agent.profitMultiplier,
      analyticsAgentId: agent.analyticsAgentId,

      // Function calls
      functionCalls: functionCalls,

      // Knowledge Base IDs (extracted from Retell LLM configuration)
      knowledgeBaseIds: llmData?.general_tools?.filter((tool: any) => tool.type === 'knowledge_base')?.map((tool: any) => tool.knowledge_base_id) || [],
    };

    console.log('[details/route] Successfully retrieved agent details for:', agentId);

    return NextResponse.json({
      success: true,
      agent: agentDetails,
    });

  } catch (error: any) {
    console.error('[details/route] Error fetching agent details:', error);

    // Handle specific error types
    if (error.message.includes('Invalid API key')) {
      return NextResponse.json({
        error: 'invalid_api_key',
        message: 'Your Retell API key appears to be invalid.',
      }, { status: 401 });
    }

    if (error.message.includes('not found')) {
      return NextResponse.json({
        error: 'agent_not_found',
        message: 'Agent not found or may have been deleted from Retell.',
      }, { status: 404 });
    }

    return NextResponse.json({
      error: 'fetch_failed',
      message: error.message || 'Failed to fetch agent details.',
    }, { status: 500 });
  }
}
