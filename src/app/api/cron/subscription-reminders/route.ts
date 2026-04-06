import { NextRequest, NextResponse } from 'next/server';
import { processSubscriptionReminders } from '@/lib/email/subscriptionNotifications';

export const dynamic = 'force-dynamic';

/**
 * POST /api/cron/subscription-reminders
 * Process subscription renewal reminders
 * This endpoint should be called by a cron job service (like Vercel Cron or external cron)
 */
export async function POST(request: NextRequest) {
  try {
    // Verify the request is from an authorized source
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;

    if (!cronSecret) {
      return NextResponse.json(
        { error: 'Server configuration error: CRON_SECRET not configured' },
        { status: 500 }
      );
    }

    if (authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const daysParam = searchParams.get('days');
    const days = daysParam ? parseInt(daysParam, 10) : null;

    // Validate days parameter
    if (days !== 7 && days !== 3) {
      return NextResponse.json(
        { error: 'Invalid days parameter. Must be 7 or 3.' },
        { status: 400 }
      );
    }

    // Starting subscription reminder processing

    const results = await processSubscriptionReminders(days);

    // Subscription reminder processing completed

    return NextResponse.json({
      success: true,
      data: {
        daysAhead: days,
        processed: results.processed,
        successful: results.successful,
        failed: results.failed,
        timestamp: new Date().toISOString(),
      },
    });

  } catch (error) {
    // Error handled silently for production
    return NextResponse.json(
      { 
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/cron/subscription-reminders
 * Get information about upcoming renewals (for testing/monitoring)
 */
export async function GET(request: NextRequest) {
  try {
    // Verify the request is from an authorized source
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;

    if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const daysParam = searchParams.get('days');
    const days = daysParam ? parseInt(daysParam, 10) : 7;

    // Import here to avoid circular dependencies
    const { getUpcomingRenewals } = await import('@/lib/email/subscriptionNotifications');
    const upcomingRenewals = await getUpcomingRenewals(days);

    return NextResponse.json({
      success: true,
      data: {
        daysAhead: days,
        count: upcomingRenewals.length,
        renewals: upcomingRenewals.map(renewal => ({
          partnerId: renewal.partnerId,
          businessName: renewal.businessName,
          emailAddress: renewal.emailAddress,
          nextBillingDate: renewal.nextBillingDate,
          amount: renewal.amount,
          currency: renewal.currency,
          daysUntilRenewal: renewal.daysUntilRenewal,
        })),
        timestamp: new Date().toISOString(),
      },
    });

  } catch (error) {
    // Error handled silently for production
    return NextResponse.json(
      { 
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
