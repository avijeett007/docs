import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

/**
 * GET /api/widgets/retell-chat/validate?token=wgt_abc123
 * Validates a Retell Chat widget token and returns config (no sensitive data)
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const token = searchParams.get('token');
    const domain = searchParams.get('domain');

    if (!token) {
      return NextResponse.json({ error: 'Widget token is required' }, { status: 400 });
    }

    // Find widget by token
    const widget = await prisma.retellChatWidget.findFirst({
      where: {
        widgetToken: token,
        isActive: true
      },
      include: {
        agent: {
          select: {
            id: true,
            name: true,
            status: true,
            isActive: true,
            language: true,
            defaultDynamicVariables: true
          }
        },
        partner: {
          select: {
            id: true,
            businessName: true,
            primaryColor: true,
            secondaryColor: true,
            logo: true
          }
        },
        customer: {
          select: {
            id: true,
            firstName: true,
            lastName: true
          }
        }
      }
    });

    if (!widget) {
      return NextResponse.json({ error: 'Invalid or inactive widget token' }, { status: 404 });
    }

    // Check if agent is active
    if (!widget.agent.isActive || widget.agent.status !== 'active') {
      return NextResponse.json({ error: 'Agent is not active' }, { status: 403 });
    }

    // Validate domain if allowedDomains is configured
    if (widget.allowedDomains && widget.allowedDomains.length > 0 && domain) {
      const isAllowed = widget.allowedDomains.some(
        (d: string) => d === '*' || d === domain || domain.endsWith(`.${d}`)
      );
      if (!isAllowed) {
        return NextResponse.json({ error: 'Domain not allowed' }, { status: 403 });
      }
    }

    // Return widget config without sensitive data
    const dynamicVarsTemplate = widget.agent.defaultDynamicVariables as Record<string, unknown> || {};
    const dynamicVarKeys = Object.keys(dynamicVarsTemplate);

    return NextResponse.json({
      valid: true,
      agentId: widget.agent.id,
      agentName: widget.agent.name,
      partnerId: widget.partnerId,
      customerId: widget.customerId,
      language: widget.agent.language,
      appearance: widget.appearance,
      behavior: widget.behavior,
      widgetConfig: widget.widgetConfig,
      dynamicVariableKeys: dynamicVarKeys,
      branding: {
        businessName: widget.partner.businessName,
        primaryColor: widget.partner.primaryColor,
        secondaryColor: widget.partner.secondaryColor,
        logo: widget.partner.logo
      }
    });

  } catch (error) {
    console.error('[RETELL-CHAT-WIDGET] Validate error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

