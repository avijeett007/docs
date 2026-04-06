export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { verifyPartnerJWT } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { encrypt } from '@/lib/encryption';
import axios from 'axios';

interface CreateAgentRequest {
  agentName: string;
  systemPrompt: string;
  voiceProvider: string;
  voiceId: string;
  apiKey: string;
  publicKey?: string;
  firstMessage?: string;
  model?: string;
  modelProvider?: string;
  temperature?: number;
  maxTokens?: number;
  silenceTimeoutSeconds?: number;
  maxDurationSeconds?: number;
  backgroundSound?: string;
  recordingEnabled?: boolean;
  endCallMessage?: string;
  voicemailMessage?: string;
  endCallPhrases?: string[];
  // New fields for enhanced functionality
  customerId?: string;
  knowledgeBaseIds?: string[];
  functionCalls?: Array<{
    id?: string;
    appName: string;
    toolName: string;
    customName: string;
    customDescription: string;
    isConfigured?: boolean;
    webhookUrl?: string;
    parameterValues?: Record<string, any>;
  }>;
}

export async function POST(req: NextRequest) {
  try {
    // Verify the partner JWT
    const decoded = await verifyPartnerJWT(req);
    if (!decoded || !decoded.payload || !decoded.isValid) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const partnerId = decoded.payload.partnerId;
    const requestData: CreateAgentRequest = await req.json();

    console.log('[vapi-create/route] Creating VAPI agent');
    console.log('[vapi-create/route] Voice provider:', requestData.voiceProvider);

    // Validate required fields
    if (!requestData.agentName || !requestData.systemPrompt || !requestData.voiceId || !requestData.apiKey) {
      return NextResponse.json({
        error: 'Missing required fields: agentName, systemPrompt, voiceId, and apiKey are required'
      }, { status: 400 });
    }

    // Get partner info for fallback API key logic
    const partner = await prisma.partner.findUnique({
      where: { id: partnerId },
      select: {
        id: true,
        vapiApiKey: true,
      },
    });

    if (!partner) {
      return NextResponse.json({ error: 'Partner not found' }, { status: 404 });
    }

    // Determine which API key to use (agent-specific first, then partner fallback)
    let apiKeyToUse = requestData.apiKey;
    let usingPartnerKey = false;

    if (!apiKeyToUse && partner.vapiApiKey) {
      apiKeyToUse = partner.vapiApiKey;
      usingPartnerKey = true;
    }

    if (!apiKeyToUse) {
      return NextResponse.json({
        error: 'No API key available. Please provide an API key or set a partner-level API key.'
      }, { status: 400 });
    }

    // Map voice provider to VAPI-compatible format
    const mapVoiceProvider = (provider: string): string => {
      const providerMap: Record<string, string> = {
        'elevenlabs': '11labs',
        '11labs': '11labs', // Handle both formats
        'playht': 'playht',
        'openai': 'openai',
        'deepgram': 'deepgram',
        'azure': 'azure',
        'cartesia': 'cartesia',
        'vapi': 'vapi',
        'lmnt': 'lmnt',
        'hume': 'hume',
        'rime-ai': 'rime-ai',
        'tavus': 'tavus',
        'neuphonic': 'neuphonic',
        'sesame': 'sesame'
      };
      const mapped = providerMap[provider] || 'playht';
      console.log(`[vapi-create/route] Mapping voice provider: ${provider} -> ${mapped}`);
      return mapped;
    };

    // Knowledge base integration will be handled by uploading files to VAPI
    // and adding them to the assistant model with google provider

    // Prepare VAPI assistant payload
    const assistantPayload: any = {
      name: requestData.agentName,
      transcriber: {
        provider: 'deepgram',
        model: 'nova-3',
        language: 'en'
      },
      model: {
        provider: requestData.modelProvider || 'openai',
        model: requestData.model || 'gpt-4o',
        temperature: requestData.temperature || 0.7,
        maxTokens: requestData.maxTokens || 500,
        messages: [
          {
            role: 'system',
            content: requestData.systemPrompt
          }
        ]
      },
      voice: {
        provider: mapVoiceProvider(requestData.voiceProvider || 'playht'),
        voiceId: requestData.voiceId,
        // Add required voice configuration for ElevenLabs
        ...(mapVoiceProvider(requestData.voiceProvider || 'playht') === '11labs' && {
          model: 'eleven_turbo_v2_5',
          stability: 0.5,
          similarityBoost: 0.75
        })
      },
      firstMessage: requestData.firstMessage || 'Hello! How can I help you today?',
      silenceTimeoutSeconds: requestData.silenceTimeoutSeconds || 30,
      maxDurationSeconds: requestData.maxDurationSeconds || 600,
      backgroundSound: requestData.backgroundSound || 'off',
      recordingEnabled: requestData.recordingEnabled ?? true,
      endCallMessage: requestData.endCallMessage || '',
      voicemailMessage: requestData.voicemailMessage || '',
      endCallPhrases: requestData.endCallPhrases || [],
      // Add webhook configuration - use HTTPS for VAPI compatibility
      serverUrl: process.env.NODE_ENV === 'production'
        ? `${process.env.ANALYTICS_API_URL || 'https://analytics.knotie-ai.pro'}/api/webhooks/vapi/${partnerId}`
        : `https://analytics.knotie-ai.pro/api/webhooks/vapi/${partnerId}`, // Use production URL even in dev for VAPI
      clientMessages: [
        'transcript',
        'hang',
        'function-call',
        'speech-update',
        'metadata',
        'conversation-update'
      ],
      serverMessages: [
        'end-of-call-report',
        'status-update',
        'hang',
        'function-call'
      ]
    };

    console.log('[vapi-create/route] Final voice configuration:', assistantPayload.voice);

    // Create VAPI tools if function calls are provided (following Retell pattern)
    const toolIds = [];
    if (requestData.functionCalls && requestData.functionCalls.length > 0 && requestData.customerId) {
      const connectHubUrl = process.env.CONNECT_HUB_URL || 'http://localhost:3001';

      for (const fc of requestData.functionCalls) {
        try {
          console.log(`[vapi-create/route] Creating VAPI tool: ${fc.customName}`);

          // Generate security token for this specific function call (like Retell)
          const tokenResponse = await fetch(`${connectHubUrl}/api/tokens/generate`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${process.env.CONNECT_HUB_API_KEY || ''}`
            },
            body: JSON.stringify({
              partnerId,
              customerId: requestData.customerId,
              appName: fc.appName,
              toolName: fc.toolName,
              options: {
                expiresIn: 31536000, // 1 year in seconds
                usageLimit: 1000     // Higher limit for agent function calls
              }
            })
          });

          if (!tokenResponse.ok) {
            console.error(`[vapi-create/route] Failed to generate security token for ${fc.appName}/${fc.toolName}`);
            continue; // Skip this function call if token generation fails
          }

          const tokenData = await tokenResponse.json();
          const securityToken = tokenData.token;

          // Get tool schema from Connect Hub (like Retell)
          const schemaResponse = await fetch(`${connectHubUrl}/schemas/${requestData.customerId}/${fc.appName}/${fc.toolName}`, {
            method: 'GET',
            headers: {
              'Authorization': `Bearer ${process.env.CONNECT_HUB_API_KEY || ''}`
            }
          });

          let toolSchema: {
            type: string;
            properties: Record<string, any>;
            required: string[];
          } = {
            type: 'object',
            properties: {},
            required: []
          };

          if (schemaResponse.ok) {
            const schemaData = await schemaResponse.json();
            if (schemaData.data?.schema?.parameters) {
              toolSchema = schemaData.data.schema.parameters;
            }
          } else {
            console.warn(`[vapi-create/route] Failed to fetch schema for ${fc.appName}/${fc.toolName}`);
          }

          // Apply parameter values as defaults to the schema (like Retell)
          if (fc.parameterValues && toolSchema.properties) {
            Object.entries(fc.parameterValues).forEach(([key, value]) => {
              if (value !== undefined && value !== '' && toolSchema.properties[key]) {
                toolSchema.properties[key].default = value;
              }
            });
          }

          // Generate webhook URL with Connect Hub dynamic pattern (like Retell)
          const webhookUrl = `${connectHubUrl}/api/dynamic/${partnerId}/${requestData.customerId}/${fc.appName}/${fc.toolName}`;

          // Create VAPI tool with Connect Hub webhook URL
          const toolPayload = {
            type: 'function',
            function: {
              name: fc.customName,
              description: fc.customDescription,
              parameters: toolSchema
            },
            server: {
              url: webhookUrl,
              timeoutSeconds: 20
            }
          };

          const toolResponse = await fetch('https://api.vapi.ai/tool', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${apiKeyToUse}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify(toolPayload)
          });

          if (toolResponse.ok) {
            const toolData = await toolResponse.json();
            toolIds.push(toolData.id);
            console.log(`[vapi-create/route] Created VAPI tool: ${toolData.id} for ${fc.customName}`);

            // Store function call configuration in Connect Hub for tracking (like Retell)
            await fetch(`${connectHubUrl}/api/function-calls`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${process.env.CONNECT_HUB_API_KEY || ''}`
              },
              body: JSON.stringify({
                partnerId,
                customerId: requestData.customerId,
                appName: fc.appName,
                toolName: fc.toolName,
                customName: fc.customName,
                customDescription: fc.customDescription,
                securityToken,
                webhookUrl,
                provider: 'vapi' // Add provider identifier
              })
            });

          } else {
            const errorText = await toolResponse.text();
            console.error(`[vapi-create/route] Failed to create VAPI tool ${fc.customName}:`, errorText);
          }

        } catch (error) {
          console.error(`[vapi-create/route] Error creating VAPI tool ${fc.customName}:`, error);
        }
      }

      console.log(`[vapi-create/route] Created ${toolIds.length} VAPI tools with Connect Hub integration:`, toolIds);
    }

    // Upload files to VAPI for knowledge base integration
    const knowledgeBaseFileIds = [];
    if (requestData.knowledgeBaseIds && requestData.knowledgeBaseIds.length > 0 && requestData.customerId) {
      try {
        console.log(`[vapi-create/route] Processing knowledge bases:`, requestData.knowledgeBaseIds);

        // Get all files from selected knowledge bases
        console.log('[vapi-create/route] Querying files from', requestData.knowledgeBaseIds?.length || 0, 'knowledge bases');

        const knowledgeBaseFiles = await prisma.knowledgeBaseFile.findMany({
          where: {
            knowledgeBaseId: {
              in: requestData.knowledgeBaseIds
            },
            partnerId: partnerId,
            customerId: requestData.customerId
            // Remove isProcessed: true requirement for VAPI
            // VAPI can handle raw files and do its own processing
          },
          include: {
            knowledgeBase: true
          }
        });

        if (knowledgeBaseFiles.length === 0) {
          console.warn('[vapi-create/route] No files found in selected knowledge bases');
          console.log('[vapi-create/route] Debug - Selected knowledge base count:', requestData.knowledgeBaseIds?.length || 0);

          // Check if there are any files at all for this customer/partner
          const allFiles = await prisma.knowledgeBaseFile.findMany({
            where: {
              partnerId: partnerId,
              customerId: requestData.customerId
            },
            select: {
              id: true,
              name: true,
              knowledgeBaseId: true,
              isProcessed: true
            }
          });
          console.log('[vapi-create/route] Debug - All files for customer:', allFiles);

          // Check if the knowledge bases exist
          const kbExists = await prisma.knowledgeBase.findMany({
            where: {
              id: {
                in: requestData.knowledgeBaseIds
              },
              partnerId: partnerId,
              customerId: requestData.customerId
            },
            select: {
              id: true,
              name: true
            }
          });
          console.log('[vapi-create/route] Debug - Knowledge bases found:', kbExists);
        } else {
          console.log(`[vapi-create/route] Found ${knowledgeBaseFiles.length} files across ${requestData.knowledgeBaseIds.length} knowledge bases`);
          console.log(`[vapi-create/route] Files to upload: ${knowledgeBaseFiles.length} files`);

          // Upload each file to VAPI and collect fileIds
          for (const file of knowledgeBaseFiles) {
            try {
              const fileId = await uploadFileToVAPI(file, apiKeyToUse);
              if (fileId) {
                knowledgeBaseFileIds.push(fileId);
                console.log(`[vapi-create/route] Uploaded file to VAPI: ${fileId} (${file.name})`);
              }
            } catch (error) {
              console.error(`[vapi-create/route] Failed to upload file ${file.name}:`, error);
            }
          }

          console.log(`[vapi-create/route] Successfully uploaded ${knowledgeBaseFileIds.length} files to VAPI for knowledge base`);
        }
      } catch (error) {
        console.error('[vapi-create/route] Error processing knowledge base files:', error);
        // Continue with agent creation even if file upload fails
      }
    }

    // Add tool IDs to assistant model if any were created
    if (toolIds.length > 0) {
      assistantPayload.model.toolIds = toolIds;
    }

    // Add knowledge base configuration to assistant model if files were uploaded
    if (knowledgeBaseFileIds.length > 0) {
      assistantPayload.model.knowledgeBase = {
        fileIds: knowledgeBaseFileIds,
        provider: 'google' // Hardcoded as requested
      };
      console.log(`[vapi-create/route] Added knowledge base to assistant with ${knowledgeBaseFileIds.length} files using google provider`);
    }

    console.log('[vapi-create/route] Creating assistant with VAPI');

    // Create assistant in VAPI
    let assistantResponse;
    try {

      assistantResponse = await axios.post(
        'https://api.vapi.ai/assistant',
        assistantPayload,
        {
          headers: {
            'Authorization': `Bearer ${apiKeyToUse}`,
            'Content-Type': 'application/json',
          },
        }
      );
      console.log('[vapi-create/route] Assistant created successfully:', assistantResponse.data.id);
    } catch (error: any) {
      console.error('[vapi-create/route] Error creating Assistant:', error.response?.data || error.message);
      
      if (error.response?.status === 401) {
        return NextResponse.json({
          error: 'Invalid VAPI API key'
        }, { status: 401 });
      }
      
      throw new Error(`Failed to create VAPI Assistant: ${error.response?.data?.message || error.message}`);
    }

    const assistantId = assistantResponse.data.id;
    if (!assistantId) {
      throw new Error('No Assistant ID returned from VAPI API');
    }

    // Encrypt the API key if provided
    let encryptedApiKey = null;
    if (requestData.apiKey && !usingPartnerKey) {
      encryptedApiKey = await encrypt(requestData.apiKey);
    }

    // Save agent to database
    const newAgent = await prisma.vapiAgent.create({
      data: {
        id: assistantId,
        partnerId: partnerId,
        customerId: requestData.customerId || null, // Add customer assignment
        name: requestData.agentName,
        voice: assistantPayload.voice,
        model: assistantPayload.model,
        firstMessage: assistantPayload.firstMessage,
        voicemailMessage: assistantPayload.voicemailMessage,
        endCallMessage: assistantPayload.endCallMessage,
        recordingEnabled: assistantPayload.recordingEnabled,
        clientMessages: [],
        serverMessages: [],
        endCallPhrases: assistantPayload.endCallPhrases,
        isServerUrlSecretSet: false,
        createdAt: new Date(),
        updatedAt: new Date(),
        isActive: true,
        profitMultiplier: 1.2, // Default profit multiplier
        // API key fields
        apiKey: encryptedApiKey,
        apiKeyStatus: 'valid', // Assume valid since we just used it successfully
        apiKeyLastVerified: new Date(),
        // Public key for testing (agent-specific)
        publicKey: requestData.publicKey || null,
      }
    });

    console.log('[vapi-create/route] Agent saved to database:', newAgent.id);

    // Step 5: Automatically register with analytics service and setup webhook
    let analyticsAgentId = null;
    let webhookUrl = null;

    try {
      console.log('[vapi-create/route] Registering agent with analytics service...');
      const { registerAgentInAnalytics, generateWebhookUrl, updateWebhookConfig } = await import('@/lib/analytics');

      const analyticsResult = await registerAgentInAnalytics({
        agentId: newAgent.id,
        provider: 'vapi',
        partnerId: partnerId,
        agentName: newAgent.name,
        customerId: requestData.customerId,
        profitMultiplier: newAgent.profitMultiplier,
      });

      if (analyticsResult.success && analyticsResult.analyticsAgentId) {
        analyticsAgentId = analyticsResult.analyticsAgentId;

        // Generate webhook URL
        webhookUrl = generateWebhookUrl({
          provider: 'vapi',
          analyticsAgentId: analyticsAgentId,
        });

        // Update the agent with analytics info
        await prisma.vapiAgent.update({
          where: { id: newAgent.id },
          data: {
            analyticsAgentId: analyticsAgentId,
            webhookUrl: webhookUrl,
            webhookEnabled: true,
            webhookMode: 'automatic',
            forwardToPreExisting: true,
          },
        });

        // Update webhook configuration in analytics service
        await updateWebhookConfig({
          analyticsAgentId: analyticsAgentId,
          providerAgentId: newAgent.id,
          provider: 'vapi',
          webhookEnabled: true,
          preExistingWebhookUrl: undefined,
          forwardToPreExisting: true,
        });

        console.log('[vapi-create/route] Analytics registration and webhook setup successful:', analyticsAgentId);
      } else {
        console.warn('[vapi-create/route] Analytics registration failed, continuing without webhook');
      }
    } catch (error) {
      console.error('[vapi-create/route] Failed to set up analytics and webhook:', error);
      // Continue with agent creation even if analytics setup fails
    }

    // Create knowledge base mappings if provided
    if (requestData.knowledgeBaseIds && requestData.knowledgeBaseIds.length > 0 && requestData.customerId) {
      try {
        const knowledgeBaseMappings = requestData.knowledgeBaseIds.map(kbId => ({
          knowledgeBaseId: kbId,
          partnerId: partnerId,
          customerId: requestData.customerId!,
          provider: 'vapi',
          providerKnowledgeBaseId: assistantResponse.data.id, // Use VAPI assistant ID
        }));

        await prisma.knowledgeBaseProviderMapping.createMany({
          data: knowledgeBaseMappings,
          skipDuplicates: true,
        });

        console.log(`[vapi-create/route] Created ${knowledgeBaseMappings.length} knowledge base mappings`);
      } catch (error) {
        console.error('[vapi-create/route] Error creating knowledge base mappings:', error);
        // Don't fail the entire request for this
      }
    }

    // Create function call mappings if provided
    if (requestData.functionCalls && requestData.functionCalls.length > 0 && requestData.customerId) {
      try {
        const connectHubUrl = process.env.CONNECT_HUB_URL || 'http://localhost:3001';

        const functionCallMappings = requestData.functionCalls.map(fc => ({
          agentId: assistantResponse.data.id,
          partnerId: partnerId,
          customerId: requestData.customerId!,
          appName: fc.appName,
          toolName: fc.toolName,
          customName: fc.customName,
          customDescription: fc.customDescription,
          securityToken: Math.random().toString(36).substring(2, 15), // Generate random token
          webhookUrl: fc.webhookUrl || `${connectHubUrl}/api/dynamic/${partnerId}/${requestData.customerId}/${fc.appName}/${fc.toolName}`,
          isActive: fc.isConfigured || true,
        }));

        await prisma.agentFunctionCall.createMany({
          data: functionCallMappings,
          skipDuplicates: true,
        });

        console.log(`[vapi-create/route] Created ${functionCallMappings.length} function call mappings`);
      } catch (error) {
        console.error('[vapi-create/route] Error creating function call mappings:', error);
        // Don't fail the entire request for this
      }
    }

    // Return the created agent
    return NextResponse.json({
      success: true,
      agent: {
        id: newAgent.id,
        name: newAgent.name,
        voice: newAgent.voice,
        model: newAgent.model,
        firstMessage: newAgent.firstMessage,
        voicemailMessage: newAgent.voicemailMessage,
        endCallMessage: newAgent.endCallMessage,
        recordingEnabled: newAgent.recordingEnabled,
        clientMessages: newAgent.clientMessages,
        serverMessages: newAgent.serverMessages,
        endCallPhrases: newAgent.endCallPhrases,
        isServerUrlSecretSet: newAgent.isServerUrlSecretSet,
        importedAt: newAgent.importedAt,
        lastSyncedAt: newAgent.lastSyncedAt,
        createdAt: newAgent.createdAt,
        updatedAt: newAgent.updatedAt,
        isActive: newAgent.isActive,
        profitMultiplier: newAgent.profitMultiplier,
        apiKeyStatus: newAgent.apiKeyStatus,
        apiKeyLastVerified: newAgent.apiKeyLastVerified,
        usingPartnerKey: usingPartnerKey,
        hasPartnerKeyFallback: !!partner.vapiApiKey,
        // Additional info about created mappings
        customerId: newAgent.customerId,
        knowledgeBaseCount: requestData.knowledgeBaseIds?.length || 0,
        functionCallCount: requestData.functionCalls?.length || 0
      }
    });

  } catch (error: any) {
    console.error('[vapi-create/route] Error creating VAPI agent:', error);

    // Handle specific error types
    if (error.message.includes('Invalid VAPI API key')) {
      return NextResponse.json({
        error: 'invalid_api_key',
        message: 'Your VAPI API key appears to be invalid.',
      }, { status: 401 });
    }

    return NextResponse.json({
      error: 'Failed to create agent',
      message: error.message || 'An unexpected error occurred'
    }, { status: 500 });
  }
}



