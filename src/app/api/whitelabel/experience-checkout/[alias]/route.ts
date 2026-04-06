import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import Stripe from 'stripe';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

/**
 * POST /api/whitelabel/experience-checkout/[alias]
 *
 * Creates a Stripe one-time payment checkout session for a prepaid
 * experience booking (e.g., OpenClaw Setup Service).
 *
 * Body: { prospectId, successUrl, cancelUrl }
 * Returns: { url }  (the Stripe-hosted checkout URL)
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { alias: string } }
) {
  const { alias } = params;
  const normalizedAlias = alias.startsWith('/') ? alias : `/${alias}`;

  try {
    const { prospectId, successUrl, cancelUrl } = await request.json();

    if (!prospectId || !successUrl || !cancelUrl) {
      return NextResponse.json({ error: 'Missing required fields: prospectId, successUrl, cancelUrl' }, { status: 400 });
    }

    // Resolve the partner from the hostname (same pattern as branding API)
    const hostname = request.headers.get('host') || '';
    const partnerId = request.headers.get('x-partner-id');

    let partner;
    if (partnerId) {
      partner = await prisma.partner.findUnique({ where: { id: partnerId } });
    } else {
      const subdomain = extractSubdomain(hostname);
      if (subdomain) {
        partner = await prisma.partner.findFirst({
          where: { subdomain: { equals: subdomain, mode: 'insensitive' } },
        });
      }
      if (!partner) {
        partner = await prisma.partner.findFirst({
          where: { customDomain: { equals: hostname.split(':')[0], mode: 'insensitive' } },
        });
      }
    }

    if (!partner) {
      return NextResponse.json({ error: 'Partner not found' }, { status: 404 });
    }

    if (!partner.stripeAccountId) {
      return NextResponse.json({ error: 'Partner Stripe account not configured' }, { status: 400 });
    }

    // Look up the experience for this alias
    const experience = await prisma.partnerExperience.findFirst({
      where: { partnerId: partner.id, alias: normalizedAlias, enabled: true },
    });

    if (!experience) {
      return NextResponse.json({ error: 'Experience not found' }, { status: 404 });
    }

    const landingConfig = (experience.landingPageConfig as Record<string, unknown>) || {};
    const prepaid = landingConfig.prepaidBooking as Record<string, unknown> | undefined;

    if (!prepaid?.enabled || !prepaid.amount || Number(prepaid.amount) <= 0) {
      return NextResponse.json({ error: 'Prepaid booking is not configured for this experience' }, { status: 400 });
    }

    // Verify the prospect belongs to this partner
    const prospect = await prisma.prospect.findFirst({
      where: { id: prospectId, partnerId: partner.id },
    });

    if (!prospect) {
      return NextResponse.json({ error: 'Prospect not found' }, { status: 404 });
    }

    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
      apiVersion: '2023-10-16',
    });

    const currency = (prepaid.currency as string) || 'usd';
    const amountInCents = Number(prepaid.amount);
    const description = (prepaid.description as string) || 'Setup Session Booking Fee';

    const session = await stripe.checkout.sessions.create(
      {
        mode: 'payment',
        payment_method_types: ['card'],
        line_items: [
          {
            price_data: {
              currency,
              unit_amount: amountInCents,
              product_data: {
                name: description,
                description: `Booking fee for ${partner.businessName || 'your agency'} setup session`,
              },
            },
            quantity: 1,
          },
        ],
        success_url: successUrl,
        cancel_url: cancelUrl,
        customer_email: prospect.email || undefined,
        metadata: {
          type: 'experience_booking',
          prospectId,
          experienceId: experience.id,
          partnerId: partner.id,
          alias: normalizedAlias,
        },
      },
      { stripeAccount: partner.stripeAccountId }
    );

    logger.info('Experience checkout session created', {
      operation: 'experience-checkout',
      prospectId,
      experienceId: experience.id,
      partnerId: partner.id,
      sessionId: session.id,
    });

    return NextResponse.json({ url: session.url });
  } catch (error) {
    logger.error('Error creating experience checkout session', error instanceof Error ? error : new Error(String(error)), {
      operation: 'experience-checkout',
      alias,
    });
    return NextResponse.json(
      { error: 'Internal server error', details: process.env.NODE_ENV === 'development' ? String(error) : undefined },
      { status: 500 }
    );
  }
}

function extractSubdomain(hostname: string): string | null {
  const host = hostname.split(':')[0];
  if (host.includes('.lvh.me')) return host.split('.')[0];
  if (host.includes('.knotie-ai.pro')) return host.split('.')[0];
  return null;
}

