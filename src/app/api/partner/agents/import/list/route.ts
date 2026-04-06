import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyPartnerJWT } from '@/lib/auth';

export const dynamic = 'force-dynamic';

interface ListImportableAgentsRequest {
  apiKey: string;
  provider: 'vapi' | 'retell' | 'ultravox';
}

interface ImportableAgent {
  id: string;
  name: string;
  status?: string;
  lastModified?: string;
  alreadyImported: boolean;
  details?: any;
  version?: number;
  is_published?: boolean;
  version_title?: string;
}

// List agents available for import from provider
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
    const { apiKey, provider }: ListImportableAgentsRequest = body;

    if (!apiKey || !provider) {
      return NextResponse.json(
        { error: 'API key and provider are required' },
        { status: 400 }
      );
    }

    // Get existing agents for this partner to check for duplicates
    const existingAgents = await getExistingAgentIds(partnerId, provider);

    // Fetch agents from the provider
    let importableAgents: ImportableAgent[] = [];

    if (provider === 'vapi') {
      importableAgents = await fetchVapiAgents(apiKey, existingAgents);
    } else if (provider === 'retell') {
      importableAgents = await fetchRetellAgents(apiKey, existingAgents);
    } else if (provider === 'ultravox') {
      importableAgents = await fetchUltravoxAgents(apiKey, existingAgents);
    }

    return NextResponse.json({
      success: true,
      provider,
      agents: importableAgents,
      totalCount: importableAgents.length,
      availableForImport: importableAgents.filter(agent => !agent.alreadyImported).length
    });

  } catch (error) {
    console.error('Error listing importable agents:', error);
    
    // Handle specific API errors
    if (error instanceof Error) {
      if (error.message.includes('401') || error.message.includes('Unauthorized')) {
        return NextResponse.json(
          { error: 'Invalid API key' },
          { status: 400 }
        );
      }
      if (error.message.includes('403') || error.message.includes('Forbidden')) {
        return NextResponse.json(
          { error: 'API key does not have required permissions' },
          { status: 400 }
        );
      }
      if (error.message.includes('429')) {
        return NextResponse.json(
          { error: 'Rate limit exceeded. Please try again later.' },
          { status: 429 }
        );
      }
    }

    return NextResponse.json(
      { error: 'Failed to fetch agents from provider' },
      { status: 500 }
    );
  }
}

async function getExistingAgentIds(partnerId: string, provider: 'vapi' | 'retell' | 'ultravox'): Promise<Set<string>> {
  if (provider === 'vapi') {
    const agents = await prisma.vapiAgent.findMany({
      where: { partnerId },
      select: { id: true }
    });
    return new Set(agents.map(agent => agent.id));
  } else if (provider === 'retell') {
    const agents = await prisma.retellAgent.findMany({
      where: { partnerId },
      select: { id: true }
    });
    return new Set(agents.map(agent => agent.id));
  } else {
    const agents = await prisma.ultravoxAgent.findMany({
      where: { partnerId },
      select: { id: true }
    });
    return new Set(agents.map(agent => agent.id));
  }
}

async function fetchVapiAgents(apiKey: string, existingAgents: Set<string>): Promise<ImportableAgent[]> {
  try {
    const response = await fetch('https://api.vapi.ai/assistant', {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Accept': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`VAPI API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    const agents = Array.isArray(data) ? data : (data.data || []);

    return agents.map((agent: any) => ({
      id: agent.id,
      name: agent.name || 'Unnamed Agent',
      status: agent.status || 'unknown',
      lastModified: agent.updatedAt || agent.createdAt,
      alreadyImported: existingAgents.has(agent.id),
      details: {
        voice: agent.voice,
        model: agent.model,
        firstMessage: agent.firstMessage
      }
    }));

  } catch (error) {
    console.error('Error fetching VAPI agents:', error);
    throw error;
  }
}

async function fetchRetellAgents(apiKey: string, existingAgents: Set<string>): Promise<ImportableAgent[]> {
  try {
    const response = await fetch('https://api.retellai.com/list-agents', {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Accept': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`Retell API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    const agents = Array.isArray(data) ? data : (data.agents || []);

    return agents.map((agent: any) => ({
      id: agent.agent_id,
      name: agent.agent_name || 'Unnamed Agent',
      status: 'active', // Retell doesn't provide status
      lastModified: agent.last_modification_timestamp,
      alreadyImported: existingAgents.has(agent.agent_id),
      version: agent.version ?? 0,
      is_published: agent.is_published ?? false,
      version_title: agent.version_title || undefined,
      details: {
        voiceId: agent.voice_id,
        language: agent.language,
        responseEngine: agent.response_engine
      }
    }));

  } catch (error) {
    console.error('Error fetching Retell agents:', error);
    throw error;
  }
}

async function fetchUltravoxAgents(apiKey: string, existingAgents: Set<string>): Promise<ImportableAgent[]> {
  try {
    const response = await fetch('https://api.ultravox.ai/api/agents', {
      headers: {
        'X-API-Key': apiKey,
        'Accept': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`Ultravox API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    const agents = data.results || [];

    return agents.map((agent: any) => ({
      id: agent.agentId,
      name: agent.name || 'Unnamed Agent',
      status: 'active', // Ultravox doesn't provide status in list
      lastModified: agent.created,
      alreadyImported: existingAgents.has(agent.agentId),
      details: {
        voice: agent.callTemplate?.voice || null,
        model: agent.callTemplate?.model || 'fixie-ai/ultravox',
        systemPrompt: agent.callTemplate?.systemPrompt || null,
        temperature: agent.callTemplate?.temperature || 0.7,
        languageHint: agent.callTemplate?.languageHint || 'en-US',
        recordingEnabled: agent.callTemplate?.recordingEnabled || false,
        maxDuration: agent.callTemplate?.maxDuration || '3600s',
        timeExceededMessage: agent.callTemplate?.timeExceededMessage || null,
        statistics: agent.statistics
      }
    }));

  } catch (error) {
    console.error('Error fetching Ultravox agents:', error);
    throw error;
  }
}
