import { NextRequest, NextResponse } from 'next/server';
import { verifyPartnerAuth } from '@/lib/auth/partnerAuth';
import { AiGatewayService, AiGatewayError } from '@/lib/services/aiGatewayService';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

/**
 * GET /api/partner/ai-gateway/keys/[keyId]
 * Get a single AI Gateway key by ID.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { keyId: string } }
) {
  try {
    const partner = await verifyPartnerAuth(request);
    if (!partner) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { keyId } = params;
    const key = await AiGatewayService.getAiGatewayKey(keyId, partner.id);

    return NextResponse.json({ key });
  } catch (error) {
    if (error instanceof AiGatewayError && error.code === 'KEY_NOT_FOUND') {
      return NextResponse.json({ error: 'Key not found' }, { status: 404 });
    }

    logger.error('Error getting AI Gateway key', error as Error, {
      operation: 'ai_gateway',
    });
    return NextResponse.json(
      { error: 'Failed to get AI Gateway key' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/partner/ai-gateway/keys/[keyId]
 * Update an AI Gateway key's settings (name, models, auto-top-up, domains, limits).
 * Budget changes are NOT allowed — use the top-up endpoint instead.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { keyId: string } }
) {
  try {
    const partner = await verifyPartnerAuth(request);
    if (!partner) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { keyId } = params;

    const updatedKey = await AiGatewayService.updateAiGatewayKey({
      keyId,
      partnerId: partner.id,
      name: body.name,
      description: body.description,
      allowedModels: body.allowedModels,
      autoTopUpEnabled: body.autoTopUpEnabled,
      autoTopUpThresholdUsd: body.autoTopUpThresholdUsd,
      autoTopUpAmountUsd: body.autoTopUpAmountUsd,
      allowedDomains: body.allowedDomains,
      rateLimit: body.rateLimit,
      dailyLimit: body.dailyLimit,
      monthlyLimit: body.monthlyLimit,
      expiresAt: body.expiresAt ? new Date(body.expiresAt) : body.expiresAt,
    });

    return NextResponse.json({ key: updatedKey });
  } catch (error) {
    if (error instanceof AiGatewayError) {
      const statusMap: Record<string, number> = {
        KEY_NOT_FOUND: 404,
        MODEL_NOT_AVAILABLE: 400,
        MODEL_TIER_RESTRICTED: 403,
        LITELLM_ERROR: 502,
      };
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: statusMap[error.code] || 400 }
      );
    }

    logger.error('Error updating AI Gateway key', error as Error, {
      operation: 'ai_gateway',
    });
    return NextResponse.json(
      { error: 'Failed to update AI Gateway key' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/partner/ai-gateway/keys/[keyId]
 * Revoke an AI Gateway key and refund unspent budget.
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { keyId: string } }
) {
  try {
    const partner = await verifyPartnerAuth(request);
    if (!partner) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { keyId } = params;
    await AiGatewayService.revokeAiGatewayKey(keyId, partner.id);

    return NextResponse.json({ message: 'Key revoked and unspent budget refunded' });
  } catch (error) {
    if (error instanceof AiGatewayError) {
      const statusMap: Record<string, number> = {
        KEY_NOT_FOUND: 404,
        LITELLM_ERROR: 502,
      };
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: statusMap[error.code] || 400 }
      );
    }

    logger.error('Error revoking AI Gateway key', error as Error, {
      operation: 'ai_gateway',
    });
    return NextResponse.json(
      { error: 'Failed to revoke AI Gateway key' },
      { status: 500 }
    );
  }
}

