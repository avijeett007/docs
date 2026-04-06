import { NextRequest, NextResponse } from 'next/server';
import { verifyPartnerJWT } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { decrypt } from '@/lib/encryption';

export const dynamic = 'force-dynamic';

/**
 * POST /api/partner/retell-chat-agents/[agentId]/test/message
 * Sends a message to an active test chat session and returns the agent's response.
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
      select: { id: true, apiKey: true },
    });

    if (!agent) {
      return NextResponse.json({ error: 'Agent not found' }, { status: 404 });
    }

    if (!agent.apiKey) {
      return NextResponse.json({ error: 'No API key configured' }, { status: 400 });
    }

    const body = await req.json();
    const { chatId, content } = body;

    if (!chatId || !content) {
      return NextResponse.json({ error: 'chatId and content are required' }, { status: 400 });
    }

    const decryptedApiKey = await decrypt(agent.apiKey);

    // Send message via Retell's create-chat-completion
    const retellResponse = await fetch('https://api.retellai.com/create-chat-completion', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${decryptedApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        chat_id: chatId,
        content: content,
      }),
    });

    if (!retellResponse.ok) {
      const errorText = await retellResponse.text();
      console.error('[retell-chat-test-message] Retell API error:', retellResponse.status, errorText);
      return NextResponse.json({ error: 'Failed to send message', details: errorText }, { status: retellResponse.status });
    }

    const result = await retellResponse.json();

    // Extract agent messages from the response
    const agentMessages: { role: string; content: string; messageId: string }[] = [];
    if (result.messages && Array.isArray(result.messages)) {
      for (const msg of result.messages) {
        if (msg.role === 'agent' && msg.content) {
          agentMessages.push({
            role: msg.role,
            content: msg.content,
            messageId: msg.message_id,
          });
        }
      }
    }

    return NextResponse.json({
      messages: agentMessages,
      chatStatus: result.chat_status || 'ongoing',
    });
  } catch (error: any) {
    console.error('[retell-chat-test-message] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

