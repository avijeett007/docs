import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { decrypt } from '@/lib/encryption';

export const dynamic = 'force-dynamic';

/**
 * POST /api/widgets/retell-chat/message
 * Proxies a chat completion request to Retell's /create-chat-completion.
 * The widget sends { widgetToken, chatId, content } and this route
 * attaches the agent's encrypted API key server-side.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { widgetToken, chatId, content } = body;

    if (!widgetToken || !chatId || !content) {
      return NextResponse.json(
        { error: 'widgetToken, chatId, and content are required' },
        { status: 400 }
      );
    }

    // Find widget and its agent (with API key)
    const widget = await prisma.retellChatWidget.findFirst({
      where: { widgetToken, isActive: true },
      include: {
        agent: {
          select: {
            id: true,
            isActive: true,
            status: true,
            apiKey: true,
          },
        },
      },
    });

    if (!widget) {
      return NextResponse.json({ error: 'Invalid or inactive widget' }, { status: 404 });
    }

    if (!widget.agent.isActive || widget.agent.status !== 'active') {
      return NextResponse.json({ error: 'Agent is not active' }, { status: 403 });
    }

    const encryptedKey = widget.agent.apiKey;
    if (!encryptedKey) {
      return NextResponse.json(
        { error: 'Retell API key not configured for this agent' },
        { status: 500 }
      );
    }

    let apiKey: string;
    try {
      apiKey = await decrypt(encryptedKey);
    } catch {
      return NextResponse.json({ error: 'Failed to resolve API key' }, { status: 500 });
    }

    // Forward to Retell /create-chat-completion
    const retellResponse = await fetch('https://api.retellai.com/create-chat-completion', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        chat_id: chatId,
        content: content,
      }),
    });

    if (!retellResponse.ok) {
      const errorText = await retellResponse.text();
      console.error('[RETELL-CHAT-MESSAGE] Retell API error:', retellResponse.status, errorText);
      return NextResponse.json(
        { error: 'Failed to get chat completion', details: errorText },
        { status: retellResponse.status }
      );
    }

    const result = await retellResponse.json();

    // Extract agent text messages from the response
    // The response has { messages: MessageOrToolCall[] }
    // We only return role=agent messages with content to the widget
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
    });
  } catch (error) {
    console.error('[RETELL-CHAT-MESSAGE] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

