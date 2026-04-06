export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getPartnerFromToken } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

/**
 * GET /api/partner/ghl-agents/[agentId]
 * Get a specific GHL agent for the authenticated partner
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { agentId: string } }
) {
  try {
    console.log('[ghl-agents/[agentId]/route] Starting GHL agent fetch for:', params.agentId);

    // Use same authentication as other agent routes
    const partner = await getPartnerFromToken(request);
    if (!partner) {
      console.log('[ghl-agents/[agentId]/route] Authentication failed - no partner found');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log('[ghl-agents/[agentId]/route] Partner authenticated:', partner.id);

    // Find the specific GHL agent
    const agent = await prisma.ghlAgent.findFirst({
      where: {
        id: params.agentId,
        partnerId: partner.id, // Ensure agent belongs to this partner
      },
      include: {
        customer: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          }
        }
      }
    });

    if (!agent) {
      console.log('[ghl-agents/[agentId]/route] Agent not found or unauthorized');
      return NextResponse.json({ 
        error: 'Agent not found or unauthorized' 
      }, { status: 404 });
    }

    console.log('[ghl-agents/[agentId]/route] Found agent:', agent.id);

    // Transform the data for the frontend (same format as list endpoint)
    const transformedAgent = {
      id: agent.id,
      name: agent.name,
      customerId: agent.customerId,
      profitMultiplier: agent.profitMultiplier,
      basePerMinuteCost: agent.basePerMinuteCost,
      isActive: agent.isActive,
      analyticsAgentId: agent.analyticsAgentId,
      webhookEnabled: agent.webhookEnabled,
      webhookUrl: agent.webhookUrl,
      createdAt: agent.createdAt.toISOString(),
      updatedAt: agent.updatedAt.toISOString(),
      customer: agent.customer ? {
        id: agent.customer.id,
        firstName: agent.customer.firstName,
        lastName: agent.customer.lastName,
        email: agent.customer.email,
      } : null,
    };

    return NextResponse.json({
      agent: transformedAgent,
      partnerName: partner.businessName,
    });

  } catch (error) {
    console.error('[ghl-agents/[agentId]/route] Error fetching GHL agent:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/partner/ghl-agents/[agentId]
 * Update a specific GHL agent for the authenticated partner
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { agentId: string } }
) {
  try {
    console.log('[ghl-agents/[agentId]/route] Starting GHL agent update for:', params.agentId);

    // Use same authentication as other agent routes
    const partner = await getPartnerFromToken(request);
    if (!partner) {
      console.log('[ghl-agents/[agentId]/route] Authentication failed - no partner found');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log('[ghl-agents/[agentId]/route] Partner authenticated:', partner.id);

    // Get request body
    const updateData = await request.json();
    console.log('[ghl-agents/[agentId]/route] Update data:', updateData);

    // Verify the agent belongs to this partner
    const existingAgent = await prisma.ghlAgent.findFirst({
      where: {
        id: params.agentId,
        partnerId: partner.id,
      },
    });

    if (!existingAgent) {
      console.log('[ghl-agents/[agentId]/route] Agent not found or unauthorized');
      return NextResponse.json({ 
        error: 'Agent not found or unauthorized' 
      }, { status: 404 });
    }

    // Prepare update data (only allow certain fields to be updated)
    const allowedUpdates: any = {};
    
    if (updateData.name !== undefined) {
      allowedUpdates.name = updateData.name;
    }
    
    if (updateData.profitMultiplier !== undefined) {
      allowedUpdates.profitMultiplier = updateData.profitMultiplier;
    }
    
    if (updateData.isActive !== undefined) {
      allowedUpdates.isActive = updateData.isActive;
    }

    // Always update the timestamp
    allowedUpdates.updatedAt = new Date();

    // Update the agent
    const updatedAgent = await prisma.ghlAgent.update({
      where: {
        id: params.agentId,
      },
      data: allowedUpdates,
      include: {
        customer: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          }
        }
      }
    });

    console.log('[ghl-agents/[agentId]/route] Agent updated successfully');

    // Transform the data for the frontend
    const transformedAgent = {
      id: updatedAgent.id,
      name: updatedAgent.name,
      customerId: updatedAgent.customerId,
      profitMultiplier: updatedAgent.profitMultiplier,
      basePerMinuteCost: updatedAgent.basePerMinuteCost,
      isActive: updatedAgent.isActive,
      analyticsAgentId: updatedAgent.analyticsAgentId,
      webhookEnabled: updatedAgent.webhookEnabled,
      webhookUrl: updatedAgent.webhookUrl,
      createdAt: updatedAgent.createdAt.toISOString(),
      updatedAt: updatedAgent.updatedAt.toISOString(),
      customer: updatedAgent.customer ? {
        id: updatedAgent.customer.id,
        firstName: updatedAgent.customer.firstName,
        lastName: updatedAgent.customer.lastName,
        email: updatedAgent.customer.email,
      } : null,
    };

    return NextResponse.json({
      success: true,
      agent: transformedAgent,
      message: 'Agent updated successfully'
    });

  } catch (error) {
    console.error('[ghl-agents/[agentId]/route] Error updating GHL agent:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/partner/ghl-agents/[agentId]
 * Delete a specific GHL agent for the authenticated partner
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { agentId: string } }
) {
  try {
    console.log('[ghl-agents/[agentId]/route] Starting GHL agent deletion for:', params.agentId);

    // Use same authentication as other agent routes
    const partner = await getPartnerFromToken(request);
    if (!partner) {
      console.log('[ghl-agents/[agentId]/route] Authentication failed - no partner found');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log('[ghl-agents/[agentId]/route] Partner authenticated:', partner.id);

    // Verify the agent belongs to this partner
    const existingAgent = await prisma.ghlAgent.findFirst({
      where: {
        id: params.agentId,
        partnerId: partner.id,
      },
    });

    if (!existingAgent) {
      console.log('[ghl-agents/[agentId]/route] Agent not found or unauthorized');
      return NextResponse.json({ 
        error: 'Agent not found or unauthorized' 
      }, { status: 404 });
    }

    // Delete the agent
    await prisma.ghlAgent.delete({
      where: {
        id: params.agentId,
      },
    });

    console.log('[ghl-agents/[agentId]/route] Agent deleted successfully');

    return NextResponse.json({
      success: true,
      message: 'Agent deleted successfully'
    });

  } catch (error) {
    console.error('[ghl-agents/[agentId]/route] Error deleting GHL agent:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
