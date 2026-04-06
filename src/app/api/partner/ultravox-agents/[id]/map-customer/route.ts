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
  { params }: { params: { id: string } }
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
    const agent = await prisma.ultravoxAgent.findFirst({
      where: {
        id: params.id,
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
      agentId: params.id,
      customerId: customer.id,
      profitMultiplier
    });
    const updatedAgent = await prisma.ultravoxAgent.update({
      where: {
        id: params.id
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
      agentId: params.id,
      provider: 'ultravox',
      partnerId: partner.id,
      agentName: updatedAgent.name,
      customerId: customer.id,
      profitMultiplier: profitMultiplier as number
    }).catch(error => {
      console.error(`[ultravox-map-customer/route] Error updating agent ${params.id} in analytics:`, error);
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
