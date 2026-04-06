import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { verifyPartnerToken } from '@/lib/auth';
import { getPartnerTier, PartnerTier } from '@/lib/portalModes';
import { ExperienceType, ExperienceStatus } from '@/types/experience';
import { EXPERIENCE_CONFIGS } from '@/lib/experiences/experienceTypes';
import { canCreateExperiences, canEnableExperience } from '@/lib/experiences/experienceAccess';

export const dynamic = 'force-dynamic';

/**
 * GET /api/partner/experiences
 * Returns the partner's experience catalog with enabled/disabled states
 */
export async function GET(request: NextRequest) {
  try {
    const authResult = await verifyPartnerToken(request);
    if (!authResult.success || !authResult.partner) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Re-fetch partner with experienceEntitlements (not always included in auth token)
    const partnerFull = await prisma.partner.findUnique({
      where: { id: authResult.partner.id },
      select: {
        id: true,
        planId: true,
        approvalStatus: true,
        manualSaasModeEnabled: true,
        portalMode: true,
        subdomain: true,
        customDomain: true,
        experienceEntitlements: true,
      },
    });

    const partner = partnerFull ?? authResult.partner;
    const tier = getPartnerTier(partner.planId, partner.approvalStatus);
    const manualSaas = (partner.manualSaasModeEnabled ?? false) as boolean;
    const entitlements = partner.experienceEntitlements ?? {};
    const isFreeForever = tier === PartnerTier.FREE_FOREVER;

    const createAccess = canCreateExperiences(tier, manualSaas, entitlements);

    // Fetch partner's enabled experiences
    const partnerExperiences = await prisma.partnerExperience.findMany({
      where: { partnerId: partner.id },
      orderBy: { createdAt: 'asc' },
    });

    // Build per-experience entitlement map for the client
    const entitlementsMap = (
      entitlements && typeof entitlements === 'object' && !Array.isArray(entitlements)
        ? entitlements
        : {}
    ) as Record<string, boolean>;

    return NextResponse.json({
      success: true,
      canView: true,
      canCreate: createAccess.allowed,
      isFreeForever,
      entitlements: entitlementsMap,
      partnerTier: tier,
      portalMode: (partner.portalMode as string) || 'BASIC',
      hasSaasMode: partner.portalMode === 'SAAS' || manualSaas,
      subdomain: (partner.subdomain as string) || null,
      customDomain: (partner.customDomain as string) || null,
      experiences: partnerExperiences.map((exp) => ({
        id: exp.id,
        experienceType: exp.experienceType,
        alias: exp.alias,
        displayName: exp.displayName,
        enabled: exp.enabled,
        isDefault: exp.isDefault,
        totalProspects: exp.totalProspects,
        totalCustomers: exp.totalCustomers,
        createdAt: exp.createdAt,
        landingPageConfig: exp.landingPageConfig || {},
      })),
    });
  } catch (error) {
    logger.error('Error fetching experiences', error instanceof Error ? error : undefined);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * POST /api/partner/experiences
 * Enable a new experience for the partner
 */
export async function POST(request: NextRequest) {
  try {
    const authResult = await verifyPartnerToken(request);
    if (!authResult.success || !authResult.partner) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Fetch partner with entitlements for authoritative access check
    const partnerFull = await prisma.partner.findUnique({
      where: { id: authResult.partner.id },
      select: {
        id: true,
        planId: true,
        approvalStatus: true,
        manualSaasModeEnabled: true,
        experienceEntitlements: true,
      },
    });

    if (!partnerFull) {
      return NextResponse.json({ error: 'Partner not found' }, { status: 404 });
    }

    const tier = getPartnerTier(partnerFull.planId, partnerFull.approvalStatus);
    const manualSaas = partnerFull.manualSaasModeEnabled ?? false;
    const entitlements = partnerFull.experienceEntitlements ?? {};

    const body = await request.json();
    const { experienceType, displayName, alias } = body;

    // Validate experience type before access check (to give 400 vs 403 in right order)
    if (!experienceType || !Object.values(ExperienceType).includes(experienceType)) {
      return NextResponse.json({ error: 'Invalid experience type' }, { status: 400 });
    }

    // Per-experience access check (respects entitlements for FREE_FOREVER)
    const enableAccess = canEnableExperience(tier, experienceType as ExperienceType, manualSaas, entitlements);
    if (!enableAccess.allowed) {
      return NextResponse.json(
        { error: enableAccess.reason, upgradeRequired: true },
        { status: 403 }
      );
    }

    const config = EXPERIENCE_CONFIGS[experienceType as ExperienceType];
    if (!config) {
      return NextResponse.json({ error: 'Unknown experience type' }, { status: 400 });
    }

    // Check if experience type is available
    if (config.status === ExperienceStatus.COMING_SOON) {
      return NextResponse.json(
        { error: `${config.name} is coming soon and cannot be enabled yet.` },
        { status: 400 }
      );
    }

    // Check if already exists
    const existing = await prisma.partnerExperience.findUnique({
      where: {
        partnerId_experienceType: {
          partnerId: partnerFull.id,
          experienceType,
        },
      },
    });

    if (existing) {
      return NextResponse.json(
        { error: 'This experience is already enabled for your account.' },
        { status: 409 }
      );
    }

    // Determine alias
    const finalAlias = alias || config.defaultAlias;
    const isDefault = finalAlias === null; // Root domain = default

    // Create the experience
    const experience = await prisma.partnerExperience.create({
      data: {
        partnerId: partnerFull.id,
        experienceType,
        alias: finalAlias,
        displayName: displayName || config.defaultDisplayName,
        description: config.shortDescription,
        enabled: true,
        isDefault,
      },
    });

    return NextResponse.json({
      success: true,
      experience: {
        id: experience.id,
        experienceType: experience.experienceType,
        alias: experience.alias,
        displayName: experience.displayName,
        enabled: experience.enabled,
      },
    });
  } catch (error) {
    logger.error('Error creating experience', error instanceof Error ? error : undefined);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

