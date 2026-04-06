import { NextResponse } from 'next/server';

// This route uses dynamic features, so it must be server-rendered
export const dynamic = 'force-dynamic';

import { prisma } from '@/lib/prisma';
import type { NextRequest } from 'next/server';
import { verifyJWT } from '@/lib/jwt';

// DELETE: Remove a team member
export async function DELETE(
  request: NextRequest,
  { params }: { params: { customerId: string; teamMemberId: string } }
) {
  try {
    // Get token from Authorization header
    const authHeader = request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({
        error: 'Unauthorized',
        message: 'No authorization token found'
      }, { status: 401 });
    }

    const token = authHeader.split(' ')[1];

    // Verify JWT token
    const decodedToken = await verifyJWT(token);
    if (!decodedToken || !decodedToken.partnerId) {
      return NextResponse.json({
        error: 'Invalid token',
        message: 'Your session has expired. Please log in again.'
      }, { status: 401 });
    }

    const partnerId = decodedToken.partnerId;
    const { customerId, teamMemberId } = params;

    // Verify the customer belongs to this partner
    const customer = await prisma.customer.findFirst({
      where: {
        id: customerId,
        userOnboarding: {
          some: {
            partnerId: partnerId
          }
        }
      }
    });

    if (!customer) {
      return NextResponse.json({
        error: 'Customer not found',
        message: 'The specified customer does not exist or does not belong to your account.'
      }, { status: 404 });
    }

    // Verify the team member belongs to this customer
    const teamMember = await prisma.customerTeamMember.findFirst({
      where: {
        id: teamMemberId,
        customerId: customerId
      }
    });

    if (!teamMember) {
      return NextResponse.json({
        error: 'Team member not found',
        message: 'The specified team member does not exist or does not belong to this customer.'
      }, { status: 404 });
    }

    // Delete the team member
    await prisma.customerTeamMember.delete({
      where: {
        id: teamMemberId
      }
    });

    return NextResponse.json({
      success: true,
      message: 'Team member deleted successfully'
    });

  } catch (error) {
    console.error('Error deleting team member:', error);
    return NextResponse.json({
      error: 'Server error',
      message: 'An error occurred while deleting the team member. Please try again.'
    }, { status: 500 });
  }
}
