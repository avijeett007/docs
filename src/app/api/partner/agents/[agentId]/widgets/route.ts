import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import jwt from 'jsonwebtoken';

export const dynamic = 'force-dynamic';



// Helper function to verify partner JWT
async function verifyPartnerToken(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return null;
  }

  try {
    const token = authHeader.substring(7);
    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as any;
    
    const partner = await prisma.partner.findUnique({
      where: { id: decoded.partnerId },
      select: { id: true, emailAddress: true }
    });

    return partner;
  } catch (error) {
    return null;
  }
}

// GET /api/partner/agents/[agentId]/widgets - Get widgets for specific agent
export async function GET(
  request: NextRequest,
  { params }: { params: { agentId: string } }
) {
  try {
    const partner = await verifyPartnerToken(request);
    if (!partner) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // First verify the agent belongs to the partner - check all agent tables
    let agent: any = null;
    let agentType: string = '';

    // Check RetellAgent table
    const retellAgent = await prisma.retellAgent.findFirst({
      where: {
        id: params.agentId,
        partnerId: partner.id
      }
    });

    if (retellAgent) {
      agent = retellAgent;
      agentType = 'retell';
    } else {
      // Check VapiAgent table
      const vapiAgent = await prisma.vapiAgent.findFirst({
        where: {
          id: params.agentId,
          partnerId: partner.id
        }
      });

      if (vapiAgent) {
        agent = vapiAgent;
        agentType = 'vapi';
      } else {
        // Check UltravoxAgent table
        const ultravoxAgent = await prisma.ultravoxAgent.findFirst({
          where: {
            id: params.agentId,
            partnerId: partner.id
          }
        });

        if (ultravoxAgent) {
          agent = ultravoxAgent;
          agentType = 'ultravox';
        } else {
          // Check legacy Agent table as fallback
          const legacyAgent = await prisma.agent.findFirst({
            where: {
              id: params.agentId,
              userId: partner.id
            }
          });

          if (legacyAgent) {
            agent = legacyAgent;
            agentType = legacyAgent.type || 'unknown';
          }
        }
      }
    }

    if (!agent) {
      return NextResponse.json(
        { error: 'Agent not found or access denied' },
        { status: 404 }
      );
    }

    // Get widgets for this agent
    const widgets = await prisma.agentWidget.findMany({
      where: {
        agentId: params.agentId,
        partnerId: partner.id
      },
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

        // Process analytics data
        const views = analytics.find(a => a.eventType === 'view')?._count.eventType || 0;
        const interactions = analytics.find(a => a.eventType === 'interaction')?._count.eventType || 0;

        return {
          id: widget.id,
          name: widget.name,
          widgetType: widget.widgetType,
          agentType: widget.agentType,
          isActive: widget.isActive,
          allowedDomains: widget.allowedDomains,
          widgetToken: widget.widgetToken,
          totalViews: views,
          totalInteractions: interactions,
          createdAt: widget.createdAt,
          lastUsedAt: lastUsed?.timestamp
        };
      })
    );

    return NextResponse.json({
      success: true,
      widgets: widgetsWithAnalytics,
      agent: {
        id: agent.id,
        agentType: agentType,
        name: agent.name || agent.agentName || 'Unknown Agent'
      }
    });

  } catch (error) {
    console.error('Error fetching agent widgets:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
