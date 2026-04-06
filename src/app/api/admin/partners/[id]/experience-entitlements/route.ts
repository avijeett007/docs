import { NextRequest, NextResponse } from 'next/server';
import { protectAdminRoute } from '@/lib/admin-route-protection';
import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { ExperienceType } from '@/types/experience';

export const dynamic = 'force-dynamic';

/**
 * PATCH /api/admin/partners/[id]/experience-entitlements
 * Toggle a single per-experience entitlement for a partner.
 *
 * Body: { experienceType: ExperienceType, enabled: boolean }
 *
 * The `experienceEntitlements` column is a JSONB map:
 *   { "OPENCLAW_SETUP_SERVICE": true, "AI_RECEPTIONIST": false, ... }
 * Keys that are absent or false mean "no entitlement".
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const authResult = await protectAdminRoute(request);
    if (authResult) return authResult;

    const partnerId = params.id;
    const body = await request.json();
    const { experienceType, enabled } = body;

    if (!experienceType || !Object.values(ExperienceType).includes(experienceType as ExperienceType)) {
      return NextResponse.json(
        { error: 'Invalid or missing experienceType' },
        { status: 400 }
      );
    }

    if (typeof enabled !== 'boolean') {
      return NextResponse.json(
        { error: 'enabled must be a boolean' },
        { status: 400 }
      );
    }

    // Fetch current entitlements
    const partner = await prisma.partner.findUnique({
      where: { id: partnerId },
      select: { id: true, businessName: true, experienceEntitlements: true },
    });

    if (!partner) {
      return NextResponse.json({ error: 'Partner not found' }, { status: 404 });
    }

    // Merge the new toggle into the existing JSONB map
    const current =
      partner.experienceEntitlements &&
      typeof partner.experienceEntitlements === 'object' &&
      !Array.isArray(partner.experienceEntitlements)
        ? (partner.experienceEntitlements as Record<string, boolean>)
        : {};

    const updated: Record<string, boolean> = {
      ...current,
      [experienceType as string]: enabled,
    };

    // Remove keys that are explicitly false to keep the object clean
    Object.keys(updated).forEach((k) => {
      if (!updated[k]) delete updated[k];
    });

    const updatedPartner = await prisma.partner.update({
      where: { id: partnerId },
      data: {
        experienceEntitlements: updated,
        updatedAt: new Date(),
      },
      select: {
        id: true,
        businessName: true,
        experienceEntitlements: true,
      },
    });

    logger.info(`Admin updated experience entitlement: ${experienceType} → ${enabled}`, {
      partnerId,
      businessName: partner.businessName,
      experienceType,
      enabled,
      entitlements: updated,
    });

    return NextResponse.json({
      success: true,
      partner: updatedPartner,
      message: `Entitlement for ${experienceType} ${enabled ? 'granted' : 'revoked'} for ${partner.businessName}`,
    });
  } catch (error) {
    logger.error('Error updating experience entitlements', error instanceof Error ? error : undefined);
    return NextResponse.json(
      { error: 'Failed to update experience entitlements' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/admin/partners/[id]/experience-entitlements
 * Returns the current entitlements map for a partner.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const authResult = await protectAdminRoute(request);
    if (authResult) return authResult;

    const partner = await prisma.partner.findUnique({
      where: { id: params.id },
      select: { id: true, businessName: true, experienceEntitlements: true },
    });

    if (!partner) {
      return NextResponse.json({ error: 'Partner not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, partner });
  } catch (error) {
    logger.error('Error fetching experience entitlements', error instanceof Error ? error : undefined);
    return NextResponse.json(
      { error: 'Failed to fetch experience entitlements' },
      { status: 500 }
    );
  }
}

