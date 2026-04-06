import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import jwt from 'jsonwebtoken';

import { checkMCPAuthIfPresent, PERMISSIONS } from '@/lib/auth/mcpAuthHelper';


// Helper function to verify partner token
async function verifyPartnerToken(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  const cookieHeader = request.headers.get('cookie');
  
  let token = null;
  
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.substring(7);
  } else if (cookieHeader) {
    const cookies = cookieHeader.split(';').reduce((acc, cookie) => {
      const [key, value] = cookie.trim().split('=');
      acc[key] = value;
      return acc;
    }, {} as Record<string, string>);
    token = cookies.partner_token;
  }

  if (!token) {
    throw new Error('No token provided');
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as any;
    const partner = await prisma.partner.findUnique({
      where: { id: decoded.partnerId }
    });

    if (!partner) {
      throw new Error('Partner not found');
    }

    return partner;
  } catch (error) {
    throw new Error('Invalid token');
  }
}

// POST /api/partner/knova-agents/[id]/assign-customer - Assign customer to agent
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
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
      partner = await verifyPartnerToken(request);
    }
    const { id } = params;
    const body = await request.json();

    const { customerId, profitMultiplier } = body;

    if (!customerId) {
      return NextResponse.json(
        { error: 'Customer ID is required' },
        { status: 400 }
      );
    }

    // Check if agent exists and belongs to partner
    const existingAgent = await prisma.knovaAgent.findFirst({
      where: {
        id,
        partnerId: partner.id
      }
    });

    if (!existingAgent) {
      return NextResponse.json(
        { error: 'Agent not found' },
        { status: 404 }
      );
    }

    // Validate customer belongs to partner
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

    if (!customer) {
      return NextResponse.json(
        { error: 'Customer not found or does not belong to this partner' },
        { status: 400 }
      );
    }

    // Update agent with customer assignment
    const updatedAgent = await prisma.knovaAgent.update({
      where: { id },
      data: {
        customerId,
        profitMultiplier: profitMultiplier || 1.2
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

    return NextResponse.json(updatedAgent);
  } catch (error) {
    console.error('Error assigning customer to Knova agent:', error);
    return NextResponse.json(
      { error: 'Failed to assign customer' },
      { status: 500 }
    );
  }
}
