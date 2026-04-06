import { NextResponse } from 'next/server';

// This route uses dynamic features, so it must be server-rendered
export const dynamic = 'force-dynamic';

import { prisma } from '@/lib/prisma';
import type { NextRequest } from 'next/server';
import bcrypt from 'bcryptjs';
import { signCustomerJWT } from '@/lib/customerJwt';
import { cookies } from 'next/headers';

export async function POST(request: NextRequest) {
  try {
    const { email: rawEmail, password } = await request.json();
    // Normalize email to lowercase for case insensitive comparison
    const email = rawEmail?.toLowerCase().trim();
    console.log(`Team member login attempt for email: ${email}`);

    // Get the partner ID from the x-partner-id header (set by our middleware)
    const partnerId = request.headers.get('x-partner-id');
    console.log(`Partner ID from header: ${partnerId}`);

    if (!partnerId) {
      console.log('No partner ID found in request headers');
      return NextResponse.json(
        { error: 'Partner not found' },
        { status: 404 }
      );
    }

    // Find the team member with this email
    const teamMember = await prisma.customerTeamMember.findFirst({
      where: {
        email: email,
        status: 'active'
      },
      include: {
        customer: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            customerPortalEnabled: true,
            userOnboarding: {
              select: {
                partnerId: true
              }
            }
          }
        }
      }
    });

    // If no team member found or no password set, return 401
    if (!teamMember || !teamMember.passwordHash) {
      console.log(`No active team member found with email ${email}`);
      return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 });
    }

    // Verify the team member belongs to a customer of this partner
    // First check if there's a direct userOnboarding relationship
    const hasDirectRelationship = teamMember.customer.userOnboarding &&
      teamMember.customer.userOnboarding.length > 0 &&
      teamMember.customer.userOnboarding[0]?.partnerId === partnerId;

    if (!hasDirectRelationship) {
      // If no direct relationship, check if there's a customer credential for this customer and partner
      const customerCredential = await prisma.customerCredential.findFirst({
        where: {
          customerId: teamMember.customerId,
          partnerId: partnerId
        }
      });

      if (!customerCredential) {
        console.log(`Team member's customer is not associated with partner ${partnerId}`);
        return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 });
      }

      console.log(`Found customer credential linking customer ${teamMember.customerId} to partner ${partnerId}`);
    }

    // Check if the customer portal is enabled
    if (!teamMember.customer.customerPortalEnabled) {
      console.log(`Customer portal is not enabled for customer ${teamMember.customer.id}`);
      return NextResponse.json(
        { error: 'Customer portal access is not enabled for your organization' },
        { status: 403 }
      );
    }

    // Verify password
    console.log(`Verifying password for team member ${email}`);
    let isPasswordValid = false;
    try {
      isPasswordValid = await bcrypt.compare(
        password,
        teamMember.passwordHash
      );
      console.log(`Password verification result: ${isPasswordValid}`);
    } catch (error) {
      console.error('Error comparing passwords:', error);
      return NextResponse.json(
        { error: 'Error verifying password. Please try again.' },
        { status: 500 }
      );
    }

    if (!isPasswordValid) {
      console.log(`Invalid password for team member ${email}`);
      return NextResponse.json(
        { error: 'Invalid email or password' },
        { status: 401 }
      );
    }

    console.log(`Password verified successfully for team member ${email}`);

    // Update last login time
    await prisma.customerTeamMember.update({
      where: { id: teamMember.id },
      data: { lastLogin: new Date() }
    });

    // Create a JWT token for the team member
    const jwtPayload = {
      teamMemberId: teamMember.id,
      customerId: teamMember.customerId,
      partnerId,
      email: teamMember.email,
      role: teamMember.role,
      isTeamMember: true
    };

    const jwtToken = await signCustomerJWT(jwtPayload);

    // Set the token in a cookie
    cookies().set({
      name: 'customer_token',
      value: jwtToken,
      httpOnly: true,
      path: '/',
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax', // Explicitly set sameSite for consistency
      maxAge: 60 * 60 * 24 * 7 // 1 week
    });

    // Return success response
    return NextResponse.json({
      success: true,
      customer: {
        id: teamMember.customer.id,
        name: teamMember.name,
        email: teamMember.email,
      },
      isTeamMember: true,
      role: teamMember.role,
      redirectUrl: '/whitelabel/dashboard'
    });

  } catch (error) {
    console.error('Error in team member login:', error);
    return NextResponse.json(
      { error: 'An error occurred during login. Please try again.' },
      { status: 500 }
    );
  }
}
