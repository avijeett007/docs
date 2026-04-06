import { NextRequest, NextResponse } from 'next/server';
import { verifyPartnerToken } from '@/lib/auth';
import { TierValidationService, AgentProvider } from '@/lib/services/tierValidationService';
import { logger } from '@/lib/logger';
import { obfuscateId } from '@/lib/pii-obfuscation';

// This route uses dynamic features, so it must be server-rendered
export const dynamic = 'force-dynamic';

// POST /api/partner/tier-validation - Validate tier limits for partner actions
export async function POST(req: NextRequest) {
  try {
    // Verify partner authentication
    const authResult = await verifyPartnerToken(req);
    if (!authResult.success || !authResult.partner) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const partnerId = authResult.partner.id;
    const body = await req.json();
    const { action, provider } = body;

    logger.debug('Tier validation request received', {
      operation: 'tier_validation_request',
      partnerId: obfuscateId(partnerId),
      action,
      provider: provider || 'none'
    });

    switch (action) {
      case 'validate_customer_creation':
        const customerValidation = await TierValidationService.validateCustomerCreation(partnerId);
        return NextResponse.json({
          success: true,
          validation: customerValidation
        });

      case 'validate_agent_creation':
        if (!provider) {
          return NextResponse.json(
            { success: false, error: 'Provider is required for agent validation' },
            { status: 400 }
          );
        }
        const agentValidation = await TierValidationService.validateAgentCreation(partnerId, provider as AgentProvider);
        return NextResponse.json({
          success: true,
          validation: agentValidation
        });

      case 'validate_saas_mode':
        const saasValidation = await TierValidationService.validateSaaSModeAccess(partnerId);
        return NextResponse.json({
          success: true,
          validation: saasValidation
        });

      case 'validate_phone_number_import':
        const phoneValidation = await TierValidationService.validatePhoneNumberImport(partnerId);
        return NextResponse.json({
          success: true,
          validation: phoneValidation
        });

      case 'validate_number_pool_creation':
        const numberPoolValidation = await TierValidationService.validateNumberPoolCreation(partnerId);
        return NextResponse.json({
          success: true,
          validation: numberPoolValidation
        });

      case 'get_tier_limits':
        const tierLimits = await TierValidationService.getPartnerTierLimits(partnerId);
        return NextResponse.json({
          success: true,
          limits: tierLimits
        });

      case 'generate_upgrade_prompt':
        const { feature } = body;
        if (!feature) {
          return NextResponse.json(
            { success: false, error: 'Feature is required for upgrade prompt' },
            { status: 400 }
          );
        }
        const upgradePrompt = await TierValidationService.generateUpgradePrompt(
          partnerId,
          feature,
          provider as AgentProvider
        );
        return NextResponse.json({
          success: true,
          prompt: upgradePrompt
        });

      default:
        return NextResponse.json(
          { success: false, error: 'Invalid action' },
          { status: 400 }
        );
    }

  } catch (error) {
    logger.error('Error in tier validation API', error as Error, {
      operation: 'tier_validation_api'
    });
    return NextResponse.json(
      { 
        success: false, 
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
