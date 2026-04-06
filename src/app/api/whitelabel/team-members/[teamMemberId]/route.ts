import { NextResponse } from 'next/server';

// This route uses dynamic features, so it must be server-rendered
export const dynamic = 'force-dynamic';

import { prisma } from '@/lib/prisma';
import { cookies } from 'next/headers';
import { verifyCustomerJWT } from '@/lib/customerJwt';
import type { NextRequest } from 'next/server';

// DELETE: Remove a team member
export async function DELETE(
  request: NextRequest,
  { params }: { params: { teamMemberId: string } }
) {
  try {
    // Get token from cookies
    const token = cookies().get('customer_token')?.value;
    if (!token) {
      return NextResponse.json({
        error: 'Unauthorized',
        message: 'No customer token found'
      }, { status: 401 });
    }

    // Verify JWT token
    const decodedToken = await verifyCustomerJWT(token);
    if (!decodedToken || !decodedToken.customerId) {
      return NextResponse.json({
        error: 'Invalid token',
        message: 'Your session has expired. Please log in again.'
      }, { status: 401 });
    }

    // Get customer using the JWT token's customerId
    const customer = await prisma.customer.findUnique({
      where: {
        id: decodedToken.customerId
      }
    });

    if (!customer) {
      return NextResponse.json({
        error: 'Customer not found',
        message: 'Please ensure your account is active.'
      }, { status: 403 });
    }

    // Find the team member
    const teamMember = await prisma.customerTeamMember.findFirst({
      where: {
        id: params.teamMemberId,
        customerId: customer.id
      }
    });

    if (!teamMember) {
      return NextResponse.json({
        error: 'Team member not found',
        message: 'The requested team member was not found or does not belong to your account.'
      }, { status: 404 });
    }

    // Delete the team member
    await prisma.customerTeamMember.delete({
      where: {
        id: params.teamMemberId
      }
    });

    return NextResponse.json({
      success: true,
      message: 'Team member removed successfully'
    });

  } catch (error) {
    console.error('Error removing team member:', error);
    return NextResponse.json({
      error: 'Failed to remove team member',
      message: 'An error occurred while removing the team member. Please try again.'
    }, { status: 500 });
  }
}
