import { NextResponse } from 'next/server';

// This route uses dynamic features, so it must be server-rendered
export const dynamic = 'force-dynamic';

import { prisma } from '@/lib/prisma';
import { cookies } from 'next/headers';
import { verifyJWT } from '@/lib/jwt';
import type { NextRequest } from 'next/server';
import { randomBytes } from 'crypto';

interface TeamMemberInviteRequest {
  email: string;
  name: string;
  role: string;
}

// GET: List all team members for the current partner
export async function GET(_request: NextRequest) {
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

    // Get all team members for this partner
    const teamMembers = await prisma.partnerTeamMember.findMany({
      where: {
        partnerId: partner.id
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    return NextResponse.json({
      success: true,
      data: teamMembers
    });

  } catch (error) {
    console.error('Error fetching team members:', error);
    return NextResponse.json({
      error: 'Failed to fetch team members',
      message: 'An error occurred while fetching team members. Please try again.'
    }, { status: 500 });
  }
}

// POST: Invite a new team member
export async function POST(_request: NextRequest) {
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
      },
      include: {
        teamMembers: true
      }
    });

    if (!partner) {
      return NextResponse.json({
        error: 'Partner not found or not approved',
        message: 'Please ensure your partner account is approved.'
      }, { status: 403 });
    }

    // Check if the partner has reached their team member limit
    if (partner.teamMembers.length >= partner.maxTeamMembers) {
      return NextResponse.json({
        error: 'Team member limit reached',
        message: `You can only have up to ${partner.maxTeamMembers} team members. Please upgrade your subscription to add more.`
      }, { status: 403 });
    }

    const body = await _request.json() as TeamMemberInviteRequest;

    // Validate required fields
    if (!body.email || !body.name) {
      return NextResponse.json({
        error: 'Missing required fields',
        message: 'Email and name are required.'
      }, { status: 400 });
    }

    // Check if the email is already in use
    const existingTeamMember = await prisma.partnerTeamMember.findFirst({
      where: {
        partnerId: partner.id,
        email: body.email
      }
    });

    if (existingTeamMember) {
      return NextResponse.json({
        error: 'Email already in use',
        message: 'A team member with this email already exists.'
      }, { status: 400 });
    }

    // Generate invite token and set expiry (24 hours from now)
    const inviteToken = randomBytes(32).toString('hex');
    const inviteExpiry = new Date();
    inviteExpiry.setHours(inviteExpiry.getHours() + 24);

    // Create the team member
    const teamMember = await prisma.partnerTeamMember.create({
      data: {
        partnerId: partner.id,
        email: body.email,
        name: body.name,
        role: body.role || 'member',
        status: 'pending',
        inviteToken,
        inviteExpiry
      }
    });

    // Send invitation email
    try {
      const { sendPartnerTeamInvite } = await import('@/lib/email');

      await sendPartnerTeamInvite({
        to: body.email,
        inviteeName: body.name,
        partnerBusinessName: partner.businessName || 'Your Agency',
        partnerContactName: partner.contactName,
        inviteToken,
        expiryHours: 24
      });

      console.log('Partner team invitation email sent successfully');
    } catch (emailError) {
      console.error('Failed to send partner team invitation email:', emailError);
      // Continue even if email sending fails
    }

    return NextResponse.json({
      success: true,
      message: 'Team member invited successfully',
      data: teamMember
    });

  } catch (error) {
    console.error('Error inviting team member:', error);
    return NextResponse.json({
      error: 'Failed to invite team member',
      message: 'An error occurred while inviting the team member. Please try again.'
    }, { status: 500 });
  }
}
