import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

/**
 * @deprecated This debug endpoint is not used in the application UI and is scheduled for removal.
 * It was created for manual debugging of partner configuration by subdomain.
 * TODO: Delete this route in a future cleanup sprint.
 *
 * @description Debug endpoint to look up partner details by subdomain including pricing model and Stripe setup.
 * @route GET /api/debug/partner?subdomain={subdomain}
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const subdomain = searchParams.get('subdomain');

    if (!subdomain) {
      return NextResponse.json({ error: 'Subdomain parameter required' }, { status: 400 });
    }

    // Fix 2: Use case-insensitive lookup for existing data compatibility
    const partner = await prisma.partner.findFirst({
      where: {
        subdomain: { equals: subdomain, mode: 'insensitive' }
      },
      select: {
        id: true,
        businessName: true,
        subdomain: true,
        pricingModel: true,
        payAsYouGoRate: true,
        freeAiCredits: true,
        freeTrialEnabled: true,
        saasOnboardingEnabled: true,
        stripeAccountId: true,
        stripeOnboardingCompleted: true,
        customerPortalEnabled: true
      }
    });

    if (!partner) {
      return NextResponse.json({ error: 'Partner not found' }, { status: 404 });
    }

    return NextResponse.json({
      partner,
      debug: {
        pricingModel: partner.pricingModel,
        payAsYouGoRate: partner.payAsYouGoRate?.toString(),
        freeAiCredits: partner.freeAiCredits,
        freeTrialEnabled: partner.freeTrialEnabled,
        stripeSetup: partner.stripeOnboardingCompleted
      }
    });
  } catch (error) {
    console.error('Debug partner API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
