import { NextRequest, NextResponse } from 'next/server';
import { verifyPartnerJWT } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import crypto from 'crypto';

export const dynamic = 'force-dynamic';

/**
 * GET /api/partner/retell-chat-agents/[agentId]/widget
 * List all widgets for a specific Retell Chat Agent.
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

    // Verify agent ownership
    const agent = await prisma.retellChatAgent.findUnique({
      where: { id: agentId, partnerId },
      select: { id: true },
    });

    if (!agent) {
      return NextResponse.json(
        { error: 'Agent not found or not owned by partner' },
        { status: 404 }
      );
    }

    const widgets = await prisma.retellChatWidget.findMany({
      where: { agentId, partnerId, isActive: true },
      include: {
        customer: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json(widgets);
  } catch (error: unknown) {
    console.error('[retell-chat-widgets] Error listing widgets:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: 'Failed to list widgets', details: errorMessage },
      { status: 500 }
    );
  }
}

/**
 * POST /api/partner/retell-chat-agents/[agentId]/widget
 * Create a new widget for a Retell Chat Agent.
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

    const { name, description, customerId, widgetConfig, appearance, allowedDomains } = body;

    if (!name) {
      return NextResponse.json({ error: 'Widget name is required' }, { status: 400 });
    }

    // Verify agent ownership
    const agent = await prisma.retellChatAgent.findUnique({
      where: { id: agentId, partnerId },
      select: { id: true },
    });

    if (!agent) {
      return NextResponse.json(
        { error: 'Agent not found or not owned by partner' },
        { status: 404 }
      );
    }

    // Generate unique widget token
    const widgetToken = `wgt_${crypto.randomBytes(32).toString('hex')}`;

    const widget = await prisma.retellChatWidget.create({
      data: {
        partnerId,
        agentId,
        customerId: customerId || null,
        name,
        description: description || null,
        widgetConfig: widgetConfig || {},
        appearance: appearance || {},
        behavior: {},
        widgetToken,
        allowedDomains: allowedDomains || [],
      },
      include: {
        customer: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
      },
    });

    // Generate embed code snippet
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://app.knotie-ai.pro';
    const embedCode = `<script src="${appUrl}/embed/retell-chat.js" data-widget-token="${widgetToken}"></script>`;

    return NextResponse.json({
      success: true,
      widget,
      embedCode,
    });
  } catch (error: unknown) {
    console.error('[retell-chat-widgets] Error creating widget:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: 'Failed to create widget', details: errorMessage },
      { status: 500 }
    );
  }
}

