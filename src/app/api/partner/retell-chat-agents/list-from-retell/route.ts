import { NextRequest, NextResponse } from 'next/server';
import { verifyPartnerJWT } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

/**
 * POST /api/partner/retell-chat-agents/list-from-retell
 * Fetches chat agents from the partner's Retell account for the import UI.
 * Accepts the Retell API key in the request body (same pattern as voice agent import).
 * Filters out agents that have already been imported into Knotie.
 */
export async function POST(req: NextRequest) {
  try {
    const decoded = await verifyPartnerJWT(req);
    if (!decoded || !decoded.payload || !decoded.isValid) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const partnerId = decoded.payload.partnerId;

    // Get API key from request body
    const body = await req.json();
    const { apiKey } = body;

    if (!apiKey || typeof apiKey !== 'string' || !apiKey.trim()) {
      return NextResponse.json(
        { error: 'Retell API key is required' },
        { status: 400 }
      );
    }

    // Fetch chat agents from Retell API
    const retellResponse = await fetch('https://api.retellai.com/list-chat-agents', {
      headers: {
        'Authorization': `Bearer ${apiKey.trim()}`,
        'Accept': 'application/json',
      },
    });

    if (!retellResponse.ok) {
      const errorData = await retellResponse.json().catch(() => ({}));
      console.error('[retell-chat-agents/list-from-retell] Retell API error:', retellResponse.status, errorData);
      return NextResponse.json(
        { error: 'Failed to fetch agents from Retell', details: errorData },
        { status: retellResponse.status }
      );
    }

    const allAgents = await retellResponse.json();

    // The /list-chat-agents endpoint already returns only chat agents,
    // so no additional filtering by agent_type is needed.
    const chatAgents = Array.isArray(allAgents) ? allAgents : [];

    // Get already imported agent IDs
    const importedAgents = await prisma.retellChatAgent.findMany({
      where: { partnerId, isActive: true },
      select: { id: true },
    });
    const importedIds = new Set(importedAgents.map((a) => a.id));

    // Filter out already imported agents and map to a clean response
    const availableAgents = chatAgents
      .filter((agent: any) => !importedIds.has(agent.agent_id))
      .map((agent: any) => ({
        agent_id: agent.agent_id,
        agent_name: agent.agent_name,
        response_engine: agent.response_engine,
        language: agent.language,
        auto_close_message: agent.auto_close_message,
        end_chat_after_silence_ms: agent.end_chat_after_silence_ms,
        is_public: agent.is_public,
        webhook_url: agent.webhook_url,
        last_modification_timestamp: agent.last_modification_timestamp,
        alreadyImported: false,
      }));

    return NextResponse.json({
      agents: availableAgents,
      totalFromRetell: chatAgents.length,
      alreadyImported: importedIds.size,
    });
  } catch (error: unknown) {
    console.error('[retell-chat-agents/list-from-retell] Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: 'Failed to fetch agents from Retell', details: errorMessage },
      { status: 500 }
    );
  }
}

