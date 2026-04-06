import { NextResponse } from 'next/server';

// This route uses dynamic features, so it must be server-rendered
export const dynamic = 'force-dynamic';

import { prisma } from '@/lib/prisma';
import { cookies } from 'next/headers';
import { verifyJWT } from '@/lib/jwt';
import type { NextRequest } from 'next/server';
import { registerAgentInAnalytics } from '@/lib/analytics';
import { checkMCPAuthIfPresent, PERMISSIONS } from '@/lib/auth/mcpAuthHelper';

export async function POST(
  request: NextRequest,
  { params }: { params: { agentId: string } }
) {
  try {
    // Check for MCP authentication first
    const mcpAuth = await checkMCPAuthIfPresent(request, PERMISSIONS.AGENT_MAP);

    // Handle MCP authentication errors
    if (mcpAuth.isMCP && mcpAuth.error) {
      return NextResponse.json({
        success: false,
        error: 'MCP Authentication Failed',
        message: mcpAuth.error
      }, { status: 401 });
    }

    let partner;

    if (mcpAuth.isMCP && !mcpAuth.error) {
      // Handle MCP request - find partner by ID
      partner = await prisma.partner.findFirst({
        where: {
          AND: [
            { id: mcpAuth.partnerId },
            { approvalStatus: 'ACTIVE' }
          ]
        }
      });

      if (!partner) {
        return NextResponse.json({
          success: false,
          error: 'Partner not found or not active',
          message: 'MCP partner account not found or not active.'
        }, { status: 403 });
      }
    } else {
      // Handle regular JWT request
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
      partner = await prisma.partner.findFirst({
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
    } // End of MCP/JWT authentication block

    // Get request body
    const { customerId, profitMultiplier } = await request.json();

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

    // Verify the agent belongs to the partner
    const agent = await prisma.vapiAgent.findFirst({
      where: {
        id: params.agentId,
        partnerId: partner.id
      }
    });

    if (!agent) {
      return NextResponse.json(
        { 
          success: false,
          error: 'Agent not found or unauthorized' 
        },
        { status: 404 }
      );
    }

    // First find the UserOnboarding record
    console.log('Looking for UserOnboarding with ID:', customerId);
    const userOnboarding = await prisma.userOnboarding.findFirst({
      where: {
        id: customerId,
        partnerId: partner.id
      }
    });
    console.log('Found UserOnboarding:', userOnboarding);

    if (!userOnboarding) {
      console.log('UserOnboarding not found');
      return NextResponse.json(
        { 
          success: false,
          error: 'Customer not found or unauthorized' 
        },
        { status: 404 }
      );
    }

    // Find or create Customer record
    console.log('Finding Customer with userId:', userOnboarding.userId);
    let customer = await prisma.customer.findUnique({
      where: {
        userId: userOnboarding.userId
      }
    });

    if (!customer) {
      console.log('Creating new Customer record');
      customer = await prisma.customer.create({
        data: {
          userId: userOnboarding.userId,
          email: userOnboarding.email,
          firstName: userOnboarding.firstName || null,
          lastName: userOnboarding.lastName || null
        }
      });
    } else {
      console.log('Found existing Customer');
    }
    console.log('Using Customer:', customer);

    // Update the agent with customer mapping and profit multiplier
    console.log('Updating agent with:', {
      agentId: params.agentId,
      customerId: customer.id,
      profitMultiplier
    });
    const updatedAgent = await prisma.vapiAgent.update({
      where: {
        id: params.agentId
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
            firstName: true,
            lastName: true
          }
        }
      }
    });
    console.log('Agent updated:', updatedAgent);

    // Update the agent in the analytics service
    await registerAgentInAnalytics({
      agentId: params.agentId,
      provider: 'vapi',
      partnerId: partner.id,
      agentName: updatedAgent.name,
      customerId: customer.id,
      profitMultiplier: profitMultiplier as number
    }).catch(error => {
      console.error(`[vapi-map-customer/route] Error updating agent ${params.agentId} in analytics:`, error);
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
