import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

import { prisma } from '@/lib/prisma';
import { cookies } from 'next/headers';
import { verifyJWT } from '@/lib/jwt';
import type { NextRequest } from 'next/server';

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

    // Update the agent to remove customer mapping
    console.log('Unmapping customer from chat agent:', params.agentId);
    const updatedAgent = await prisma.retellChatAgent.update({
      where: { id: params.agentId },
      data: {
        customer: { disconnect: true },
        updatedAt: new Date()
      }
    });

    return NextResponse.json({
      success: true,
      agent: {
        id: updatedAgent.id,
        name: updatedAgent.name,
        customerId: null,
        customer: null
      },
      message: 'Successfully unmapped customer from agent'
    });
  } catch (error) {
    console.error('Error unmapping customer from chat agent:', error);
    return NextResponse.json(
      { 
        success: false,
        error: error instanceof Error ? error.message : 'Failed to unmap customer from agent'
      },
      { status: 500 }
    );
  }
}

