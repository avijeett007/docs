import { NextRequest, NextResponse } from 'next/server';
import { verifyPartnerAuth } from '@/lib/auth/partnerAuth';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';

// Credit configuration schema
const creditConfigSchema = z.object({
  billing_mode: z.enum(['per_conversation', 'per_message_pair', 'per_10_messages', 'per_minute']).default('per_conversation'),
  credits_per_unit: z.number().min(0.1).default(1),
  minimum_credits: z.number().min(1).default(1),
});

// Validation schema for updating N8N Chat agents
const updateAgentSchema = z.object({
  name: z.string().min(1, 'Agent name is required').optional(),
  description: z.string().optional(),
  integration_mode: z.enum(['custom_node', 'proxy']).optional(),
  n8n_webhook_url: z.string().url().optional(),
  webhook_secret: z.string().min(1, 'Webhook secret is required').optional(),
  status: z.enum(['active', 'inactive', 'testing']).optional(),
  credit_config: creditConfigSchema.optional(),
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

// GET - Get a specific N8N Chat agent
export async function GET(
  request: NextRequest,
  { params }: { params: { agentId: string } }
) {
  try {
    const partner = await verifyPartnerAuth(request);
    if (!partner) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const agent = await prisma.n8nChatAgent.findFirst({
      where: {
        id: params.agentId,
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

    if (!agent) {
      return NextResponse.json(
        { error: 'N8N Chat agent not found' },
        { status: 404 }
      );
    }

    // Get analytics data
    let analytics = null;
    try {
      const analyticsResponse = await fetch(
        `${process.env.ANALYTICS_API_URL || 'https://analytics.knotie-ai.pro'}/api/agents/${agent.id}/chat-analytics`,
        {
          headers: {
            'Authorization': `Bearer ${process.env.ANALYTICS_STANDARD_API_KEY}`,
          }
        }
      );
      
      if (analyticsResponse.ok) {
        analytics = await analyticsResponse.json();
      }
    } catch (error) {
      console.warn('Failed to fetch analytics for agent:', agent.id);
    }

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
      analytics: analytics ? {
        total_conversations: analytics.total_conversations || 0,
        total_messages: analytics.total_messages || 0,
        avg_response_time_ms: analytics.avg_response_time_ms || 0
      } : null
    };

    return NextResponse.json({
      success: true,
      agent: transformedAgent
    });

  } catch (error) {
    console.error('Error fetching N8N Chat agent:', error);
    return NextResponse.json(
      { error: 'Failed to fetch N8N Chat agent' },
      { status: 500 }
    );
  }
}

// PUT - Update a specific N8N Chat agent
export async function PUT(
  request: NextRequest,
  { params }: { params: { agentId: string } }
) {
  return await updateAgent(request, { params });
}

// PATCH - Update a specific N8N Chat agent (preferred method)
export async function PATCH(
  request: NextRequest,
  { params }: { params: { agentId: string } }
) {
  return await updateAgent(request, { params });
}

// Shared update logic for both PUT and PATCH
async function updateAgent(
  request: NextRequest,
  { params }: { params: { agentId: string } }
) {
  try {
    const partner = await verifyPartnerAuth(request);
    if (!partner) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();

    // Handle customer reassignment specifically (bypass validation for simple reassignment)
    if (body.customer_id && Object.keys(body).length === 1) {
      // Verify the customer belongs to the partner
      // Check if customer exists and belongs to this partner
      const customer = await prisma.customer.findUnique({
        where: { id: body.customer_id },
        include: {
          userOnboarding: {
            where: { partnerId: partner.id }
          }
        }
      });

      if (!customer || customer.userOnboarding.length === 0) {
        return NextResponse.json(
          { error: 'Customer not found or not associated with this partner' },
          { status: 404 }
        );
      }



      // Update the agent's customer assignment
      const updatedAgent = await prisma.n8nChatAgent.update({
        where: {
          id: params.agentId,
          partnerId: partner.id
        },
        data: {
          customerId: body.customer_id,
          updatedAt: new Date()
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

      return NextResponse.json({
        success: true,
        message: 'Agent reassigned successfully',
        agent: {
          id: updatedAgent.id,
          name: updatedAgent.name,
          description: updatedAgent.description,
          customer_id: updatedAgent.customerId,
          customer_name: updatedAgent.customer
            ? `${updatedAgent.customer.firstName || ''} ${updatedAgent.customer.lastName || ''}`.trim() || updatedAgent.customer.email
            : null,
          integration_mode: updatedAgent.integrationMode,
          n8n_webhook_url: updatedAgent.n8nWebhookUrl,
          webhook_secret: updatedAgent.webhookSecret,
          status: updatedAgent.status,
          is_active: updatedAgent.isActive,
          created_at: updatedAgent.createdAt,
          updated_at: updatedAgent.updatedAt
        }
      });
    }

    // Validate request body for other updates
    const validationResult = updateAgentSchema.safeParse(body);
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

    // Find the existing agent
    const existingAgent = await prisma.n8nChatAgent.findFirst({
      where: {
        id: params.agentId,
        partnerId: partner.id
      }
    });

    if (!existingAgent) {
      return NextResponse.json(
        { error: 'N8N Chat agent not found' },
        { status: 404 }
      );
    }

    // Prepare update data
    const updateData: any = {};

    if (data.name !== undefined) updateData.name = data.name;
    if (data.description !== undefined) updateData.description = data.description;
    if (data.status !== undefined) updateData.status = data.status;
    if (data.integration_mode !== undefined) updateData.integrationMode = data.integration_mode;
    if (data.n8n_webhook_url !== undefined) updateData.n8nWebhookUrl = data.n8n_webhook_url;
    if (data.webhook_secret !== undefined) updateData.webhookSecret = data.webhook_secret;

    // Update the agent
    const updatedAgent = await prisma.n8nChatAgent.update({
      where: { id: params.agentId },
      data: updateData,
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

    // Update agent in analytics service
    try {
      const analyticsUpdateData: any = {};

      // Only include fields that were actually updated
      if (data.name !== undefined) {
        analyticsUpdateData.agent_name = updatedAgent.name;
      }

      if (data.integration_mode !== undefined) {
        analyticsUpdateData.provider = updatedAgent.integrationMode === 'custom_node' ? 'n8n_chat' : 'n8n_chat_proxy';
      }

      // Update config if any config-related fields changed
      if (data.integration_mode !== undefined || data.n8n_webhook_url !== undefined || data.webhook_secret !== undefined) {
        analyticsUpdateData.config = {
          integration_mode: updatedAgent.integrationMode,
          n8n_webhook_url: updatedAgent.n8nWebhookUrl,
          webhook_secret: updatedAgent.webhookSecret
        };
      }

      // Add credit_config if provided
      if (data.credit_config !== undefined) {
        analyticsUpdateData.credit_config = data.credit_config;
      }

      // Only make the call if there's something to update
      if (Object.keys(analyticsUpdateData).length > 0) {
        const analyticsResponse = await fetch(
          `${process.env.ANALYTICS_API_URL || 'https://analytics.knotie-ai.pro'}/api/agents/${params.agentId}`,
          {
            method: 'PATCH',
            headers: {
              'Content-Type': 'application/json',
              'x-api-key': process.env.ANALYTICS_STANDARD_API_KEY || 'test-api-key',
            },
            body: JSON.stringify(analyticsUpdateData)
          }
        );

        if (!analyticsResponse.ok) {
          console.warn('Failed to update agent in analytics service:', await analyticsResponse.text());
        }
      }
    } catch (error) {
      console.warn('Failed to update agent in analytics service:', error);
    }

    const transformedAgent = {
      id: updatedAgent.id,
      name: updatedAgent.name,
      description: updatedAgent.description,
      customer_id: updatedAgent.customerId,
      customer_name: `${updatedAgent.customer?.firstName || ''} ${updatedAgent.customer?.lastName || ''}`.trim() ||
                    updatedAgent.customer?.email || 'Unknown Customer',
      integration_mode: updatedAgent.integrationMode,
      n8n_webhook_url: updatedAgent.n8nWebhookUrl,
      webhook_secret: updatedAgent.webhookSecret,
      status: updatedAgent.status,
      is_active: updatedAgent.isActive,
      created_at: updatedAgent.createdAt,
      updated_at: updatedAgent.updatedAt
    };

    return NextResponse.json({
      success: true,
      message: 'N8N Chat agent updated successfully',
      agent: transformedAgent
    });

  } catch (error) {
    console.error('Error updating N8N Chat agent:', error);
    return NextResponse.json(
      { error: 'Failed to update N8N Chat agent' },
      { status: 500 }
    );
  }
}

// DELETE - Delete a specific N8N Chat agent
export async function DELETE(
  request: NextRequest,
  { params }: { params: { agentId: string } }
) {
  try {
    const partner = await verifyPartnerAuth(request);
    if (!partner) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Find the existing agent
    const existingAgent = await prisma.n8nChatAgent.findFirst({
      where: {
        id: params.agentId,
        partnerId: partner.id
      }
    });

    if (!existingAgent) {
      return NextResponse.json(
        { error: 'N8N Chat agent not found' },
        { status: 404 }
      );
    }

    // Delete from analytics service first
    try {
      const analyticsResponse = await fetch(
        `${process.env.ANALYTICS_API_URL || 'https://analytics.knotie-ai.pro'}/api/agents/${params.agentId}`,
        {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${process.env.ANALYTICS_STANDARD_API_KEY}`,
          }
        }
      );

      if (!analyticsResponse.ok) {
        console.warn('Failed to delete agent from analytics service:', await analyticsResponse.text());
      }
    } catch (error) {
      console.warn('Failed to delete agent from analytics service:', error);
    }

    // Delete the agent from main database
    await prisma.n8nChatAgent.delete({
      where: { id: params.agentId }
    });

    return NextResponse.json({
      success: true,
      message: 'N8N Chat agent deleted successfully'
    });

  } catch (error) {
    console.error('Error deleting N8N Chat agent:', error);
    return NextResponse.json(
      { error: 'Failed to delete N8N Chat agent' },
      { status: 500 }
    );
  }
}


