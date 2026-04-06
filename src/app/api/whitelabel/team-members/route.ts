import { NextResponse } from 'next/server';

// This route uses dynamic features, so it must be server-rendered
export const dynamic = 'force-dynamic';

import { prisma } from '@/lib/prisma';
import { cookies } from 'next/headers';
import { verifyCustomerJWT } from '@/lib/customerJwt';
import type { NextRequest } from 'next/server';
import { randomBytes } from 'crypto';

interface TeamMemberInviteRequest {
  email: string;
  name: string;
  role: string;
}

// GET: List all team members for the current customer
export async function GET(_request: NextRequest) {
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
    if (!decodedToken || !decodedToken.email) {
      return NextResponse.json({
        error: 'Invalid token',
        message: 'Your session has expired. Please log in again.'
      }, { status: 401 });
    }

    // Get customer using the JWT token's email
    const customer = await prisma.customer.findFirst({
      where: {
        email: decodedToken.email
      }
    });

    if (!customer) {
      return NextResponse.json({
        error: 'Customer not found',
        message: 'Please ensure your account is active.'
      }, { status: 403 });
    }

    // Get all team members for this customer
    const teamMembers = await prisma.customerTeamMember.findMany({
      where: {
        customerId: customer.id
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
    const token = cookies().get('customer_token')?.value;
    if (!token) {
      return NextResponse.json({
        error: 'Unauthorized',
        message: 'No customer token found'
      }, { status: 401 });
    }

    // Verify JWT token
    const decodedToken = await verifyCustomerJWT(token);
    if (!decodedToken || !decodedToken.email) {
      return NextResponse.json({
        error: 'Invalid token',
        message: 'Your session has expired. Please log in again.'
      }, { status: 401 });
    }

    // Get customer using the JWT token's email
    const customer = await prisma.customer.findFirst({
      where: {
        email: decodedToken.email
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        teamMembers: true,
        userOnboarding: {
          select: {
            id: true,
            partnerId: true,
            enableTeamMembers: true,
            maxTeamMembers: true
          }
        }
      }
    });

    if (!customer) {
      return NextResponse.json({
        error: 'Customer not found',
        message: 'Please ensure your account is active.'
      }, { status: 403 });
    }

    // Check if team members feature is enabled for this customer
    console.log('Customer userOnboarding data:', customer.userOnboarding);

    // Get the partner ID from the JWT token
    const partnerId = decodedToken.partnerId;
    if (!partnerId) {
      console.log('No partner ID found in token');
      return NextResponse.json({
        error: 'Invalid configuration',
        message: 'Your account is not properly configured. Please contact support.'
      }, { status: 403 });
    }

    // Check if userOnboarding array exists and has items
    let userOnboarding;

    if (!customer.userOnboarding || customer.userOnboarding.length === 0) {
      console.log('No userOnboarding records found for customer:', customer.id);
      console.log('Creating a new userOnboarding record with partnerId:', partnerId);

      try {
        // Create a new userOnboarding record for this customer
        userOnboarding = await prisma.userOnboarding.create({
          data: {
            partnerId: partnerId,
            email: customer.email,
            customerId: customer.id,
            enableTeamMembers: true, // Enable team members by default
            maxTeamMembers: 2, // Default to 2 team members
            // Set other required fields with default values
            firstName: customer.firstName || '',
            lastName: customer.lastName || '',
            monthlyCallVolume: '0', // String in the schema
            estimatedPrice: 0, // Number in the schema
            priceBreakdown: '{}', // Required field
            orderStatus: 'ACTIVE',
            isOnboardingCompleted: true,
            userId: customer.id, // Required field
            languages: '[]' // Required field
          }
        });

        console.log('Created new userOnboarding record:', userOnboarding);
      } catch (error) {
        console.error('Error creating userOnboarding record:', error);
        return NextResponse.json({
          error: 'Configuration error',
          message: 'Failed to configure your account. Please contact support.'
        }, { status: 500 });
      }
    } else {
      userOnboarding = customer.userOnboarding[0];
      console.log('Using existing userOnboarding record:', {
        id: userOnboarding.id,
        partnerId: userOnboarding.partnerId,
        enableTeamMembers: userOnboarding.enableTeamMembers,
        maxTeamMembers: userOnboarding.maxTeamMembers
      });

      // If team members feature is not enabled, enable it
      if (!userOnboarding.enableTeamMembers) {
        console.log('Team members feature is not enabled, enabling it now');
        try {
          await prisma.userOnboarding.update({
            where: { id: userOnboarding.id },
            data: {
              enableTeamMembers: true,
              maxTeamMembers: userOnboarding.maxTeamMembers || 2
            }
          });

          // Update the local userOnboarding object
          userOnboarding.enableTeamMembers = true;
          userOnboarding.maxTeamMembers = userOnboarding.maxTeamMembers || 2;

          console.log('Updated userOnboarding record to enable team members');
        } catch (error) {
          console.error('Error updating userOnboarding record:', error);
          // Continue anyway, we'll just use the current values
        }
      }
    }

    // Check if the customer has reached their team member limit
    if (customer.teamMembers.length >= (userOnboarding.maxTeamMembers || 2)) {
      return NextResponse.json({
        error: 'Team member limit reached',
        message: `You can only have up to ${userOnboarding.maxTeamMembers} team members. Please contact your partner to increase this limit.`
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
    const existingTeamMember = await prisma.customerTeamMember.findFirst({
      where: {
        customerId: customer.id,
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
    const teamMember = await prisma.customerTeamMember.create({
      data: {
        customerId: customer.id,
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
      const { sendCustomerTeamInvite } = await import('@/lib/email');

      // Create customer name from firstName and lastName
      const customerName = customer.firstName && customer.lastName
        ? `${customer.firstName} ${customer.lastName}`
        : customer.firstName || 'Your Team';

      // Ensure partnerId is not null
      if (!userOnboarding.partnerId) {
        throw new Error('Partner ID is required for sending invitation emails');
      }

      await sendCustomerTeamInvite({
        to: body.email,
        inviteeName: body.name,
        customerName,
        inviteToken,
        expiryHours: 24,
        partnerId: userOnboarding.partnerId
      });

      console.log('Customer team invitation email sent successfully');
    } catch (emailError) {
      console.error('Failed to send customer team invitation email:', emailError);
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
