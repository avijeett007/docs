import { NextRequest, NextResponse } from 'next/server';
import { verifyCustomerAuth } from '@/lib/auth/customerAuth';
import { prisma } from '@/lib/prisma';

// Mark this route as dynamic
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    // Verify customer authentication
    const customerAuth = await verifyCustomerAuth(request);

    if (!customerAuth) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get the customer ID and partner ID from the auth
    const { customerId } = customerAuth;

    // Get the customer record with all agent types
    const customer = await prisma.customer.findUnique({
      where: { id: customerId },
      include: {
        vapiAgents: {
          select: {
            id: true,
            name: true,
            createdAt: true,
            customerId: true,
            partnerId: true,
            isActive: true
          }
        },
        retellAgents: {
          select: {
            id: true,
            name: true,
            voiceId: true,
            language: true,
            createdAt: true,
            customerId: true,
            partnerId: true,
            isActive: true
          }
        },
        ultravoxAgents: {
          select: {
            id: true,
            name: true,
            createdAt: true,
            customerId: true,
            partnerId: true,
            isActive: true
          }
        },
        elevenlabsAgents: {
          select: {
            id: true,
            name: true,
            createdAt: true,
            customerId: true,
            partnerId: true,
            isActive: true
          }
        },
        ghlAgents: {
          select: {
            id: true,
            name: true,
            createdAt: true,
            customerId: true,
            partnerId: true,
            isActive: true
          }
        },
        knovaAgents: {
          select: {
            id: true,
            name: true,
            agentType: true,
            status: true,
            isActive: true,
            createdAt: true,
            customerId: true,
            partnerId: true,
            phoneNumbers: {
              select: {
                id: true,
                phoneNumber: true,
                status: true
              }
            }
          }
        },
        n8nChatAgents: {
          select: {
            id: true,
            name: true,
            description: true,
            status: true,
            integrationMode: true,
            createdAt: true,
            customerId: true,
            partnerId: true
          }
        },
        retellChatAgents: {
          select: {
            id: true,
            name: true,
            status: true,
            isActive: true,
            language: true,
            createdAt: true,
            customerId: true,
            partnerId: true
          }
        }
      }
    });

    if (!customer) {
      return NextResponse.json({ error: 'Customer not found' }, { status: 404 });
    }

    // Format the agents (hide provider details from whitelabel customers)
    const formattedVapiAgents = customer.vapiAgents.map(agent => ({
      id: agent.id,
      type: 'vapi',
      name: agent.name,
      description: 'Voice AI Assistant',
      status: agent.isActive ? 'active' : 'inactive',
      createdAt: agent.createdAt,
    }));

    const formattedRetellAgents = customer.retellAgents.map(agent => ({
      id: agent.id,
      type: 'retell',
      name: agent.name,
      description: 'Voice AI Assistant',
      status: agent.isActive ? 'active' : 'inactive',
      createdAt: agent.createdAt,
    }));

    const formattedUltravoxAgents = customer.ultravoxAgents.map(agent => ({
      id: agent.id,
      type: 'ultravox',
      name: agent.name,
      description: 'Voice AI Assistant',
      status: agent.isActive ? 'active' : 'inactive',
      createdAt: agent.createdAt,
    }));

    const formattedElevenLabsAgents = customer.elevenlabsAgents.map(agent => ({
      id: agent.id,
      type: 'elevenlabs',
      name: agent.name,
      description: 'Voice AI Assistant',
      status: agent.isActive ? 'active' : 'inactive',
      createdAt: agent.createdAt,
    }));

    const formattedGhlAgents = customer.ghlAgents.map(agent => ({
      id: agent.id,
      type: 'ghl',
      name: agent.name,
      description: 'Voice AI Assistant',
      status: agent.isActive ? 'active' : 'inactive',
      createdAt: agent.createdAt,
    }));

    const formattedN8nChatAgents = customer.n8nChatAgents.map(agent => ({
      id: agent.id,
      type: 'n8n_chat',
      name: agent.name,
      description: agent.description || 'Chat AI Assistant',
      status: agent.status === 'active' ? 'active' : 'inactive',
      integrationMode: agent.integrationMode,
      createdAt: agent.createdAt,
    }));

    const formattedRetellChatAgents = customer.retellChatAgents.map(agent => ({
      id: agent.id,
      type: 'retell_chat',
      name: agent.name,
      description: 'Chat AI Assistant',
      status: agent.isActive && agent.status === 'active' ? 'active' : 'inactive',
      language: agent.language,
      createdAt: agent.createdAt,
    }));

    // Format Knova agents with phone numbers
    const formattedKnovaAgents = customer.knovaAgents.map(agent => {
      // Get the first active phone number assigned to this agent
      const activePhone = agent.phoneNumbers.find(p => p.status === 'active');

      return {
        id: agent.id,
        type: 'knova',
        name: agent.name,
        description: 'AI Receptionist',
        status: agent.isActive && agent.status === 'active' ? 'active' : 'inactive',
        agentType: agent.agentType,
        createdAt: agent.createdAt,
        // Include phone number for testing
        phoneNumber: activePhone?.phoneNumber || null,
        phoneNumberId: activePhone?.id || null,
      };
    });

    // Combine all agents and sort by creation date (newest first)
    const allAgents = [
      ...formattedVapiAgents,
      ...formattedRetellAgents,
      ...formattedUltravoxAgents,
      ...formattedElevenLabsAgents,
      ...formattedGhlAgents,
      ...formattedKnovaAgents,
      ...formattedN8nChatAgents,
      ...formattedRetellChatAgents
    ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    return NextResponse.json({
      agents: allAgents,
    });
  } catch (error) {
    console.error('Error fetching agents:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
