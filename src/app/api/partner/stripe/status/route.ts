// API endpoint for partner Stripe Connect status

import { NextRequest, NextResponse } from 'next/server';
import { StripeConnectService } from '@/lib/stripe/connect';
import { isStripeConnectError } from '@/lib/stripe/utils';
import { verifyJWT } from '@/lib/jwt';
import { prisma } from '@/lib/prisma';
import { cookies } from 'next/headers';

export const dynamic = 'force-dynamic';

export async function GET(_request: NextRequest) {
  try {
    // Get token from cookies (matching other partner APIs)
    const token = cookies().get('partner_token')?.value;
    if (!token) {
      return NextResponse.json({
        success: false,
        error: 'Unauthorized',
        message: 'No partner token found'
      }, { status: 401 });
    }

    // Verify JWT token
    const decodedToken = await verifyJWT(token);
    if (!decodedToken || !decodedToken.email) {
      return NextResponse.json({
        success: false,
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
        success: false,
        error: 'Partner not found or not active',
        message: 'Please ensure your partner account is active.'
      }, { status: 403 });
    }

    // Get partner's Stripe status
    const status = await StripeConnectService.getPartnerStripeStatus(partner.id);

    return NextResponse.json({
      success: true,
      data: status,
    });
  } catch (error: any) {
    console.error('Error getting Stripe status:', error);

    if (isStripeConnectError(error)) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: error.statusCode || 500 }
      );
    }

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
