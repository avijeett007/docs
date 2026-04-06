import { NextRequest, NextResponse } from 'next/server';
import { verifyPartnerAuth } from '@/lib/auth/partnerAuth';
import { AiGatewayService, AiGatewayError } from '@/lib/services/aiGatewayService';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

/**
 * GET /api/partner/ai-gateway/keys
 * List all AI Gateway keys for the authenticated partner.
 * Query params: ?status=active&customerId=xxx
 */
export async function GET(request: NextRequest) {
  try {
    const partner = await verifyPartnerAuth(request);
    if (!partner) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') || undefined;
    const customerId = searchParams.get('customerId') || undefined;

    const keys = await AiGatewayService.listAiGatewayKeys(partner.id, {
      status,
      customerId,
    });

    return NextResponse.json({ keys });
  } catch (error) {
    logger.error('Error listing AI Gateway keys', error as Error, {
      operation: 'ai_gateway',
    });
    return NextResponse.json(
      { error: 'Failed to list AI Gateway keys' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/partner/ai-gateway/keys
 * Create a new AI Gateway key.
 * Body: { name, budgetUsd, allowedModels, description?, customerId?, profitMultiplier?, ... }
 */
export async function POST(request: NextRequest) {
  try {
    const partner = await verifyPartnerAuth(request);
    if (!partner) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();

    // Validate required fields
    if (!body.name || typeof body.name !== 'string') {
      return NextResponse.json({ error: 'name is required' }, { status: 400 });
    }
    if (!body.budgetUsd || typeof body.budgetUsd !== 'number' || body.budgetUsd <= 0) {
      return NextResponse.json({ error: 'budgetUsd must be a positive number' }, { status: 400 });
    }
    if (!body.allowedModels || !Array.isArray(body.allowedModels) || body.allowedModels.length === 0) {
      return NextResponse.json({ error: 'allowedModels must be a non-empty array' }, { status: 400 });
    }

    const result = await AiGatewayService.createAiGatewayKey({
      partnerId: partner.id,
      name: body.name,
      description: body.description,
      budgetUsd: body.budgetUsd,
      allowedModels: body.allowedModels,
      customerId: body.customerId,
      isCustomerKey: !!body.isCustomerKey || !!body.customerId,
      profitMultiplier: body.profitMultiplier,
      customerCreditPriceCents: body.customerCreditPriceCents,
      autoTopUpEnabled: body.autoTopUpEnabled,
      autoTopUpThresholdUsd: body.autoTopUpThresholdUsd,
      autoTopUpAmountUsd: body.autoTopUpAmountUsd,
      allowedDomains: body.allowedDomains,
      rateLimit: body.rateLimit,
      dailyLimit: body.dailyLimit,
      monthlyLimit: body.monthlyLimit,
      expiresAt: body.expiresAt ? new Date(body.expiresAt) : undefined,
    });

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    if (error instanceof AiGatewayError) {
      const statusMap: Record<string, number> = {
        PARTNER_NOT_FOUND: 404,
        GATEWAY_DISABLED: 403,
        MAX_KEYS_EXCEEDED: 429,
        BUDGET_CAP_EXCEEDED: 400,
        MODEL_NOT_AVAILABLE: 400,
        MODEL_TIER_RESTRICTED: 403,
        INSUFFICIENT_CREDITS: 402,
        CUSTOMER_NOT_FOUND: 404,
        CUSTOMER_AI_CREDIT_DISABLED: 402,
        CUSTOMER_INSUFFICIENT_AI_CREDITS: 402,
        LITELLM_ERROR: 502,
        CREDIT_RESERVE_FAILED: 500,
      };
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: statusMap[error.code] || 400 }
      );
    }

    logger.error('Error creating AI Gateway key', error as Error, {
      operation: 'ai_gateway',
    });
    return NextResponse.json(
      { error: 'Failed to create AI Gateway key' },
      { status: 500 }
    );
  }
}

