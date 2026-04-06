export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getPartnerFromToken } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

import { checkMCPAuthIfPresent, PERMISSIONS } from '@/lib/auth/mcpAuthHelper';
/**
 * POST /api/partner/ghl-agents/[agentId]/unassign
 * Unassign a GHL agent from a customer
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { agentId: string } }
) {
  try {
    // Verify partner authentication
    const partner = await getPartnerFromToken(request);

    if (!partner) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { agentId } = params;

    // Verify the agent belongs to this partner
    const agent = await prisma.ghlAgent.findFirst({
      where: {
        id: agentId,
        partnerId: partner.id,
      },
    });

    if (!agent) {
      return NextResponse.json(
        { error: 'Agent not found' },
        { status: 404 }
      );
    }

    // Update the agent to remove customer assignment
    const updatedAgent = await prisma.ghlAgent.update({
      where: {
        id: agentId,
      },
      data: {
        customerId: null,
        profitMultiplier: 1.2, // Reset to default
        updatedAt: new Date(),
      },
    });

    return NextResponse.json({
      message: 'Agent unassigned from customer successfully',
      agent: {
        id: updatedAgent.id,
        name: updatedAgent.name,
        customerId: updatedAgent.customerId,
        profitMultiplier: updatedAgent.profitMultiplier,
        basePerMinuteCost: updatedAgent.basePerMinuteCost,
      },
    });
  } catch (error) {
    console.error('Error unassigning GHL agent from customer:', error);
    return NextResponse.json(
      { error: 'Failed to unassign agent from customer' },
      { status: 500 }
    );
  }
}
