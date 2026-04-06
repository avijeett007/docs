import { NextRequest, NextResponse } from 'next/server';
import { verifyCustomerAuth } from '@/lib/auth/customerAuth';
import { prisma } from '@/lib/prisma';
import Stripe from 'stripe';

export const dynamic = 'force-dynamic';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2023-10-16',
});

/**
 * GET /api/whitelabel/credits/success?session_id=cs_xxx
 * Process successful credit purchase and add credits to customer account
 */
export async function GET(request: NextRequest) {
  try {
    // Verify customer authentication
    const customerAuth = await verifyCustomerAuth(request);

    if (!customerAuth) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const customerId = customerAuth.customerId;
    const partnerId = customerAuth.partnerId;

    // Get session_id from query params
    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get('session_id');

    if (!sessionId) {
      return NextResponse.json(
        { success: false, error: 'Missing session_id parameter' },
        { status: 400 }
      );
    }

    console.log(`Processing credit purchase success for session: ${sessionId}`);

    // Get partner info for Stripe Connect account
    const partner = await prisma.partner.findUnique({
      where: { id: partnerId },
      select: {
        id: true,
        stripeAccountId: true,
      },
    });

    if (!partner?.stripeAccountId) {
      return NextResponse.json(
        { success: false, error: 'Partner Stripe account not found' },
        { status: 400 }
      );
    }

    // Retrieve the checkout session from Stripe
    const session = await stripe.checkout.sessions.retrieve(sessionId, {
      stripeAccount: partner.stripeAccountId,
    });

    if (!session) {
      return NextResponse.json(
        { success: false, error: 'Checkout session not found' },
        { status: 404 }
      );
    }

    if (session.payment_status !== 'paid') {
      return NextResponse.json(
        { success: false, error: 'Payment not completed' },
        { status: 400 }
      );
    }

    // Verify this is a customer credit purchase
    if (session.metadata?.type !== 'customer_credit_purchase') {
      return NextResponse.json(
        { success: false, error: 'Invalid session type' },
        { status: 400 }
      );
    }

    const { planId, credits } = session.metadata;

    if (!planId || !credits) {
      return NextResponse.json(
        { success: false, error: 'Missing session metadata' },
        { status: 400 }
      );
    }

    // Check if this session has already been processed by ANY method (webhook or redirect)
    const existingTransaction = await prisma.creditTransaction.findFirst({
      where: {
        OR: [
          {
            metadata: {
              path: ['stripeSessionId'],
              equals: sessionId
            }
          },
          {
            referenceId: session.payment_intent as string
          }
        ]
      }
    });

    if (existingTransaction) {
      const source = existingTransaction.metadata && typeof existingTransaction.metadata === 'object' && 'source' in existingTransaction.metadata
        ? existingTransaction.metadata.source
        : 'unknown';
      console.log(`Payment ${session.payment_intent} already processed via ${source}, skipping`);
      return NextResponse.json({
        success: true,
        message: 'Credits already added',
        data: {
          credits: parseInt(credits),
          alreadyProcessed: true,
          processedVia: source
        }
      });
    }

    // Process the credit addition with atomic transaction and idempotency
    const result = await prisma.$transaction(async (tx) => {
      // Double-check for existing transaction within the transaction (prevents race conditions)
      const existingInTransaction = await tx.creditTransaction.findFirst({
        where: {
          OR: [
            {
              metadata: {
                path: ['stripeSessionId'],
                equals: sessionId
              }
            },
            {
              referenceId: session.payment_intent as string
            }
          ]
        }
      });

      if (existingInTransaction) {
        throw new Error(`Payment already processed: ${existingInTransaction.id}`);
      }

      // Update the purchase record to completed
      await tx.customerCreditPurchase.updateMany({
        where: {
          customerId,
          planId,
          status: 'pending',
          metadata: {
            path: ['stripeSessionId'],
            equals: sessionId
          }
        },
        data: {
          status: 'completed',
          stripePaymentIntentId: session.payment_intent as string || '',
        }
      });

      // Get current customer balance with row-level locking
      const customer = await tx.customer.findUnique({
        where: { id: customerId },
        select: { creditBalance: true }
      });

      if (!customer) {
        throw new Error(`Customer ${customerId} not found`);
      }

      const creditsToAdd = parseInt(credits);
      const newBalance = customer.creditBalance + creditsToAdd;

      // Get credit plan details first
      const creditPlan = await tx.customerCreditPlan.findUnique({
        where: { id: planId },
        select: { name: true }
      });

      // Atomically update customer balance and create transaction record
      const [updatedCustomer, transaction] = await Promise.all([
        tx.customer.update({
          where: { id: customerId },
          data: {
            creditBalance: newBalance,
            totalCreditsAllocated: {
              increment: creditsToAdd
            }
          }
        }),
        tx.creditTransaction.create({
          data: {
            customerId: customerId,
            partnerId: partnerId,
            type: 'purchase',
            amount: creditsToAdd,
            balanceAfter: newBalance,
            description: `Credit purchase: ${creditPlan?.name || 'Credit Plan'}`,
            referenceId: session.payment_intent as string || sessionId,
            metadata: {
              source: 'stripe_purchase_success_redirect',
              planId: planId,
              type: 'customer_credit_purchase',
              stripeSessionId: sessionId,
              processedAt: new Date().toISOString()
            }
          }
        })
      ]);

      return {
        creditsAdded: creditsToAdd,
        newBalance: updatedCustomer.creditBalance,
        transactionId: transaction.id,
        planName: creditPlan?.name
      };
    }, {
      isolationLevel: 'Serializable', // Highest isolation level to prevent race conditions
      timeout: 10000 // 10 second timeout
    });

    console.log(`Successfully added ${result.creditsAdded} credits to customer ${customerId}. New balance: ${result.newBalance}`);

    // After successful credit purchase, reassociate any phone numbers
    // that were suspended due to insufficient credits (fire-and-forget)
    try {
      const connectHubUrl = process.env.CONNECT_HUB_URL;
      if (connectHubUrl) {
        console.log(`🔄 Triggering phone reassociation for customer ${customerId} after credit purchase (success redirect)`);
        fetch(`${connectHubUrl}/api/phone-reassociation/${customerId}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${process.env.CONNECT_HUB_API_KEY || ''}`,
          },
        }).then(async (res) => {
          if (res.ok) {
            const data = await res.json();
            console.log(`✅ Phone reassociation completed for customer ${customerId}:`, {
              totalFound: data.totalFound,
              restored: data.restored,
              failed: data.failed
            });
          } else {
            console.error(`❌ Phone reassociation failed for customer ${customerId}: HTTP ${res.status}`);
          }
        }).catch((err) => {
          console.error(`❌ Phone reassociation request failed for customer ${customerId}:`, err.message);
        });
      }
    } catch (reassocError) {
      console.error('Error triggering phone reassociation:', reassocError);
      // Don't throw - reassociation failure shouldn't fail the success redirect
    }

    return NextResponse.json({
      success: true,
      message: 'Credits added successfully',
      data: {
        credits: result.creditsAdded,
        newBalance: result.newBalance,
        planName: result.planName,
        transactionId: result.transactionId
      }
    });

  } catch (error) {
    console.error('Error processing credit purchase success:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to process credit purchase' },
      { status: 500 }
    );
  }
}
