import { NextRequest, NextResponse } from 'next/server';
import { verifyPartnerAuth } from '@/lib/auth/partnerAuth';
import { AiGatewayService } from '@/lib/services/aiGatewayService';
import { getPartnerTier, PartnerTier } from '@/lib/portalModes';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

/**
 * GET /api/partner/ai-gateway/config
 * Get the AI Gateway configuration including available models for the partner's tier.
 * Returns the admin config with model registry filtered by the partner's subscription tier.
 */
export async function GET(request: NextRequest) {
  try {
    const partner = await verifyPartnerAuth(request);
    if (!partner) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const config = await AiGatewayService.getAdminConfig();

    // Use the project-wide getPartnerTier() to resolve planId (including Stripe price IDs) to a tier
    const tierEnum = getPartnerTier(
      (partner as any).planId,
      (partner as any).approvalStatus
    );
    const tierKey = tierEnum as string; // e.g. 'free_forever', 'starter', 'pro', 'enterprise', 'lifetime'
    const isFreeTier = tierEnum === PartnerTier.FREE_FOREVER;

    const availableModels = (config.supportedModels || []).filter((model: any) => {
      if (!model.enabled) return false;
      // No tier restrictions = available to all
      if (!model.tierAccess || model.tierAccess.length === 0) return true;
      // Check if partner's resolved tier is in the model's tierAccess list
      return model.tierAccess.includes(tierKey);
    });

    return NextResponse.json({
      enabled: config.gatewayEnabled,
      models: availableModels,
      maxKeysPerPartner: config.maxKeysPerPartner,
      maxBudgetCapUsd: config.maxBudgetCapUsd,
      adminFeePercent: isFreeTier ? config.freeTierAdminFeePercent : 0,
      partnerTier: tierKey,
    });
  } catch (error) {
    logger.error('Error getting AI Gateway config', error as Error, {
      operation: 'ai_gateway',
    });
    return NextResponse.json(
      { error: 'Failed to get AI Gateway configuration' },
      { status: 500 }
    );
  }
}

