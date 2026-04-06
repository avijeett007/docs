import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyPartnerToken } from '@/lib/auth';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

// Get Stripe price IDs from environment for tier calculation
const ENTERPRISE_MONTHLY_PRICE_ID = process.env.STRIPE_ENTERPRISE_MONTHLY_PRICE_ID;
const ENTERPRISE_YEARLY_PRICE_ID = process.env.STRIPE_ENTERPRISE_YEARLY_PRICE_ID;
const STARTER_MONTHLY_PRICE_ID = process.env.STRIPE_STARTER_MONTHLY_PRICE_ID;
const STARTER_YEARLY_PRICE_ID = process.env.STRIPE_STARTER_YEARLY_PRICE_ID;
const PRO_MONTHLY_PRICE_ID = process.env.STRIPE_PRO_MONTHLY_PRICE_ID;
const PRO_YEARLY_PRICE_ID = process.env.STRIPE_PRO_YEARLY_PRICE_ID;
const LIFETIME_PRO_PRICE_ID = process.env.STRIPE_LIFETIME_PRO_PRICE_ID;
const FREE_FOREVER_PRICE_ID = process.env.STRIPE_FREE_FOREVER_PRICE_ID;

/**
 * Calculate partner tier from planId and billing interval
 */
function calculatePartnerTier(partner: { planId: string | null; billingInterval: string | null; approvalStatus: string; subscriptionStatus: string | null }): string {
  // Check approval status first - must be ACTIVE for paid tiers
  if (partner.approvalStatus !== 'ACTIVE') {
    return 'free_forever';
  }

  if (partner.planId === 'enterprise' ||
      (ENTERPRISE_MONTHLY_PRICE_ID && partner.planId === ENTERPRISE_MONTHLY_PRICE_ID) ||
      (ENTERPRISE_YEARLY_PRICE_ID && partner.planId === ENTERPRISE_YEARLY_PRICE_ID)) {
    return 'enterprise';
  }

  if (partner.planId === 'starter' ||
      (STARTER_MONTHLY_PRICE_ID && partner.planId === STARTER_MONTHLY_PRICE_ID) ||
      (STARTER_YEARLY_PRICE_ID && partner.planId === STARTER_YEARLY_PRICE_ID)) {
    return 'starter';
  }

  if (partner.planId === 'lifetime' ||
      (partner.planId === 'pro' && partner.billingInterval === 'lifetime') ||
      (LIFETIME_PRO_PRICE_ID && partner.planId === LIFETIME_PRO_PRICE_ID)) {
    return 'lifetime_pro';
  }

  if (partner.planId === 'pro' ||
      (PRO_MONTHLY_PRICE_ID && partner.planId === PRO_MONTHLY_PRICE_ID) ||
      (PRO_YEARLY_PRICE_ID && partner.planId === PRO_YEARLY_PRICE_ID)) {
    return 'pro';
  }

  if (partner.planId === 'free_forever_trial' || partner.planId === 'free_forever' ||
      (FREE_FOREVER_PRICE_ID && partner.planId === FREE_FOREVER_PRICE_ID)) {
    return 'free_forever';
  }

  if (!partner.planId && partner.subscriptionStatus === 'INACTIVE') {
    return 'free_forever';
  }

  return 'unknown';
}

export async function GET(request: NextRequest) {
  try {
    // Verify partner authentication
    const authResult = await verifyPartnerToken(request);
    if (!authResult.success || !authResult.partner) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const partnerId = authResult.partner.id;

    // Get full partner details including tier and SaaS mode info in a single query
    const partner = await prisma.partner.findUnique({
      where: { id: partnerId },
      select: {
        id: true,
        planId: true,
        billingInterval: true,
        approvalStatus: true,
        subscriptionStatus: true,
        manualSaasModeEnabled: true,
      }
    });

    if (!partner) {
      return NextResponse.json(
        { error: 'Partner not found' },
        { status: 404 }
      );
    }

    // Calculate tier server-side
    const tier = calculatePartnerTier(partner);

    // Check SaaS access: enterprise tier OR manualSaasModeEnabled (set by admin in mission control)
    const hasSaasAccess = tier === 'enterprise' || partner.manualSaasModeEnabled;

    // If no access, return early with access info (no need to query prospects)
    if (!hasSaasAccess) {
      return NextResponse.json({
        success: true,
        hasAccess: false,
        tier: tier,
        hasSaasAccess: false,
        prospects: []
      });
    }

    // Fetch prospects for the partner (only if they have access)
    const prospects = await prisma.prospect.findMany({
      where: {
        partnerId: partnerId
      },
      orderBy: {
        createdAt: 'desc'
      },
      select: {
        id: true,
        businessName: true,
        businessWebsite: true,
        hasNoWebsite: true,
        firstName: true,
        lastName: true,
        email: true,
        phone: true,
        currentStep: true,
        isCompleted: true,
        convertedToCustomerId: true,
        experienceType: true,
        createdAt: true,
        updatedAt: true
      }
    });

    return NextResponse.json({
      success: true,
      hasAccess: true,
      tier: tier,
      hasSaasAccess: true,
      prospects: prospects
    });

  } catch (error) {
    logger.error('Error fetching prospects', error instanceof Error ? error : new Error(String(error)), { operation: 'list_prospects' });
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
