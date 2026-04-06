import { NextRequest, NextResponse } from 'next/server';
import { verifyPartnerAuth } from '@/lib/auth/partnerAuth';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';
import crypto from 'crypto';

// Validation schema for creating N8N Chat widgets
const createWidgetSchema = z.object({
  name: z.string().min(1, 'Widget name is required'),
  description: z.string().optional(),
  agent_id: z.string().min(1, 'Agent ID is required'),
  customer_id: z.string().min(1, 'Customer ID is required'),
  
  // Widget Configuration
  widget_config: z.object({
    title: z.string().default('Chat with us'),
    placeholder: z.string().default('Type your message...'),
    welcome_message: z.string().default('Hello! How can I help you today?'),
    position: z.enum(['bottom-right', 'bottom-left', 'top-right', 'top-left']).default('bottom-right'),
    auto_open: z.boolean().default(false),
    auto_open_delay: z.number().default(3000),
  }).default({}),
  
  // Appearance Configuration
  appearance: z.object({
    primary_color: z.string().default('#3B82F6'),
    secondary_color: z.string().default('#10B981'),
    text_color: z.string().default('#1F2937'),
    background_color: z.string().default('#FFFFFF'),
    border_radius: z.number().default(12),
    font_family: z.string().default('Inter, sans-serif'),
    widget_size: z.enum(['small', 'medium', 'large']).default('medium'),
    show_agent_avatar: z.boolean().default(true),
    show_typing_indicator: z.boolean().default(true),
  }).default({}),
  
  // Behavior Configuration
  behavior: z.object({
    enable_sound: z.boolean().default(true),
    enable_emoji: z.boolean().default(true),
    max_message_length: z.number().default(1000),
    session_timeout: z.number().default(1800), // 30 minutes
    enable_file_upload: z.boolean().default(false),
    enable_feedback: z.boolean().default(true),
  }).default({}),
  
  // Security Configuration
  allowed_domains: z.array(z.string()).default([]),
});

export const dynamic = 'force-dynamic';

