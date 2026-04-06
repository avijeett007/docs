import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import Stripe from 'stripe';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

/**
 * GET /api/whitelabel/verify-payment/[alias]?session_id=cs_xxx
 *
 * Server-side verification that a Stripe checkout session is paid.
 * Called by the landing page after the customer returns from Stripe.
 * Replaces the insecure ?paid=1 client-side check.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { alias: string } }
) {
  const { alias } = params;
  const sessionId = request.nextUrl.searchParams.get('session_id');

  if (!sessionId || !sessionId.startsWith('cs_')) {
    return NextResponse.json({ paid: false, error: 'Invalid session_id' }, { status: 400 });
  }

  try {
    // Resolve the partner from hostname or x-partner-id header
    const hostname = request.headers.get('host') || '';
    const partnerIdHeader = request.headers.get('x-partner-id');

    let partner: { id: string; stripeAccountId: string | null } | null = null;

    if (partnerIdHeader) {
      partner = await prisma.partner.findUnique({
        where: { id: partnerIdHeader },
        select: { id: true, stripeAccountId: true },
      });
    } else {
      const host = hostname.split(':')[0];
      let subdomain: string | null = null;
      if (host.includes('.lvh.me')) subdomain = host.split('.')[0];
      else if (host.includes('.knotie-ai.pro')) subdomain = host.split('.')[0];

      if (subdomain) {
        partner = await prisma.partner.findFirst({
          where: { subdomain: { equals: subdomain, mode: 'insensitive' } },
          select: { id: true, stripeAccountId: true },
        });
      }
      if (!partner) {
        partner = await prisma.partner.findFirst({
          where: { customDomain: { equals: host, mode: 'insensitive' } },
          select: { id: true, stripeAccountId: true },
        });
      }
    }

    if (!partner) {
      logger.warn('Payment verification - partner not found', { operation: 'verify-payment', alias, hostname });
      return NextResponse.json({ paid: false, error: 'Partner not found' }, { status: 404 });
    }

    if (!partner.stripeAccountId) {
      logger.warn('Payment verification - partner has no Stripe account', { operation: 'verify-payment', alias, partnerId: partner.id });
      return NextResponse.json({ paid: false, error: 'Stripe not configured for this partner' }, { status: 400 });
    }

    // Retrieve the session from the partner's Stripe Connect account
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2023-10-16' });

    const session = await stripe.checkout.sessions.retrieve(
      sessionId,
      { expand: ['payment_intent'] },
      { stripeAccount: partner.stripeAccountId }
    );

    const paid = session.payment_status === 'paid';

    logger.info('Payment verification complete', {
      operation: 'verify-payment',
      alias,
      partnerId: partner.id,
      sessionId,
      paymentStatus: session.payment_status,
      paid,
    });

    return NextResponse.json({ paid });
  } catch (error) {
    // Stripe throws if sessionId is invalid / not found on that account — treat as not paid
    logger.error(
      'Payment verification failed',
      error instanceof Error ? error : new Error(String(error)),
      { operation: 'verify-payment', alias, sessionId }
    );
    return NextResponse.json({ paid: false }, { status: 500 });
  }
}

