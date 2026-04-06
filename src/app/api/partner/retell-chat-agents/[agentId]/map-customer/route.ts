import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

import { prisma } from '@/lib/prisma';
import { cookies } from 'next/headers';
import { verifyJWT } from '@/lib/jwt';
import type { NextRequest } from 'next/server';
import { registerAgentInAnalytics } from '@/lib/analytics';

export async function POST(
  request: NextRequest,
  { params }: { params: { agentId: string } }
) {
  try {
    const token = cookies().get('partner_token')?.value;
    if (!token) {
      return NextResponse.json({ 
        success: false, error: 'Unauthorized', message: 'No partner token found' 
      }, { status: 401 });
    }

    const decodedToken = await verifyJWT(token);
    if (!decodedToken || !decodedToken.email) {
      return NextResponse.json({ 
        success: false, error: 'Invalid token', message: 'Your session has expired. Please log in again.' 
      }, { status: 401 });
    }

    const partner = await prisma.partner.findFirst({
      where: { 
        AND: [
          { emailAddress: decodedToken.email },
          { approvalStatus: 'ACTIVE' }
        ]
      }
    });

    if (!partner) {
      return NextResponse.json({ 
        success: false, error: 'Unauthorized', message: 'Partner not found or not approved' 
      }, { status: 401 });
    }

    const { customerId, profitMultiplier } = await request.json();

    if (!customerId || !profitMultiplier) {
      return NextResponse.json(
        { success: false, error: 'Customer ID and profit multiplier are required' },
        { status: 400 }
      );
    }

    // Verify the agent belongs to the partner
    const agent = await prisma.retellChatAgent.findFirst({
      where: { id: params.agentId, partnerId: partner.id }
    });

    if (!agent) {
      return NextResponse.json(
        { success: false, error: 'Agent not found or unauthorized' },
        { status: 404 }
      );
    }

    // The customerId from frontend is actually the UserOnboarding ID
    const userOnboarding = await prisma.userOnboarding.findFirst({
      where: { id: customerId, partnerId: partner.id },
      include: { customer: true }
    });

    if (!userOnboarding) {
      return NextResponse.json(
        { success: false, error: 'Customer not found or unauthorized' },
        { status: 404 }
      );
    }

    if (!userOnboarding.customerId || !userOnboarding.customer) {
      return NextResponse.json(
        { success: false, error: 'Customer record not found. Please ensure the customer is properly set up.' },
        { status: 404 }
      );
    }

    const customer = userOnboarding.customer;

    const updatedAgent = await prisma.retellChatAgent.update({
      where: { id: params.agentId },
      data: {
        customer: { connect: { id: customer.id } },
        profitMultiplier: profitMultiplier as number,
        updatedAt: new Date()
      },
      include: {
        customer: {
          select: { id: true, firstName: true, lastName: true, email: true }
        }
      }
    });

    // Update the agent in the analytics service (non-blocking)
    await registerAgentInAnalytics({
      agentId: params.agentId,
      provider: 'retell_chat',
      partnerId: partner.id,
      agentName: updatedAgent.name,
      customerId: customer.id,
      profitMultiplier: profitMultiplier as number
    }).catch(error => {
      console.error(`[retell-chat-map-customer] Error updating agent ${params.agentId} in analytics:`, error);
    });

    return NextResponse.json({
      success: true,
      agent: {
        id: updatedAgent.id,
        name: updatedAgent.name,
        customer: updatedAgent.customer,
        profitMultiplier: updatedAgent.profitMultiplier
      },
      message: 'Successfully mapped customer to agent'
    });
  } catch (error) {
    console.error('Error mapping customer to chat agent:', error);
    return NextResponse.json(
      { 
        success: false,
        error: error instanceof Error ? error.message : 'Failed to map customer to agent',
        details: error instanceof Error && 'code' in error ? (error as any).code : undefined
      },
      { status: 500 }
    );
  }
}

