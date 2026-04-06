export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { verifyPartnerJWT } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { encrypt, decrypt } from '@/lib/encryption';
import axios from 'axios';

interface UpdateAgentRequest {
  agentName?: string;
  systemPrompt?: string;
  voiceProvider?: string;
  voiceId?: string;
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
    const requestData: UpdateAgentRequest = await req.json();

    console.log('[vapi-update/route] Updating VAPI agent:', agentId);

    // Get the existing agent
    const existingAgent = await prisma.vapiAgent.findUnique({
      where: {
        id: agentId,
        partnerId: partnerId, // Ensure partner owns this agent
      },
      include: {
        partner: {
          select: {
            vapiApiKey: true,
          },
        },
      },
    });

    if (!existingAgent) {
      return NextResponse.json({
        error: 'Agent not found or not owned by partner'
      }, { status: 404 });
    }

    // Determine which API key to use
    let apiKeyToUse = null;
    let usingPartnerKey = false;

    if (existingAgent.apiKey) {
      try {
        apiKeyToUse = decrypt(existingAgent.apiKey);
      } catch (error) {
        console.error('[vapi-update/route] Failed to decrypt agent API key:', error);
      }
    }

    if (!apiKeyToUse && existingAgent.partner.vapiApiKey) {
      apiKeyToUse = existingAgent.partner.vapiApiKey;
      usingPartnerKey = true;
    }

    if (!apiKeyToUse) {
      return NextResponse.json({
        error: 'No API key available for this agent'
      }, { status: 400 });
    }

    // Prepare update payload for VAPI
    const updatePayload: any = {};

    if (requestData.agentName !== undefined) {
      updatePayload.name = requestData.agentName;
    }

    // Handle model updates
    if (requestData.systemPrompt !== undefined || requestData.model !== undefined || 
        requestData.modelProvider !== undefined || requestData.temperature !== undefined || 
        requestData.maxTokens !== undefined) {
      
      const currentModel = existingAgent.model as any;
      updatePayload.model = {
        ...currentModel,
        ...(requestData.modelProvider && { provider: requestData.modelProvider }),
        ...(requestData.model && { model: requestData.model }),
        ...(requestData.temperature !== undefined && { temperature: requestData.temperature }),
        ...(requestData.maxTokens !== undefined && { maxTokens: requestData.maxTokens }),
      };

      if (requestData.systemPrompt !== undefined) {
        updatePayload.model.messages = [
          {
            role: 'system',
            content: requestData.systemPrompt
          }
        ];
      }
    }

    // Handle voice updates
    if (requestData.voiceProvider !== undefined || requestData.voiceId !== undefined) {
      const currentVoice = existingAgent.voice as any;
      updatePayload.voice = {
        ...currentVoice,
        ...(requestData.voiceProvider && { provider: requestData.voiceProvider }),
        ...(requestData.voiceId && { voiceId: requestData.voiceId }),
      };
    }

    // Handle other field updates
    if (requestData.firstMessage !== undefined) {
      updatePayload.firstMessage = requestData.firstMessage;
    }
    if (requestData.silenceTimeoutSeconds !== undefined) {
      updatePayload.silenceTimeoutSeconds = requestData.silenceTimeoutSeconds;
    }
    if (requestData.maxDurationSeconds !== undefined) {
      updatePayload.maxDurationSeconds = requestData.maxDurationSeconds;
    }
    if (requestData.backgroundSound !== undefined) {
      updatePayload.backgroundSound = requestData.backgroundSound;
    }
    if (requestData.recordingEnabled !== undefined) {
      updatePayload.recordingEnabled = requestData.recordingEnabled;
    }
    if (requestData.endCallMessage !== undefined) {
      updatePayload.endCallMessage = requestData.endCallMessage;
    }
    if (requestData.voicemailMessage !== undefined) {
      updatePayload.voicemailMessage = requestData.voicemailMessage;
    }
    if (requestData.endCallPhrases !== undefined) {
      updatePayload.endCallPhrases = requestData.endCallPhrases;
    }

