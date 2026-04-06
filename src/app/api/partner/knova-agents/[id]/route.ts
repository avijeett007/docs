import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import jwt from 'jsonwebtoken';

// Helper function to process tool definitions and generate security tokens
async function processToolDefinitionsWithSecurityTokens(
  toolDefinitions: string | null,
  partnerId: string,
  customerId: string | null
): Promise<string | null> {
  if (!toolDefinitions) return null;

  const connectHubUrl = process.env.CONNECT_HUB_URL || 'http://localhost:3001';

  try {
    const tools = JSON.parse(toolDefinitions);
    if (!Array.isArray(tools) || tools.length === 0) {
      return toolDefinitions;
    }

    const processedTools = [];

    for (const tool of tools) {
      // Skip if it's a built-in tool (like end_call) or already has a valid security token
      // For edit mode, we may want to regenerate tokens, but keep existing ones if valid
      if (tool.appName === 'retell' || tool.appName === 'knova') {
        processedTools.push(tool);
        continue;
      }

      // Check if token exists and is not expired
      if (tool.securityToken && tool.tokenExpiresAt) {
        const expiresAt = new Date(tool.tokenExpiresAt);
        const now = new Date();
        // If token expires in more than 30 days, keep it
        const thirtyDaysFromNow = new Date();
        thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);

        if (expiresAt > thirtyDaysFromNow) {
          processedTools.push(tool);
          continue;
        }
      }

      // Generate new security token for tools that need it
      try {
        const tokenResponse = await fetch(`${connectHubUrl}/api/tokens/generate`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${process.env.CONNECT_HUB_API_KEY || ''}`
          },
          body: JSON.stringify({
            partnerId,
            customerId: customerId || partnerId,
            appName: tool.appName,
            toolName: tool.toolName,
            options: {
              expiresIn: 31536000, // 1 year in seconds
              usageLimit: 10000
            }
          })
        });

        if (tokenResponse.ok) {
          const tokenData = await tokenResponse.json();
          const securityToken = tokenData.token;
          const webhookUrl = `${connectHubUrl}/api/dynamic/${partnerId}/${customerId || partnerId}/${tool.appName}/${tool.toolName}`;

          processedTools.push({
            ...tool,
            securityToken,
            webhookUrl,
            tokenExpiresAt: tokenData.metadata?.expiresAt || null
          });

          console.log(`[KnovaAgents] Generated/renewed security token for ${tool.appName}/${tool.toolName}`);
        } else {
          console.error(`[KnovaAgents] Failed to generate token for ${tool.appName}/${tool.toolName}`);
          processedTools.push(tool);
        }
      } catch (tokenError) {
        console.error(`[KnovaAgents] Error generating token for ${tool.appName}/${tool.toolName}:`, tokenError);
        processedTools.push(tool);
      }
    }

    return JSON.stringify(processedTools);
  } catch (parseError) {
    console.error('[KnovaAgents] Failed to parse toolDefinitions:', parseError);
    return toolDefinitions;
  }
}

// Agent Mode to LLM Provider/Model mapping from environment variables
function getAgentModeLlmConfig(agentMode: string) {
  const modeConfigs: Record<string, { provider: string; model: string }> = {
    essential: {
      provider: process.env.KNOVA_ESSENTIAL_PROVIDER || 'cerebras',
      model: process.env.KNOVA_ESSENTIAL_MODEL || 'llama-3.3-70b'
    },
    moderate: {
      provider: process.env.KNOVA_MODERATE_PROVIDER || 'openrouter',
      model: process.env.KNOVA_MODERATE_MODEL || 'google/gemini-2.0-flash-001'
    },
    premium: {
      provider: process.env.KNOVA_PREMIUM_PROVIDER || 'openrouter',
      model: process.env.KNOVA_PREMIUM_MODEL || 'anthropic/claude-3.5-haiku'
    }
  };

  return modeConfigs[agentMode] || modeConfigs.moderate;
}

// Helper function to invalidate cache for all phone numbers assigned to an agent
async function invalidateAgentPhoneCache(agentId: string): Promise<void> {
  try {
    // Find all phone numbers assigned to this Knova agent
    const agentMappings = await prisma.agentPhoneMapping.findMany({
      where: {
        agentId: agentId,
        agentProvider: 'knova',
        status: 'active'
      },
      include: {
        phoneNumber: {
          select: {
            phoneNumber: true
          }
        }
      }
    });

    if (agentMappings.length === 0) {
      console.log('[KnovaAgents PUT] No phone numbers assigned to agent, skipping cache invalidation');
      return;
    }

    const connectHubUrl = process.env.CONNECT_HUB_URL || 'http://localhost:3001';
    const agentValidationKey = process.env.AGENT_VALIDATION_KEY;

    if (!agentValidationKey) {
      console.warn('[KnovaAgents PUT] AGENT_VALIDATION_KEY not set, skipping cache invalidation');
      return;
    }

    // Invalidate cache for each phone number
    for (const mapping of agentMappings) {
      const phoneNumber = mapping.phoneNumber?.phoneNumber;
      if (!phoneNumber) continue;

      try {
        const response = await fetch(`${connectHubUrl}/agent-config/invalidate`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-agent-validation-key': agentValidationKey
          },
          body: JSON.stringify({ phoneNumber })
        });

        if (response.ok) {
          console.log('[KnovaAgents PUT] Cache invalidated for phone number:', phoneNumber.substring(0, 6) + '***');
        } else {
          console.warn('[KnovaAgents PUT] Failed to invalidate cache for phone number:', phoneNumber.substring(0, 6) + '***', response.status);
        }
      } catch (error) {
        console.error('[KnovaAgents PUT] Error invalidating cache for phone number:', phoneNumber.substring(0, 6) + '***', error);
      }
    }
  } catch (error) {
    console.error('[KnovaAgents PUT] Error in invalidateAgentPhoneCache:', error);
    // Don't throw - cache invalidation failure shouldn't fail the update
  }
}

// Helper function to verify partner token
async function verifyPartnerToken(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  const cookieHeader = request.headers.get('cookie');
  
  let token = null;
  
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.substring(7);
  } else if (cookieHeader) {
    const cookies = cookieHeader.split(';').reduce((acc, cookie) => {
      const [key, value] = cookie.trim().split('=');
      acc[key] = value;
      return acc;
    }, {} as Record<string, string>);
    token = cookies.partner_token;
  }

  if (!token) {
    throw new Error('No token provided');
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as any;
    const partner = await prisma.partner.findUnique({
      where: { id: decoded.partnerId }
    });

    if (!partner) {
      throw new Error('Partner not found');
    }

    return partner;
  } catch (error) {
    throw new Error('Invalid token');
  }
}

// GET /api/partner/knova-agents/[id] - Get a specific Knova agent
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const partner = await verifyPartnerToken(request);
    const { id } = params;

    const agent = await prisma.knovaAgent.findFirst({
      where: {
        id,
        partnerId: partner.id
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

    if (!agent) {
      return NextResponse.json(
        { error: 'Agent not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(agent);
  } catch (error) {
    console.error('Error fetching Knova agent:', error);
    return NextResponse.json(
      { error: 'Failed to fetch agent' },
      { status: 500 }
    );
  }
}

// PUT /api/partner/knova-agents/[id] - Update a Knova agent
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const partner = await verifyPartnerToken(request);
    const { id } = params;
    const body = await request.json();

    // Check if agent exists and belongs to partner
    const existingAgent = await prisma.knovaAgent.findFirst({
      where: {
        id,
        partnerId: partner.id
      }
    });

    if (!existingAgent) {
      return NextResponse.json(
        { error: 'Agent not found' },
        { status: 404 }
      );
    }

    const {
      name,
      customerId,
      agentType,
      communicationChannel,
      systemPrompt,
      greetingMessage,
      language,
      voiceConfig,
      llmConfig,
      businessHours,
      productServices,
      knowledgeBaseIds,
      integrationIds,
      advancedConfig,
      widgetConfig,
      sipConfig,
      backchannelConfig,
      speechConfig,
      voicemailConfig,
      backgroundAudioConfig,
      toolDefinitions,
      recordingEnabled,
      isActive,
      status
    } = body;

    // Validate customer belongs to partner if provided
    if (customerId) {
      const customer = await prisma.customer.findFirst({
        where: {
          id: customerId,
          userOnboarding: {
            some: {
              partnerId: partner.id
            }
          }
        }
      });

      if (!customer) {
        return NextResponse.json(
          { error: 'Customer not found or does not belong to this partner' },
          { status: 400 }
        );
      }
    }

    // Process llmConfig - map agentMode to actual provider/model
    let processedLlmConfig = llmConfig;
    if (llmConfig && llmConfig.agentMode) {
      const { provider, model } = getAgentModeLlmConfig(llmConfig.agentMode);
      processedLlmConfig = {
        ...llmConfig,
        provider,
        model
      };
    }

    // Process tool definitions and generate/renew security tokens (1 year expiry)
    let processedToolDefinitions = toolDefinitions;
    if (toolDefinitions !== undefined) {
      // Determine the customer ID to use (new one or existing)
      const customerIdForToken = customerId !== undefined ? customerId : existingAgent.customerId;
      processedToolDefinitions = await processToolDefinitionsWithSecurityTokens(
        toolDefinitions,
        partner.id,
        customerIdForToken
      );

      console.log('[KnovaAgents PUT] Tool definitions processed:', {
        original: toolDefinitions?.substring(0, 100),
        processed: processedToolDefinitions?.substring(0, 100),
        hasSecurityTokens: processedToolDefinitions?.includes('securityToken')
      });
    }

    const updatedAgent = await prisma.knovaAgent.update({
      where: { id },
      data: {
        ...(name !== undefined && { name }),
        ...(customerId !== undefined && { customerId }),
        ...(agentType !== undefined && { agentType }),
        ...(communicationChannel !== undefined && { communicationChannel }),
        ...(systemPrompt !== undefined && { systemPrompt }),
        ...(greetingMessage !== undefined && { greetingMessage }),
        ...(language !== undefined && { language }),
        ...(voiceConfig !== undefined && { voiceConfig }),
        ...(processedLlmConfig !== undefined && { llmConfig: processedLlmConfig }),
        ...(businessHours !== undefined && { businessHours }),
        ...(productServices !== undefined && { productServices }),
        ...(knowledgeBaseIds !== undefined && { knowledgeBaseIds }),
        ...(integrationIds !== undefined && { integrationIds }),
        ...(advancedConfig !== undefined && { advancedConfig }),
        ...(widgetConfig !== undefined && { widgetConfig }),
        ...(sipConfig !== undefined && { sipConfig }),
        ...(backchannelConfig !== undefined && { backchannelConfig }),
        ...(speechConfig !== undefined && { speechConfig }),
        ...(voicemailConfig !== undefined && { voicemailConfig }),
        ...(backgroundAudioConfig !== undefined && { backgroundAudioConfig }),
        ...(processedToolDefinitions !== undefined && { toolDefinitions: processedToolDefinitions }),
        ...(recordingEnabled !== undefined && { recordingEnabled }),
        ...(isActive !== undefined && { isActive }),
        ...(status !== undefined && { status })
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

    // Invalidate cache for all phone numbers assigned to this agent
    await invalidateAgentPhoneCache(id);

    return NextResponse.json(updatedAgent);
  } catch (error) {
    console.error('Error updating Knova agent:', error);
    return NextResponse.json(
      { error: 'Failed to update agent' },
      { status: 500 }
    );
  }
}

// DELETE /api/partner/knova-agents/[id] - Delete a Knova agent
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const partner = await verifyPartnerToken(request);
    const { id } = params;

    // Check if agent exists and belongs to partner
    const existingAgent = await prisma.knovaAgent.findFirst({
      where: {
        id,
        partnerId: partner.id
      }
    });

    if (!existingAgent) {
      return NextResponse.json(
        { error: 'Agent not found' },
        { status: 404 }
      );
    }

    await prisma.knovaAgent.delete({
      where: { id }
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting Knova agent:', error);
    return NextResponse.json(
      { error: 'Failed to delete agent' },
      { status: 500 }
    );
  }
}
