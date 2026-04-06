import { NextResponse } from 'next/server';

// This route uses dynamic features, so it must be server-rendered
export const dynamic = 'force-dynamic';

import { prisma } from '@/lib/prisma';
import { cookies } from 'next/headers';
import { verifyJWT } from '@/lib/jwt';
import type { NextRequest } from 'next/server';
import { checkMCPAuthIfPresent, PERMISSIONS } from '@/lib/auth/mcpAuthHelper';

const VALID_STATUSES = [
  'Submitted',
  'Processing',
  'Additional Info Requested',
  'Under Review',
  'Regulatory approval submitted',
  'Regulatory approval completed',
  'Business Agreement Established',
  'Under Development',
  'System under review',
  'Voice AI Agent Live'
] as const;

export async function PUT(
  request: NextRequest,
  { params }: { params: { customerId: string } }
) {
  try {
    // Check for MCP authentication first
    const mcpAuth = await checkMCPAuthIfPresent(request, PERMISSIONS.CUSTOMER_UPDATE);

    // Handle MCP authentication errors
    if (mcpAuth.isMCP && mcpAuth.error) {
      return NextResponse.json({
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
          error: 'Unauthorized',
          message: 'No partner token found'
        }, { status: 401 });
      }

      // Verify JWT token
      const decodedToken = await verifyJWT(token);
      if (!decodedToken || !decodedToken.email) {
        return NextResponse.json({
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
            error: 'Partner not found or not approved',
            message: 'Please ensure your partner account is approved.'
          }, { status: 403 });
        }
    } // End of MCP/JWT authentication block

    const body = await request.json();
    const { status } = body;

    // Validate status
    if (!VALID_STATUSES.includes(status)) {
      return NextResponse.json({ 
        error: 'Invalid status',
        message: 'The provided status is not valid.'
      }, { status: 400 });
    }

    // Update the customer's status
    const updatedCustomer = await prisma.userOnboarding.update({
      where: {
        id: params.customerId,
        partnerId: partner.id // Ensure the customer belongs to this partner
      },
      data: {
        orderStatus: status
      }
    });

    return NextResponse.json(updatedCustomer);
  } catch (error) {
    console.error('Error in status update route:', error);
    return NextResponse.json({ 
      error: 'Failed to update status', 
      message: 'An error occurred while updating the status. Please try again.'
    }, { status: 500 });
  }
}
