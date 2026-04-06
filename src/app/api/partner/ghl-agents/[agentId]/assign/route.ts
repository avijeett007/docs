export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getPartnerFromToken } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

/**
 * POST /api/partner/ghl-agents/[agentId]/assign
 * Assign a GHL agent to a customer
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
    const { customerId, profitMultiplier } = await request.json();

    // Validate required fields
    if (!customerId || !profitMultiplier) {
      return NextResponse.json(
        { error: 'Customer ID and profit multiplier are required' },
        { status: 400 }
      );
    }

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

    // Verify the customer belongs to this partner
    const customer = await prisma.customer.findFirst({
      where: {
        id: customerId,
      },
      include: {
        credentials: {
          where: {
            partnerId: partner.id,
          },
        },
      },
    });

    if (!customer || customer.credentials.length === 0) {
      return NextResponse.json(
        { error: 'Customer not found or not associated with this partner' },
        { status: 404 }
      );
    }

    // Update the agent with customer assignment
    const updatedAgent = await prisma.ghlAgent.update({
      where: {
        id: agentId,
      },
      data: {
        customerId: customerId,
        profitMultiplier: profitMultiplier,
        updatedAt: new Date(),
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
    });

    return NextResponse.json({
      message: 'Agent assigned to customer successfully',
      agent: {
        id: updatedAgent.id,
        name: updatedAgent.name,
        customerId: updatedAgent.customerId,
        profitMultiplier: updatedAgent.profitMultiplier,
        basePerMinuteCost: updatedAgent.basePerMinuteCost,
        customer: updatedAgent.customer ? {
          firstName: updatedAgent.customer.firstName,
          lastName: updatedAgent.customer.lastName,
          email: updatedAgent.customer.email,
        } : null,
      },
    });
  } catch (error) {
    console.error('Error assigning GHL agent to customer:', error);
    return NextResponse.json(
      { error: 'Failed to assign agent to customer' },
      { status: 500 }
    );
  }
}