/**
 * Upload a single file to VAPI
 */
async function uploadFileToVAPI(
  file: any, // KnowledgeBaseFile with knowledgeBase relation
  apiKey: string
): Promise<string> {
  console.log(`[uploadFileToVAPI] Starting upload for file: ${file.name}`);
  console.log(`[uploadFileToVAPI] File details: ${file.name} (${file.fileType}, ${file.fileSize} bytes)`);

  // Get file content from Supabase storage
  const { createClient } = await import('@supabase/supabase-js');
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // Download file from Supabase
  const filePath = `${file.partnerId}/${file.customerId}/${file.storageKey}`;
  console.log(`[uploadFileToVAPI] Downloading file from storage`);

  const { data: fileData, error } = await supabase.storage
    .from(file.bucketName)
    .download(filePath);

  if (error || !fileData) {
    console.error(`[uploadFileToVAPI] Failed to download file from Supabase:`, error);
    throw new Error(`Failed to download file from storage: ${error?.message}`);
  }

  console.log(`[uploadFileToVAPI] Successfully downloaded file from Supabase, size: ${fileData.size} bytes`);

  // Create FormData for VAPI upload
  const formData = new FormData();
  const blob = new Blob([fileData], { type: file.fileType });
  formData.append('file', blob, file.name);

  console.log(`[uploadFileToVAPI] Uploading to VAPI with blob size: ${blob.size} bytes, type: ${file.fileType}`);

  // Upload to VAPI
  const response = await fetch('https://api.vapi.ai/file', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
    },
    body: formData
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`[uploadFileToVAPI] VAPI upload failed:`, {
      status: response.status,
      statusText: response.statusText,
      error: errorText
    });
    throw new Error(`VAPI file upload failed: ${response.status} ${errorText}`);
  }

  const result = await response.json();
  console.log(`[uploadFileToVAPI] VAPI upload successful: ${file.name} (${result.status})`);
  return result.id;
}


