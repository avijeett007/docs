import { NextResponse } from 'next/server';

// This route uses dynamic features, so it must be server-rendered
export const dynamic = 'force-dynamic';

import { prisma } from '@/lib/prisma';
import { getPartnerFromToken } from '@/lib/auth';
import type { NextRequest } from 'next/server';
import { registerAgentInAnalytics } from '@/lib/analytics';

import { checkMCPAuthIfPresent, PERMISSIONS } from '@/lib/auth/mcpAuthHelper';
export async function POST(
  request: NextRequest,
  { params }: { params: { agentId: string } }
) {
  try {
    console.log('[ghl-map-customer/route] Starting customer mapping for agent:', params.agentId);

    // Use same authentication as VAPI/Retell/Ultravox routes
    const partner = await getPartnerFromToken(request);
    if (!partner) {
      console.log('[ghl-map-customer/route] Authentication failed - no partner found');
      return NextResponse.json({
        success: false,
        error: 'Unauthorized'
      }, { status: 401 });
    }

    console.log('[ghl-map-customer/route] Partner authenticated:', partner.id);

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
    const agent = await prisma.ghlAgent.findFirst({
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

    // First find the UserOnboarding record (same as VAPI/Retell/Ultravox)
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

    // Find or create Customer record (same as VAPI/Retell/Ultravox)
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
    console.log('Updating GHL agent with:', {
      agentId: params.agentId,
      customerId: customer.id,
      profitMultiplier
    });

    const updatedAgent = await prisma.ghlAgent.update({
      where: {
        id: params.agentId
      },
      data: {
        customerId: customer.id,
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

    console.log('GHL agent updated:', updatedAgent);

    // Update the agent in the analytics service (same as VAPI/Retell/Ultravox)
    await registerAgentInAnalytics({
      agentId: params.agentId,
      provider: 'ghl',
      partnerId: partner.id,
      agentName: updatedAgent.name,
      customerId: customer.id,
      profitMultiplier: profitMultiplier as number
    }).catch(error => {
      console.error(`[ghl-map-customer/route] Error updating agent ${params.agentId} in analytics:`, error);
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
      message: 'Successfully mapped customer to GHL agent'
    });
  } catch (error) {
    console.error('Error mapping customer to GHL agent:', error);
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
