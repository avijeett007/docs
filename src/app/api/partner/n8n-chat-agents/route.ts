import { NextRequest, NextResponse } from 'next/server';
import { verifyPartnerAuth } from '@/lib/auth/partnerAuth';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';

// Validation schema for creating N8N Chat agents
const createAgentSchema = z.object({
  name: z.string().min(1, 'Agent name is required'),
  description: z.string().optional(),
  customer_id: z.string().min(1, 'Customer ID is required'),
  integration_mode: z.enum(['custom_node', 'proxy']),
  n8n_webhook_url: z.string().url().optional(),
  webhook_secret: z.string().min(1, 'Webhook secret is required'),
  status: z.enum(['active', 'inactive', 'testing']).default('testing'),
}).refine((data) => {
  // For proxy mode, n8n_webhook_url is required
  if (data.integration_mode === 'proxy' && !data.n8n_webhook_url) {
    return false;
  }
  return true;
}, {
  message: "N8N Webhook URL is required for proxy mode",
  path: ["n8n_webhook_url"]
});

export const dynamic = 'force-dynamic';

// GET - List all N8N Chat agents for a partner
export async function GET(request: NextRequest) {
  try {
    const partner = await verifyPartnerAuth(request);
    if (!partner) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get all N8N Chat agents for this partner
    const agents = await prisma.n8nChatAgent.findMany({
      where: {
        partnerId: partner.id
      },
      include: {
        customer: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    // Transform agents to include customer name and analytics
    const transformedAgents = await Promise.all(
      agents.map(async (agent) => {
        // Get analytics data from analytics service
        let analytics = null;
        try {
          const analyticsResponse = await fetch(
            `${process.env.ANALYTICS_API_URL || 'https://analytics.knotie-ai.pro'}/api/agents/${agent.id}/chat-analytics`,
            {
              headers: {
                'x-api-key': process.env.ANALYTICS_STANDARD_API_KEY || 'test-api-key',
              },
              // Add timeout to prevent hanging
              signal: AbortSignal.timeout(5000) // 5 second timeout
            }
          );

          if (analyticsResponse.ok) {
            analytics = await analyticsResponse.json();
          } else {
            console.warn(`Analytics service returned ${analyticsResponse.status} for agent:`, agent.id);
          }
        } catch (error) {
          console.warn('Failed to fetch analytics for agent:', agent.id, error instanceof Error ? error.message : 'Unknown error');
        }

        return {
          id: agent.id,
          name: agent.name,
          description: agent.description,
          customer_id: agent.customerId,
          customer_name: `${agent.customer?.firstName || ''} ${agent.customer?.lastName || ''}`.trim() ||
                        agent.customer?.email || 'Unknown Customer',
          integration_mode: agent.integrationMode,
          n8n_webhook_url: agent.n8nWebhookUrl,
          webhook_secret: agent.webhookSecret,
          status: agent.status,
          is_active: agent.isActive,
          created_at: agent.createdAt,
          updated_at: agent.updatedAt,
          analytics: analytics?.analytics ? {
            total_conversations: analytics.analytics.total_conversations || 0,
            total_messages: analytics.analytics.total_messages || 0,
            avg_response_time_ms: analytics.analytics.avg_response_time_ms || 0
          } : {
            total_conversations: 0,
            total_messages: 0,
            avg_response_time_ms: 0
          }
        };
      })
    );

    return NextResponse.json({
      success: true,
      agents: transformedAgents
    });

  } catch (error) {
    console.error('Error fetching N8N Chat agents:', error);
    return NextResponse.json(
      { error: 'Failed to fetch N8N Chat agents' },
      { status: 500 }
    );
  }
}

// POST - Create a new N8N Chat agent
export async function POST(request: NextRequest) {
  try {
    const partner = await verifyPartnerAuth(request);
    if (!partner) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    console.log('[N8N-CHAT-AGENTS] Creating agent with data:', body);

    // Validate request body
    const validationResult = createAgentSchema.safeParse(body);
    if (!validationResult.success) {
      console.log('[N8N-CHAT-AGENTS] Validation failed:', validationResult.error.errors);
      return NextResponse.json(
        {
          error: 'Validation failed',
          details: validationResult.error.errors
        },
        { status: 400 }
      );
    }

    const data = validationResult.data;

    // Verify customer belongs to this partner through UserOnboarding
    const userOnboarding = await prisma.userOnboarding.findFirst({
      where: {
        customerId: data.customer_id,
        partnerId: partner.id
      },
      include: {
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

    if (!userOnboarding) {
      return NextResponse.json(
        { error: 'Customer not found or does not belong to this partner' },
        { status: 404 }
      );
    }

    // Create the agent in the main database
    const agent = await prisma.n8nChatAgent.create({
      data: {
        name: data.name,
        description: data.description,
        partnerId: partner.id,
        customerId: data.customer_id,
        integrationMode: data.integration_mode,
        n8nWebhookUrl: data.n8n_webhook_url,
        webhookSecret: data.webhook_secret,
        status: data.status,
        isActive: true,
        webhookEnabled: true
      },
      include: {
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

    // Register agent in analytics service
    try {
      const analyticsResponse = await fetch(
        `${process.env.ANALYTICS_API_URL || 'https://analytics.knotie-ai.pro'}/api/agents/register`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': process.env.ANALYTICS_STANDARD_API_KEY || 'test-api-key',
          },
          body: JSON.stringify({
            agent_id: agent.id,
            provider: data.integration_mode === 'custom_node' ? 'n8n_chat' : 'n8n_chat_proxy',
            partner_id: partner.id,
            customer_id: data.customer_id,
            agent_name: data.name,
            config: {
              integration_mode: data.integration_mode,
              n8n_webhook_url: data.n8n_webhook_url,
              webhook_secret: data.webhook_secret,
              webhook_enabled: true
            }
          })
        }
      );

      if (!analyticsResponse.ok) {
        console.warn('Failed to register agent in analytics service:', await analyticsResponse.text());
      }
    } catch (error) {
      console.warn('Failed to register agent in analytics service:', error);
    }

    // Transform response
    const transformedAgent = {
      id: agent.id,
      name: agent.name,
      description: agent.description,
      customer_id: agent.customerId,
      customer_name: `${agent.customer?.firstName || ''} ${agent.customer?.lastName || ''}`.trim() ||
                    agent.customer?.email || 'Unknown Customer',
      integration_mode: agent.integrationMode,
      n8n_webhook_url: agent.n8nWebhookUrl,
      webhook_secret: agent.webhookSecret,
      status: agent.status,
      is_active: agent.isActive,
      created_at: agent.createdAt,
      updated_at: agent.updatedAt,
      webhook_url: agent.integrationMode === 'custom_node'
        ? `${process.env.ANALYTICS_API_URL || 'https://analytics.knotie-ai.pro'}/webhooks/n8n-chat/${partner.id}/${data.customer_id}/${agent.id}`
        : `${process.env.ANALYTICS_API_URL || 'https://analytics.knotie-ai.pro'}/proxy/n8n-chat/${partner.id}/${data.customer_id}/${agent.id}`,
      analytics_url: `${process.env.ANALYTICS_API_URL || 'https://analytics.knotie-ai.pro'}/api/agents/${agent.id}/chat-analytics`
    };

    return NextResponse.json({
      success: true,
      message: 'N8N Chat agent created successfully',
      agent: transformedAgent
    }, { status: 201 });

  } catch (error) {
    console.error('Error creating N8N Chat agent:', error);
    return NextResponse.json(
      { error: 'Failed to create N8N Chat agent' },
      { status: 500 }
    );
  }
}
