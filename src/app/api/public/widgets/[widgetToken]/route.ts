import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

// GET - Get widget configuration for public embedding
export async function GET(
  request: NextRequest,
  { params }: { params: { widgetToken: string } }
) {
  try {
    const { searchParams } = new URL(request.url);
    const domain = searchParams.get('domain');
    const userAgent = request.headers.get('user-agent');
    const forwardedFor = request.headers.get('x-forwarded-for');
    const realIp = request.headers.get('x-real-ip');
    const ipAddress = forwardedFor?.split(',')[0] || realIp || 'unknown';

    console.log('[WIDGET-PUBLIC] Widget request:', {
      widgetToken: params.widgetToken,
      domain,
      userAgent,
      ipAddress
    });

    // Find widget by token
    const widget = await prisma.n8nChatWidget.findFirst({
      where: {
        widgetToken: params.widgetToken,
        isActive: true
      },
      include: {
        agent: {
          select: {
            id: true,
            name: true,
            status: true,
            integrationMode: true,
            n8nWebhookUrl: true
          }
        },
        customer: {
          select: {
            id: true,
            firstName: true,
            lastName: true
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
        }
      }
    });

    if (!widget) {
      return NextResponse.json(
        { error: 'Widget not found or inactive' },
        { status: 404 }
      );
    }

    // Check domain whitelist if configured
    if (widget.allowedDomains.length > 0 && domain) {
      const isDomainAllowed = widget.allowedDomains.some(allowedDomain => {
        // Support wildcard domains like *.example.com
        if (allowedDomain.startsWith('*.')) {
          const baseDomain = allowedDomain.substring(2);
          return domain.endsWith(baseDomain);
        }
        return domain === allowedDomain;
      });

      if (!isDomainAllowed) {
        console.log('[WIDGET-PUBLIC] Domain not allowed:', {
          domain,
          allowedDomains: widget.allowedDomains
        });
        return NextResponse.json(
          { error: 'Domain not allowed' },
          { status: 403 }
        );
      }
    }

    // Check if agent is active
    if (widget.agent.status !== 'active') {
      return NextResponse.json(
        { error: 'Agent is not active' },
        { status: 503 }
      );
    }

    // Generate analytics proxy URL
    const analyticsUrl = process.env.ANALYTICS_API_URL || 'https://analytics.knotie-ai.pro';
    const proxyUrl = `${analyticsUrl}/proxy/n8n-chat/${widget.partnerId}/${widget.customerId}/${widget.agentId}`;

    // Return widget configuration
    return NextResponse.json({
      success: true,
      data: {
        widget_id: widget.id,
        widget_token: widget.widgetToken,
        name: widget.name,
        description: widget.description,
        
        // Widget Configuration
        config: widget.widgetConfig,
        appearance: {
          ...(widget.appearance as object || {}),
          // Override with partner branding if available
          primary_color: widget.partner.primaryColor || (widget.appearance as any)?.primary_color,
          secondary_color: widget.partner.secondaryColor || (widget.appearance as any)?.secondary_color,
        },
        behavior: widget.behavior,
        
        // Agent Information
        agent: {
          id: widget.agent.id,
          name: widget.agent.name,
          integration_mode: widget.agent.integrationMode
        },
        
        // Partner Branding
        partner: {
          business_name: widget.partner.businessName,
          logo: widget.partner.logo,
          primary_color: widget.partner.primaryColor,
          secondary_color: widget.partner.secondaryColor
        },
        
        // API Endpoints
        proxy_url: proxyUrl,
        session_url: `/api/public/widgets/${widget.widgetToken}/session`,
        
        // Security
        allowed_domains: widget.allowedDomains,
        domain_check_enabled: widget.allowedDomains.length > 0
      }
    });

  } catch (error) {
    console.error('Error fetching widget configuration:', error);
    return NextResponse.json(
      { error: 'Failed to fetch widget configuration' },
      { status: 500 }
    );
  }
}

// POST - Create a new widget session
export async function POST(
  request: NextRequest,
  { params }: { params: { widgetToken: string } }
) {
  try {
    const body = await request.json();
    const { domain, user_agent, metadata } = body;
    
    const forwardedFor = request.headers.get('x-forwarded-for');
    const realIp = request.headers.get('x-real-ip');
    const ipAddress = forwardedFor?.split(',')[0] || realIp || 'unknown';

    console.log('[WIDGET-PUBLIC] Creating session:', {
      widgetToken: params.widgetToken,
      domain,
      ipAddress
    });

    // Find widget by token
    const widget = await prisma.n8nChatWidget.findFirst({
      where: {
        widgetToken: params.widgetToken,
        isActive: true
      }
    });

    if (!widget) {
      return NextResponse.json(
        { error: 'Widget not found or inactive' },
        { status: 404 }
      );
    }

    // Check domain whitelist if configured
    if (widget.allowedDomains.length > 0 && domain) {
      const isDomainAllowed = widget.allowedDomains.some(allowedDomain => {
        if (allowedDomain.startsWith('*.')) {
          const baseDomain = allowedDomain.substring(2);
          return domain.endsWith(baseDomain);
        }
        return domain === allowedDomain;
      });

      if (!isDomainAllowed) {
        return NextResponse.json(
          { error: 'Domain not allowed' },
          { status: 403 }
        );
      }
    }

    // Generate unique session ID
    const sessionId = `ws_${Date.now()}_${Math.random().toString(36).substring(2)}`;

    // Create widget session
    const session = await prisma.n8nChatWidgetSession.create({
      data: {
        widgetId: widget.id,
        sessionId,
        domain: domain || null,
        userAgent: user_agent || null,
        ipAddress,
        metadata: metadata || {}
      }
    });

    // Update widget session count
    await prisma.n8nChatWidget.update({
      where: {
        id: widget.id
      },
      data: {
        totalSessions: {
          increment: 1
        },
        lastUsedAt: new Date()
      }
    });

    return NextResponse.json({
      success: true,
      data: {
        session_id: session.sessionId,
        widget_id: widget.id,
        created_at: session.createdAt
      }
    });

  } catch (error) {
    console.error('Error creating widget session:', error);
    return NextResponse.json(
      { error: 'Failed to create session' },
      { status: 500 }
    );
  }
}
