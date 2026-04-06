import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyCustomerJWT } from '@/lib/customerJwt';
import { prisma } from '@/lib/prisma';
import { AiGatewayService } from '@/lib/services/aiGatewayService';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

/**
 * GET /api/whitelabel/ai-gateway/models
 * Returns available AI models with customer-facing credit costs.
 * Provider names and raw USD costs are abstracted away.
 */
export async function GET(_request: NextRequest) {
  try {
    const cookieStore = cookies();
    const token = cookieStore.get('customer_token')?.value;
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const payload = await verifyCustomerJWT(token);
    if (!payload) return NextResponse.json({ error: 'Invalid token' }, { status: 401 });

    const { customerId, partnerId } = payload;

    // Fetch partner gateway settings (only master toggle needed)
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

    // Check customer has AI Credits enabled
    const customer = await prisma.customer.findUnique({
      where: { id: customerId },
      select: { aiCreditsEnabled: true, email: true },
    });

    if (!customer?.aiCreditsEnabled) {
      return NextResponse.json({ error: 'AI Credits must be enabled to use the gateway' }, { status: 403 });
    }

    // Check customer is individually authorized (showAiGateway flag).
    // This covers both auto-enabled new customers and manually enabled existing customers.
    // customerGatewayForExistingCustomers is a self-service enrollment flag, not an authorization gate.
    const userOnboarding = await prisma.userOnboarding.findFirst({
      where: { email: customer.email, partnerId },
      select: { showAiGateway: true },
    });

    if (!userOnboarding?.showAiGateway) {
      return NextResponse.json({ error: 'AI Gateway is not enabled for your account' }, { status: 403 });
    }

    const config = await AiGatewayService.getAdminConfig();
    if (!config.gatewayEnabled) {
      return NextResponse.json({ error: 'AI Gateway is currently unavailable' }, { status: 503 });
    }

    const multiplier = partner.gatewayProfitMultiplier ?? 1.5;
    const creditToUsdCents = partner.gatewayCreditToUsdCents ?? 1.0;
    // 1 credit = creditToUsdCents cents = creditToUsdCents/100 USD
    const creditToUsd = creditToUsdCents / 100;

    // Return models with credit costs — no provider, no raw USD
    const models = config.supportedModels
      .filter(m => m.enabled)
      .map(m => ({
        modelId: m.modelId,
        displayName: m.displayName,
        category: m.category,
        // Credits per 1M tokens = (rawCost * multiplier) / creditToUsd
        inputCreditsPerM: creditToUsd > 0
          ? Math.ceil((m.inputCostPer1MTokens * multiplier) / creditToUsd)
          : 0,
        outputCreditsPerM: creditToUsd > 0
          ? Math.ceil((m.outputCostPer1MTokens * multiplier) / creditToUsd)
          : 0,
      }));

    return NextResponse.json({ models, creditToUsdCents });
  } catch (error) {
    logger.error('Error fetching whitelabel AI Gateway models', error as Error, {
      operation: 'whitelabel_ai_gateway',
    });
    return NextResponse.json({ error: 'Failed to fetch models' }, { status: 500 });
  }
}

