import { NextRequest, NextResponse } from 'next/server';
import { verifyPartnerAuth } from '@/lib/auth/partnerAuth';
import { AiGatewayService, AiGatewayError } from '@/lib/services/aiGatewayService';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

/**
 * POST /api/partner/ai-gateway/keys/[keyId]/top-up
 * Add additional budget to an existing AI Gateway key.
 * Body: { amountUsd: number }
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { keyId: string } }
) {
  try {
    const partner = await verifyPartnerAuth(request);
    if (!partner) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();

    if (!body.amountUsd || typeof body.amountUsd !== 'number' || body.amountUsd <= 0) {
      return NextResponse.json(
        { error: 'amountUsd must be a positive number' },
        { status: 400 }
      );
    }

    const { keyId } = params;
    const result = await AiGatewayService.topUpAiGatewayKey({
      aiGatewayKeyId: keyId,
      partnerId: partner.id,
      additionalBudgetUsd: body.amountUsd,
    });

    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof AiGatewayError) {
      const statusMap: Record<string, number> = {
        KEY_NOT_FOUND: 404,
        INVALID_AMOUNT: 400,
        INSUFFICIENT_CREDITS: 402,
        BUDGET_CAP_EXCEEDED: 400,
        LITELLM_ERROR: 502,
        CREDIT_RESERVE_FAILED: 500,
        CREDIT_DEDUCT_FAILED: 500,
      };
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: statusMap[error.code] || 400 }
      );
    }

    logger.error('Error topping up AI Gateway key', error as Error, {
      operation: 'ai_gateway',
    });
    return NextResponse.json(
      { error: 'Failed to top up AI Gateway key' },
      { status: 500 }
    );
  }
}

