// API endpoint for refreshing Stripe Connect onboarding link

import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
import { StripeConnectService } from '@/lib/stripe/connect';
import { isStripeConnectError } from '@/lib/stripe/utils';

export async function POST(request: NextRequest) {
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
    const { partnerId, accountId, refreshUrl, returnUrl } = body;

    if (!partnerId || !accountId || !refreshUrl || !returnUrl) {
      return NextResponse.json(
        { error: 'Missing required fields: partnerId, accountId, refreshUrl, returnUrl' },
        { status: 400 }
      );
    }

    // Refresh onboarding link
    const result = await StripeConnectService.refreshOnboardingLink({
      partnerId,
      accountId,
      refreshUrl,
      returnUrl,
    });

    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (error: any) {
    console.error('Error refreshing onboarding link:', error);

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
