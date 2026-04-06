import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { decrypt } from '@/lib/encryption';

export const dynamic = 'force-dynamic';

/**
 * POST /api/widgets/retell-chat/session
 * Creates a Retell chat session with Knotie metadata injected.
 * Proxies to Retell POST /create-chat
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { widgetToken, dynamicVariables } = body;

    if (!widgetToken) {
      return NextResponse.json({ error: 'Widget token is required' }, { status: 400 });
    }

    // Find and validate widget
    const widget = await prisma.retellChatWidget.findFirst({
      where: { widgetToken, isActive: true },
      include: {
        agent: {
          select: {
            id: true,
            name: true,
            status: true,
            isActive: true,
            partnerId: true,
            customerId: true,
            defaultDynamicVariables: true,
            apiKey: true
          }
        }
      }
    });

    if (!widget) {
      return NextResponse.json({ error: 'Invalid or inactive widget' }, { status: 404 });
    }

    if (!widget.agent.isActive || widget.agent.status !== 'active') {
      return NextResponse.json({ error: 'Agent is not active' }, { status: 403 });
    }

    // Get agent's stored Retell API key
    const encryptedKey = widget.agent.apiKey;
    if (!encryptedKey) {
      return NextResponse.json({ error: 'Retell API key not configured for this agent' }, { status: 500 });
    }

    let apiKey: string;
    try {
      apiKey = await decrypt(encryptedKey);
    } catch {
      return NextResponse.json({ error: 'Failed to resolve API key' }, { status: 500 });
    }

    // Merge default dynamic variables with per-session overrides
    const defaultDynVars = (widget.agent.defaultDynamicVariables as Record<string, unknown>) || {};
    const mergedDynamicVars = {
      ...defaultDynVars,
      ...(dynamicVariables || {})
    };

    // Create chat via Retell API with metadata
    const retellPayload: Record<string, unknown> = {
      agent_id: widget.agentId,
      metadata: {
        partner_id: widget.partnerId,
        customer_id: widget.customerId || widget.agent.customerId,
        widget_id: widget.id,
        widget_token: widget.widgetToken
      }
    };

    // Only include dynamic variables if there are any
    if (Object.keys(mergedDynamicVars).length > 0) {
      retellPayload.retell_llm_dynamic_variables = mergedDynamicVars;
    }

    const chatResponse = await fetch('https://api.retellai.com/create-chat', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(retellPayload)
    });

    if (!chatResponse.ok) {
      const errorText = await chatResponse.text();
      console.error('[RETELL-CHAT-SESSION] Retell API error:', chatResponse.status, errorText);
      return NextResponse.json(
        { error: 'Failed to create chat session', details: errorText },
        { status: chatResponse.status }
      );
    }

    const chat = await chatResponse.json();

    // Increment session count on widget
    await prisma.retellChatWidget.update({
      where: { id: widget.id },
      data: {
        totalSessions: { increment: 1 },
        lastUsedAt: new Date()
      }
    });

    return NextResponse.json({
      chatId: chat.chat_id,
      agentId: chat.agent_id,
      chatStatus: chat.chat_status,
    });

  } catch (error) {
    console.error('[RETELL-CHAT-SESSION] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

