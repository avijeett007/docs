import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyPartnerToken } from '@/lib/auth';
import { getPartnerTier } from '@/lib/portalModes';
import { canConfigureExperience } from '@/lib/experiences/experienceAccess';
import { isValidAlias } from '@/lib/experiences/experienceTypes';

export const dynamic = 'force-dynamic';

/**
 * GET /api/partner/experiences/[id]
 * Get a single experience with full configuration
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

    return NextResponse.json({
      success: true,
      experience,
    });
  } catch (error) {
    console.error('Error fetching experience:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * PATCH /api/partner/experiences/[id]
 * Update an experience (toggle enabled, change config, etc.)
 */
export async function PATCH(
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
    const existing = await prisma.partnerExperience.findUnique({
      where: { id },
    });

    if (!existing || existing.partnerId !== partner.id) {
      return NextResponse.json({ error: 'Experience not found' }, { status: 404 });
    }

    const body = await request.json();
    const updateData: Record<string, unknown> = {};

    // Toggle enabled
    if (typeof body.enabled === 'boolean') {
      updateData.enabled = body.enabled;
    }

    // Update display name
    if (body.displayName && typeof body.displayName === 'string') {
      updateData.displayName = body.displayName.trim();
    }

    // Update alias (with validation)
    if (body.alias !== undefined) {
      if (body.alias === null) {
        // Setting to root domain
        updateData.alias = null;
        updateData.isDefault = true;
      } else if (typeof body.alias === 'string' && isValidAlias(body.alias)) {
        updateData.alias = body.alias.startsWith('/') ? body.alias : `/${body.alias}`;
        updateData.isDefault = false;
      } else {
        return NextResponse.json({ error: 'Invalid alias format' }, { status: 400 });
      }
    }

    // Update JSON configs (merge with existing)
    if (body.landingPageConfig && typeof body.landingPageConfig === 'object') {
      const existingConfig = (existing.landingPageConfig as Record<string, unknown>) || {};
      updateData.landingPageConfig = { ...existingConfig, ...body.landingPageConfig };
    }

    if (body.onboardingConfig && typeof body.onboardingConfig === 'object') {
      const existingConfig = (existing.onboardingConfig as Record<string, unknown>) || {};
      updateData.onboardingConfig = { ...existingConfig, ...body.onboardingConfig };
    }

    if (body.pricingConfig && typeof body.pricingConfig === 'object') {
      const existingConfig = (existing.pricingConfig as Record<string, unknown>) || {};
      updateData.pricingConfig = { ...existingConfig, ...body.pricingConfig };
    }

    if (body.deploymentConfig && typeof body.deploymentConfig === 'object') {
      const existingConfig = (existing.deploymentConfig as Record<string, unknown>) || {};
      updateData.deploymentConfig = { ...existingConfig, ...body.deploymentConfig };
    }

    const updated = await prisma.partnerExperience.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json({
      success: true,
      experience: {
        id: updated.id,
        experienceType: updated.experienceType,
        alias: updated.alias,
        displayName: updated.displayName,
        enabled: updated.enabled,
        isDefault: updated.isDefault,
      },
    });
  } catch (error) {
    console.error('Error updating experience:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

