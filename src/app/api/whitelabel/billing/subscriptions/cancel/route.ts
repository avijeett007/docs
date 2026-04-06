import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyCustomerJWT } from '@/lib/customerJwt';
import { prisma } from '@/lib/prisma';
import { getServerStripe } from '@/lib/stripe';
import { logger } from '@/lib/logger';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

const cancelSubscriptionSchema = z.object({
  subscriptionId: z.string().min(1, 'Subscription ID is required'),
  reason: z.string().optional(),
  immediate: z.boolean().default(false),
});

/**
 * POST /api/whitelabel/billing/subscriptions/cancel
 * Cancel customer's subscription
 */
export async function POST(request: NextRequest) {
  try {
    // Verify customer authentication
    const cookieStore = cookies();
    const token = cookieStore.get('customer_token')?.value;

    if (!token) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const payload = await verifyCustomerJWT(token);
    if (!payload) {
      return NextResponse.json(
        { success: false, error: 'Invalid token' },
        { status: 401 }
      );
    }

    const { customerId, partnerId } = payload;
    const body = await request.json();
    const validatedData = cancelSubscriptionSchema.parse(body);

    // Get the subscription
    const subscription = await prisma.customerSubscription.findFirst({
      where: {
        id: validatedData.subscriptionId,
        customerId: customerId,
        partnerId: partnerId,
      },
      include: {
        partner: {
          select: {
            stripeAccountId: true,
          },
        },
      },
    });

    if (!subscription) {
      return NextResponse.json(
        { success: false, error: 'Subscription not found' },
        { status: 404 }
      );
    }

    if (subscription.status === 'canceled') {
      return NextResponse.json(
        { success: false, error: 'Subscription is already canceled' },
        { status: 400 }
      );
    }

    // Cancel Stripe subscription if it exists
    let effectiveDate = new Date();
    if (subscription.stripeSubscriptionId && subscription.partner.stripeAccountId) {
      try {
        const stripe = getServerStripe();
        
        if (validatedData.immediate) {
          // Cancel immediately
          await stripe.subscriptions.cancel(
            subscription.stripeSubscriptionId,
            {
              stripeAccount: subscription.partner.stripeAccountId,
            }
          );
          effectiveDate = new Date();
        } else {
          // Cancel at period end
          const updatedSubscription = await stripe.subscriptions.update(
            subscription.stripeSubscriptionId,
            {
              cancel_at_period_end: true,
              metadata: {
                cancellation_reason: validatedData.reason || 'customer_requested',
                cancelled_by: customerId,
                cancelled_at: new Date().toISOString(),
              },
            },
            {
              stripeAccount: subscription.partner.stripeAccountId,
            }
          );
          effectiveDate = new Date(updatedSubscription.current_period_end * 1000);
        }

        logger.info('Stripe subscription cancelled', {
          operation: 'cancel-customer-subscription',
          customerId,
          partnerId,
          subscriptionId: subscription.id,
          stripeSubscriptionId: subscription.stripeSubscriptionId,
          immediate: validatedData.immediate,
        });
      } catch (stripeError) {
        logger.error(
          'Error cancelling Stripe subscription',
          stripeError instanceof Error ? stripeError : new Error(String(stripeError)),
          {
            operation: 'cancel-customer-subscription',
            customerId,
            partnerId,
            subscriptionId: subscription.id,
          }
        );
        return NextResponse.json(
          { success: false, error: 'Failed to cancel subscription with payment provider' },
          { status: 500 }
        );
      }
    }

    // Update subscription in database
    const updateData: any = {
      cancelAtPeriodEnd: !validatedData.immediate,
      updatedAt: new Date(),
    };

    if (validatedData.immediate) {
      updateData.status = 'canceled';
      updateData.canceledAt = new Date();
    }

    await prisma.customerSubscription.update({
      where: { id: subscription.id },
      data: updateData,
    });

    logger.info('Customer subscription cancelled', {
      operation: 'cancel-customer-subscription',
      customerId,
      partnerId,
      subscriptionId: subscription.id,
      immediate: validatedData.immediate,
      reason: validatedData.reason,
    });

    // Block customer portal access by suspending credentials
    try {
      const credential = await prisma.customerCredential.findFirst({
        where: {
          customerId: customerId,
          partnerId: partnerId,
        },
      });

      if (credential) {
        await prisma.customerCredential.update({
          where: { id: credential.id },
          data: { status: 'suspended' },
        });

        logger.info('Customer credential blocked after subscription cancellation', {
          operation: 'cancel-customer-subscription',
          customerId,
          partnerId,
          credentialId: credential.id,
        });
      }
    } catch (credentialError) {
      logger.error(
        'Error blocking customer credential after cancellation',
        credentialError instanceof Error ? credentialError : new Error(String(credentialError)),
        {
          operation: 'cancel-customer-subscription',
          customerId,
          partnerId,
        }
      );
      // Continue execution - don't fail the cancellation if blocking fails
    }

    // Clear customer token cookie to force logout
    const response = NextResponse.json({
      success: true,
      data: {
        cancelled: true,
        immediate: validatedData.immediate,
        effectiveDate: effectiveDate.toISOString(),
        message: validatedData.immediate
          ? 'Subscription cancelled immediately. You will be logged out.'
          : `Subscription will be cancelled at the end of the current billing period (${effectiveDate.toLocaleDateString()})`,
      },
    });

    // Clear cookie to force logout
    response.cookies.delete('customer_token');

    return response;
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: 'Invalid request data', details: error.errors },
        { status: 400 }
      );
    }

    logger.error(
      'Error cancelling customer subscription',
      error instanceof Error ? error : new Error(String(error)),
      { operation: 'cancel-customer-subscription' }
    );

    return NextResponse.json(
      { success: false, error: 'Failed to cancel subscription' },
      { status: 500 }
    );
  }
}
