import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import crypto from 'crypto';
import { verifyPartnerAuth } from '@/lib/auth/partnerAuth';

export const dynamic = 'force-dynamic';



// Generate secure widget token
function generateWidgetToken(): string {
  return 'wgt_' + crypto.randomBytes(32).toString('hex');
}

// POST /api/partner/widgets - Create new widget
export async function POST(request: NextRequest) {
  try {
    const partner = await verifyPartnerAuth(request);
    if (!partner) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const {
      name,
      description,
      agentId,
      agentType,
      customerId,
      widgetType,
      customization,
      allowedDomains = []
    } = body;

    // Always add the widget hosting domain to allowed domains
    const widgetAppUrl = process.env.WIDGET_APP_URL || process.env.NEXT_PUBLIC_WIDGET_APP_URL || 'https://widgets.knotie-ai.pro';
    const widgetDomain = new URL(widgetAppUrl).hostname;

    // Ensure widget hosting domain is always included
    const finalAllowedDomains = [...allowedDomains];
    if (!finalAllowedDomains.includes(widgetDomain)) {
      finalAllowedDomains.push(widgetDomain);
      console.log('[Widget Creation] Auto-added widget hosting domain:', widgetDomain);
    }

    // Validate required fields
    if (!name || !agentId || !agentType || !widgetType) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Verify agent belongs to partner based on agent type
    let agent = null;

    if (agentType === 'vapi') {
      agent = await prisma.vapiAgent.findFirst({
        where: {
          id: agentId,
          partnerId: partner.id
        }
      });
    } else if (agentType === 'retell') {
      agent = await prisma.retellAgent.findFirst({
        where: {
          id: agentId,
          partnerId: partner.id
        }
      });
    } else if (agentType === 'ultravox') {
      agent = await prisma.ultravoxAgent.findFirst({
        where: {
          id: agentId,
          partnerId: partner.id
        }
      });
    } else if (agentType === 'knova') {
      agent = await prisma.knovaAgent.findFirst({
        where: {
          id: agentId,
          partnerId: partner.id
        }
      });
    }

    if (!agent) {
      return NextResponse.json(
        { error: 'Agent not found or access denied' },
        { status: 404 }
      );
    }

    // Generate widget token
    const widgetToken = generateWidgetToken();

    // Create widget
    const widget = await prisma.agentWidget.create({
      data: {
        name,
        partnerId: partner.id,
        agentId,
        agentType,
        customerId,
        widgetType,
        widgetToken,
        allowedDomains: finalAllowedDomains,
        isActive: true,
        providerAgentId: agent.id,
        description,
        // Customization fields
        primaryColor: customization?.appearance?.primaryColor || "#6366F1",
        secondaryColor: customization?.appearance?.secondaryColor || "#8B5CF6",
        backgroundColor: customization?.appearance?.backgroundColor || "transparent",
        textColor: customization?.appearance?.textColor || "#1F2937",
        borderRadius: customization?.appearance?.borderRadius || 12,
        position: customization?.behavior?.position || "bottom-right",
        size: customization?.behavior?.size || "medium",
        autoStart: customization?.behavior?.autoStart || false,
        showBranding: customization?.behavior?.showBranding === true,
        showTranscript: customization?.behavior?.showTranscript || false,
        showInteractionHints: customization?.behavior?.showInteractionHints !== false,
        welcomeMessage: customization?.messages?.welcomeMessage || "",
        buttonText: customization?.messages?.buttonText || "",
        endCallText: customization?.messages?.endCallText || "End Call",
        interactionHint: customization?.messages?.interactionHint || "",
        brandingText: customization?.branding?.text,
        brandingUrl: customization?.branding?.url,
        brandingPosition: customization?.branding?.position || "bottom-center",
        brandingFontSize: customization?.branding?.fontSize || 12,
        brandingOpacity: customization?.branding?.opacity || 0.5
      }
    });

    return NextResponse.json({
      success: true,
      widget: {
        id: widget.id,
        name: widget.name,
        widgetType: widget.widgetType,
        widgetToken: widget.widgetToken,
        isActive: widget.isActive,
        createdAt: widget.createdAt
      }
    });

  } catch (error) {
    console.error('Error creating widget:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// GET /api/partner/widgets - List partner's widgets
export async function GET(request: NextRequest) {
  try {
    const partner = await verifyPartnerAuth(request);
    if (!partner) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const agentId = searchParams.get('agentId');
    const agentType = searchParams.get('agentType');

    const whereClause: any = {
      partnerId: partner.id
    };

    if (agentId) {
      whereClause.agentId = agentId;
    }

    if (agentType) {
      whereClause.agentType = agentType;
    }

    const widgets = await prisma.agentWidget.findMany({
      where: whereClause,
      include: {
        _count: {
          select: {
            analytics: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    // Get analytics data for each widget
    const widgetsWithAnalytics = await Promise.all(
      widgets.map(async (widget) => {
        const analytics = await prisma.widgetAnalytics.groupBy({
          by: ['eventType'],
          where: {
            widgetId: widget.id
          },
          _count: {
            eventType: true
          }
        });

        const lastUsed = await prisma.widgetAnalytics.findFirst({
          where: {
            widgetId: widget.id
          },
          orderBy: {
            timestamp: 'desc'
          },
          select: {
            timestamp: true
          }
        });

        // Calculate totals from analytics
        const totalViews = analytics.find(a => a.eventType === 'view')?._count.eventType || 0;
        const totalInteractions = analytics.find(a => a.eventType === 'interaction')?._count.eventType || 0;

        return {
          id: widget.id,
          name: widget.name,
          widgetType: widget.widgetType,
          agentType: widget.agentType,
          agentId: widget.agentId,
          isActive: widget.isActive,
          allowedDomains: widget.allowedDomains,
          widgetToken: widget.widgetToken,
          totalViews,
          totalInteractions,
          createdAt: widget.createdAt,
          lastUsedAt: lastUsed?.timestamp
        };
      })
    );

    return NextResponse.json({
      success: true,
      widgets: widgetsWithAnalytics
    });

  } catch (error) {
    console.error('Error fetching widgets:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
