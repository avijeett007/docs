import { NextResponse } from 'next/server';

// This route uses dynamic features, so it must be server-rendered
export const dynamic = 'force-dynamic';

import { prisma } from '@/lib/prisma';
import type { NextRequest } from 'next/server';
import { verifyJWT } from '@/lib/jwt';
import { randomBytes } from 'crypto';

export async function POST(
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
      },
      include: {
        userOnboarding: {
          select: {
            partnerId: true
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

    // Generate a reset token and set expiry (24 hours from now)
    const resetToken = randomBytes(32).toString('hex');
    const resetExpiry = new Date();
    resetExpiry.setHours(resetExpiry.getHours() + 24);

    // Update the team member with the reset token
    await prisma.customerTeamMember.update({
      where: {
        id: teamMemberId
      },
      data: {
        inviteToken: resetToken,
        inviteExpiry: resetExpiry
      }
    });

    // Send password reset email
    try {
      const { sendCustomerTeamPasswordReset } = await import('@/lib/email');

      // Get partner info for email branding
      const partner = await prisma.partner.findUnique({
        where: { id: partnerId },
        select: {
          businessName: true,
          primaryColor: true,
          logo: true
        }
      });

      if (!partner) {
        return NextResponse.json({
          error: 'Partner not found',
          message: 'Could not find partner information for email branding.'
        }, { status: 404 });
      }

      await sendCustomerTeamPasswordReset({
        to: teamMember.email,
        name: teamMember.name,
        resetToken,
        expiryHours: 24,
        partnerId,
        partnerName: partner.businessName || 'Your Service Provider',
        partnerLogo: partner.logo || '',
        partnerColor: partner.primaryColor || '#3B82F6'
      });

      return NextResponse.json({
        success: true,
        message: 'Password reset email sent successfully'
      });
    } catch (emailError) {
      console.error('Error sending password reset email:', emailError);
      return NextResponse.json({
        error: 'Email error',
        message: 'Failed to send password reset email. Please try again.'
      }, { status: 500 });
    }
  } catch (error) {
    console.error('Error resetting team member password:', error);
    return NextResponse.json({
      error: 'Server error',
      message: 'An error occurred while resetting the password. Please try again.'
    }, { status: 500 });
  }
}
