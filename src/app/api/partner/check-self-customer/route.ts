import { NextRequest, NextResponse } from 'next/server';
import { verifyJWT } from '@/lib/jwt';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

/**
 * API route to check if a partner has already onboarded themselves as a customer
 */
export async function GET(request: NextRequest) {
  try {
    // Get the authorization header
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({
        error: 'Missing or invalid authorization header',
        message: 'Please provide a valid Bearer token.'
      }, { status: 401 });
    }

    const token = authHeader.substring(7);

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
      select: {
        id: true,
        businessName: true,
        contactName: true,
        emailAddress: true,
        phoneNumber: true,
        businessAddress: true
      }
    });

    if (!partner) {
      return NextResponse.json({
        error: 'Partner not found or not approved',
        message: 'Please ensure your partner account is approved.'
      }, { status: 403 });
    }

    // Check if partner has already onboarded themselves as a customer
    // Look for a UserOnboarding record where the email matches the partner's email
    // and the partnerId matches the current partner
    const existingCustomerOnboarding = await prisma.userOnboarding.findFirst({
      where: {
        AND: [
          { email: partner.emailAddress },
          { partnerId: partner.id }
        ]
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        companyName: true,
        customerPortalEnabled: true
      }
    });

    return NextResponse.json({
      success: true,
      hasCustomerAccount: !!existingCustomerOnboarding,
      partnerData: {
        businessName: partner.businessName,
        contactName: partner.contactName,
        emailAddress: partner.emailAddress,
        phoneNumber: partner.phoneNumber,
        businessAddress: partner.businessAddress
      },
      customerData: existingCustomerOnboarding || null
    });

  } catch (error) {
    console.error('Error checking partner self-customer status:', error);
    return NextResponse.json({
      error: 'Internal server error',
      message: 'An error occurred while checking customer status.'
    }, { status: 500 });
  }
}