    // Handle knowledge base updates
    if (requestData.knowledgeBaseIds !== undefined && requestData.customerId) {
      // Ensure we have a model object to add knowledgeBase to
      if (!updatePayload.model) {
        const currentModel = existingAgent.model as any;
        updatePayload.model = { ...currentModel };
      }

      if (requestData.knowledgeBaseIds.length > 0) {
        // Create the knowledge base query URL for our custom endpoint
        const knowledgeBaseIds = requestData.knowledgeBaseIds.join(',');
        const queryUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'https://app.knotie-ai.pro'}/api/knowledge-base/query?kb=${knowledgeBaseIds}`;

        updatePayload.model.knowledgeBase = {
          provider: 'custom-knowledge-base',
          server: {
            timeoutSeconds: 30,
            url: queryUrl,
            headers: {
              'Content-Type': 'application/json',
              'X-Partner-ID': partnerId,
              'X-Customer-ID': requestData.customerId
            },
            backoffPlan: {
              type: 'fixed',
              maxRetries: 2,
              baseDelaySeconds: 1,
              excludedStatusCodes: [400, 401, 403, 404]
            }
          }
        };

        console.log('[vapi-update/route] Added knowledge base configuration:', updatePayload.model.knowledgeBase);
      } else {
        // Remove knowledge base if no knowledge bases are selected
        updatePayload.model.knowledgeBase = null;
        console.log('[vapi-update/route] Removed knowledge base configuration');
      }
    }

    // Only update VAPI if there are actual changes to VAPI-related fields
    const hasVapiChanges = Object.keys(updatePayload).length > 0;

    if (hasVapiChanges) {
      console.log('[vapi-update/route] Updating assistant with payload:', JSON.stringify(updatePayload, null, 2));

      // Update assistant in VAPI
      try {
        await axios.patch(
          `https://api.vapi.ai/assistant/${agentId}`,
          updatePayload,
          {
            headers: {
              'Authorization': `Bearer ${apiKeyToUse}`,
              'Content-Type': 'application/json',
            },
          }
        );
        console.log('[vapi-update/route] Assistant updated successfully in VAPI');
      } catch (error: any) {
        console.error('[vapi-update/route] Error updating Assistant in VAPI:', error.response?.data || error.message);

        if (error.response?.status === 401) {
          return NextResponse.json({
            error: 'Invalid VAPI API key'
          }, { status: 401 });
        }

        if (error.response?.status === 404) {
          return NextResponse.json({
            error: 'Assistant not found in VAPI'
          }, { status: 404 });
        }

        throw new Error(`Failed to update VAPI Assistant: ${error.response?.data?.message || error.message}`);
      }
    } else {
      console.log('[vapi-update/route] No VAPI-related changes detected, skipping VAPI API call');
    }

    // Update agent in database
    const updatedAgent = await prisma.vapiAgent.update({
      where: { id: agentId },
      data: {
        ...(requestData.agentName && { name: requestData.agentName }),
        ...(updatePayload.voice && { voice: updatePayload.voice }),
        ...(updatePayload.model && { model: updatePayload.model }),
        ...(requestData.firstMessage !== undefined && { firstMessage: requestData.firstMessage }),
        ...(requestData.voicemailMessage !== undefined && { voicemailMessage: requestData.voicemailMessage }),
        ...(requestData.endCallMessage !== undefined && { endCallMessage: requestData.endCallMessage }),
        ...(requestData.recordingEnabled !== undefined && { recordingEnabled: requestData.recordingEnabled }),
        ...(requestData.endCallPhrases !== undefined && { endCallPhrases: requestData.endCallPhrases }),
        ...(requestData.publicKey !== undefined && { publicKey: requestData.publicKey }),
        ...(requestData.customerId !== undefined && { customerId: requestData.customerId }),
        updatedAt: new Date(),
        // Only update API key verification status if we actually made VAPI changes
        ...(hasVapiChanges && {
          apiKeyLastVerified: new Date(),
          apiKeyStatus: 'valid',
        }),
      },
    });

    console.log('[vapi-update/route] Agent updated in database:', updatedAgent.id);

    // Update knowledge base mappings if provided
    if (requestData.knowledgeBaseIds !== undefined && requestData.customerId) {
      try {
        // Delete existing mappings for this agent
        await prisma.knowledgeBaseProviderMapping.deleteMany({
          where: {
            providerKnowledgeBaseId: agentId,
            provider: 'vapi',
            partnerId: partnerId,
          },
        });

        // Create new mappings
        if (requestData.knowledgeBaseIds.length > 0) {
          const knowledgeBaseMappings = requestData.knowledgeBaseIds.map(kbId => ({
            knowledgeBaseId: kbId,
            partnerId: partnerId,
            customerId: requestData.customerId!,
            provider: 'vapi',
            providerKnowledgeBaseId: agentId,
          }));

          await prisma.knowledgeBaseProviderMapping.createMany({
            data: knowledgeBaseMappings,
            skipDuplicates: true,
          });
        }

        console.log(`[vapi-update/route] Updated knowledge base mappings: ${requestData.knowledgeBaseIds.length} mappings`);
      } catch (error) {
        console.error('[vapi-update/route] Error updating knowledge base mappings:', error);
        // Don't fail the entire request for this
      }
    }

    // Update function call mappings if provided
    if (requestData.functionCalls !== undefined && requestData.customerId) {
      try {
        // Delete existing function calls for this agent
        await prisma.agentFunctionCall.deleteMany({
          where: {
            agentId: agentId,
            partnerId: partnerId,
          },
        });

        // Create new function calls
        if (requestData.functionCalls.length > 0) {
          const functionCallMappings = requestData.functionCalls.map(fc => ({
            agentId: agentId,
            partnerId: partnerId,
            customerId: requestData.customerId!,
            appName: fc.appName,
            toolName: fc.toolName,
            customName: fc.customName,
            customDescription: fc.customDescription,
            securityToken: Math.random().toString(36).substring(2, 15), // Generate random token
            webhookUrl: fc.webhookUrl || `${process.env.NEXT_PUBLIC_APP_URL}/api/webhooks/function-calls`,
            isActive: fc.isConfigured || true,
          }));

          await prisma.agentFunctionCall.createMany({
            data: functionCallMappings,
            skipDuplicates: true,
          });
        }

        console.log(`[vapi-update/route] Updated function call mappings: ${requestData.functionCalls.length} mappings`);
      } catch (error) {
        console.error('[vapi-update/route] Error updating function call mappings:', error);
        // Don't fail the entire request for this
      }
    }

    // Return the updated agent
    return NextResponse.json({
      success: true,
      agent: {
        id: updatedAgent.id,
        name: updatedAgent.name,
        voice: updatedAgent.voice,
        model: updatedAgent.model,
        firstMessage: updatedAgent.firstMessage,
        voicemailMessage: updatedAgent.voicemailMessage,
        endCallMessage: updatedAgent.endCallMessage,
        recordingEnabled: updatedAgent.recordingEnabled,
        clientMessages: updatedAgent.clientMessages,
        serverMessages: updatedAgent.serverMessages,
        endCallPhrases: updatedAgent.endCallPhrases,
        isServerUrlSecretSet: updatedAgent.isServerUrlSecretSet,
        importedAt: updatedAgent.importedAt,
        lastSyncedAt: updatedAgent.lastSyncedAt,
        createdAt: updatedAgent.createdAt,
        updatedAt: updatedAgent.updatedAt,
        isActive: updatedAgent.isActive,
        profitMultiplier: updatedAgent.profitMultiplier,
        apiKeyStatus: updatedAgent.apiKeyStatus,
        apiKeyLastVerified: updatedAgent.apiKeyLastVerified,
        usingPartnerKey: usingPartnerKey,
        hasPartnerKeyFallback: !!existingAgent.partner.vapiApiKey,
        // Additional info about updated mappings
        customerId: updatedAgent.customerId,
        knowledgeBaseCount: requestData.knowledgeBaseIds?.length || 0,
        functionCallCount: requestData.functionCalls?.length || 0
      }
    });

  } catch (error: any) {
    console.error('[vapi-update/route] Error updating VAPI agent:', error);

    // Handle specific error types
    if (error.message.includes('Invalid VAPI API key')) {
      return NextResponse.json({
        error: 'invalid_api_key',
        message: 'Your VAPI API key appears to be invalid.',
      }, { status: 401 });
    }

    return NextResponse.json({
      error: 'Failed to update agent',
      message: error.message || 'An unexpected error occurred'
    }, { status: 500 });
  }
}
