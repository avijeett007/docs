import { NextRequest, NextResponse } from 'next/server';
import { verifyPartnerJWT } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { decrypt } from '@/lib/encryption';

export const dynamic = 'force-dynamic';

/**
 * POST /api/partner/retell-chat-agents/[agentId]/test
 * Creates a new chat session for testing. Returns chat_id for use with /test/message.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: { agentId: string } }
) {
  try {
    const decoded = await verifyPartnerJWT(req);
    if (!decoded || !decoded.payload || !decoded.isValid) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const partnerId = decoded.payload.partnerId;
    const agentId = params.agentId;

    const agent = await prisma.retellChatAgent.findUnique({
      where: { id: agentId, partnerId },
      select: { id: true, name: true, apiKey: true },
    });

    if (!agent) {
      return NextResponse.json({ error: 'Agent not found or not owned by partner' }, { status: 404 });
    }

    if (!agent.apiKey) {
      return NextResponse.json({ error: 'No API key configured for this agent' }, { status: 400 });
    }

    const decryptedApiKey = await decrypt(agent.apiKey);
    const body = await req.json().catch(() => ({}));

    // Create chat session via Retell API
    const retellResponse = await fetch('https://api.retellai.com/create-chat', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${decryptedApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        agent_id: agentId,
        metadata: {
          test_chat: true,
          partner_id: partnerId,
          agent_name: agent.name,
          created_at: new Date().toISOString(),
        },
        retell_llm_dynamic_variables: body.dynamicVariables || {},
      }),
    });

    if (!retellResponse.ok) {
      const errorText = await retellResponse.text();
      console.error('[retell-chat-test] Retell API error:', retellResponse.status, errorText);

      if (retellResponse.status === 401) {
        return NextResponse.json({ error: 'invalid_api_key', message: 'Your Retell API key appears to be invalid.' }, { status: 401 });
      }
      if (retellResponse.status === 402 || retellResponse.status === 403) {
        return NextResponse.json({ error: 'quota_exceeded', message: 'Your Retell account has reached its usage limit.' }, { status: 403 });
      }

      return NextResponse.json({ error: 'Failed to create chat session', details: errorText }, { status: retellResponse.status });
    }

    const chatData = await retellResponse.json();

    return NextResponse.json({
      success: true,
      chatId: chatData.chat_id,
      agentName: agent.name,
    });
  } catch (error: any) {
    console.error('[retell-chat-test] Error:', error);
    return NextResponse.json({ error: 'test_creation_failed', message: error.message || 'Failed to create test chat.' }, { status: 500 });
  }
}

