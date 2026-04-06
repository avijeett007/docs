import { NextRequest, NextResponse } from 'next/server';
import { verifyPartnerAuth } from '@/lib/auth/partnerAuth';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';

// Validation schema for updating BYO agents
const updateByoAgentSchema = z.object({
  name: z.string().min(1, 'Agent name is required').max(100).optional(),
  description: z.string().max(500).optional(),
  status: z.enum(['active', 'inactive']).optional(),
  tool_definitions: z.array(z.object({
    appName: z.string(),
    toolName: z.string(),
  })).optional(),
  config_json: z.string().optional(),
  customer_id: z.string().optional(),
});

export const dynamic = 'force-dynamic';

// GET - Get a specific BYO agent
export async function GET(
  request: NextRequest,
  { params }: { params: { agentId: string } }
) {
  try {
    const partner = await verifyPartnerAuth(request);
    if (!partner) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const agent = await prisma.byoAgent.findFirst({
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
        { error: 'BYO agent not found' },
        { status: 404 }
      );
    }

    // Get analytics data
    let analytics = null;
    try {
      const analyticsResponse = await fetch(
        `${process.env.ANALYTICS_API_URL || 'https://analytics.knotie-ai.pro'}/api/agents/${agent.analyticsAgentId || agent.id}/analytics`,
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
      console.warn('Failed to fetch analytics for BYO agent:', agent.id);
    }

    const transformedAgent = {
      id: agent.id,
      name: agent.name,
      description: agent.description,
      framework: agent.framework,
      customer_id: agent.customerId,
      customer_name: `${agent.customer?.firstName || ''} ${agent.customer?.lastName || ''}`.trim() ||
                    agent.customer?.email || 'Unknown Customer',
      tool_definitions: agent.toolDefinitions ? JSON.parse(agent.toolDefinitions) : [],
      config_json: agent.configJson ? JSON.parse(agent.configJson) : null,
      status: agent.status,
      is_active: agent.isActive,
      webhook_url: agent.webhookUrl,
      webhook_secret: agent.webhookSecret,
      analytics_agent_id: agent.analyticsAgentId,
      last_active_at: agent.lastActiveAt,
      created_at: agent.createdAt,
      updated_at: agent.updatedAt,
      analytics: analytics ? {
        total_calls: analytics.total_calls || 0,
        total_duration_minutes: analytics.total_duration_minutes || 0,
        avg_call_duration_seconds: analytics.avg_call_duration_seconds || 0,
        total_cost: analytics.total_cost || 0,
      } : null
    };

    return NextResponse.json({
      success: true,
      agent: transformedAgent
    });

  } catch (error) {
    console.error('Error fetching BYO agent:', error);
    return NextResponse.json(
      { error: 'Failed to fetch BYO agent' },
      { status: 500 }
    );
  }
}

// PUT - Update a specific BYO agent
export async function PUT(
  request: NextRequest,
  { params }: { params: { agentId: string } }
) {
  return await updateAgent(request, { params });
}

// PATCH - Update a specific BYO agent (preferred method)
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

    // Handle customer reassignment specifically
    if (body.customer_id && Object.keys(body).length === 1) {
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

      const updatedAgent = await prisma.byoAgent.update({
        where: {
          id: params.agentId,
          partnerId: partner.id
        },
        data: {
          customerId: body.customer_id,
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
        message: 'BYO agent reassigned successfully',
        agent: transformByoAgent(updatedAgent)
      });
    }

    // Validate request body for other updates
    const validationResult = updateByoAgentSchema.safeParse(body);
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
    const existingAgent = await prisma.byoAgent.findFirst({
      where: {
        id: params.agentId,
        partnerId: partner.id
      }
    });

    if (!existingAgent) {
      return NextResponse.json(
        { error: 'BYO agent not found' },
        { status: 404 }
      );
    }

    // Prepare update data
    const updateData: Record<string, unknown> = {};

    if (data.name !== undefined) updateData.name = data.name;
    if (data.description !== undefined) updateData.description = data.description;
    if (data.status !== undefined) {
      updateData.status = data.status;
      updateData.isActive = data.status === 'active';
    }
    if (data.tool_definitions !== undefined) updateData.toolDefinitions = JSON.stringify(data.tool_definitions);
    if (data.config_json !== undefined) updateData.configJson = data.config_json;

    // Update the agent
    const updatedAgent = await prisma.byoAgent.update({
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
      const analyticsUpdateData: Record<string, unknown> = {};

      if (data.name !== undefined) {
        analyticsUpdateData.agent_name = updatedAgent.name;
      }
      if (data.status !== undefined) {
        analyticsUpdateData.status = updatedAgent.status;
      }
      if (data.tool_definitions !== undefined) {
        analyticsUpdateData.config = {
          framework: updatedAgent.framework,
          tool_definitions: data.tool_definitions,
        };
      }

      if (Object.keys(analyticsUpdateData).length > 0) {
        const analyticsResponse = await fetch(
          `${process.env.ANALYTICS_API_URL || 'https://analytics.knotie-ai.pro'}/api/agents/${existingAgent.analyticsAgentId || params.agentId}`,
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
          console.warn('[BYO-AGENTS] Failed to update agent in analytics service:', await analyticsResponse.text());
        }
      }
    } catch (error) {
      console.warn('[BYO-AGENTS] Failed to update agent in analytics service:', error);
    }

    return NextResponse.json({
      success: true,
      message: 'BYO agent updated successfully',
      agent: transformByoAgent(updatedAgent)
    });

  } catch (error) {
    console.error('Error updating BYO agent:', error);
    return NextResponse.json(
      { error: 'Failed to update BYO agent' },
      { status: 500 }
    );
  }
}

// DELETE - Delete a specific BYO agent
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
    const existingAgent = await prisma.byoAgent.findFirst({
      where: {
        id: params.agentId,
        partnerId: partner.id
      }
    });

    if (!existingAgent) {
      return NextResponse.json(
        { error: 'BYO agent not found' },
        { status: 404 }
      );
    }

    // Delete from analytics service first
    try {
      const analyticsResponse = await fetch(
        `${process.env.ANALYTICS_API_URL || 'https://analytics.knotie-ai.pro'}/api/agents/${existingAgent.analyticsAgentId || params.agentId}`,
        {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${process.env.ANALYTICS_STANDARD_API_KEY}`,
          }
        }
      );

      if (!analyticsResponse.ok) {
        console.warn('[BYO-AGENTS] Failed to delete agent from analytics service:', await analyticsResponse.text());
      }
    } catch (error) {
      console.warn('[BYO-AGENTS] Failed to delete agent from analytics service:', error);
    }

    // Delete the agent from main database
    await prisma.byoAgent.delete({
      where: { id: params.agentId }
    });

    return NextResponse.json({
      success: true,
      message: 'BYO agent deleted successfully'
    });

  } catch (error) {
    console.error('Error deleting BYO agent:', error);
    return NextResponse.json(
      { error: 'Failed to delete BYO agent' },
      { status: 500 }
    );
  }
}

// Helper function to transform agent for response
function transformByoAgent(agent: {
  id: string;
  name: string;
  description: string | null;
  framework: string;
  customerId: string;
  customer?: { id: string; firstName: string | null; lastName: string | null; email: string | null } | null;
  toolDefinitions: string | null;
  configJson: string | null;
  status: string;
  isActive: boolean;
  webhookUrl: string | null;
  analyticsAgentId: string | null;
  lastActiveAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: agent.id,
    name: agent.name,
    description: agent.description,
    framework: agent.framework,
    customer_id: agent.customerId,
    customer_name: `${agent.customer?.firstName || ''} ${agent.customer?.lastName || ''}`.trim() ||
                  agent.customer?.email || 'Unknown Customer',
    tool_definitions: agent.toolDefinitions ? JSON.parse(agent.toolDefinitions) : [],
    config_json: agent.configJson ? JSON.parse(agent.configJson) : null,
    status: agent.status,
    is_active: agent.isActive,
    webhook_url: agent.webhookUrl,
    analytics_agent_id: agent.analyticsAgentId,
    last_active_at: agent.lastActiveAt,
    created_at: agent.createdAt,
    updated_at: agent.updatedAt,
  };
}

