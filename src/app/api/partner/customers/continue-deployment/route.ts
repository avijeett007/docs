import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { verifyPartnerJWT } from '@/lib/auth';

// KnotieManager URL for auto-deploy jobs
const KNOTIE_MANAGER_URL = process.env.KNOTIE_MANAGER_URL || 'http://localhost:3003';
const KNOTIE_MANAGER_API_KEY = process.env.KNOTIE_MANAGER_API_KEY;

// Credit thresholds for auto-deploy
const MIN_TELEPHONY_CREDITS_CENTS_DEFAULT = 500; // $5.00 minimum for regular partners
const MIN_TELEPHONY_CREDITS_CENTS_FREE_FOREVER = 1000; // $10.00 minimum for free forever partners
const MIN_KNOTIE_CREDITS = 200; // 200 Knotie credits minimum

// Helper function to check if partner is on free forever plan
function isFreeForeverPartner(planId: string | null): boolean {
  if (!planId) return false;
  const freeForeverPriceId = process.env.STRIPE_FREE_FOREVER_PRICE_ID;
  return (
    planId === 'free_forever_trial' ||
    planId === 'free_forever' ||
    (freeForeverPriceId !== undefined && planId === freeForeverPriceId)
  );
}

/**
 * POST /api/partner/customers/continue-deployment
 *
 * Allows partners to manually trigger auto-deployment for customers
 * whose deployment was held due to insufficient credits.
 */
