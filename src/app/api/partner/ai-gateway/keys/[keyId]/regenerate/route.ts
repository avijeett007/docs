import { NextRequest, NextResponse } from 'next/server';
import { verifyPartnerAuth } from '@/lib/auth/partnerAuth';
import { AiGatewayService, AiGatewayError } from '@/lib/services/aiGatewayService';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

/**
 * POST /api/partner/ai-gateway/keys/[keyId]/regenerate
 * Regenerate (rotate) the virtual key while keeping the same configuration.
 * The new key is returned once and must be saved by the client.
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

    const { keyId } = params;
    const result = await AiGatewayService.regenerateAiGatewayKey(keyId, partner.id);

    return NextResponse.json(result);
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

    logger.error('Error regenerating AI Gateway key', error as Error, {
      operation: 'ai_gateway',
    });
    return NextResponse.json(
      { error: 'Failed to regenerate AI Gateway key' },
      { status: 500 }
    );
  }
}

