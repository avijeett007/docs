import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyPartnerToken } from '@/lib/auth';
import { getPartnerTier } from '@/lib/portalModes';
import { canConfigureExperience } from '@/lib/experiences/experienceAccess';
import { PricingTier, PricingConfig } from '@/types/experience';
import Stripe from 'stripe';

export const dynamic = 'force-dynamic';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2023-10-16',
});

/**
 * GET /api/partner/experiences/[id]/pricing
 * Get current pricing tiers for an experience
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const authResult = await verifyPartnerToken(request);
    if (!authResult.success || !authResult.partner) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = params;
    const experience = await prisma.partnerExperience.findUnique({
      where: { id },
    });

    if (!experience || experience.partnerId !== authResult.partner.id) {
      return NextResponse.json({ error: 'Experience not found' }, { status: 404 });
    }

    const pricingConfig = (experience.pricingConfig as PricingConfig) || {};

    return NextResponse.json({
      success: true,
      tiers: pricingConfig.tiers || [],
      pricingModel: pricingConfig.pricingModel || 'subscription',
    });
  } catch (error) {
    console.error('Error fetching pricing tiers:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * POST /api/partner/experiences/[id]/pricing
 * Create or update pricing tiers with Stripe product/price creation
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const authResult = await verifyPartnerToken(request);
    if (!authResult.success || !authResult.partner) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const partner = authResult.partner;
    const tier = getPartnerTier(partner.planId, partner.approvalStatus);
    const manualSaas = partner.manualSaasModeEnabled ?? false;

    const configAccess = canConfigureExperience(tier, manualSaas);
    if (!configAccess.allowed) {
      return NextResponse.json(
        { error: configAccess.reason, upgradeRequired: true },
        { status: 403 }
      );
    }

    const { id } = params;
    const experience = await prisma.partnerExperience.findUnique({
      where: { id },
    });

    if (!experience || experience.partnerId !== partner.id) {
      return NextResponse.json({ error: 'Experience not found' }, { status: 404 });
    }

    const body = await request.json();
    const { tiers } = body as { tiers: PricingTier[] };

    if (!tiers || !Array.isArray(tiers) || tiers.length === 0) {
      return NextResponse.json({ error: 'At least one pricing tier is required' }, { status: 400 });
    }

    // Validate each tier
    for (const t of tiers) {
      if (!t.name || !t.displayName || !t.description) {
        return NextResponse.json({ error: `Tier "${t.name || 'unknown'}" is missing required fields (name, displayName, description)` }, { status: 400 });
      }
      if (typeof t.price !== 'number' || t.price < 0) {
        return NextResponse.json({ error: `Tier "${t.displayName}" has an invalid price` }, { status: 400 });
      }
      if (!['month', 'year'].includes(t.interval)) {
        return NextResponse.json({ error: `Tier "${t.displayName}" has an invalid interval (must be month or year)` }, { status: 400 });
      }
      if (!Array.isArray(t.features)) {
        return NextResponse.json({ error: `Tier "${t.displayName}" must have a features array` }, { status: 400 });
      }
    }

    // Check Stripe Connect setup
    if (!partner.stripeAccountId) {
      return NextResponse.json({ error: 'Stripe Connect account not set up. Please complete Stripe onboarding first.' }, { status: 400 });
    }
    if (!partner.stripeOnboardingCompleted) {
      return NextResponse.json({ error: 'Stripe onboarding not completed. Please finish Stripe setup first.' }, { status: 400 });
    }
    if (!partner.stripeChargesEnabled) {
      return NextResponse.json({ error: 'Stripe charges not enabled. Please complete Stripe verification.' }, { status: 400 });
    }

    const stripeOptions = { stripeAccount: partner.stripeAccountId };
    const existingConfig = (experience.pricingConfig as PricingConfig) || {};
    const existingTiers = existingConfig.tiers || [];

    // Process each tier - create or update Stripe products/prices
    const processedTiers: PricingTier[] = [];

    for (const t of tiers) {
      const existingTier = existingTiers.find(et => et.name === t.name);
      let stripeProductId = existingTier?.stripeProductId;
      let stripePriceId = existingTier?.stripePriceId;

      const priceChanged = !existingTier || existingTier.price !== t.price || existingTier.interval !== t.interval || existingTier.currency !== t.currency;

      // Create or update Stripe product
      if (!stripeProductId) {
        const product = await stripe.products.create({
          name: `${partner.businessName} - ${experience.displayName} - ${t.displayName}`,
          description: t.description,
          metadata: {
            partnerId: partner.id,
            experienceId: experience.id,
            experienceType: experience.experienceType,
            tierName: t.name,
            knotieAiPro: 'true',
          },
        }, stripeOptions);
        stripeProductId = product.id;
      } else {
        // Update existing product metadata/name
        await stripe.products.update(stripeProductId, {
          name: `${partner.businessName} - ${experience.displayName} - ${t.displayName}`,
          description: t.description,
        }, stripeOptions);
      }

      // Create new price if price/interval/currency changed (Stripe prices are immutable)
      if (priceChanged && t.price > 0) {
        // Deactivate old price if it exists
        if (stripePriceId) {
          try {
            await stripe.prices.update(stripePriceId, { active: false }, stripeOptions);
          } catch (e) {
            console.warn(`Failed to deactivate old price ${stripePriceId}:`, e);
          }
        }

        const newPrice = await stripe.prices.create({
          product: stripeProductId,
          unit_amount: t.price,
          currency: t.currency || 'usd',
          recurring: {
            interval: t.interval as Stripe.PriceCreateParams.Recurring.Interval,
          },
          metadata: {
            partnerId: partner.id,
            experienceId: experience.id,
            tierName: t.name,
            knotieAiPro: 'true',
          },
        }, stripeOptions);
        stripePriceId = newPrice.id;
      }

      processedTiers.push({
        ...t,
        stripeProductId,
        stripePriceId,
      });
    }

    // Update experience pricingConfig
    const updatedPricingConfig: PricingConfig = {
      ...existingConfig,
      pricingModel: 'subscription',
      tiers: processedTiers,
    };

    await prisma.partnerExperience.update({
      where: { id },
      data: { pricingConfig: JSON.parse(JSON.stringify(updatedPricingConfig)) },
    });

    return NextResponse.json({
      success: true,
      tiers: processedTiers,
      message: 'Pricing tiers saved and Stripe products/prices created successfully',
    });
  } catch (error) {
    console.error('Error saving pricing tiers:', error);
    if (error instanceof Stripe.errors.StripeError) {
      return NextResponse.json(
        { error: `Stripe error: ${error.message}` },
        { status: 400 }
      );
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

