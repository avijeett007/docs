import { NextRequest, NextResponse } from 'next/server';
import { verifyPartnerJWT } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { decrypt } from '@/lib/encryption';
import axios from 'axios';

export const dynamic = 'force-dynamic';

export async function GET(
  req: NextRequest,
  { params }: { params: { agentId: string } }
) {
  try {
    // Verify the partner JWT token
    const decoded = await verifyPartnerJWT(req);
    if (!decoded || !decoded.payload || !decoded.isValid) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const partnerId = decoded.payload.partnerId;
    const { agentId } = params;

    // Get the agent from database
    const agent = await prisma.retellAgent.findFirst({
      where: {
        id: agentId,
        partnerId: partnerId
      }
    });

    if (!agent) {
      return NextResponse.json(
        { error: 'Agent not found' },
        { status: 404 }
      );
    }

    // Determine which API key to use (agent's own key or partner's key)
    let apiKey = null;
    let hasValidApiKey = false;

    if (agent.apiKey) {
      // Agent has its own API key
      apiKey = await decrypt(agent.apiKey);
      hasValidApiKey = true;
    } else {
      // Use partner's API key as fallback
      const partner = await prisma.partner.findUnique({
        where: { id: partnerId },
        select: { retellApiKey: true }
      });

      if (partner?.retellApiKey) {
        apiKey = await decrypt(partner.retellApiKey);
        hasValidApiKey = true;
      }
    }

    if (!apiKey) {
      return NextResponse.json({
        error: 'No API key available',
        hasValidApiKey: false
      }, { status: 400 });
    }

    console.log('[live-data/route] Fetching live agent data from Retell API:', agentId);

    // Fetch agent data from Retell API
    let retellAgentData;
    try {
      const agentResponse = await axios.get(
        `https://api.retellai.com/get-agent/${agentId}`,
        {
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Accept': 'application/json',
          },
        }
      );
      retellAgentData = agentResponse.data;
    } catch (error: any) {
      console.error('[live-data/route] Error fetching agent from Retell:', error.response?.data || error.message);
      
      if (error.response?.status === 404) {
        return NextResponse.json({
          error: 'Agent not found in Retell API',
          hasValidApiKey
        }, { status: 404 });
      }

      if (error.response?.status === 401) {
        return NextResponse.json({
          error: 'Invalid API key',
          hasValidApiKey: false
        }, { status: 401 });
      }

      throw error;
    }

    // Fetch LLM data if available
    let llmData = null;
    if (retellAgentData.response_engine?.llm_id) {
      try {
        console.log('[live-data/route] Fetching LLM details:', retellAgentData.response_engine.llm_id);
        const llmResponse = await axios.get(
          `https://api.retellai.com/get-retell-llm/${retellAgentData.response_engine.llm_id}`,
          {
            headers: {
              'Authorization': `Bearer ${apiKey}`,
              'Accept': 'application/json',
            },
          }
        );
        llmData = llmResponse.data;
      } catch (error: any) {
        console.error('[live-data/route] Error fetching LLM from Retell:', error.response?.data || error.message);
        // Don't fail if LLM fetch fails, just log the error
      }
    }

    // Extract Retell knowledge base IDs from LLM general tools
    const retellKnowledgeBaseIds = llmData?.general_tools
      ?.filter((tool: any) => tool.type === 'knowledge_base')
      ?.map((tool: any) => tool.knowledge_base_id) || [];

    console.log('[live-data/route] LLM general_tools:', llmData?.general_tools);
    console.log('[live-data/route] Extracted Retell KB IDs:', retellKnowledgeBaseIds);

    // Map Retell KB IDs to our local KB IDs if agent has a customer
    let knowledgeBaseIds: string[] = [];
    if (agent.customerId && retellKnowledgeBaseIds.length > 0) {
      try {
        // Find mappings between Retell KB IDs and our KB IDs
        const mappings = await prisma.knowledgeBaseProviderMapping.findMany({
          where: {
            partnerId: partnerId,
            customerId: agent.customerId,
            provider: 'retell',
            providerKnowledgeBaseId: {
              in: retellKnowledgeBaseIds
            }
          },
          select: {
            knowledgeBaseId: true,
            providerKnowledgeBaseId: true
          }
        });

        knowledgeBaseIds = mappings.map(mapping => mapping.knowledgeBaseId);
        console.log('[live-data/route] Mapped Retell KB IDs to local KB IDs:', {
          retellKbIds: retellKnowledgeBaseIds,
          localKbIds: knowledgeBaseIds,
          mappingsFound: mappings.length,
          mappings: mappings
        });
      } catch (error) {
        console.error('[live-data/route] Error mapping knowledge base IDs:', error);
        // Continue without knowledge base mapping
      }
    }

    // Extract function calls from LLM general tools
    // Function calls can have various types: 'function_call', 'end_call', 'transfer_call', etc.
    // We exclude 'knowledge_base' type as those are handled separately
    const functionCalls = llmData?.general_tools
      ?.filter((tool: any) => tool.type !== 'knowledge_base')
      ?.map((tool: any) => {
        // Determine if this is a custom function call or built-in Retell tool
        const isCustomFunctionCall = tool.type === 'function_call' ||
                                   tool.type === 'custom' ||
                                   (tool.url && tool.headers); // Has URL and headers = custom function call

        const isBuiltInRetellTool = ['end_call', 'transfer_call', 'press_digit', 'sms', 'webhook'].includes(tool.type);

        let appName, toolName;
        if (isCustomFunctionCall) {
          // Try to extract app name and tool name from webhook URL
          if (tool.url) {
            console.log('[live-data] Parsing webhook URL:', tool.url);
            const urlMatch = tool.url.match(/\/api\/dynamic\/[^\/]+\/[^\/]+\/([^\/]+)\/([^\/\?]+)/);
            if (urlMatch) {
              appName = urlMatch[1]; // Extract app name from URL
              toolName = urlMatch[2]; // Extract tool name from URL
              console.log('[live-data] Extracted from URL:', { appName, toolName });
            } else {
              appName = 'custom';
              toolName = tool.name || tool.type;
              console.log('[live-data] URL match failed, using fallback:', { appName, toolName });
            }
          } else {
            appName = 'custom';
            toolName = tool.name || tool.type;
            console.log('[live-data] No URL found, using fallback:', { appName, toolName });
          }
        } else if (isBuiltInRetellTool) {
          appName = 'retell';
          toolName = tool.type;
        } else {
          // This might be a custom function call that came back with a different type
          // Check if it has custom function call properties
          if (tool.url || tool.method || tool.headers) {
            // Try to extract from URL first
            if (tool.url) {
              const urlMatch = tool.url.match(/\/api\/dynamic\/[^\/]+\/[^\/]+\/([^\/]+)\/([^\/\?]+)/);
              if (urlMatch) {
                appName = urlMatch[1];
                toolName = urlMatch[2];
              } else {
                appName = 'custom';
                toolName = tool.name || tool.type;
              }
            } else {
              appName = 'custom';
              toolName = tool.name || tool.type;
            }
          } else {
            // Treat as built-in tool
            appName = 'retell';
            toolName = tool.type;
          }
        }

        return {
          id: tool.name || tool.type,
          appName,
          toolName,
          customName: tool.name || tool.type,
          customDescription: tool.description || `${tool.type} tool`,
          isConfigured: true,
          toolType: tool.type, // Keep track of the original tool type
          originalTool: tool // Keep the original tool data for reference
        };
      }) || [];

    console.log('[live-data/route] Extracted function calls:', {
      totalTools: llmData?.general_tools?.length || 0,
      functionCallsFound: functionCalls.length,
      functionCalls: functionCalls
    });

    // Combine all the live data
    const liveData = {
      // Agent data from Retell
      agent_id: retellAgentData.agent_id,
      agent_name: retellAgentData.agent_name,
      voice_id: retellAgentData.voice_id,
      voice_model: retellAgentData.voice_model,
      voice_speed: retellAgentData.voice_speed,
      voice_temperature: retellAgentData.voice_temperature,
      language: retellAgentData.language,
      interruption_sensitivity: retellAgentData.interruption_sensitivity,
      enable_backchannel: retellAgentData.enable_backchannel,
      normalize_for_speech: retellAgentData.normalize_for_speech,
      max_call_duration_ms: retellAgentData.max_call_duration_ms,
      end_call_after_silence_ms: retellAgentData.end_call_after_silence_ms,
      webhook_url: retellAgentData.webhook_url,
      boosted_keywords: retellAgentData.boosted_keywords,

      // LLM data from Retell
      llm: llmData ? {
        llm_id: llmData.llm_id,
        model: llmData.model,
        model_temperature: llmData.model_temperature,
        model_high_priority: llmData.model_high_priority,
        general_prompt: llmData.general_prompt,
        begin_message: llmData.begin_message,
        states: llmData.states,
        starting_state: llmData.starting_state,
        general_tools: llmData.general_tools
      } : null,

      // Extracted data
      knowledgeBaseIds,
      functionCalls,
      hasValidApiKey
    };

    console.log('[live-data/route] Successfully retrieved live agent data for:', agentId);

    return NextResponse.json({
      success: true,
      ...liveData
    });

  } catch (error: any) {
    console.error('[live-data/route] Error fetching live agent data:', error);

    return NextResponse.json({
      error: 'Failed to fetch live agent data',
      details: error.message || 'Unknown error',
      hasValidApiKey: false
    }, { status: 500 });
  }
}
