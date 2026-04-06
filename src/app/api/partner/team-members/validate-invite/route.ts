import { NextResponse } from 'next/server';

// This route uses dynamic features, so it must be server-rendered
export const dynamic = 'force-dynamic';

import { prisma } from '@/lib/prisma';
import type { NextRequest } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    // Get the token from the query parameters
    const { searchParams } = new URL(request.url);
    const token = searchParams.get('token');

    if (!token) {
      return NextResponse.json({
        error: 'Missing token',
        message: 'Invitation token is required'
      }, { status: 400 });
    }

    // Find the team member with this token
    const teamMember = await prisma.partnerTeamMember.findFirst({
      where: {
        inviteToken: token,
        status: 'pending'
      },
      select: {
        id: true,
        name: true,
        email: true,
        inviteExpiry: true,
        partner: {
          select: {
            businessName: true
          }
        }
      }
    });

    if (!teamMember) {
      return NextResponse.json({
        error: 'Invalid token',
        message: 'Invalid or expired invitation token'
      }, { status: 404 });
    }

    // Check if the invitation has expired
    if (teamMember.inviteExpiry && new Date() > teamMember.inviteExpiry) {
      return NextResponse.json({
        error: 'Expired token',
        message: 'This invitation has expired. Please contact your administrator for a new invitation.'
      }, { status: 400 });
    }

    // Return the team member data
    return NextResponse.json({
      success: true,
      data: {
        id: teamMember.id,
        name: teamMember.name,
        email: teamMember.email,
        partnerName: teamMember.partner.businessName
      }
    });

  } catch (error) {
    console.error('Error validating invitation token:', error);
    return NextResponse.json({
      error: 'Server error',
      message: 'An error occurred while validating the invitation token'
    }, { status: 500 });
  }
}
