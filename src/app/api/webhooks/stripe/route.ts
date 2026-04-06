// Stripe Connect webhook endpoint

import { NextRequest, NextResponse } from 'next/server';
import { StripeWebhookService } from '@/lib/stripe/webhooks';
import { isStripeConnectError } from '@/lib/stripe/utils';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    // Get the raw body
    const body = await request.text();
    const signature = request.headers.get('stripe-signature');

    if (!signature) {
      console.error('Missing Stripe signature header');
      return NextResponse.json(
        { error: 'Missing Stripe signature' },
        { status: 400 }
      );
    }

    const webhookSecret = process.env.STRIPE_CONNECT_WEBHOOK_SECRET || process.env.STRIPE_WEBHOOK_SECRET;
    if (!webhookSecret) {
      console.error('Missing STRIPE_CONNECT_WEBHOOK_SECRET or STRIPE_WEBHOOK_SECRET environment variable');
      return NextResponse.json(
        { error: 'Webhook secret not configured' },
        { status: 500 }
      );
    }

    // Verify webhook signature and construct event
    const event = StripeWebhookService.verifyWebhookSignature(
      body,
      signature,
      webhookSecret
    );

    console.log(`Received Stripe webhook: ${event.type} (${event.id})`);

    // Process the webhook event
    await StripeWebhookService.processWebhookEvent(event);

    return NextResponse.json({
      success: true,
      message: 'Webhook processed successfully',
      eventId: event.id,
      eventType: event.type,
    });
  } catch (error: any) {
    console.error('Error processing Stripe webhook:', error);

    if (isStripeConnectError(error)) {
      // Return 400 for signature verification errors
      if (error.code === 'INVALID_WEBHOOK_SIGNATURE') {
        return NextResponse.json(
          { error: error.message },
          { status: 400 }
        );
      }

      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: error.statusCode || 500 }
      );
    }

    // Return 500 for unexpected errors but still acknowledge receipt
    // This prevents Stripe from retrying the webhook
    return NextResponse.json(
      { error: 'Internal server error', received: true },
      { status: 500 }
    );
  }
}

// Handle GET requests for webhook endpoint verification
export async function GET() {
  return NextResponse.json({
    message: 'Stripe webhook endpoint is active',
    timestamp: new Date().toISOString(),
  });
}