export async function POST(request: NextRequest) {
  try {
    // Verify partner authentication
    const authResult = await verifyPartnerJWT(request);
    if (!authResult.isValid || !authResult.payload?.partnerId) {
      return authResult.error || NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const partnerId = authResult.payload.partnerId;
    const body = await request.json();
    const { customerId } = body;

    if (!customerId) {
      return NextResponse.json({ error: 'Customer ID is required' }, { status: 400 });
    }

    logger.info('[ContinueDeployment] Request received', { partnerId, customerId });

    // Get partner with credit balances
    const partner = await prisma.partner.findUnique({
      where: { id: partnerId },
      select: {
        id: true,
        autoDeployEnabled: true,
        businessName: true,
        telephonyCreditBalanceCents: true,
        creditBalance: true,
        freeAiCredits: true, // For assigning credits to customer
        planId: true, // For free forever partner detection
      }
    });

    // Determine required telephony credits based on partner plan
    const isFreeForever = partner ? isFreeForeverPartner(partner.planId) : false;
    const MIN_TELEPHONY_CREDITS_CENTS = isFreeForever
      ? MIN_TELEPHONY_CREDITS_CENTS_FREE_FOREVER
      : MIN_TELEPHONY_CREDITS_CENTS_DEFAULT;

    if (!partner) {
      return NextResponse.json({ error: 'Partner not found' }, { status: 404 });
    }

    if (!partner.autoDeployEnabled) {
      logger.warn('[ContinueDeployment] Auto-deploy not enabled', { partnerId });
      return NextResponse.json({
        error: 'Auto-deploy is not enabled for your account'
      }, { status: 400 });
    }

    // The customerId passed from frontend is actually userOnboarding.id
    // First, look up the userOnboarding to get the actual Customer.id
    const userOnboarding = await prisma.userOnboarding.findFirst({
      where: {
        id: customerId,
        partnerId: partnerId
      },
      select: {
        id: true,
        customerId: true,
        firstName: true,
        lastName: true,
        email: true,
      }
    });

    if (!userOnboarding) {
      logger.warn('[ContinueDeployment] UserOnboarding not found', { customerId, partnerId });
      return NextResponse.json({ error: 'Customer not found' }, { status: 404 });
    }

    if (!userOnboarding.customerId) {
      logger.warn('[ContinueDeployment] Customer record not created yet', { userOnboardingId: customerId });
      return NextResponse.json({ error: 'Customer record not yet created' }, { status: 400 });
    }

    // Now get the actual Customer record
    const customer = await prisma.customer.findUnique({
      where: { id: userOnboarding.customerId },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        businessName: true,
        deploymentStatus: true,
        aiCreditsEnabled: true,
        creditBalance: true,
      }
    });

    if (!customer) {
      logger.warn('[ContinueDeployment] Customer record not found', { customerId: userOnboarding.customerId });
      return NextResponse.json({ error: 'Customer not found' }, { status: 404 });
    }

    // Get prospect info if available (linked via convertedToCustomerId)
    const prospect = await prisma.prospect.findFirst({
      where: { convertedToCustomerId: customer.id }
    });

    // Check if customer already has a Knova agent deployed
    const existingKnovaAgent = await prisma.knovaAgent.findFirst({
      where: {
        customerId: customer.id,
        isActive: true
      }
    });

    if (existingKnovaAgent) {
      return NextResponse.json({
        error: 'Customer already has an active Knova agent deployed',
        agentId: existingKnovaAgent.id
      }, { status: 400 });
    }

    // Check if deployment status allows continuation
    // Allow: 'pending_credits', null, 'not_started', 'failed', or 'completed' (agent was deleted)
    const allowedStatuses = ['pending_credits', null, undefined, 'not_started', 'failed', 'completed'];
    if (!allowedStatuses.includes(customer.deploymentStatus)) {
      logger.warn('[ContinueDeployment] Invalid deployment status', {
        partnerId,
        customerId: customer.id,
        currentStatus: customer.deploymentStatus,
        allowedStatuses
      });

      return NextResponse.json({
        error: `Cannot continue deployment. Current status: ${customer.deploymentStatus}`,
        currentStatus: customer.deploymentStatus
      }, { status: 400 });
    }

    // Only assign credits if customer doesn't have AI credits enabled yet
    // This prevents duplicate credit assignment
    if (!customer.aiCreditsEnabled) {
      const freeAiCredits = partner.freeAiCredits || 50;

      await prisma.$transaction(async (tx) => {
        // Enable AI credits and add free credits to customer
        await tx.customer.update({
          where: { id: customer.id },
          data: {
            aiCreditsEnabled: true,
            creditBalance: {
              increment: freeAiCredits
            }
          }
        });

        // Create credit transaction record
        await tx.creditTransaction.create({
          data: {
            customerId: customer.id,
            partnerId: partnerId,
            type: 'credit',
            amount: freeAiCredits,
            balanceAfter: (customer.creditBalance || 0) + freeAiCredits,
            description: 'Free AI Credits - Continue Deployment',
            metadata: {
              source: 'continue_deployment',
              grantType: 'one_time',
              reason: 'Automatic credit grant when partner continues deployment'
            }
          }
        });
      });

      logger.info('[ContinueDeployment] Assigned AI credits to customer', {
        customerId: customer.id,
        partnerId,
        creditsAdded: freeAiCredits
      });
    } else {
      logger.info('[ContinueDeployment] Customer already has AI credits enabled, skipping credit assignment', {
        customerId: customer.id,
        partnerId,
        existingCredits: customer.creditBalance
      });
    }

    // Re-check credits
    const hasSufficientTelephonyCredits = partner.telephonyCreditBalanceCents >= MIN_TELEPHONY_CREDITS_CENTS;
    const hasSufficientKnotieCredits = partner.creditBalance >= MIN_KNOTIE_CREDITS;

    if (!hasSufficientTelephonyCredits || !hasSufficientKnotieCredits) {
      logger.warn('[ContinueDeployment] Insufficient credits', {
        partnerId,
        telephonyCreditBalanceCents: partner.telephonyCreditBalanceCents,
        creditBalance: partner.creditBalance,
        minTelephonyCreditsCents: MIN_TELEPHONY_CREDITS_CENTS,
        minKnotieCredits: MIN_KNOTIE_CREDITS,
        hasSufficientTelephonyCredits,
        hasSufficientKnotieCredits
      });

      return NextResponse.json({
        error: 'Insufficient credits',
        details: {
          telephonyCreditBalanceCents: partner.telephonyCreditBalanceCents,
          creditBalance: partner.creditBalance,
          minTelephonyCreditsCents: MIN_TELEPHONY_CREDITS_CENTS,
          minKnotieCredits: MIN_KNOTIE_CREDITS,
          hasSufficientTelephonyCredits,
          hasSufficientKnotieCredits
        }
      }, { status: 400 });
    }

    // Queue auto-deploy job
    if (!KNOTIE_MANAGER_API_KEY) {
      logger.error('[ContinueDeployment] KNOTIE_MANAGER_API_KEY not configured');
      return NextResponse.json({ error: 'Auto-deploy service not configured' }, { status: 500 });
    }

    const response = await fetch(`${KNOTIE_MANAGER_URL}/api/auto-deploy/queue`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-internal-api-key': KNOTIE_MANAGER_API_KEY || '',
      },
      body: JSON.stringify({
        customerId: customer.id,
        partnerId: partnerId,
        prospectId: prospect?.id,
        customerEmail: customer.email,
        customerFirstName: customer.firstName || '',
        customerLastName: customer.lastName || '',
        customerPhone: prospect?.businessPhone || undefined,
        businessName: prospect?.businessName || customer.businessName || '',
        country: prospect?.businessCountry || undefined,
        requestedBy: 'manual_trigger'
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      logger.error('[ContinueDeployment] Failed to queue job', new Error(errorText));
      return NextResponse.json({ error: 'Failed to queue deployment' }, { status: 500 });
    }

    const data = await response.json();

    // Update customer deployment status
    await prisma.customer.update({
      where: { id: customer.id },
      data: { deploymentStatus: 'queued' }
    });

    logger.info('[ContinueDeployment] Deployment queued successfully', {
      partnerId,
      customerId: customer.id,
      userOnboardingId: customerId,
      jobId: data.jobId
    });

    return NextResponse.json({
      success: true,
      message: 'Deployment queued successfully',
      jobId: data.jobId
    });

  } catch (error) {
    logger.error('[ContinueDeployment] Error', error instanceof Error ? error : new Error('Unknown'));
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

