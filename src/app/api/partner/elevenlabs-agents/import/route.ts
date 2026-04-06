import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyPartnerJWT } from '@/lib/auth';
import { registerAgentInAnalytics } from '@/lib/analytics';
import { encrypt } from '@/lib/encryption';

/**
 * GET /api/partner/elevenlabs-agents/import
 * Fetch available agents from ElevenLabs platform
 */
export async function GET(request: NextRequest) {
  try {
    // Verify the partner JWT token
    const decoded = await verifyPartnerJWT(request);
    if (!decoded || !decoded.payload || !decoded.isValid) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const partnerId = decoded.payload.partnerId;
    const apiKey = request.headers.get('X-API-Key');

    if (!apiKey) {
      return NextResponse.json({ error: 'ElevenLabs API key is required' }, { status: 400 });
    }

    // Get existing agents for this partner to check for duplicates
    const existingAgents = await prisma.elevenLabsAgent.findMany({
      where: { partnerId },
      select: { id: true }
    });
    const existingAgentIds = new Set(existingAgents.map(agent => agent.id).filter(Boolean));

    // Fetch agents from ElevenLabs API
    const response = await fetch('https://api.elevenlabs.io/v1/convai/agents', {
      headers: {
        'xi-api-key': apiKey,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('ElevenLabs API error:', response.status, errorText);
      
      if (response.status === 401) {
        return NextResponse.json({ error: 'Invalid ElevenLabs API key' }, { status: 401 });
      }
      
      return NextResponse.json({ 
        error: `Failed to fetch agents from ElevenLabs: ${response.status}` 
      }, { status: response.status });
    }

    const data = await response.json();
    const agents = data.agents || [];

    // Transform agents to our format
    const importableAgents = agents.map((agent: any) => ({
      id: agent.agent_id,
      name: agent.name || 'Unnamed Agent',
      status: 'active',
      lastModified: agent.created_at || new Date().toISOString(),
      alreadyImported: existingAgentIds.has(agent.agent_id),
      details: {
        voiceId: agent.conversation_config?.tts?.voice_id,
        language: agent.conversation_config?.agent?.language || 'en',
        conversationConfig: agent.conversation_config
      }
    }));

    return NextResponse.json({
      success: true,
      agents: importableAgents,
      totalCount: importableAgents.length,
      availableForImport: importableAgents.filter((agent: any) => !agent.alreadyImported).length
    });

  } catch (error) {
    console.error('Error fetching ElevenLabs agents:', error);
    return NextResponse.json(
      { error: 'Failed to fetch agents from ElevenLabs' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/partner/elevenlabs-agents/import
 * Import selected agents from ElevenLabs platform
 */
export async function POST(request: NextRequest) {
  try {
    // Verify the partner JWT token
    const decoded = await verifyPartnerJWT(request);
    if (!decoded || !decoded.payload || !decoded.isValid) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const partnerId = decoded.payload.partnerId;
    const body = await request.json();
    const { apiKey, agents } = body;

    if (!apiKey || !agents || !Array.isArray(agents)) {
      return NextResponse.json({ 
        error: 'API key and agents array are required' 
      }, { status: 400 });
    }

    // Encrypt the API key for storage
    const encryptedApiKey = await encrypt(apiKey);

    const results = [];

    for (const agentConfig of agents) {
      const result = {
        agentId: agentConfig.id,
        success: false,
        error: null as string | null
      };

      try {
        // Fetch agent details from ElevenLabs
        const response = await fetch(`https://api.elevenlabs.io/v1/convai/agents/${agentConfig.id}`, {
          headers: {
            'xi-api-key': apiKey,
            'Content-Type': 'application/json'
          }
        });

        if (!response.ok) {
          result.error = `Failed to fetch agent details: ${response.status}`;
          results.push(result);
          continue;
        }

        const agentData = await response.json();

        // Check if agent already exists
        const existingAgent = await prisma.elevenLabsAgent.findFirst({
          where: {
            partnerId,
            id: agentConfig.id
          }
        });

        if (existingAgent) {
          result.error = 'Agent already imported';
          results.push(result);
          continue;
        }

        // Create agent in database using ElevenLabs agent ID as primary key
        const newAgent = await prisma.elevenLabsAgent.create({
          data: {
            id: agentData.agent_id, // Use ElevenLabs agent ID directly as primary key
            partnerId,
            name: agentData.name || 'Imported Agent',
            conversationConfig: agentData.conversation_config || null,
            systemPrompt: agentData.conversation_config?.agent?.prompt?.prompt || null,
            llmModel: agentData.conversation_config?.agent?.prompt?.llm || null,
            temperature: agentData.conversation_config?.agent?.prompt?.temperature || 0.0,
            voiceId: agentData.conversation_config?.tts?.voice_id || null,
            language: agentData.conversation_config?.agent?.language || 'en',
            maxDurationSeconds: agentData.conversation_config?.conversation?.max_duration_seconds || null,
            profitMultiplier: 1.2,
            webhookEnabled: agentConfig.enableWebhook || false,
            webhookMode: agentConfig.webhookMode || 'manual',
            forwardToPreExisting: agentConfig.forwardToPreExisting || true,
            importedAt: new Date(),
            lastSyncedAt: new Date(),
            isActive: true,
            // Store encrypted API key
            apiKey: encryptedApiKey,
            apiKeyStatus: 'valid',
            apiKeyLastVerified: new Date()
          }
        });

        // Register agent in analytics service
        try {
          const analyticsResult = await registerAgentInAnalytics({
            agentId: newAgent.id, // Now using the ElevenLabs agent ID directly
            provider: 'elevenlabs',
            partnerId,
            agentName: newAgent.name,
            profitMultiplier: newAgent.profitMultiplier
          });

          if (analyticsResult.success && analyticsResult.analyticsAgentId) {
            // Update agent with analytics ID
            await prisma.elevenLabsAgent.update({
              where: { id: newAgent.id },
              data: { analyticsAgentId: analyticsResult.analyticsAgentId }
            });
          }
        } catch (analyticsError) {
          console.error('Failed to register agent in analytics:', analyticsError);
          // Continue - don't fail the import
        }

        result.success = true;
        results.push(result);

      } catch (error) {
        console.error(`Error importing agent ${agentConfig.id}:`, error);
        result.error = error instanceof Error ? error.message : 'Unknown error';
        results.push(result);
      }
    }

    const successful = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;

    return NextResponse.json({
      success: true,
      message: `Import completed: ${successful} successful, ${failed} failed`,
      results,
      summary: {
        total: results.length,
        successful,
        failed
      }
    });

  } catch (error) {
    console.error('Error importing ElevenLabs agents:', error);
    return NextResponse.json(
      { error: 'Failed to import agents' },
      { status: 500 }
    );
  }
}
