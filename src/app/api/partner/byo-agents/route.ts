import { NextRequest, NextResponse } from 'next/server';
import { verifyPartnerAuth } from '@/lib/auth/partnerAuth';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';

// Validation schema for creating BYO agents
const createByoAgentSchema = z.object({
  name: z.string().min(1, 'Agent name is required').max(100),
  description: z.string().max(500).optional(),
  framework: z.enum(['livekit', 'pipecat']),
  customer_id: z.string().min(1, 'Customer ID is required'),
  tool_definitions: z.array(z.object({
    appName: z.string(),
    toolName: z.string(),
  })).optional().default([]),
});

export const dynamic = 'force-dynamic';

// GET - List all BYO agents for a partner
export async function GET(request: NextRequest) {
  try {
    const partner = await verifyPartnerAuth(request);
    if (!partner) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const agents = await prisma.byoAgent.findMany({
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

    const transformedAgents = agents.map((agent) => ({
      id: agent.id,
      name: agent.name,
      description: agent.description,
      framework: agent.framework,
      customer_id: agent.customerId,
      customer_name: `${agent.customer?.firstName || ''} ${agent.customer?.lastName || ''}`.trim() ||
                    agent.customer?.email || 'Unknown Customer',
      tool_definitions: agent.toolDefinitions ? JSON.parse(agent.toolDefinitions) : [],
      status: agent.status,
      is_active: agent.isActive,
      webhook_url: agent.webhookUrl,
      analytics_agent_id: agent.analyticsAgentId,
      last_active_at: agent.lastActiveAt,
      created_at: agent.createdAt,
      updated_at: agent.updatedAt,
    }));

    return NextResponse.json({
      success: true,
      agents: transformedAgents
    });

  } catch (error) {
    console.error('Error fetching BYO agents:', error);
    return NextResponse.json(
      { error: 'Failed to fetch BYO agents' },
      { status: 500 }
    );
  }
}

// POST - Create a new BYO agent
export async function POST(request: NextRequest) {
  try {
    const partner = await verifyPartnerAuth(request);
    if (!partner) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    console.log('[BYO-AGENTS] Creating agent with data:', body);

    // Validate request body
    const validationResult = createByoAgentSchema.safeParse(body);
    if (!validationResult.success) {
      console.log('[BYO-AGENTS] Validation failed:', validationResult.error.errors);
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

    // Generate API token: byo_ prefix + 48-char random hex
    const rawToken = `byo_${crypto.randomBytes(24).toString('hex')}`;
    const apiTokenHash = await bcrypt.hash(rawToken, 10);
    // SHA-256 hash for fast ConnectHub lookups (bcrypt is too slow for per-request validation)
    const tokenSha256 = crypto.createHash('sha256').update(rawToken).digest('hex');

    // Generate webhook secret: 32-byte random hex
    const webhookSecret = crypto.randomBytes(32).toString('hex');

    // Create the agent in the database
    const agent = await prisma.byoAgent.create({
      data: {
        name: data.name,
        description: data.description,
        framework: data.framework,
        partnerId: partner.id,
        customerId: data.customer_id,
        apiTokenHash,
        tokenSha256,
        webhookSecret,
        toolDefinitions: JSON.stringify(data.tool_definitions),
        status: 'active',
        isActive: true,
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

    // Build the analytics webhook URL
    const analyticsBaseUrl = process.env.ANALYTICS_API_URL || 'https://analytics.knotie-ai.pro';
    const webhookUrl = `${analyticsBaseUrl}/webhooks/byo/${partner.id}/${data.customer_id}/${agent.id}`;

    // Register agent in analytics service
    let analyticsAgentId: string | null = null;
    try {
      const analyticsResponse = await fetch(
        `${analyticsBaseUrl}/api/agents/register`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': process.env.ANALYTICS_STANDARD_API_KEY || 'test-api-key',
          },
          body: JSON.stringify({
            agent_id: agent.id,
            provider: `byo_${data.framework}`,
            partner_id: partner.id,
            customer_id: data.customer_id,
            agent_name: data.name,
            config: {
              framework: data.framework,
              webhook_secret: webhookSecret,
              webhook_enabled: true,
              tool_definitions: data.tool_definitions,
            }
          })
        }
      );

      if (analyticsResponse.ok) {
        const analyticsData = await analyticsResponse.json();
        analyticsAgentId = analyticsData.agent_id || agent.id;
        console.log(`[BYO-AGENTS] Registered agent ${agent.id} with analytics service`);
      } else {
        console.warn('[BYO-AGENTS] Failed to register agent in analytics service:', await analyticsResponse.text());
      }
    } catch (error) {
      console.warn('[BYO-AGENTS] Failed to register agent in analytics service:', error);
    }

    // Update agent with webhook URL and analytics agent ID
    await prisma.byoAgent.update({
      where: { id: agent.id },
      data: {
        webhookUrl,
        analyticsAgentId: analyticsAgentId || agent.id,
      }
    });

    // Build framework-specific quick start code
    const quickStartCode = data.framework === 'livekit'
      ? `from knotie_connect import KnotieConnect
from livekit.agents import Agent, AgentSession, JobContext, WorkerOptions, cli

knotie = KnotieConnect(token="${rawToken}")

class MyAgent(Agent):
    def __init__(self):
        tools = knotie.get_livekit_tools()
        super().__init__(
            instructions="Your agent instructions here",
            tools=tools,
        )

async def entrypoint(ctx: JobContext):
    await ctx.connect()
    session = AgentSession()
    await session.start(agent=MyAgent(), room=ctx.room)

if __name__ == "__main__":
    cli.run_app(WorkerOptions(entrypoint_fnc=entrypoint))`
      : `from knotie_connect import KnotieConnect
from pipecat.pipeline.pipeline import Pipeline

knotie = KnotieConnect(token="${rawToken}")
tools = knotie.get_pipecat_tools()

# Register tools with your Pipecat LLM service
for tool in tools:
    llm.register_function(tool["name"], tool["handler"])`;

    // Transform response - include raw token (shown only once)
    const transformedAgent = {
      id: agent.id,
      name: agent.name,
      description: agent.description,
      framework: agent.framework,
      customer_id: agent.customerId,
      customer_name: `${agent.customer?.firstName || ''} ${agent.customer?.lastName || ''}`.trim() ||
                    agent.customer?.email || 'Unknown Customer',
      tool_definitions: data.tool_definitions,
      status: agent.status,
      is_active: agent.isActive,
      api_token: rawToken, // Shown ONLY on creation
      webhook_url: webhookUrl,
      webhook_secret: webhookSecret, // Shown ONLY on creation
      analytics_agent_id: analyticsAgentId || agent.id,
      created_at: agent.createdAt,
      updated_at: agent.updatedAt,
    };

    return NextResponse.json({
      success: true,
      message: 'BYO agent created successfully',
      agent: transformedAgent,
      integration: {
        pip_install: 'pip install knotie-connect',
        quick_start_code: quickStartCode,
        docs_url: 'https://docs.knotie-ai.pro/byo-agent',
      }
    }, { status: 201 });

  } catch (error) {
    console.error('Error creating BYO agent:', error);
    return NextResponse.json(
      { error: 'Failed to create BYO agent' },
      { status: 500 }
    );
  }
}

