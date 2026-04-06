import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyPartnerJWT } from '@/lib/auth';
import { encrypt, decrypt } from '@/lib/encryption';
import { addTrackingToSystemPrompt } from '@/lib/ultravox-tracking';
import { TierValidationService, AgentProvider } from '@/lib/services/tierValidationService';



export const dynamic = 'force-dynamic';

// Function to register agent with analytics service
async function registerAgentWithAnalytics(agentId: string, provider: string, partnerId: string, customerId: string | null, agentName: string) {
  try {
    const analyticsApiKey = process.env.ANALYTICS_STANDARD_API_KEY;
    if (!analyticsApiKey) {
      console.warn('ANALYTICS_STANDARD_API_KEY not set, skipping analytics registration');
      return false;
    }

    const response = await fetch(`${process.env.ANALYTICS_API_URL || 'http://localhost:8001'}/agents/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': analyticsApiKey,
      },
      body: JSON.stringify({
        agent_id: agentId,
        provider: provider,
        partner_id: partnerId,
        customer_id: customerId,
        agent_name: agentName,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Failed to register agent ${agentId} with analytics:`, response.status, errorText);
      return false;
    }

    const result = await response.json();
    console.log(`Successfully registered agent ${agentId} with analytics:`, result.message);
    return true;
  } catch (error) {
    console.error(`Error registering agent ${agentId} with analytics:`, error);
    return false;
  }
}

interface ImportAgentRequest {
  apiKey: string;
  provider: 'vapi' | 'retell' | 'ultravox';
  agents: {
    id: string;
    enableWebhook: boolean;
    webhookMode: 'manual' | 'automatic';
    preExistingWebhookUrl?: string;
    forwardToPreExisting?: boolean;
  }[];
}

interface ImportResult {
  agentId: string;
  success: boolean;
  error?: string;
  webhookConfigured?: boolean;
  webhookError?: string;
}

