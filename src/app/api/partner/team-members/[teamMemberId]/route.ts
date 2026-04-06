import { NextResponse } from 'next/server';

// This route uses dynamic features, so it must be server-rendered
export const dynamic = 'force-dynamic';

import { prisma } from '@/lib/prisma';
import { cookies } from 'next/headers';
import { verifyJWT } from '@/lib/jwt';
import type { NextRequest } from 'next/server';

// DELETE: Remove a team member
export async function DELETE(
  request: NextRequest,
  { params }: { params: { teamMemberId: string } }
) {
  try {
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
        error: 'Partner not found or not approved',
        message: 'Please ensure your partner account is approved.'
      }, { status: 403 });
    }

    // Find the team member
    const teamMember = await prisma.partnerTeamMember.findFirst({
      where: {
        id: params.teamMemberId,
        partnerId: partner.id
      }
    });

    if (!teamMember) {
      return NextResponse.json({
        error: 'Team member not found',
        message: 'The requested team member was not found or does not belong to your account.'
      }, { status: 404 });
    }

    // Delete the team member
    await prisma.partnerTeamMember.delete({
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
