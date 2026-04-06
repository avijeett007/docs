import { NextRequest, NextResponse } from 'next/server';
import { verifyPartnerAuth } from '@/lib/auth/partnerAuth';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

// POST - Register a specific N8N Chat agent with analytics service
export async function POST(
  request: NextRequest,
  { params }: { params: { agentId: string } }
) {
  try {
    const partner = await verifyPartnerAuth(request);
    if (!partner) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get the specific N8N Chat agent
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

    // Register the agent with the analytics service
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

      if (!analyticsResponse.ok) {
        const errorText = await analyticsResponse.text();
        console.error('Failed to register agent with analytics service:', errorText);
        return NextResponse.json(
          { error: 'Failed to register agent with analytics service', details: errorText },
          { status: 500 }
        );
      }

      const analyticsData = await analyticsResponse.json();
      
      console.log(`✅ Registered N8N Chat agent ${agent.id} with analytics service`);

      return NextResponse.json({
        message: 'Agent registered with analytics service successfully',
        agent_id: agent.id,
        agent_name: agent.name,
        provider: agent.integrationMode === 'custom_node' ? 'n8n_chat' : 'n8n_chat_proxy',
        analytics_data: analyticsData,
        webhook_url: agent.integrationMode === 'custom_node'
          ? `${process.env.ANALYTICS_API_URL || 'https://analytics.knotie-ai.pro'}/webhooks/n8n-chat/${partner.id}/${agent.customerId}/${agent.id}`
          : `${process.env.ANALYTICS_API_URL || 'https://analytics.knotie-ai.pro'}/proxy/n8n-chat/${partner.id}/${agent.customerId}/${agent.id}`,
        analytics_url: `${process.env.ANALYTICS_API_URL || 'https://analytics.knotie-ai.pro'}/api/agents/${agent.id}/chat-analytics`
      });

    } catch (error) {
      console.error('Error registering agent with analytics service:', error);
      return NextResponse.json(
        { error: 'Failed to register agent with analytics service' },
        { status: 500 }
      );
    }

  } catch (error) {
    console.error('Error registering N8N Chat agent with analytics:', error);
    return NextResponse.json(
      { error: 'Failed to register N8N Chat agent with analytics service' },
      { status: 500 }
    );
  }
}
