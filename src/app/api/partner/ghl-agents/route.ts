export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getPartnerFromToken } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

/**
 * GET /api/partner/ghl-agents
 * Get all GHL agents for the authenticated partner
 */
export async function GET(request: NextRequest) {
  try {
    console.log('[ghl-agents/route] Starting GHL agents fetch');

    // Use same authentication as VAPI and Retell routes
    const partner = await getPartnerFromToken(request);
    if (!partner) {
      console.log('[ghl-agents/route] Authentication failed - no partner found');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log('[ghl-agents/route] Partner authenticated:', partner.id);

    // Get GHL agents for this partner
    const agents = await prisma.ghlAgent.findMany({
      where: {
        partnerId: partner.id,
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
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    // Transform the data for the frontend
    const transformedAgents = agents.map(agent => ({
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
        firstName: agent.customer.firstName,
        lastName: agent.customer.lastName,
        email: agent.customer.email,
      } : null,
    }));

    return NextResponse.json({
      agents: transformedAgents,
      partnerName: partner.businessName,
    });
  } catch (error) {
    console.error('Error fetching GHL agents:', error);
    return NextResponse.json(
      {
        error: 'Failed to fetch GHL agents',
        message: 'An internal server error occurred. Please try again later.'
      },
      { status: 500 }
    );
  }
}
