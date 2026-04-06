import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { cookies } from 'next/headers';
import { verifyJWT } from '@/lib/jwt';
import { registerAgentInAnalytics } from '@/lib/analytics';

/**
 * POST /api/partner/elevenlabs-agents/[agentId]/map-customer
 * Map an ElevenLabs agent to a customer
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { agentId: string } }
) {
  try {
    // Get token from cookies
    const token = cookies().get('partner_token')?.value;
    if (!token) {
      return NextResponse.json({
        success: false,
        error: 'Unauthorized',
        message: 'No partner token found'
      }, { status: 401 });
    }

    // Verify JWT token
    const decodedToken = await verifyJWT(token);
    if (!decodedToken || !decodedToken.email) {
      return NextResponse.json({
        success: false,
        error: 'Invalid token',
        message: 'Your session has expired. Please log in again.'
      }, { status: 401 });
    }

    // Get partner using the JWT token's email
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
        success: false,
        error: 'Unauthorized',
        message: 'Partner not found or not approved'
      }, { status: 401 });
    }

    const { agentId } = params;
    const body = await request.json();
    const { customerId, profitMultiplier } = body;

    // Validate input
    if (!customerId || !profitMultiplier) {
      return NextResponse.json(
        {
          success: false,
          error: 'Customer ID and profit multiplier are required'
        },
        { status: 400 }
      );
    }

    // Check if agent exists and belongs to partner
    const existingAgent = await prisma.elevenLabsAgent.findFirst({
      where: {
        id: agentId,
        partnerId: partner.id
      }
    });

    if (!existingAgent) {
      return NextResponse.json(
        {
          success: false,
          error: 'Agent not found or unauthorized'
        },
        { status: 404 }
      );
    }

    // The ElevenLabs frontend sends the actual Customer ID (not UserOnboarding ID)
    // We need to validate that this Customer belongs to the partner
    console.log('Looking for Customer with ID:', customerId);

    const customer = await prisma.customer.findFirst({
      where: {
        id: customerId,
        userOnboarding: {
          some: {
            partnerId: partner.id
          }
        }
      }
    });

    console.log('Found Customer:', customer);

    if (!customer) {
      console.log('Customer not found or not associated with this partner');
      return NextResponse.json(
        {
          success: false,
          error: 'Customer not found or unauthorized'
        },
        { status: 404 }
      );
    }

    console.log('Using Customer:', customer);

    // Update the agent with customer mapping and profit multiplier
    console.log('Updating agent with:', {
      agentId: agentId,
      customerId: customer.id,
      profitMultiplier
    });
    const updatedAgent = await prisma.elevenLabsAgent.update({
      where: {
        id: agentId
      },
      data: {
        customer: {
          connect: {
            id: customer.id
          }
        },
        profitMultiplier: profitMultiplier as number,
        updatedAt: new Date()
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
    console.log('Agent updated:', updatedAgent);

    // Update the agent in the analytics service
    await registerAgentInAnalytics({
      agentId: agentId,
      provider: 'elevenlabs',
      partnerId: partner.id,
      customerId: customer.id,
      agentName: updatedAgent.name,
      profitMultiplier: profitMultiplier as number
    }).catch(error => {
      console.error(`[elevenlabs-map-customer/route] Error updating agent ${agentId} in analytics:`, error);
      // Non-blocking - continue with the process even if analytics update fails
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
    console.error('Error mapping customer to agent:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to map customer to agent',
        details: error instanceof Error && 'code' in error ? error.code : undefined
      },
      { status: 500 }
    );
  }
}