// GET - List all N8N Chat widgets for a partner
export async function GET(request: NextRequest) {
  try {
    const partner = await verifyPartnerAuth(request);
    if (!partner) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get all N8N Chat widgets for this partner
    const widgets = await prisma.n8nChatWidget.findMany({
      where: {
        partnerId: partner.id
      },
      include: {
        agent: {
          select: {
            id: true,
            name: true,
            status: true,
            integrationMode: true
          }
        },
        customer: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true
          }
        },
        _count: {
          select: {
            sessions: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    return NextResponse.json({
      success: true,
      data: widgets.map(widget => ({
        id: widget.id,
        name: widget.name,
        description: widget.description,
        agent_id: widget.agentId,
        customer_id: widget.customerId,
        widget_config: widget.widgetConfig,
        appearance: widget.appearance,
        behavior: widget.behavior,
        widget_token: widget.widgetToken,
        allowed_domains: widget.allowedDomains,
        is_active: widget.isActive,
        total_sessions: widget.totalSessions,
        total_messages: widget.totalMessages,
        last_used_at: widget.lastUsedAt,
        created_at: widget.createdAt,
        updated_at: widget.updatedAt,
        agent: widget.agent,
        customer: widget.customer,
        session_count: widget._count.sessions
      }))
    });

  } catch (error) {
    console.error('Error fetching N8N Chat widgets:', error);
    return NextResponse.json(
      { error: 'Failed to fetch widgets' },
      { status: 500 }
    );
  }
}

// POST - Create a new N8N Chat widget
export async function POST(request: NextRequest) {
  try {
    const partner = await verifyPartnerAuth(request);
    if (!partner) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    console.log('[N8N-CHAT-WIDGETS] Creating widget with data:', body);
    
    // Validate request body
    const validationResult = createWidgetSchema.safeParse(body);
    if (!validationResult.success) {
      console.log('[N8N-CHAT-WIDGETS] Validation failed:', validationResult.error.errors);
      return NextResponse.json(
        { 
          error: 'Validation failed',
          details: validationResult.error.errors
        },
        { status: 400 }
      );
    }

    const data = validationResult.data;

    // Verify agent exists and belongs to partner
    const agent = await prisma.n8nChatAgent.findFirst({
      where: {
        id: data.agent_id,
        partnerId: partner.id
      }
    });

    if (!agent) {
      return NextResponse.json(
        { error: 'Agent not found or does not belong to partner' },
        { status: 404 }
      );
    }

    // Verify customer exists and belongs to partner
    const customer = await prisma.customer.findFirst({
      where: {
        id: data.customer_id,
        // Customer should be associated with partner through UserOnboarding
      },
      include: {
        userOnboarding: {
          where: {
            partnerId: partner.id
          }
        }
      }
    });

    if (!customer || customer.userOnboarding.length === 0) {
      return NextResponse.json(
        { error: 'Customer not found or not associated with partner' },
        { status: 404 }
      );
    }

    // Generate unique widget token
    const widgetToken = `wgt_${crypto.randomBytes(32).toString('hex')}`;

    // Create widget in database
    const widget = await prisma.n8nChatWidget.create({
      data: {
        partnerId: partner.id,
        agentId: data.agent_id,
        customerId: data.customer_id,
        name: data.name,
        description: data.description,
        widgetConfig: data.widget_config,
        appearance: data.appearance,
        behavior: data.behavior,
        widgetToken,
        allowedDomains: data.allowed_domains,
        isActive: true
      },
      include: {
        agent: {
          select: {
            id: true,
            name: true,
            status: true,
            integrationMode: true,
            n8nWebhookUrl: true,
            webhookSecret: true
          }
        },
        customer: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true
          }
        }
      }
    });

    console.log('[N8N-CHAT-WIDGETS] Widget created successfully:', widget.id);

    // Update the agent in Supabase analytics with allowed domains
    try {
      const analyticsUrl = process.env.ANALYTICS_API_URL || 'https://analytics.knotie-ai.pro';
      const updateResponse = await fetch(`${analyticsUrl}/api/agents/${data.agent_id}?provider=n8n_chat_proxy`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': process.env.ANALYTICS_STANDARD_API_KEY || 'test-api-key',
        },
        body: JSON.stringify({
          config: {
            allowed_domains: data.allowed_domains,
            integration_mode: 'proxy', // Widgets are always proxy mode
            n8n_webhook_url: widget.agent.n8nWebhookUrl,
            webhook_secret: widget.agent.webhookSecret,
            webhook_enabled: true
          }
        })
      });

      if (updateResponse.ok) {
        console.log('[N8N-CHAT-WIDGETS] Successfully updated agent config in analytics with allowed domains:', data.allowed_domains);
      } else {
        const errorText = await updateResponse.text();
        console.warn('[N8N-CHAT-WIDGETS] Failed to update agent config in analytics:', errorText);
      }
    } catch (error) {
      console.error('[N8N-CHAT-WIDGETS] Error updating agent config in analytics:', error);
      // Don't fail widget creation if analytics update fails
    }

    // Return widget data with URLs
    const analyticsUrl = process.env.ANALYTICS_API_URL || 'https://analytics.knotie-ai.pro';
    const widgetUrl = `${analyticsUrl}/widget/n8n-chat/${widget.widgetToken}`;
    const embedCode = generateEmbedCode(widgetUrl, widget.appearance);

    return NextResponse.json({
      success: true,
      message: 'Widget created successfully',
      data: {
        id: widget.id,
        name: widget.name,
        description: widget.description,
        agent_id: widget.agentId,
        customer_id: widget.customerId,
        widget_config: widget.widgetConfig,
        appearance: widget.appearance,
        behavior: widget.behavior,
        widget_token: widget.widgetToken,
        allowed_domains: widget.allowedDomains,
        is_active: widget.isActive,
        total_sessions: widget.totalSessions,
        total_messages: widget.totalMessages,
        created_at: widget.createdAt,
        updated_at: widget.updatedAt,
        agent: widget.agent,
        customer: widget.customer,
        widget_url: widgetUrl,
        embed_code: embedCode
      }
    });

  } catch (error) {
    console.error('Error creating N8N Chat widget:', error);
    return NextResponse.json(
      { error: 'Failed to create widget' },
      { status: 500 }
    );
  }
}

// Helper function to generate embed code
function generateEmbedCode(widgetUrl: string, appearance: any): string {
  return `<!-- Knotie N8N Chat Widget -->
<script>
  (function() {
    var script = document.createElement('script');
    script.src = '${widgetUrl}/embed.js';
    script.async = true;
    script.onload = function() {
      KnotieN8nChat.init({
        widgetUrl: '${widgetUrl}',
        appearance: ${JSON.stringify(appearance, null, 2)}
      });
    };
    document.head.appendChild(script);
  })();
</script>
<!-- End Knotie N8N Chat Widget -->`;
}
