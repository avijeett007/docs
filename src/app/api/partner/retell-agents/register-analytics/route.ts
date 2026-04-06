import { NextRequest, NextResponse } from 'next/server';
import { verifyPartnerJWT } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { registerAgentInAnalytics, generateWebhookUrl } from '@/lib/analytics';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    // Verify the partner JWT token
    const decoded = await verifyPartnerJWT(req);
    if (!decoded || !decoded.payload || !decoded.isValid) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const partnerId = decoded.payload.partnerId;

    // Get all active Retell agents for this partner
    const agents = await prisma.retellAgent.findMany({
      where: {
        partnerId,
        isActive: true,
      },
      include: {
        customer: {
          select: {
            id: true,
          },
        },
      },
    });

    if (agents.length === 0) {
      return NextResponse.json({
        message: 'No agents found',
        agents: [],
        registeredCount: 0,
      });
    }

    // Filter agents that don't have an analytics agent ID
    const agentsToRegister = agents.filter(agent => !agent.analyticsAgentId);

    if (agentsToRegister.length === 0) {
      return NextResponse.json({
        message: 'All agents already registered with analytics service',
        agents,
        registeredCount: 0,
      });
    }

    // Register each agent with the analytics service
    let registeredCount = 0;
    const updatedAgents = [...agents];

    for (const agent of agentsToRegister) {
      try {
        // Register the agent with the analytics service
        const result = await registerAgentInAnalytics({
          agentId: agent.id,
          provider: 'retell',
          partnerId,
          agentName: agent.name,
          customerId: agent.customerId || undefined,
          profitMultiplier: agent.profitMultiplier,
        });

        // If registration was successful and we got an analytics agent ID, store it
        if (result.success && result.analyticsAgentId) {
          const webhookUrl = generateWebhookUrl({
            provider: 'retell',
            analyticsAgentId: result.analyticsAgentId,
          });

          // Update the agent in the database
          await prisma.retellAgent.update({
            where: { id: agent.id },
            data: {
              analyticsAgentId: result.analyticsAgentId,
              webhookUrl,
            },
          });

          // Update the agent in the response
          const index = updatedAgents.findIndex(a => a.id === agent.id);
          if (index !== -1) {
            updatedAgents[index] = {
              ...updatedAgents[index],
              analyticsAgentId: result.analyticsAgentId,
              webhookUrl,
            };
          }

          registeredCount++;
        }
      } catch (error) {
        console.error(`[register-analytics/route] Error registering agent ${agent.id}:`, error);
        // Continue with the next agent
      }
    }

    return NextResponse.json({
      message: `Successfully registered ${registeredCount} agents with analytics service`,
      agents: updatedAgents,
      registeredCount,
    });
  } catch (error) {
    console.error('[register-analytics/route] Error registering agents:', error);
    return NextResponse.json(
      { error: 'Failed to register agents with analytics service' },
      { status: 500 }
    );
  }
}
