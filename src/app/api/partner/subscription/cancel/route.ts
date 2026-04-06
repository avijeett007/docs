import { NextRequest, NextResponse } from 'next/server';
import { verifyPartnerJWT } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { getServerStripe } from '@/lib/stripe';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

const stripe = getServerStripe();

const cancelSubscriptionSchema = z.object({
  reason: z.string().optional(),
  feedback: z.string().optional(),
  immediate: z.boolean().default(false),
  acceptedRetention: z.boolean().default(false),
  retentionOfferId: z.string().optional(),
});

/**
 * POST /api/partner/subscription/cancel
 * Cancel partner's subscription with retention flow
 */
export async function POST(request: NextRequest) {
  try {
    // Verify partner authentication
    const decoded = await verifyPartnerJWT(request);
    if (!decoded || !decoded.payload || !decoded.isValid) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const partnerId = decoded.payload.partnerId;
    const body = await request.json();
    const validatedData = cancelSubscriptionSchema.parse(body);

    // Get partner details
    const partner = await prisma.partner.findUnique({
      where: { id: partnerId },
      select: {
        id: true,
        businessName: true,
        emailAddress: true,
        stripeCustomerId: true,
        stripeSubscriptionId: true,
        subscriptionStatus: true,
        approvalStatus: true,
      },
    });

    if (!partner) {
      return NextResponse.json({ error: 'Partner not found' }, { status: 404 });
    }

    if (partner.subscriptionStatus !== 'ACTIVE') {
      return NextResponse.json(
        { error: 'No active subscription to cancel' },
        { status: 400 }
      );
    }

    let stripeSubscription = null;

    // Handle Stripe subscription cancellation
    if (partner.stripeCustomerId && partner.stripeSubscriptionId) {
      try {
        if (validatedData.immediate) {
          // Cancel immediately
          stripeSubscription = await stripe.subscriptions.cancel(
            partner.stripeSubscriptionId
          );
        } else {
          // Cancel at period end
          stripeSubscription = await stripe.subscriptions.update(
            partner.stripeSubscriptionId,
            {
              cancel_at_period_end: true,
              metadata: {
                cancellation_reason: validatedData.reason || 'user_requested',
                cancellation_feedback: validatedData.feedback || '',
                cancelled_by: partnerId,
                cancelled_at: new Date().toISOString(),
              },
            }
          );
        }
      } catch (stripeError) {
        // Error cancelling Stripe subscription
        return NextResponse.json(
          { error: 'Failed to cancel subscription with payment provider' },
          { status: 500 }
        );
      }
    }

    // Update partner status in database
    const updateData: any = {
      subscriptionStatus: validatedData.immediate ? 'CANCELLED' : 'CANCELLING',
      updatedAt: new Date(),
    };

    // If immediate cancellation, also update approval status
    if (validatedData.immediate) {
      updateData.approvalStatus = 'INACTIVE';
    }

    await prisma.partner.update({
      where: { id: partnerId },
      data: updateData,
    });

    // Log cancellation event
    await prisma.auditLog.create({
      data: {
        partnerId: partnerId,
        entityType: 'subscription',
        entityId: partner.stripeSubscriptionId || partnerId,
        action: 'SUBSCRIPTION_CANCELLED',
        details: {
          reason: validatedData.reason,
          feedback: validatedData.feedback,
          immediate: validatedData.immediate,
          acceptedRetention: validatedData.acceptedRetention,
          retentionOfferId: validatedData.retentionOfferId,
          stripeSubscriptionId: partner.stripeSubscriptionId,
          cancelledAt: new Date().toISOString(),
        },
        ipAddress: request.headers.get('x-forwarded-for') || 
                   request.headers.get('x-real-ip') || 
                   'unknown',
        userAgent: request.headers.get('user-agent') || 'unknown',
      },
    });

    // If immediate cancellation, trigger partner deactivation process
    if (validatedData.immediate) {
      try {
        // Call partner deactivation endpoint
        // Use INTERNAL_API_URL for server-to-server calls to prevent redirect loops
        const internalApiUrl = process.env.INTERNAL_API_URL || 'http://localhost:3000';
        await fetch(`${internalApiUrl}/api/partner/deactivate`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${request.headers.get('Authorization')?.replace('Bearer ', '')}`,
          },
          body: JSON.stringify({
            partnerId,
            reason: 'subscription_cancelled',
          }),
        });
      } catch (deactivationError) {
        // Error triggering partner deactivation
        // Don't fail the cancellation if deactivation fails
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        cancelled: true,
        immediate: validatedData.immediate,
        effectiveDate: validatedData.immediate 
          ? new Date() 
          : stripeSubscription?.current_period_end 
            ? new Date(stripeSubscription.current_period_end * 1000)
            : null,
        message: validatedData.immediate
          ? 'Subscription cancelled immediately'
          : 'Subscription will be cancelled at the end of the current billing period',
      },
    });

  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request data', details: error.errors },
        { status: 400 }
      );
    }

    // Error cancelling subscription
    return NextResponse.json(
      { error: 'Failed to cancel subscription' },
      { status: 500 }
    );
  }
}
