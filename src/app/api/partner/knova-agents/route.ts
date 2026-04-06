import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import jwt from 'jsonwebtoken';
import { registerAgentInAnalytics, generateWebhookUrl } from '@/lib/analytics';

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
      // Skip if it's a built-in tool (like end_call) or already has a security token
      if (tool.appName === 'retell' || tool.appName === 'knova' || tool.securityToken) {
        processedTools.push(tool);
        continue;
      }

      // Generate security token for external tools
      try {
        const tokenResponse = await fetch(`${connectHubUrl}/api/tokens/generate`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${process.env.CONNECT_HUB_API_KEY || ''}`
          },
          body: JSON.stringify({
            partnerId,
            customerId: customerId || partnerId, // Use partnerId as fallback if no customer
            appName: tool.appName,
            toolName: tool.toolName,
            options: {
              expiresIn: 31536000, // 1 year in seconds
              usageLimit: 10000   // High limit for agent function calls
            }
          })
        });

        if (tokenResponse.ok) {
          const tokenData = await tokenResponse.json();
          const securityToken = tokenData.token;

          // Generate webhook URL
          const webhookUrl = `${connectHubUrl}/api/dynamic/${partnerId}/${customerId || partnerId}/${tool.appName}/${tool.toolName}`;

          // Add security token and webhook URL to the tool
          processedTools.push({
            ...tool,
            securityToken,
            webhookUrl,
            tokenExpiresAt: tokenData.metadata?.expiresAt || null
          });

          console.log(`[KnovaAgents] Generated security token for ${tool.appName}/${tool.toolName}`);
        } else {
          console.error(`[KnovaAgents] Failed to generate token for ${tool.appName}/${tool.toolName}:`, await tokenResponse.text());
          // Still include the tool, just without the security token
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
    return toolDefinitions; // Return original if parsing fails
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

// GET /api/partner/knova-agents - List all Knova agents for a partner
export async function GET(request: NextRequest) {
  try {
    const partner = await verifyPartnerToken(request);

    const agents = await prisma.knovaAgent.findMany({
      where: {
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
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    return NextResponse.json(agents);
  } catch (error) {
    console.error('Error fetching Knova agents:', error);
    return NextResponse.json(
      { error: 'Failed to fetch agents' },
      { status: 500 }
    );
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

// POST /api/partner/knova-agents - Create a new Knova agent
export async function POST(request: NextRequest) {
  try {
    const partner = await verifyPartnerToken(request);
    const body = await request.json();

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
      metadataValues
    } = body;

    console.log('[KnovaAgents POST] Received body keys:', Object.keys(body));
    console.log('[KnovaAgents POST] toolDefinitions value:', toolDefinitions);
    console.log('[KnovaAgents POST] toolDefinitions type:', typeof toolDefinitions);
    console.log('[KnovaAgents POST] toolDefinitions length:', toolDefinitions?.length);

    // Validate required fields
    if (!name || !agentType || !communicationChannel) {
      return NextResponse.json(
        { error: 'Missing required fields: name, agentType, communicationChannel' },
        { status: 400 }
      );
    }

    // Validate customer belongs to partner if provided
    if (customerId) {
      const customer = await prisma.customer.findFirst({
        where: {
          id: customerId,
          credentials: {
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

    // Process tool definitions and generate security tokens (1 year expiry)
    const processedToolDefinitions = await processToolDefinitionsWithSecurityTokens(
      toolDefinitions,
      partner.id,
      customerId || null
    );

    console.log('[KnovaAgents POST] Tool definitions processed:', {
      original: toolDefinitions?.substring(0, 100),
      processed: processedToolDefinitions?.substring(0, 100),
      hasSecurityTokens: processedToolDefinitions?.includes('securityToken')
    });

    // Generate unique ID for the agent
    const agentId = `knova_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    const agent = await prisma.knovaAgent.create({
      data: {
        id: agentId,
        partnerId: partner.id,
        customerId: customerId || null,
        name,
        agentType,
        communicationChannel,
        systemPrompt: systemPrompt || null,
        greetingMessage: greetingMessage || null,
        language: language || 'en-US',
        voiceConfig: voiceConfig || null,
        llmConfig: processedLlmConfig || null,
        businessHours: businessHours || null,
        productServices: productServices || null,
        knowledgeBaseIds: knowledgeBaseIds || [],
        integrationIds: integrationIds || [],
        advancedConfig: advancedConfig || null,
        widgetConfig: widgetConfig || null,
        sipConfig: sipConfig || null,
        backchannelConfig: backchannelConfig || null,
        speechConfig: speechConfig || null,
        voicemailConfig: voicemailConfig || null,
        backgroundAudioConfig: backgroundAudioConfig || null,
        toolDefinitions: processedToolDefinitions,
        metadataValues: metadataValues || null,
        recordingEnabled: true,
        isActive: true,
        status: 'active',
        profitMultiplier: 1.2
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

    console.log('[KnovaAgents POST] Agent created successfully:', {
      id: agent.id,
      name: agent.name,
      toolDefinitions: agent.toolDefinitions,
      toolDefinitionsLength: agent.toolDefinitions?.length
    });

    // Register the agent with the analytics service
    try {
      const analyticsResult = await registerAgentInAnalytics({
        agentId: agent.id,
        provider: 'knova',
        partnerId: partner.id,
        agentName: agent.name,
        customerId: agent.customerId || undefined,
        profitMultiplier: agent.profitMultiplier,
      });

      if (analyticsResult.success && analyticsResult.analyticsAgentId) {
        // Generate the webhook URL
        const webhookUrl = generateWebhookUrl({
          provider: 'knova',
          analyticsAgentId: analyticsResult.analyticsAgentId,
        });

        // Update the agent with analytics info
        await prisma.knovaAgent.update({
          where: { id: agent.id },
          data: {
            analyticsAgentId: analyticsResult.analyticsAgentId,
            webhookUrl,
          },
        });

        console.log('[KnovaAgents POST] Agent registered with analytics:', {
          analyticsAgentId: analyticsResult.analyticsAgentId,
          webhookUrl,
        });

        // Return agent with analytics info
        return NextResponse.json({
          ...agent,
          analyticsAgentId: analyticsResult.analyticsAgentId,
          webhookUrl,
        }, { status: 201 });
      }
    } catch (analyticsError) {
      console.error('[KnovaAgents POST] Failed to register with analytics (non-blocking):', analyticsError);
      // Continue without analytics - agent is still created
    }

    return NextResponse.json(agent, { status: 201 });
  } catch (error) {
    console.error('Error creating Knova agent:', error);
    return NextResponse.json(
      { error: 'Failed to create agent' },
      { status: 500 }
    );
  }
}
