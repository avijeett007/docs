import { NextResponse } from 'next/server';

// This route uses dynamic features, so it must be server-rendered
export const dynamic = 'force-dynamic';

import { prisma } from '@/lib/prisma';
import type { NextRequest } from 'next/server';
import { verifyJWT } from '@/lib/jwt';

// GET: List all team members for a specific customer
export async function GET(
  request: NextRequest,
  { params }: { params: { customerId: string } }
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
    const customerId = params.customerId;

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

    // Get all team members for this customer
    const teamMembers = await prisma.customerTeamMember.findMany({
      where: {
        customerId: customerId
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
      error: 'Server error',
      message: 'An error occurred while fetching team members. Please try again.'
    }, { status: 500 });
  }
}
