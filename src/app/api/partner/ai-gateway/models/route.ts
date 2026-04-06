import { NextRequest, NextResponse } from 'next/server';
import { verifyPartnerAuth } from '@/lib/auth/partnerAuth';
import { AiGatewayService } from '@/lib/services/aiGatewayService';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

/**
 * GET /api/partner/ai-gateway/models
 * Returns the list of supported models filtered by the partner's plan tier.
 */
export async function GET(request: NextRequest) {
  try {
    const partner = await verifyPartnerAuth(request);
    if (!partner) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const config = await AiGatewayService.getAdminConfig();

    if (!config.gatewayEnabled) {
      return NextResponse.json({ error: 'AI Gateway is currently disabled' }, { status: 403 });
    }

    // Filter models by partner's tier access
    const partnerTierKey = ['free_forever', 'free', null].includes(partner.planId)
      ? 'free_forever'
      : (partner.planId || 'free_forever');

    const availableModels = config.supportedModels
      .filter(m => m.enabled && m.tierAccess.includes(partnerTierKey))
      .map(m => ({
        modelId: m.modelId,
        displayName: m.displayName,
        provider: m.provider,
        category: m.category,
        inputCostPer1MTokens: m.inputCostPer1MTokens,
        outputCostPer1MTokens: m.outputCostPer1MTokens,
      }));

    return NextResponse.json({ models: availableModels });
  } catch (error) {
    logger.error('Error fetching AI Gateway models', error as Error, {
      operation: 'ai_gateway',
    });
    return NextResponse.json(
      { error: 'Failed to fetch models' },
      { status: 500 }
    );
  }
}

