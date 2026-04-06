import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import Stripe from 'stripe';
import { MeteredBillingService } from '@/lib/billing/meteredBilling';
import { UsageTrackingService } from '@/lib/billing/usageTracking';

export const dynamic = 'force-dynamic';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2023-10-16',
});

const endpointSecret = process.env.STRIPE_METERED_BILLING_WEBHOOK_SECRET || process.env.STRIPE_WEBHOOK_SECRET!;

export async function POST(request: NextRequest) {
  try {
    const body = await request.text();
    const signature = request.headers.get('stripe-signature');

    if (!signature) {
      console.error('Missing Stripe signature');
      return NextResponse.json(
        { error: 'Missing signature' },
        { status: 400 }
      );
    }

    let event: Stripe.Event;

    try {
      event = stripe.webhooks.constructEvent(body, signature, endpointSecret);
    } catch (err) {
      console.error('Webhook signature verification failed:', err);
      return NextResponse.json(
        { error: 'Invalid signature' },
        { status: 400 }
      );
    }

    console.log('Processing Stripe metered billing webhook event:', event.type);

    switch (event.type) {
      case 'customer.subscription.created':
        await handleSubscriptionCreated(event.data.object as Stripe.Subscription);
        break;

      case 'customer.subscription.updated':
        await handleSubscriptionUpdated(event.data.object as Stripe.Subscription);
        break;

      case 'customer.subscription.deleted':
        await handleSubscriptionDeleted(event.data.object as Stripe.Subscription);
        break;

      case 'invoice.created':
        await handleInvoiceCreated(event.data.object as Stripe.Invoice);
        break;

      case 'invoice.finalized':
        await handleInvoiceFinalized(event.data.object as Stripe.Invoice);
        break;

      case 'invoice.payment_succeeded':
        await handleInvoicePaymentSucceeded(event.data.object as Stripe.Invoice);
        break;

      case 'invoice.payment_failed':
        await handleInvoicePaymentFailed(event.data.object as Stripe.Invoice);
        break;

      // Note: usage_record.created is not a valid Stripe webhook event type
      // Usage records are created via API calls, not webhook events

      default:
        console.log(`Unhandled metered billing event type: ${event.type}`);
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error('Error processing metered billing webhook:', error);
    return NextResponse.json(
      { error: 'Webhook processing failed' },
      { status: 500 }
    );
  }
}

async function handleSubscriptionCreated(subscription: Stripe.Subscription) {
  console.log('Handling subscription created:', subscription.id);
  
  try {
    // Find the corresponding database subscription by Stripe subscription ID
    const dbSubscription = await prisma.customerMeteredSubscription.findFirst({
      where: {
        stripeSubscriptionId: subscription.id,
      },
      include: {
        customer: true,
        partner: true,
        plan: true,
      },
    });

    if (!dbSubscription) {
      console.error('Database subscription not found for Stripe subscription:', subscription.id);
      return;
    }

    // Update subscription status
    await prisma.customerMeteredSubscription.update({
      where: { id: dbSubscription.id },
      data: {
        status: subscription.status === 'active' ? 'active' : 'paused',
        stripeCustomerId: subscription.customer as string,
        currentPeriodStart: new Date(subscription.current_period_start * 1000),
        currentPeriodEnd: new Date(subscription.current_period_end * 1000),
        nextBillingDate: new Date(subscription.current_period_end * 1000),
      },
    });

    console.log('Subscription created and updated in database:', dbSubscription.id);
  } catch (error) {
    console.error('Error handling subscription created:', error);
    throw error;
  }
}

async function handleSubscriptionUpdated(subscription: Stripe.Subscription) {
  console.log('Handling subscription updated:', subscription.id);
  
  try {
    const dbSubscription = await prisma.customerMeteredSubscription.findFirst({
      where: {
        stripeSubscriptionId: subscription.id,
      },
    });

    if (!dbSubscription) {
      console.error('Database subscription not found for Stripe subscription:', subscription.id);
      return;
    }

    // Update subscription status and billing period
    await prisma.customerMeteredSubscription.update({
      where: { id: dbSubscription.id },
      data: {
        status: subscription.status === 'active' ? 'active' : 
               subscription.status === 'canceled' ? 'cancelled' : 'paused',
        currentPeriodStart: new Date(subscription.current_period_start * 1000),
        currentPeriodEnd: new Date(subscription.current_period_end * 1000),
        nextBillingDate: new Date(subscription.current_period_end * 1000),
      },
    });

    console.log('Subscription updated in database:', dbSubscription.id);
  } catch (error) {
    console.error('Error handling subscription updated:', error);
    throw error;
  }
}

async function handleSubscriptionDeleted(subscription: Stripe.Subscription) {
  console.log('Handling subscription deleted:', subscription.id);
  
  try {
    const dbSubscription = await prisma.customerMeteredSubscription.findFirst({
      where: {
        stripeSubscriptionId: subscription.id,
      },
    });

    if (!dbSubscription) {
      console.error('Database subscription not found for Stripe subscription:', subscription.id);
      return;
    }

    // Mark subscription as cancelled
    await prisma.customerMeteredSubscription.update({
      where: { id: dbSubscription.id },
      data: {
        status: 'cancelled',
        cancelledAt: new Date(),
      },
    });

    console.log('Subscription cancelled in database:', dbSubscription.id);
  } catch (error) {
    console.error('Error handling subscription deleted:', error);
    throw error;
  }
}

async function handleInvoiceCreated(invoice: Stripe.Invoice) {
  console.log('Handling invoice created:', invoice.id);
  
  try {
    // This is called when Stripe creates an invoice for a subscription
    // We can use this to prepare for billing processing
    if (invoice.subscription) {
      const dbSubscription = await prisma.customerMeteredSubscription.findFirst({
        where: {
          stripeSubscriptionId: invoice.subscription as string,
        },
      });

      if (dbSubscription) {
        console.log('Invoice created for subscription:', dbSubscription.id);
        // Could trigger usage aggregation here if needed
      }
    }
  } catch (error) {
    console.error('Error handling invoice created:', error);
    throw error;
  }
}

async function handleInvoiceFinalized(invoice: Stripe.Invoice) {
  console.log('Handling invoice finalized:', invoice.id);
  
  try {
    // Invoice is finalized and ready for payment
    // This is where we can record the final billing amount
    if (invoice.subscription) {
      const dbSubscription = await prisma.customerMeteredSubscription.findFirst({
        where: {
          stripeSubscriptionId: invoice.subscription as string,
        },
        include: {
          plan: true,
        },
      });

      if (dbSubscription) {
        // Record the invoice in our system
        await prisma.invoice.create({
          data: {
            customerId: dbSubscription.customerId,
            partnerId: dbSubscription.partnerId,
            invoiceNumber: invoice.number || `INV-${Date.now()}`,
            title: `Metered Billing Invoice`,
            stripeInvoiceId: invoice.id,
            amount: invoice.amount_due, // Keep in cents
            currency: invoice.currency,
            status: 'pending',
            type: 'metered',
            dueDate: new Date(invoice.due_date! * 1000),
            description: `Metered billing for ${dbSubscription.plan.name}`,
            usagePeriodStart: new Date(invoice.period_start! * 1000),
            usagePeriodEnd: new Date(invoice.period_end! * 1000),
            meteredComponents: {
              subscriptionId: dbSubscription.id,
              billingPeriod: {
                start: invoice.period_start,
                end: invoice.period_end,
              },
            },
          },
        });

        console.log('Invoice recorded in database for subscription:', dbSubscription.id);
      }
    }
  } catch (error) {
    console.error('Error handling invoice finalized:', error);
    throw error;
  }
}

async function handleInvoicePaymentSucceeded(invoice: Stripe.Invoice) {
  console.log('Handling invoice payment succeeded:', invoice.id);
  
  try {
    // Update invoice status to paid
    const dbInvoice = await prisma.invoice.findFirst({
      where: {
        stripeInvoiceId: invoice.id,
      },
    });

    if (dbInvoice) {
      await prisma.invoice.update({
        where: { id: dbInvoice.id },
        data: {
          status: 'paid',
          paidAt: new Date(),
        },
      });

      // Mark usage as billed
      if (invoice.subscription) {
        const dbSubscription = await prisma.customerMeteredSubscription.findFirst({
          where: {
            stripeSubscriptionId: invoice.subscription as string,
          },
          include: { plan: true },
        });

        if (dbSubscription) {
          await UsageTrackingService.markUsageAsBilled(
            dbSubscription.customerId,
            dbSubscription.partnerId,
            new Date(invoice.period_start * 1000),
            new Date(invoice.period_end * 1000),
            dbInvoice.id,
            dbSubscription.plan.metricType
          );
        }
      }

      console.log('Invoice payment processed successfully:', dbInvoice.id);
    }
  } catch (error) {
    console.error('Error handling invoice payment succeeded:', error);
    throw error;
  }
}

async function handleInvoicePaymentFailed(invoice: Stripe.Invoice) {
  console.log('Handling invoice payment failed:', invoice.id);
  
  try {
    // Update invoice status to failed
    const dbInvoice = await prisma.invoice.findFirst({
      where: {
        stripeInvoiceId: invoice.id,
      },
    });

    if (dbInvoice) {
      await prisma.invoice.update({
        where: { id: dbInvoice.id },
        data: {
          status: 'failed',
        },
      });

      // Could trigger retry logic or customer notification here
      console.log('Invoice payment failed, updated status:', dbInvoice.id);
    }
  } catch (error) {
    console.error('Error handling invoice payment failed:', error);
    throw error;
  }
}


