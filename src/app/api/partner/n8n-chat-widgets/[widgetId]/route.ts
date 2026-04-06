import { NextRequest, NextResponse } from 'next/server';
import { verifyPartnerAuth } from '@/lib/auth/partnerAuth';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';

// Validation schema for updating N8N Chat widgets
const updateWidgetSchema = z.object({
  name: z.string().min(1, 'Widget name is required').optional(),
  description: z.string().optional(),
  
  // Widget Configuration
  widget_config: z.object({
    title: z.string().optional(),
    placeholder: z.string().optional(),
    welcome_message: z.string().optional(),
    position: z.enum(['bottom-right', 'bottom-left', 'top-right', 'top-left']).optional(),
    auto_open: z.boolean().optional(),
    auto_open_delay: z.number().optional(),
  }).optional(),
  
  // Appearance Configuration
  appearance: z.object({
    primary_color: z.string().optional(),
    secondary_color: z.string().optional(),
    text_color: z.string().optional(),
    background_color: z.string().optional(),
    border_radius: z.number().optional(),
    font_family: z.string().optional(),
    widget_size: z.enum(['small', 'medium', 'large']).optional(),
    show_agent_avatar: z.boolean().optional(),
    show_typing_indicator: z.boolean().optional(),
  }).optional(),
  
  // Behavior Configuration
  behavior: z.object({
    enable_sound: z.boolean().optional(),
    enable_emoji: z.boolean().optional(),
    max_message_length: z.number().optional(),
    session_timeout: z.number().optional(),
    enable_file_upload: z.boolean().optional(),
    enable_feedback: z.boolean().optional(),
  }).optional(),
  
  // Security Configuration
  allowed_domains: z.array(z.string()).optional(),
  is_active: z.boolean().optional(),
});

export const dynamic = 'force-dynamic';

// GET - Get a specific N8N Chat widget
export async function GET(
  request: NextRequest,
  { params }: { params: { widgetId: string } }
) {
  try {
    const partner = await verifyPartnerAuth(request);
    if (!partner) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const widget = await prisma.n8nChatWidget.findFirst({
      where: {
        id: params.widgetId,
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
        sessions: {
          select: {
            id: true,
            sessionId: true,
            domain: true,
            messageCount: true,
            startedAt: true,
            endedAt: true,
            duration: true
          },
          orderBy: {
            startedAt: 'desc'
          },
          take: 10 // Latest 10 sessions
        }
      }
    });

    if (!widget) {
      return NextResponse.json(
        { error: 'Widget not found' },
        { status: 404 }
      );
    }

    // Generate URLs
    const analyticsUrl = process.env.ANALYTICS_API_URL || 'https://analytics.knotie-ai.pro';
    const widgetUrl = `${analyticsUrl}/widget/n8n-chat/${widget.widgetToken}`;
    const embedCode = generateEmbedCode(widgetUrl, widget.appearance);

    return NextResponse.json({
      success: true,
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
        last_used_at: widget.lastUsedAt,
        created_at: widget.createdAt,
        updated_at: widget.updatedAt,
        agent: widget.agent,
        customer: widget.customer,
        recent_sessions: widget.sessions,
        widget_url: widgetUrl,
        embed_code: embedCode
      }
    });

  } catch (error) {
    console.error('Error fetching N8N Chat widget:', error);
    return NextResponse.json(
      { error: 'Failed to fetch widget' },
      { status: 500 }
    );
  }
}

// PUT - Update a specific N8N Chat widget
export async function PUT(
  request: NextRequest,
  { params }: { params: { widgetId: string } }
) {
  try {
    const partner = await verifyPartnerAuth(request);
    if (!partner) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    
    // Validate request body
    const validationResult = updateWidgetSchema.safeParse(body);
    if (!validationResult.success) {
      return NextResponse.json(
        { 
          error: 'Validation failed',
          details: validationResult.error.errors
        },
        { status: 400 }
      );
    }

    const data = validationResult.data;

    // Find the existing widget
    const existingWidget = await prisma.n8nChatWidget.findFirst({
      where: {
        id: params.widgetId,
        partnerId: partner.id
      }
    });

    if (!existingWidget) {
      return NextResponse.json(
        { error: 'Widget not found' },
        { status: 404 }
      );
    }

    // Update widget
    const updatedWidget = await prisma.n8nChatWidget.update({
      where: {
        id: params.widgetId
      },
      data: {
        ...(data.name && { name: data.name }),
        ...(data.description !== undefined && { description: data.description }),
        ...(data.widget_config && { 
          widgetConfig: {
            ...existingWidget.widgetConfig as any,
            ...data.widget_config
          }
        }),
        ...(data.appearance && { 
          appearance: {
            ...existingWidget.appearance as any,
            ...data.appearance
          }
        }),
        ...(data.behavior && { 
          behavior: {
            ...existingWidget.behavior as any,
            ...data.behavior
          }
        }),
        ...(data.allowed_domains && { allowedDomains: data.allowed_domains }),
        ...(data.is_active !== undefined && { isActive: data.is_active }),
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
        }
      }
    });

    // Generate URLs
    const analyticsUrl = process.env.ANALYTICS_API_URL || 'https://analytics.knotie-ai.pro';
    const widgetUrl = `${analyticsUrl}/widget/n8n-chat/${updatedWidget.widgetToken}`;
    const embedCode = generateEmbedCode(widgetUrl, updatedWidget.appearance);

    return NextResponse.json({
      success: true,
      message: 'Widget updated successfully',
      data: {
        id: updatedWidget.id,
        name: updatedWidget.name,
        description: updatedWidget.description,
        agent_id: updatedWidget.agentId,
        customer_id: updatedWidget.customerId,
        widget_config: updatedWidget.widgetConfig,
        appearance: updatedWidget.appearance,
        behavior: updatedWidget.behavior,
        widget_token: updatedWidget.widgetToken,
        allowed_domains: updatedWidget.allowedDomains,
        is_active: updatedWidget.isActive,
        total_sessions: updatedWidget.totalSessions,
        total_messages: updatedWidget.totalMessages,
        last_used_at: updatedWidget.lastUsedAt,
        created_at: updatedWidget.createdAt,
        updated_at: updatedWidget.updatedAt,
        agent: updatedWidget.agent,
        customer: updatedWidget.customer,
        widget_url: widgetUrl,
        embed_code: embedCode
      }
    });

  } catch (error) {
    console.error('Error updating N8N Chat widget:', error);
    return NextResponse.json(
      { error: 'Failed to update widget' },
      { status: 500 }
    );
  }
}

// DELETE - Delete a specific N8N Chat widget
export async function DELETE(
  request: NextRequest,
  { params }: { params: { widgetId: string } }
) {
  try {
    const partner = await verifyPartnerAuth(request);
    if (!partner) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Find the existing widget
    const existingWidget = await prisma.n8nChatWidget.findFirst({
      where: {
        id: params.widgetId,
        partnerId: partner.id
      }
    });

    if (!existingWidget) {
      return NextResponse.json(
        { error: 'Widget not found' },
        { status: 404 }
      );
    }

    // Delete widget (sessions will be cascade deleted)
    await prisma.n8nChatWidget.delete({
      where: {
        id: params.widgetId
      }
    });

    return NextResponse.json({
      success: true,
      message: 'Widget deleted successfully'
    });

  } catch (error) {
    console.error('Error deleting N8N Chat widget:', error);
    return NextResponse.json(
      { error: 'Failed to delete widget' },
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
