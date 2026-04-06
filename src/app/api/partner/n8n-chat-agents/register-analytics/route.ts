import { NextRequest, NextResponse } from 'next/server';
import { verifyPartnerAuth } from '@/lib/auth/partnerAuth';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

// POST - Register all N8N Chat agents with analytics service
export async function POST(request: NextRequest) {
  try {
    const partner = await verifyPartnerAuth(request);
    if (!partner) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get all N8N Chat agents for this partner
    const agents = await prisma.n8nChatAgent.findMany({
      where: {
        partnerId: partner.id,
        isActive: true
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

    if (agents.length === 0) {
      return NextResponse.json({
        message: 'No N8N Chat agents found for this partner',
        agents: [],
        registeredCount: 0,
      });
    }

    // Register each agent with the analytics service
    let registeredCount = 0;
    const results = [];

    for (const agent of agents) {
      try {
        // Register the agent with the analytics service
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
              provider: agent.integrationMode === 'custom_node' ? 'n8n_chat' : 'n8n_chat_proxy',
              partner_id: partner.id,
              customer_id: agent.customerId,
              agent_name: agent.name,
              config: {
                integration_mode: agent.integrationMode,
                n8n_webhook_url: agent.n8nWebhookUrl,
                webhook_secret: agent.webhookSecret,
                webhook_enabled: agent.webhookEnabled
              }
            })
          }
        );

        if (analyticsResponse.ok) {
          const analyticsData = await analyticsResponse.json();
          registeredCount++;
          
          results.push({
            agent_id: agent.id,
            agent_name: agent.name,
            status: 'registered',
            analytics_data: analyticsData
          });
          
          console.log(`✅ Registered N8N Chat agent ${agent.id} with analytics service`);
        } else {
          const errorText = await analyticsResponse.text();
          console.warn(`⚠️ Failed to register N8N Chat agent ${agent.id}:`, errorText);
          
          results.push({
            agent_id: agent.id,
            agent_name: agent.name,
            status: 'failed',
            error: errorText
          });
        }
      } catch (error) {
        console.error(`❌ Error registering N8N Chat agent ${agent.id}:`, error);
        results.push({
          agent_id: agent.id,
          agent_name: agent.name,
          status: 'error',
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    return NextResponse.json({
      message: `Registered ${registeredCount} out of ${agents.length} N8N Chat agents with analytics service`,
      totalAgents: agents.length,
      registeredCount,
      results
    });

  } catch (error) {
    console.error('Error registering N8N Chat agents with analytics:', error);
    return NextResponse.json(
      { error: 'Failed to register N8N Chat agents with analytics service' },
      { status: 500 }
    );
  }
}
