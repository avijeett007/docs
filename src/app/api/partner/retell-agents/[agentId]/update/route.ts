import { NextRequest, NextResponse } from 'next/server';
import { verifyPartnerJWT } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { decrypt } from '@/lib/encryption';
import axios from 'axios';

// Transform function calls to Retell tools with proper security and schema handling
async function transformFunctionCallsToRetellTools(functionCalls: any[], partnerId: string, customerId: string): Promise<any[]> {
  const tools: any[] = [];

  // Check if end_call is already in the function calls
  const hasEndCall = functionCalls.some(fc => fc.toolName === 'end_call' || fc.appName === 'retell');

  // Only add end_call tool if it's not already included
  if (!hasEndCall) {
    tools.push({
      type: "end_call",
      name: "end_call",
      description: "End the call with user."
    });
  }

  const connectHubUrl = process.env.CONNECT_HUB_URL || 'http://localhost:3001';

  // Transform configured function calls
  for (const fc of functionCalls) {
    if (fc.appName === 'retell') {
      // Built-in Retell tool
      const tool: any = {
        type: fc.toolName,
        name: fc.customName,
        description: fc.customDescription
      };

      // Add tool-specific configuration from parameterValues
      if (fc.toolName === 'transfer_call' && fc.parameterValues) {
        tool.transfer_destination = fc.parameterValues.transfer_destination;
        tool.transfer_option = fc.parameterValues.transfer_option;
      }

      tools.push(tool);
    } else {
      // Custom Composio tool - generate proper security token and schema
      try {
        // Generate security token for this specific function call
        const tokenResponse = await fetch(`${connectHubUrl}/api/tokens/generate`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${process.env.CONNECT_HUB_API_KEY || ''}`
          },
          body: JSON.stringify({
            partnerId,
            customerId,
            appName: fc.appName,
            toolName: fc.toolName,
            options: {
              expiresIn: 31536000, // 1 year in seconds
              usageLimit: 1000     // Higher limit for agent function calls
            }
          })
        });

        if (!tokenResponse.ok) {
          console.error(`Failed to generate security token for ${fc.appName}/${fc.toolName}`);
          continue; // Skip this function call if token generation fails
        }

        const tokenData = await tokenResponse.json();
        const securityToken = tokenData.token;

        // Get tool schema from Connect Hub
        const schemaResponse = await fetch(`${connectHubUrl}/schemas/${customerId}/${fc.appName}/${fc.toolName}`, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${process.env.CONNECT_HUB_API_KEY || ''}`
          }
        });

        let toolSchema = null;
        if (schemaResponse.ok) {
          const schemaData = await schemaResponse.json();
          toolSchema = schemaData.data;
        }

        // Generate webhook URL for this specific function call
        const webhookUrl = `${connectHubUrl}/api/dynamic/${partnerId}/${customerId}/${fc.appName}/${fc.toolName}`;

        // Use frontend-generated parameters if available, otherwise transform from tool schema
        const parameters = fc.parameters || transformSchemaToRetellFormat(toolSchema?.inputSchema || {});



        // Ensure base description doesn't exceed limit before adding defaults
        const baseDescription = fc.customDescription || '';
        const maxDescriptionLength = 1024;

        const tool: any = {
          type: 'custom',
          name: fc.customName,
          description: baseDescription,
          url: webhookUrl,
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            // Use customer-specific token in Authorization header (secure)
            'Authorization': `Bearer ${securityToken}`
          },
          parameters: parameters,
          speak_during_execution: fc.speakDuringExecution ?? true,
          speak_after_execution: fc.speakAfterExecution ?? true,
          execution_message_description: fc.executionMessageDescription ||
            getExecutionMessage(fc.toolName, fc.customDescription),
          timeout_ms: fc.timeoutMs || 30000
        };

        // Add pre-filled parameter values to the function description (Retell doesn't support defaults in schema)
        console.log('🔍 Backend Update - Function call data:', {
          customName: fc.customName,
          parameterValues: fc.parameterValues,
          hasParameterValues: !!fc.parameterValues,
          parameterValuesKeys: fc.parameterValues ? Object.keys(fc.parameterValues) : [],
          toolParametersProperties: tool.parameters.properties ? Object.keys(tool.parameters.properties) : []
        });

        if (fc.parameterValues && Object.keys(fc.parameterValues).length > 0) {
          const defaultValues: string[] = [];
          Object.entries(fc.parameterValues).forEach(([key, value]) => {
            if (value !== undefined && value !== '') {
              defaultValues.push(`${key}: "${value}"`);
              console.log(`🔍 Backend Update - Will include default value for ${key}:`, value);
            }
          });

          if (defaultValues.length > 0) {
            const defaultsText = `\n\nDefault values to use: ${defaultValues.join(', ')}`;
            let fullDescription = tool.description + defaultsText;

            // Truncate description to meet Retell's 1024 character limit
            const maxDescriptionLength = 1024;
            if (fullDescription.length > maxDescriptionLength) {
              fullDescription = fullDescription.substring(0, maxDescriptionLength - 3) + '...';
              console.log('🔍 Backend Update - Description truncated due to length limit');
            }

            tool.description = fullDescription;
            console.log('🔍 Backend Update - Updated description with defaults:', tool.description);
          }
        } else {
          console.log('🔍 Backend Update - No parameterValues to include in description');
        }

        tools.push(tool);

        // Store function call configuration in Connect Hub for tracking
        await fetch(`${connectHubUrl}/api/function-calls`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${process.env.CONNECT_HUB_API_KEY || ''}`
          },
          body: JSON.stringify({
            partnerId,
            customerId,
            appName: fc.appName,
            toolName: fc.toolName,
            customName: fc.customName,
            customDescription: fc.customDescription,
            securityToken,
            webhookUrl
          })
        });

      } catch (error) {
        console.error(`Error configuring function call ${fc.appName}/${fc.toolName}:`, error);
        // Continue with other function calls even if one fails
      }
    }
  }

  return tools;
}

/**
 * Transform Composio tool schema to Retell-compatible format
 */
function transformSchemaToRetellFormat(inputSchema: any): {
  type: "object";
  properties: Record<string, any>;
  required: string[];
} {
  if (!inputSchema || !inputSchema.properties) {
    return {
      type: "object",
      properties: {},
      required: []
    };
  }

  const properties: Record<string, any> = {};
  const required: string[] = [];

  Object.entries(inputSchema.properties).forEach(([key, value]: [string, any]) => {
    properties[key] = {
      type: value.type || "string",
      description: value.description || `${key} parameter`
    };

    // Handle enum values
    if (value.enum) {
      properties[key].enum = value.enum;
    }

    // Handle array items
    if (value.type === "array" && value.items) {
      properties[key].items = {
        type: value.items.type || "string"
      };
    }
  });

  // Add required fields
  if (inputSchema.required && Array.isArray(inputSchema.required)) {
    required.push(...inputSchema.required);
  }

  return {
    type: "object",
    properties,
    required
  };
}

/**
 * Generate execution message for function calls
 */
function getExecutionMessage(toolName: string, description: string): string {
  const toolMessages: Record<string, string> = {
    'send_email': 'Let me send that email for you.',
    'create_event': 'Let me create that calendar event.',
    'search_contacts': 'Let me search for those contacts.',
    'create_task': 'Let me create that task for you.',
    'update_record': 'Let me update that record.',
    'get_weather': 'Let me check the weather for you.',
    'book_meeting': 'Let me schedule that meeting.',
    'send_message': 'Let me send that message.',
    'create_document': 'Let me create that document.',
    'search_files': 'Let me search for those files.'
  };

  // Try to find a specific message for this tool
  const specificMessage = toolMessages[toolName.toLowerCase()];
  if (specificMessage) {
    return specificMessage;
  }

  // Generate a generic message based on the tool name
  const cleanToolName = toolName.replace(/_/g, ' ').toLowerCase();
  return `Let me ${cleanToolName} for you.`;
}

// This route uses dynamic features, so it must be server-rendered
export const dynamic = 'force-dynamic';

interface UpdateAgentRequest {
  agentName?: string;
  generalPrompt?: string;
  voiceId?: string;
  language?: string;
  beginMessage?: string;
  agentType?: 'simple' | 'advanced';
  knowledgeBaseIds?: string[]; // Our local knowledge base IDs
  advancedSettings?: {
    voiceSpeed?: number;
    voiceTemperature?: number;
    voiceModel?: string;
    model?: string;
    modelTemperature?: number;
    modelHighPriority?: boolean;
    interruptionSensitivity?: number;
    enableBackchannel?: boolean;
    normalizeForSpeech?: boolean;
    maxCallDurationMs?: number;
    endCallAfterSilenceMs?: number;
    webhookUrl?: string;
  };
  states?: any[];
  startingState?: string;
  functionCalls?: Array<{
    id?: string;
    appName: string;
    toolName: string;
    customName: string;
    customDescription: string;
    isConfigured?: boolean;
    webhookUrl?: string;
    parameterValues?: Record<string, any>;
    speakDuringExecution?: boolean;
    speakAfterExecution?: boolean;
    executionMessageDescription?: string;
    timeoutMs?: number;
  }>;
}

export async function PATCH(
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

    // Get the agent from database
    const agent = await prisma.retellAgent.findUnique({
      where: {
        id: agentId,
        partnerId: partnerId, // Ensure partner owns this agent
      },
    });

    if (!agent) {
      return NextResponse.json({
        error: 'Agent not found or not owned by partner'
      }, { status: 404 });
    }

    // Determine which API key to use (agent's own key or partner's key)
    let apiKey = null;

    if (agent.apiKey) {
      // Agent has its own API key
      apiKey = await decrypt(agent.apiKey);
      console.log('[update/route] Using agent\'s own API key');
    } else {
      // Use partner's API key as fallback
      const partner = await prisma.partner.findUnique({
        where: { id: partnerId },
        select: { retellApiKey: true }
      });

      if (partner?.retellApiKey) {
        apiKey = await decrypt(partner.retellApiKey);
        console.log('[update/route] Using partner\'s API key as fallback');
      }
    }

    if (!apiKey) {
      return NextResponse.json({
        error: 'No API key available for this agent'
      }, { status: 400 });
    }

    // Parse request body
    const updateData: UpdateAgentRequest = await req.json();
    console.log('[update/route] Updating agent:', agentId, 'with data:', JSON.stringify(updateData, null, 2));

    // Get current agent data from Retell to determine what needs updating
    let currentAgentData;
    let currentLlmData;

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
      currentAgentData = agentResponse.data;

      // Get LLM data if available
      if (currentAgentData.response_engine?.llm_id) {
        try {
          const llmResponse = await axios.get(
            `https://api.retellai.com/get-retell-llm/${currentAgentData.response_engine.llm_id}`,
            {
              headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Accept': 'application/json',
              },
            }
          );
          currentLlmData = llmResponse.data;
        } catch (llmError) {
          console.error('[update/route] Error fetching LLM data:', llmError);
        }
      }
    } catch (error: any) {
      console.error('[update/route] Error fetching current agent data:', error.response?.data || error.message);
      throw new Error('Failed to fetch current agent configuration');
    }

    const updatedFields: string[] = [];

    // Step 1: Update LLM if prompt, model settings, or knowledge bases changed
    const needsLlmUpdate =
      updateData.generalPrompt !== undefined ||
      updateData.beginMessage !== undefined ||
      updateData.advancedSettings?.model !== undefined ||
      updateData.advancedSettings?.modelTemperature !== undefined ||
      updateData.advancedSettings?.modelHighPriority !== undefined ||
      updateData.states !== undefined ||
      updateData.startingState !== undefined ||
      updateData.knowledgeBaseIds !== undefined ||
      updateData.functionCalls !== undefined;

    if (needsLlmUpdate && currentLlmData) {
      const llmUpdatePayload: any = {};

      if (updateData.generalPrompt !== undefined) {
        llmUpdatePayload.general_prompt = updateData.generalPrompt;
        updatedFields.push('generalPrompt');
      }

      if (updateData.beginMessage !== undefined) {
        llmUpdatePayload.begin_message = updateData.beginMessage;
        updatedFields.push('beginMessage');
      }

      if (updateData.advancedSettings?.model !== undefined) {
        llmUpdatePayload.model = updateData.advancedSettings.model;
        updatedFields.push('model');
      }

      if (updateData.advancedSettings?.modelTemperature !== undefined) {
        llmUpdatePayload.model_temperature = updateData.advancedSettings.modelTemperature;
        updatedFields.push('modelTemperature');
      }

      if (updateData.advancedSettings?.modelHighPriority !== undefined) {
        llmUpdatePayload.model_high_priority = updateData.advancedSettings.modelHighPriority;
        updatedFields.push('modelHighPriority');
      }

      if (updateData.states !== undefined) {
        llmUpdatePayload.states = updateData.states;
        updatedFields.push('states');

        // Only include starting_state if there are states defined
        if (updateData.states.length > 0 && updateData.startingState !== undefined && updateData.startingState !== '') {
          llmUpdatePayload.starting_state = updateData.startingState;
          updatedFields.push('startingState');
        }
      } else if (updateData.startingState !== undefined && updateData.startingState !== '') {
        // If states are not being updated but starting_state is, we need to check if current LLM has states
        if (currentLlmData.states && currentLlmData.states.length > 0) {
          llmUpdatePayload.starting_state = updateData.startingState;
          updatedFields.push('startingState');
        }
      }

      // Handle knowledge base updates
      if (updateData.knowledgeBaseIds !== undefined && agent.customerId) {
        try {
          // Convert our local KB IDs to Retell KB IDs
          const retellKnowledgeBaseIds = [];
          if (updateData.knowledgeBaseIds.length > 0) {
            const mappings = await prisma.knowledgeBaseProviderMapping.findMany({
              where: {
                knowledgeBaseId: { in: updateData.knowledgeBaseIds },
                partnerId: partnerId,
                customerId: agent.customerId,
                provider: 'retell',
                syncStatus: 'active'
              }
            });

            for (const mapping of mappings) {
              retellKnowledgeBaseIds.push(mapping.providerKnowledgeBaseId);
            }
          }

          // Use knowledge_base_ids field like create route, not general_tools
          llmUpdatePayload.knowledge_base_ids = retellKnowledgeBaseIds.length > 0 ? retellKnowledgeBaseIds : undefined;
          updatedFields.push('knowledgeBases');

          console.log('[update/route] Updated knowledge bases:', {
            localKbIds: updateData.knowledgeBaseIds,
            retellKbIds: retellKnowledgeBaseIds,
            totalKnowledgeBases: retellKnowledgeBaseIds.length
          });
        } catch (kbError) {
          console.error('[update/route] Error handling knowledge base update:', kbError);
          throw new Error('Failed to update knowledge bases');
        }
      }

      // Handle function calls updates
      if (updateData.functionCalls !== undefined) {
        try {
          console.log('[update/route] Processing function calls:', updateData.functionCalls);

          // Transform function calls to Retell tools using the same logic as create
          const retellTools = await transformFunctionCallsToRetellTools(
            updateData.functionCalls || [],
            partnerId,
            agent.customerId || ''
          );

          console.log('[update/route] Generated Retell tools:', JSON.stringify(retellTools, null, 2));

          // Knowledge bases are handled separately via knowledge_base_ids field
          // Just use the function call tools for general_tools
          llmUpdatePayload.general_tools = retellTools;

          updatedFields.push('functionCalls');

          console.log('[update/route] Updated function calls:', {
            originalFunctionCallsCount: updateData.functionCalls.length,
            generatedToolsCount: retellTools.length,
            tools: retellTools.map(t => ({ type: t.type, name: t.name }))
          });
        } catch (toolError) {
          console.error('[update/route] Error handling function calls update:', toolError);
          throw new Error('Failed to update function calls');
        }
      }

      try {
        console.log('[update/route] Updating LLM:', currentLlmData.llm_id, 'with payload:', JSON.stringify(llmUpdatePayload, null, 2));
      console.log('[update/route] States validation:', {
        hasStates: llmUpdatePayload.states && llmUpdatePayload.states.length > 0,
        statesCount: llmUpdatePayload.states?.length || 0,
        hasStartingState: 'starting_state' in llmUpdatePayload,
        startingStateValue: llmUpdatePayload.starting_state
      });
        await axios.patch(
          `https://api.retellai.com/update-retell-llm/${currentLlmData.llm_id}`,
          llmUpdatePayload,
          {
            headers: {
              'Authorization': `Bearer ${apiKey}`,
              'Content-Type': 'application/json',
            },
          }
        );
        console.log('[update/route] LLM updated successfully');
      } catch (error: any) {
        console.error('[update/route] Error updating LLM:', error.response?.data || error.message);
        throw new Error(`Failed to update LLM: ${error.response?.data?.message || error.message}`);
      }
    }

    // Step 2: Update Agent if voice or call settings changed
    const needsAgentUpdate =
      updateData.agentName !== undefined ||
      updateData.voiceId !== undefined ||
      updateData.language !== undefined ||
      updateData.advancedSettings?.voiceSpeed !== undefined ||
      updateData.advancedSettings?.voiceTemperature !== undefined ||
      updateData.advancedSettings?.voiceModel !== undefined ||
      updateData.advancedSettings?.interruptionSensitivity !== undefined ||
      updateData.advancedSettings?.enableBackchannel !== undefined ||
      updateData.advancedSettings?.normalizeForSpeech !== undefined ||
      updateData.advancedSettings?.maxCallDurationMs !== undefined ||
      updateData.advancedSettings?.endCallAfterSilenceMs !== undefined ||
      updateData.advancedSettings?.webhookUrl !== undefined;

    if (needsAgentUpdate) {
      const agentUpdatePayload: any = {};

      if (updateData.agentName !== undefined) {
        agentUpdatePayload.agent_name = updateData.agentName;
        updatedFields.push('agentName');
      }

      if (updateData.voiceId !== undefined) {
        agentUpdatePayload.voice_id = updateData.voiceId;
        updatedFields.push('voiceId');
      }

      if (updateData.language !== undefined) {
        agentUpdatePayload.language = updateData.language;
        updatedFields.push('language');
      }

      if (updateData.advancedSettings?.voiceSpeed !== undefined) {
        agentUpdatePayload.voice_speed = updateData.advancedSettings.voiceSpeed;
        updatedFields.push('voiceSpeed');
      }

      if (updateData.advancedSettings?.voiceTemperature !== undefined) {
        agentUpdatePayload.voice_temperature = updateData.advancedSettings.voiceTemperature;
        updatedFields.push('voiceTemperature');
      }

      if (updateData.advancedSettings?.voiceModel !== undefined) {
        // Only set voice_model if it's not empty, otherwise omit it
        if (updateData.advancedSettings.voiceModel && updateData.advancedSettings.voiceModel.trim() !== '') {
          agentUpdatePayload.voice_model = updateData.advancedSettings.voiceModel;
        }
        updatedFields.push('voiceModel');
      }

      if (updateData.advancedSettings?.interruptionSensitivity !== undefined) {
        agentUpdatePayload.interruption_sensitivity = updateData.advancedSettings.interruptionSensitivity;
        updatedFields.push('interruptionSensitivity');
      }

      if (updateData.advancedSettings?.enableBackchannel !== undefined) {
        agentUpdatePayload.enable_backchannel = updateData.advancedSettings.enableBackchannel;
        updatedFields.push('enableBackchannel');
      }

      if (updateData.advancedSettings?.normalizeForSpeech !== undefined) {
        agentUpdatePayload.normalize_for_speech = updateData.advancedSettings.normalizeForSpeech;
        updatedFields.push('normalizeForSpeech');
      }

      if (updateData.advancedSettings?.maxCallDurationMs !== undefined) {
        agentUpdatePayload.max_call_duration_ms = updateData.advancedSettings.maxCallDurationMs;
        updatedFields.push('maxCallDurationMs');
      }

      if (updateData.advancedSettings?.endCallAfterSilenceMs !== undefined) {
        agentUpdatePayload.end_call_after_silence_ms = updateData.advancedSettings.endCallAfterSilenceMs;
        updatedFields.push('endCallAfterSilenceMs');
      }

      if (updateData.advancedSettings?.webhookUrl !== undefined) {
        agentUpdatePayload.webhook_url = updateData.advancedSettings.webhookUrl || null;
        updatedFields.push('webhookUrl');
      }

      try {
        console.log('[update/route] Updating agent:', agentId, 'with payload:', JSON.stringify(agentUpdatePayload, null, 2));
        await axios.patch(
          `https://api.retellai.com/update-agent/${agentId}`,
          agentUpdatePayload,
          {
            headers: {
              'Authorization': `Bearer ${apiKey}`,
              'Content-Type': 'application/json',
            },
          }
        );
        console.log('[update/route] Agent updated successfully');
      } catch (error: any) {
        console.error('[update/route] Error updating agent:', error.response?.data || error.message);
        throw new Error(`Failed to update agent: ${error.response?.data?.message || error.message}`);
      }
    }

    // Step 3: Update local database record
    const dbUpdateData: any = {
      updatedAt: new Date(),
      lastSyncedAt: new Date(),
    };

    if (updateData.agentName !== undefined) {
      dbUpdateData.name = updateData.agentName;
    }

    if (updateData.voiceId !== undefined) {
      dbUpdateData.voiceId = updateData.voiceId;
    }

    if (updateData.language !== undefined) {
      dbUpdateData.language = updateData.language;
    }

    if (updateData.advancedSettings?.webhookUrl !== undefined) {
      dbUpdateData.webhookUrl = updateData.advancedSettings.webhookUrl || null;
    }

    // Update voice config
    if (updateData.advancedSettings?.voiceSpeed !== undefined ||
        updateData.advancedSettings?.voiceTemperature !== undefined ||
        updateData.advancedSettings?.voiceModel !== undefined) {
      dbUpdateData.voiceConfig = {
        ...(agent.voiceConfig as any || {}),
        ...(updateData.advancedSettings.voiceSpeed !== undefined && { speed: updateData.advancedSettings.voiceSpeed }),
        ...(updateData.advancedSettings.voiceTemperature !== undefined && { temperature: updateData.advancedSettings.voiceTemperature }),
        ...(updateData.advancedSettings.voiceModel !== undefined && { model: updateData.advancedSettings.voiceModel }),
      };
    }

    // Update call config
    if (updateData.advancedSettings?.interruptionSensitivity !== undefined ||
        updateData.advancedSettings?.enableBackchannel !== undefined ||
        updateData.advancedSettings?.normalizeForSpeech !== undefined ||
        updateData.advancedSettings?.maxCallDurationMs !== undefined ||
        updateData.advancedSettings?.endCallAfterSilenceMs !== undefined) {
      dbUpdateData.callConfig = {
        ...(agent.callConfig as any || {}),
        ...(updateData.advancedSettings.interruptionSensitivity !== undefined && { interruptionSensitivity: updateData.advancedSettings.interruptionSensitivity }),
        ...(updateData.advancedSettings.enableBackchannel !== undefined && { enableBackchannel: updateData.advancedSettings.enableBackchannel }),
        ...(updateData.advancedSettings.normalizeForSpeech !== undefined && { normalizeForSpeech: updateData.advancedSettings.normalizeForSpeech }),
        ...(updateData.advancedSettings.maxCallDurationMs !== undefined && { maxCallDurationMs: updateData.advancedSettings.maxCallDurationMs }),
        ...(updateData.advancedSettings.endCallAfterSilenceMs !== undefined && { endCallAfterSilenceMs: updateData.advancedSettings.endCallAfterSilenceMs }),
      };
    }

    const updatedAgent = await prisma.retellAgent.update({
      where: { id: agentId },
      data: dbUpdateData,
    });

    console.log('[update/route] Database updated successfully for agent:', agentId);

    return NextResponse.json({
      success: true,
      agent: {
        id: updatedAgent.id,
        name: updatedAgent.name,
        updatedAt: updatedAgent.updatedAt.toISOString(),
        updatedFields,
      },
      message: `Agent updated successfully. Updated fields: ${updatedFields.join(', ')}`
    });

  } catch (error: any) {
    console.error('[update/route] Error updating agent:', error);

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
      error: 'update_failed',
      message: error.message || 'Failed to update agent.',
    }, { status: 500 });
  }
}
