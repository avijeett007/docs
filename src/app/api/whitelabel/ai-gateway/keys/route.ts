import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyCustomerJWT } from '@/lib/customerJwt';
import { prisma } from '@/lib/prisma';
import { AiGatewayService, AiGatewayError } from '@/lib/services/aiGatewayService';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

/**
 * GET /api/whitelabel/ai-gateway/keys
 * List AI Gateway keys belonging to the authenticated customer.
 */
export async function GET(_request: NextRequest) {
  try {
    const cookieStore = cookies();
    const token = cookieStore.get('customer_token')?.value;
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const payload = await verifyCustomerJWT(token);
    if (!payload) return NextResponse.json({ error: 'Invalid token' }, { status: 401 });

    const { customerId, partnerId } = payload;

    const keys = await AiGatewayService.listAiGatewayKeys(partnerId, { customerId });

    // Strip sensitive internal fields before returning to customer
    const safeKeys = keys.map(k => ({
      id: k.id,
      name: k.name,
      description: k.description,
      status: k.status,
      keyPrefix: k.keyPrefix,
      virtualKey: k.virtualKey, // only present on creation
      allowedModels: k.allowedModels,
      budgetCreditsReserved: k.budgetCreditsReserved,
      budgetCreditsUsed: k.budgetCreditsUsed,
      customerCreditPriceCents: k.customerCreditPriceCents,
      totalRequests: k.totalRequests,
      totalTokens: k.totalTokens,
      createdAt: k.createdAt,
      expiresAt: k.expiresAt,
      lastUsedAt: k.lastUsedAt,
    }));

    return NextResponse.json({ keys: safeKeys });
  } catch (error) {
    logger.error('Error listing whitelabel AI Gateway keys', error as Error, { operation: 'whitelabel_ai_gateway' });
    return NextResponse.json({ error: 'Failed to list keys' }, { status: 500 });
  }
}

/**
 * POST /api/whitelabel/ai-gateway/keys
 * Create a new AI Gateway key for the authenticated customer.
 * Budget is specified in AI Credits; models are specified by modelId.
 */
export async function POST(request: NextRequest) {
  try {
    const cookieStore = cookies();
    const token = cookieStore.get('customer_token')?.value;
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const payload = await verifyCustomerJWT(token);
    if (!payload) return NextResponse.json({ error: 'Invalid token' }, { status: 401 });

    const { customerId, partnerId } = payload;

    // Verify partner master gateway toggle is on
    const partner = await prisma.partner.findUnique({
      where: { id: partnerId },
      select: {
        customerGatewayEnabled: true,
        gatewayProfitMultiplier: true,
        gatewayCreditToUsdCents: true,
      },
    });

    if (!partner?.customerGatewayEnabled) {
      return NextResponse.json({ error: 'AI Gateway is not available' }, { status: 403 });
    }

    // Verify customer has AI Credits enabled
    const customer = await prisma.customer.findUnique({
      where: { id: customerId },
      select: { aiCreditsEnabled: true, creditBalance: true, email: true },
    });

    if (!customer?.aiCreditsEnabled) {
      return NextResponse.json({ error: 'AI Credits must be enabled' }, { status: 403 });
    }

    // Verify customer is individually authorized for the gateway
    const userOnboarding = await prisma.userOnboarding.findFirst({
      where: { email: customer.email, partnerId },
      select: { showAiGateway: true },
    });

    if (!userOnboarding?.showAiGateway) {
      return NextResponse.json({ error: 'AI Gateway is not enabled for your account' }, { status: 403 });
    }

    const body = await request.json();
    const { name, allowedModels, description } = body;

    if (!name || typeof name !== 'string') {
      return NextResponse.json({ error: 'name is required' }, { status: 400 });
    }
    if (!allowedModels || !Array.isArray(allowedModels) || allowedModels.length === 0) {
      return NextResponse.json({ error: 'allowedModels must be a non-empty array' }, { status: 400 });
    }

    const multiplier = partner.gatewayProfitMultiplier ?? 1.5;
    const creditToUsdCents = partner.gatewayCreditToUsdCents ?? 1.0;

    // Customer keys use pay-as-you-go: no budget input from customer.
    // We set a very high LiteLLM budget so it won't block the key on the LiteLLM side.
    // Credit deduction is managed by our spend webhook.
    // We reserve exactly 1000 Knotie credits from the partner as a deposit.
    const CUSTOMER_KEY_LITELLM_BUDGET_USD = 9999;

    const result = await AiGatewayService.createAiGatewayKey({
      partnerId,
      customerId,
      name,
      description,
      budgetUsd: CUSTOMER_KEY_LITELLM_BUDGET_USD,
      allowedModels,
      profitMultiplier: multiplier,
      customerCreditPriceCents: creditToUsdCents,
      isCustomerKey: true, // signal to reserve fixed 1000 credits from partner
    });

    return NextResponse.json({
      id: result.id,
      name: result.name,
      status: result.status,
      keyPrefix: result.keyPrefix,
      virtualKey: result.virtualKey,
      allowedModels: result.allowedModels,
      budgetCreditsReserved: result.budgetCreditsReserved,
      createdAt: result.createdAt,
    }, { status: 201 });
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
        LITELLM_ERROR: 502,
        CREDIT_RESERVE_FAILED: 500,
      };
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: statusMap[error.code] || 400 }
      );
    }
    logger.error('Error creating whitelabel AI Gateway key', error as Error, { operation: 'whitelabel_ai_gateway' });
    return NextResponse.json({ error: 'Failed to create key' }, { status: 500 });
  }
}

