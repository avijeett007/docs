import { NextRequest, NextResponse } from 'next/server';
import { protectAdminRoute } from '@/lib/admin-route-protection';
import { AiGatewayService, AiGatewayError } from '@/lib/services/aiGatewayService';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/ai-gateway/config
 * Get the full AI Gateway admin configuration (unfiltered).
 */
export async function GET(request: NextRequest) {
  try {
    const authResult = await protectAdminRoute(request);
    if (authResult) return authResult;

    const config = await AiGatewayService.getAdminConfig();
    return NextResponse.json(config);
  } catch (error) {
    logger.error('Error getting AI Gateway admin config', error as Error, {
      operation: 'ai_gateway_admin',
    });
    return NextResponse.json(
      { error: 'Failed to get AI Gateway configuration' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/admin/ai-gateway/config
 * Update the AI Gateway admin configuration.
 * Body: Partial<AdminConfig>
 */
export async function PUT(request: NextRequest) {
  try {
    const authResult = await protectAdminRoute(request);
    if (authResult) return authResult;

    const body = await request.json();

    // Extract admin user email for audit trail
    const adminEmail = 'admin'; // protectAdminRoute validates but doesn't return user info directly

    const updatedConfig = await AiGatewayService.updateAdminConfig(body, adminEmail);
    return NextResponse.json(updatedConfig);
  } catch (error) {
    if (error instanceof AiGatewayError) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: 400 }
      );
    }

    logger.error('Error updating AI Gateway admin config', error as Error, {
      operation: 'ai_gateway_admin',
    });
    return NextResponse.json(
      { error: 'Failed to update AI Gateway configuration' },
      { status: 500 }
    );
  }
}

