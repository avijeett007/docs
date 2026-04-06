// API endpoint for partner Stripe Connect onboarding

import { NextRequest, NextResponse } from 'next/server';
import { StripeConnectService } from '@/lib/stripe/connect';
import { isStripeConnectError } from '@/lib/stripe/utils';
import { verifyPartnerAuth } from '@/lib/auth/partnerAuth';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    // Verify partner authentication
    const authResult = await verifyPartnerAuth(request);
    if (!authResult) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const partnerId = authResult.id;
    const body = await request.json();
    const { refreshUrl, returnUrl, accountType = 'express' } = body;

    if (!refreshUrl || !returnUrl) {
      return NextResponse.json(
        { error: 'Missing required fields: refreshUrl, returnUrl' },
        { status: 400 }
      );
    }

    // Start onboarding flow
    const result = await StripeConnectService.startOnboardingFlow({
      partnerId,
      refreshUrl,
      returnUrl,
      accountType,
    });

    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (error: any) {
    console.error('Error in Stripe Connect onboarding:', error);

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

export async function DELETE(request: NextRequest) {
  try {
    // Get partner ID from authentication
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Missing or invalid authorization header' },
        { status: 401 }
      );
    }

    // TODO: Verify JWT token and extract partner ID
    const body = await request.json();
    const { partnerId, accountId } = body;

    if (!partnerId || !accountId) {
      return NextResponse.json(
        { error: 'Missing required fields: partnerId, accountId' },
        { status: 400 }
      );
    }

    // Disconnect Stripe account
    await StripeConnectService.disconnectAccount({
      partnerId,
      accountId,
    });

    return NextResponse.json({
      success: true,
      message: 'Stripe account disconnected successfully',
    });
  } catch (error: any) {
    console.error('Error disconnecting Stripe account:', error);

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
