import { NextRequest, NextResponse } from 'next/server';
import { protectAdminRoute } from '@/lib/admin-route-protection';
import { getLiteLLMClient } from '@/lib/litellm';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/ai-gateway/litellm-models
 * Proxies LiteLLM's /model/info endpoint to list all onboarded models
 * with their pricing data. Master key stays server-side.
 */
export async function GET(request: NextRequest) {
  try {
    const authResult = await protectAdminRoute(request);
    if (authResult) return authResult;

    const client = getLiteLLMClient();
    const models = await client.listModels();

    // Deduplicate by model_name (same model may have primary + fallback entries)
    // Keep the one with the most pricing info
    const modelMap = new Map<string, {
      modelName: string;
      provider: string;
      mode: string;
      inputCostPer1MTokens: number | null;
      outputCostPer1MTokens: number | null;
      maxInputTokens: number | null;
      maxOutputTokens: number | null;
      supportsVision: boolean;
      supportsFunctionCalling: boolean;
    }>();

    for (const m of models) {
      const name = m.model_name;
      const info = m.model_info || {};
      const provider = info.litellm_provider || m.litellm_params?.model?.split('/')[0] || 'unknown';
      const mode = info.mode || 'chat';
      const inputCost = typeof info.input_cost_per_token === 'number'
        ? parseFloat((info.input_cost_per_token * 1_000_000).toFixed(4))
        : null;
      const outputCost = typeof info.output_cost_per_token === 'number'
        ? parseFloat((info.output_cost_per_token * 1_000_000).toFixed(4))
        : null;

      const existing = modelMap.get(name);

      // Prefer entries that have pricing info, or the first entry
      if (!existing || (inputCost !== null && existing.inputCostPer1MTokens === null)) {
        modelMap.set(name, {
          modelName: name,
          provider,
          mode,
          inputCostPer1MTokens: inputCost,
          outputCostPer1MTokens: outputCost,
          maxInputTokens: info.max_input_tokens ?? null,
          maxOutputTokens: info.max_output_tokens ?? null,
          supportsVision: !!info.supports_vision,
          supportsFunctionCalling: !!info.supports_function_calling,
        });
      }
    }

    const dedupedModels = Array.from(modelMap.values()).sort((a, b) =>
      a.modelName.localeCompare(b.modelName)
    );

    return NextResponse.json({
      models: dedupedModels,
      totalRaw: models.length,
      totalDeduped: dedupedModels.length,
    });
  } catch (error) {
    logger.error('Error fetching LiteLLM models', error as Error, {
      operation: 'ai_gateway_admin',
    });

    const message = error instanceof Error ? error.message : 'Failed to fetch LiteLLM models';
    const isConfigError = message.includes('LITELLM_PROXY_URL') || message.includes('LITELLM_MASTER_KEY');

    return NextResponse.json(
      { error: isConfigError ? 'LiteLLM is not configured. Set LITELLM_PROXY_URL and LITELLM_MASTER_KEY.' : message },
      { status: isConfigError ? 503 : 500 }
    );
  }
}