// Import selected agents from provider
export async function POST(request: NextRequest) {
  try {
    // Verify JWT and get partner
    const auth = await verifyPartnerJWT(request);
    if (!auth.isValid) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const partnerId = auth.payload?.partnerId;
    if (!partnerId) {
      return NextResponse.json(
        { error: 'Invalid partner ID' },
        { status: 401 }
      );
    }

    // Parse request body
    const body = await request.json();
    const { apiKey, provider, agents }: ImportAgentRequest = body;

    if (!apiKey || !provider || !agents || agents.length === 0) {
      return NextResponse.json(
        { error: 'API key, provider, and agents list are required' },
        { status: 400 }
      );
    }

    console.log(`Starting import of ${agents.length} ${provider} agents for partner ${partnerId}`);

    // Validate tier limits before importing
    const validation = await TierValidationService.validateAgentCreation(partnerId, provider as AgentProvider);

    if (!validation.allowed) {
      console.warn(`❌ Agent import blocked for partner ${partnerId}: tier limit exceeded`);
      return NextResponse.json(
        {
          error: 'Agent limit exceeded',
          message: validation.limit === null
            ? 'No agent limit configured for your tier'
            : `Cannot import agents. You have ${validation.remaining} remaining out of ${validation.limit} allowed ${provider} agents.`,
          validation
        },
        { status: 403 }
      );
    }

    // Check if trying to import more agents than remaining limit allows
    if (validation.remaining !== null && agents.length > validation.remaining) {
      console.warn(`❌ Agent import blocked for partner ${partnerId}: trying to import ${agents.length} agents but only ${validation.remaining} remaining`);
      return NextResponse.json(
        {
          error: 'Import count exceeds limit',
          message: `Cannot import ${agents.length} agents. You have ${validation.remaining} remaining out of ${validation.limit} allowed ${provider} agents.`,
          validation
        },
        { status: 403 }
      );
    }

    console.log(`✅ Tier validation passed for partner ${partnerId}: ${validation.remaining === null ? 'unlimited' : validation.remaining + ' remaining'}`);

    const results: ImportResult[] = [];
    const encryptedApiKey = await encrypt(apiKey);

    for (const agentConfig of agents) {
      const result: ImportResult = {
        agentId: agentConfig.id,
        success: false
      };

      try {
        // Fetch agent details from provider
        const agentDetails = await fetchAgentDetails(apiKey, provider, agentConfig.id);
        
        if (!agentDetails) {
          result.error = 'Agent not found in provider';
          results.push(result);
          continue;
        }

        // Import the agent
        if (provider === 'vapi') {
          await importVapiAgent(partnerId, agentDetails, encryptedApiKey);
        } else if (provider === 'retell') {
          await importRetellAgent(partnerId, agentDetails, encryptedApiKey);
        } else if (provider === 'ultravox') {
          await importUltravoxAgent(partnerId, agentDetails, encryptedApiKey);
        }

        result.success = true;

        // Configure webhook if requested
        if (agentConfig.enableWebhook) {
          try {
            const webhookResult = await configureWebhook(
              agentConfig.id,
              provider,
              agentConfig.webhookMode,
              agentConfig.preExistingWebhookUrl,
              agentConfig.forwardToPreExisting
            );
            result.webhookConfigured = webhookResult.success;
            if (!webhookResult.success) {
              result.webhookError = 'Failed to configure webhook';
            }
          } catch (webhookError) {
            result.webhookConfigured = false;
            result.webhookError = webhookError instanceof Error ? webhookError.message : 'Webhook configuration failed';
          }
        }

        console.log(`✅ Successfully imported ${provider} agent ${agentConfig.id}`);

      } catch (error) {
        result.error = error instanceof Error ? error.message : 'Unknown error';
        console.error(`❌ Failed to import ${provider} agent ${agentConfig.id}:`, error);
      }

      results.push(result);
    }

    const successful = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;

    return NextResponse.json({
      success: true,
      summary: {
        total: agents.length,
        successful,
        failed,
        successRate: Math.round((successful / agents.length) * 100)
      },
      results
    });

  } catch (error) {
    console.error('Error in agent import:', error);
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}

async function fetchAgentDetails(apiKey: string, provider: 'vapi' | 'retell' | 'ultravox', agentId: string) {
  if (provider === 'vapi') {
    const response = await fetch(`https://api.vapi.ai/assistant/${agentId}`, {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Accept': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch VAPI agent: ${response.statusText}`);
    }

    return await response.json();
  } else if (provider === 'retell') {
    const response = await fetch(`https://api.retellai.com/get-agent/${agentId}`, {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Accept': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch Retell agent: ${response.statusText}`);
    }

    return await response.json();
  } else if (provider === 'ultravox') {
    const response = await fetch(`https://api.ultravox.ai/api/agents/${agentId}`, {
      headers: {
        'X-API-Key': apiKey,
        'Accept': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch Ultravox agent: ${response.statusText}`);
    }

    const data = await response.json();

    // Transform Ultravox agent data to our format
    return {
      agentId: data.agentId,
      name: data.name || 'Imported Agent',
      systemPrompt: data.callTemplate?.systemPrompt || 'You are a helpful AI assistant.',
      model: data.callTemplate?.model || 'fixie-ai/ultravox',
      voice: data.callTemplate?.voice || null,
      temperature: data.callTemplate?.temperature || 0.7,
      languageHint: data.callTemplate?.languageHint || 'en-US',
      recordingEnabled: data.callTemplate?.recordingEnabled || false,
      maxDuration: data.callTemplate?.maxDuration || '3600s',
      timeExceededMessage: data.callTemplate?.timeExceededMessage || null,
      created: data.created,
      statistics: data.statistics
    };
  }
}

async function importVapiAgent(partnerId: string, agentDetails: any, encryptedApiKey: string) {
  // Calculate historical data date range (30 days back from now)
  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - (30 * 24 * 60 * 60 * 1000));

  // First, create the agent record without historical processing flags
  const createdAgent = await prisma.vapiAgent.create({
    data: {
      id: agentDetails.id,
      partner: {
        connect: { id: partnerId }
      },
      name: agentDetails.name || 'Imported Agent',
      voice: agentDetails.voice || {},
      model: agentDetails.model || {},
      firstMessage: agentDetails.firstMessage || '',
      voicemailMessage: agentDetails.voicemailMessage || '',
      endCallMessage: agentDetails.endCallMessage || '',
      recordingEnabled: agentDetails.recordingEnabled ?? true,
      clientMessages: agentDetails.clientMessages || [],
      serverMessages: agentDetails.serverMessages || [],
      endCallPhrases: agentDetails.endCallPhrases || [],
      isServerUrlSecretSet: agentDetails.isServerUrlSecretSet ?? false,
      importedAt: new Date(),
      lastSyncedAt: new Date(),
      createdAt: new Date(agentDetails.createdAt || Date.now()),
      updatedAt: new Date(agentDetails.updatedAt || Date.now()),
      isActive: true,
      profitMultiplier: 1.2,
      // Set agent-level API key
      apiKey: encryptedApiKey,
      apiKeyStatus: 'valid',
      apiKeyLastVerified: new Date(),
      // Historical processing fields will be set after analytics registration
      historicalAnalyticsProcessed: false,
      historicalProcessingStatus: null,
      historicalDataStartDate: null,
      historicalDataEndDate: null,
      historicalCallsProcessed: 0,
      historicalCallsTotal: 0,
    }
  });

  // Register agent with analytics service
  const analyticsRegistered = await registerAgentWithAnalytics(
    agentDetails.id,
    'vapi',
    partnerId,
    null, // customerId - will be set later if needed
    agentDetails.name || 'Imported Agent'
  );

  // Only set historical processing flags if analytics registration was successful
  if (analyticsRegistered) {
    await prisma.vapiAgent.update({
      where: { id: agentDetails.id },
      data: {
        historicalAnalyticsProcessed: false,
        historicalProcessingStatus: 'pending',
        historicalDataStartDate: thirtyDaysAgo,
        historicalDataEndDate: now,
      },
    });
    console.log(`VAPI agent ${agentDetails.id} ready for historical processing`);
  } else {
    console.warn(`VAPI agent ${agentDetails.id} created but not registered with analytics - historical processing disabled`);
  }

  return createdAgent;
}

async function importRetellAgent(partnerId: string, agentDetails: any, encryptedApiKey: string) {
  // Calculate historical data date range (30 days back from now)
  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - (30 * 24 * 60 * 60 * 1000));

  // First, create the agent record without historical processing flags
  const createdAgent = await prisma.retellAgent.create({
    data: {
      id: agentDetails.agent_id,
      partner: {
        connect: { id: partnerId }
      },
      name: agentDetails.agent_name || 'Imported Agent',
      voiceId: agentDetails.voice_id || '',
      voiceModel: agentDetails.voice_model,
      responseEngine: agentDetails.response_engine || {},
      voiceConfig: agentDetails.voice_config || {},
      callConfig: agentDetails.call_config || {},
      webhookUrl: agentDetails.webhook_url,
      language: agentDetails.language || 'en',
      recordingEnabled: true,
      importedAt: new Date(),
      lastSyncedAt: new Date(),
      createdAt: new Date(agentDetails.creation_timestamp || Date.now()),
      updatedAt: new Date(agentDetails.last_modification_timestamp || Date.now()),
      isActive: true,
      profitMultiplier: 1.2,
      // Set agent-level API key
      apiKey: encryptedApiKey,
      apiKeyStatus: 'valid',
      apiKeyLastVerified: new Date(),
      // Historical processing fields will be set after analytics registration
      historicalAnalyticsProcessed: false,
      historicalProcessingStatus: null,
      historicalDataStartDate: null,
      historicalDataEndDate: null,
      historicalCallsProcessed: 0,
      historicalCallsTotal: 0,
    }
  });

  // Register agent with analytics service
  const analyticsRegistered = await registerAgentWithAnalytics(
    agentDetails.agent_id,
    'retell',
    partnerId,
    null, // customerId - will be set later if needed
    agentDetails.agent_name || 'Imported Agent'
  );

  // Only set historical processing flags if analytics registration was successful
  if (analyticsRegistered) {
    await prisma.retellAgent.update({
      where: { id: agentDetails.agent_id },
      data: {
        historicalAnalyticsProcessed: false,
        historicalProcessingStatus: 'pending',
        historicalDataStartDate: thirtyDaysAgo,
        historicalDataEndDate: now,
      },
    });
    console.log(`Retell agent ${agentDetails.agent_id} ready for historical processing`);
  } else {
    console.warn(`Retell agent ${agentDetails.agent_id} created but not registered with analytics - historical processing disabled`);
  }

  return createdAgent;
}

async function importUltravoxAgent(partnerId: string, agentDetails: any, encryptedApiKey: string) {
  // Calculate historical data date range (30 days back from now)
  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - (30 * 24 * 60 * 60 * 1000));

  // First, create the agent record without historical processing flags
  const createdAgent = await prisma.ultravoxAgent.create({
    data: {
      id: agentDetails.agentId,
      partner: {
        connect: { id: partnerId }
      },
      name: agentDetails.name || 'Imported Agent',
      systemPrompt: agentDetails.systemPrompt || 'You are a helpful AI assistant.',
      model: agentDetails.model || 'fixie-ai/ultravox',
      voice: agentDetails.voice,
      temperature: agentDetails.temperature || 0.7,
      languageHint: agentDetails.languageHint || 'en-US',
      recordingEnabled: agentDetails.recordingEnabled ?? false,
      maxDuration: agentDetails.maxDuration || '3600s',
      timeExceededMessage: agentDetails.timeExceededMessage || null,
      importedAt: new Date(),
      lastSyncedAt: new Date(),
      createdAt: new Date(agentDetails.created || Date.now()),
      updatedAt: new Date(),
      isActive: true,
      profitMultiplier: 1.2,
      // Set agent-level API key
      apiKey: encryptedApiKey,
      apiKeyStatus: 'valid',
      apiKeyLastVerified: new Date(),
      // Historical processing fields will be set after analytics registration
      historicalAnalyticsProcessed: false,
      historicalProcessingStatus: null,
      historicalDataStartDate: null,
      historicalDataEndDate: null,
      historicalCallsProcessed: 0,
      historicalCallsTotal: 0,
    }
  });

  // Add tracking identifier to system prompt for webhook identification
  await addTrackingToUltravoxAgent(agentDetails.agentId, encryptedApiKey, createdAgent.id);

  // Register agent with analytics service
  const analyticsRegistered = await registerAgentWithAnalytics(
    agentDetails.agentId,
    'ultravox',
    partnerId,
    null, // customerId - will be set later if needed
    agentDetails.name || 'Imported Agent'
  );

  // Only set historical processing flags if analytics registration was successful
  if (analyticsRegistered) {
    await prisma.ultravoxAgent.update({
      where: { id: agentDetails.agentId },
      data: {
        historicalAnalyticsProcessed: false,
        historicalProcessingStatus: 'pending',
        historicalDataStartDate: thirtyDaysAgo,
        historicalDataEndDate: now,
      },
    });
    console.log(`Ultravox agent ${agentDetails.agentId} ready for historical processing`);
  } else {
    console.warn(`Ultravox agent ${agentDetails.agentId} created but not registered with analytics - historical processing disabled`);
  }

  return createdAgent;
}

// Function to add tracking identifier to Ultravox agent system prompt
async function addTrackingToUltravoxAgent(ultravoxAgentId: string, encryptedApiKey: string, databaseAgentId: string) {
  try {
    // Decrypt API key for use
    const apiKey = await decrypt(encryptedApiKey);

    // Get current agent details
    const response = await fetch(`https://api.ultravox.ai/api/agents/${ultravoxAgentId}`, {
      headers: {
        'X-API-Key': apiKey,
        'Accept': 'application/json'
      }
    });

    if (!response.ok) {
      console.error(`Failed to fetch Ultravox agent ${ultravoxAgentId} for tracking update:`, response.statusText);
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
      console.error(`Failed to update Ultravox agent ${ultravoxAgentId} with tracking:`, updateResponse.statusText);
      return false;
    }

    console.log(`✅ Successfully added tracking identifier to Ultravox agent ${ultravoxAgentId}`);

    // Update our database record with the new system prompt
    await prisma.ultravoxAgent.update({
      where: { id: ultravoxAgentId },
      data: { systemPrompt: updatedSystemPrompt }
    });

    return true;
  } catch (error) {
    console.error(`Error adding tracking to Ultravox agent ${ultravoxAgentId}:`, error);
    return false;
  }
}

async function configureWebhook(
  agentId: string,
  provider: 'vapi' | 'retell' | 'ultravox',
  mode: 'manual' | 'automatic',
  _preExistingWebhookUrl?: string,
  _forwardToPreExisting?: boolean
) {
  // This is a placeholder for webhook configuration
  // In a real implementation, this would:
  // 1. Register the agent with the analytics service
  // 2. Configure the webhook URL with the provider
  // 3. Set up forwarding if needed

  console.log(`Configuring webhook for ${provider} agent ${agentId} in ${mode} mode`);

  // For now, return success
  return {
    success: true,
    webhookUrl: `${process.env.NEXT_PUBLIC_APP_URL}/api/webhooks/${provider}/${agentId}`
  };
}
