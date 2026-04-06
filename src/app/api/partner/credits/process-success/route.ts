import { NextRequest, NextResponse } from 'next/server';
import { getServerStripe } from '@/lib/stripe';
import { CreditPurchaseService } from '@/lib/services/creditPurchaseService';
import { verifyPartnerAuth } from '@/lib/auth/partnerAuth';

export const dynamic = 'force-dynamic';

/**
 * POST /api/partner/credits/process-success
 * Process successful credit purchase immediately (don't wait for webhook)
 */
export async function POST(request: NextRequest) {
  try {
    // Verify partner authentication
    const partner = await verifyPartnerAuth(request);
    if (!partner) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { sessionId } = await request.json();

    if (!sessionId) {
      return NextResponse.json(
        { success: false, error: 'Session ID is required' },
        { status: 400 }
      );
    }

    const stripe = getServerStripe();
    if (!stripe) {
      return NextResponse.json(
        { success: false, error: 'Stripe not initialized' },
        { status: 500 }
      );
    }

    // Retrieve the checkout session from Stripe
    const session = await stripe.checkout.sessions.retrieve(sessionId);

    if (!session) {
      return NextResponse.json(
        { success: false, error: 'Session not found' },
        { status: 404 }
      );
    }

    // Verify the session belongs to this partner
    if (session.metadata?.partnerId !== partner.id) {
      return NextResponse.json(
        { success: false, error: 'Session does not belong to this partner' },
        { status: 403 }
      );
    }

    // Check if payment was successful
    if (session.payment_status !== 'paid') {
      return NextResponse.json(
        { success: false, error: 'Payment not completed' },
        { status: 400 }
      );
    }

    // Process the successful purchase
    const result = await CreditPurchaseService.handleSuccessfulPurchase(
      sessionId,
      session.payment_intent as string
    );

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error || 'Failed to process purchase' },
        { status: 500 }
      );
    }

    // Return success with credits added
    return NextResponse.json({
      success: true,
      creditsAdded: result.creditsAdded || 0,
      message: 'Credits added successfully'
    });

  } catch (error) {
    console.error('Error processing successful payment:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
