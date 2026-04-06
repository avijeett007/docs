import { NextRequest, NextResponse } from 'next/server';
import { verifyPartnerJWT } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { decrypt } from '@/lib/encryption';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

/**
 * POST /api/partner/retell-chat-agents/[agentId]/sms
 * Initiate an outbound SMS chat session via Retell's /create-chat API.
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
    const body = await req.json();

    const { phoneNumber, dynamicVariables, metadata } = body;

    // Verify agent ownership and SMS capability
    const agent = await prisma.retellChatAgent.findUnique({
      where: { id: agentId, partnerId },
    });

    if (!agent) {
      return NextResponse.json(
        { error: 'Agent not found or not owned by partner' },
        { status: 404 }
      );
    }

    if (!agent.smsEnabled) {
      return NextResponse.json(
        { error: 'SMS is not enabled for this agent. Enable SMS in agent settings first.' },
        { status: 400 }
      );
    }

    const targetPhone = phoneNumber || agent.smsPhoneNumber;
    if (!targetPhone) {
      return NextResponse.json(
        { error: 'No phone number provided and no default SMS phone number configured' },
        { status: 400 }
      );
    }

    // Get API key from the agent's stored key
    if (!agent.apiKey) {
      return NextResponse.json(
        { error: 'No Retell API key configured for this agent' },
        { status: 400 }
      );
    }

    const apiKey = await decrypt(agent.apiKey);

    // Merge default dynamic variables with per-session overrides
    const mergedDynamicVars = {
      ...(agent.defaultDynamicVariables as Record<string, string> || {}),
      ...(dynamicVariables || {}),
    };

    // Create SMS chat session via Retell API
    const createChatBody: Record<string, any> = {
      agent_id: agentId,
      metadata: {
        partner_id: partnerId,
        customer_id: agent.customerId || undefined,
        ...(metadata || {}),
      },
      chat_type: 'sms_chat',
    };

    // Only include dynamic variables if there are any
    if (Object.keys(mergedDynamicVars).length > 0) {
      createChatBody.retell_llm_dynamic_variables = mergedDynamicVars;
    }

    const retellResponse = await fetch('https://api.retellai.com/create-chat', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(createChatBody),
    });

    if (!retellResponse.ok) {
      const errorData = await retellResponse.json().catch(() => ({}));
      console.error('[retell-chat-agents/sms] Retell API error:', retellResponse.status, errorData);
      return NextResponse.json(
        { error: 'Failed to create SMS chat session', details: errorData },
        { status: retellResponse.status }
      );
    }

    const chatSession = await retellResponse.json();

    logger.info('Outbound SMS chat session created', {
      operation: 'retell_chat_sms_create',
      agentId,
      partnerId,
      chatId: chatSession.chat_id,
    });

    return NextResponse.json({
      success: true,
      chatId: chatSession.chat_id,
      session: chatSession,
    });
  } catch (error: unknown) {
    console.error('[retell-chat-agents/sms] Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: 'Failed to initiate SMS chat', details: errorMessage },
      { status: 500 }
    );
  }
}

