import { NextRequest, NextResponse } from 'next/server';
import { verifyPartnerJWT } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { decrypt } from '@/lib/encryption';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

/**
 * GET /api/partner/retell-chat-agents/[agentId]
 * Get a single imported Retell Chat Agent with optional sync from Retell.
 */
export async function GET(
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
      include: {
        customer: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
        _count: { select: { widgets: true } },
      },
    });

    if (!agent) {
      return NextResponse.json(
        { error: 'Agent not found or not owned by partner' },
        { status: 404 }
      );
    }

    // Optionally fetch latest config from Retell API
    let retellData = null;
    const sync = req.nextUrl.searchParams.get('sync');
    if (sync === 'true' && agent.apiKey) {
      try {
        const apiKey = await decrypt(agent.apiKey);
        const res = await fetch(
          `https://api.retellai.com/get-chat-agent/${agentId}`,
          {
            headers: {
              Authorization: `Bearer ${apiKey}`,
              Accept: 'application/json',
            },
          }
        );
        if (res.ok) {
          retellData = await res.json();
        }
      } catch (syncError) {
        console.error('[retell-chat-agents/detail] Sync error:', syncError);
      }
    }

    return NextResponse.json({
      success: true,
      agent: {
        ...agent,
        lastModificationTimestamp: agent.lastModificationTimestamp?.toString() || null,
        widgetCount: agent._count.widgets,
      },
      retellData,
    });
  } catch (error: unknown) {
    console.error('[retell-chat-agents/detail] Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: 'Failed to fetch agent', details: errorMessage },
      { status: 500 }
    );
  }
}



/**
 * PATCH /api/partner/retell-chat-agents/[agentId]
 * Update Knotie-only fields and optionally sync changes to Retell.
 */
export async function PATCH(
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

    // Verify ownership
    const existing = await prisma.retellChatAgent.findUnique({
      where: { id: agentId, partnerId },
    });
    if (!existing) {
      return NextResponse.json(
        { error: 'Agent not found or not owned by partner' },
        { status: 404 }
      );
    }

    // Knotie-only fields
    const localUpdate: Record<string, any> = {};
    if (body.customerId !== undefined) localUpdate.customerId = body.customerId;
    if (body.creditConfig !== undefined) localUpdate.creditConfig = body.creditConfig;
    if (body.partnerWebhookUrl !== undefined) localUpdate.partnerWebhookUrl = body.partnerWebhookUrl;
    if (body.defaultDynamicVariables !== undefined) localUpdate.defaultDynamicVariables = body.defaultDynamicVariables;
    if (body.status !== undefined) localUpdate.status = body.status;
    if (body.smsEnabled !== undefined) localUpdate.smsEnabled = body.smsEnabled;
    if (body.smsPhoneNumber !== undefined) localUpdate.smsPhoneNumber = body.smsPhoneNumber;

    // Fields that need to be synced to Retell
    const retellSyncFields: Record<string, string> = {
      name: 'agent_name',
      language: 'language',
      autoCloseMessage: 'auto_close_message',
      endChatAfterSilenceMs: 'end_chat_after_silence_ms',
    };

    const retellUpdate: Record<string, any> = {};
    for (const [localKey, retellKey] of Object.entries(retellSyncFields)) {
      if (body[localKey] !== undefined) {
        retellUpdate[retellKey] = body[localKey];
        localUpdate[localKey] = body[localKey];
      }
    }

    // Sync to Retell if needed
    if (Object.keys(retellUpdate).length > 0 && existing.apiKey) {
      const apiKey = await decrypt(existing.apiKey);
      const res = await fetch(
        `https://api.retellai.com/update-chat-agent/${agentId}`,
        {
          method: 'PATCH',
          headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(retellUpdate),
        }
      );

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        console.error('[retell-chat-agents/update] Retell sync failed:', errorData);
        return NextResponse.json(
          { error: 'Failed to sync changes to Retell', details: errorData },
          { status: res.status }
        );
      }
    }

    const updatedAgent = await prisma.retellChatAgent.update({
      where: { id: agentId },
      data: localUpdate,
      include: {
        customer: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
      },
    });

    logger.info('Retell Chat Agent updated', {
      operation: 'retell_chat_agent_update',
      agentId,
      partnerId,
      updatedFields: Object.keys(localUpdate),
    });

    return NextResponse.json({
      success: true,
      agent: {
        ...updatedAgent,
        lastModificationTimestamp: updatedAgent.lastModificationTimestamp?.toString() || null,
      },
    });
  } catch (error: unknown) {
    console.error('[retell-chat-agents/update] Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: 'Failed to update agent', details: errorMessage },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/partner/retell-chat-agents/[agentId]
 * Soft delete — sets isActive: false. Does NOT delete from Retell.
 */
export async function DELETE(
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
    });

    if (!agent) {
      return NextResponse.json(
        { error: 'Agent not found or not owned by partner' },
        { status: 404 }
      );
    }

    // Soft delete
    await prisma.retellChatAgent.update({
      where: { id: agentId },
      data: { isActive: false, status: 'deleted' },
    });

    // Optionally restore original webhook on Retell
    if (agent.apiKey) {
      try {
        const apiKey = await decrypt(agent.apiKey);
        await fetch(`https://api.retellai.com/update-chat-agent/${agentId}`, {
          method: 'PATCH',
          headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ webhook_url: '' }),
        });
      } catch (webhookError) {
        console.error('[retell-chat-agents/delete] Error clearing webhook:', webhookError);
      }
    }

    logger.info('Retell Chat Agent soft-deleted', {
      operation: 'retell_chat_agent_delete',
      agentId,
      partnerId,
    });

    return NextResponse.json({ success: true, message: 'Agent removed from Knotie' });
  } catch (error: unknown) {
    console.error('[retell-chat-agents/delete] Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: 'Failed to delete agent', details: errorMessage },
      { status: 500 }
    );
  }
}