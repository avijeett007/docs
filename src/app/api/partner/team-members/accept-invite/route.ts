import { NextResponse } from 'next/server';

// This route uses dynamic features, so it must be server-rendered
export const dynamic = 'force-dynamic';

import { prisma } from '@/lib/prisma';
import type { NextRequest } from 'next/server';
import bcrypt from 'bcryptjs';
import { signJWT } from '@/lib/jwt';
import { cookies } from 'next/headers';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { token, password } = body;

    if (!token || !password) {
      return NextResponse.json({
        error: 'Missing required fields',
        message: 'Token and password are required'
      }, { status: 400 });
    }

    // Find the team member with this token
    const teamMember = await prisma.partnerTeamMember.findFirst({
      where: {
        inviteToken: token,
        status: 'pending'
      },
      include: {
        partner: {
          select: {
            id: true,
            businessName: true,
            emailAddress: true
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

    // Hash the password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Update the team member
    await prisma.partnerTeamMember.update({
      where: {
        id: teamMember.id
      },
      data: {
        passwordHash: hashedPassword,
        status: 'active',
        inviteToken: null,
        inviteExpiry: null,
        lastLogin: new Date()
      }
    });

    // Create a JWT token for the team member
    const jwtPayload = {
      teamMemberId: teamMember.id,
      partnerId: teamMember.partnerId,
      email: teamMember.email,
      role: teamMember.role,
      isTeamMember: true
    };

    const jwtToken = await signJWT(jwtPayload);

    // Set the token in a cookie
    cookies().set({
      name: 'partner_token',
      value: jwtToken,
      httpOnly: true,
      path: '/',
      secure: process.env.NODE_ENV === 'production',
      maxAge: 60 * 60 * 24 * 7 // 1 week
    });

    return NextResponse.json({
      success: true,
      message: 'Invitation accepted successfully'
    });

  } catch (error) {
    console.error('Error accepting invitation:', error);
    return NextResponse.json({
      error: 'Server error',
      message: 'An error occurred while accepting the invitation'
    }, { status: 500 });
  }
}
