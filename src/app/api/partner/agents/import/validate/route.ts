import { NextRequest, NextResponse } from 'next/server';
import { verifyPartnerToken } from '@/lib/auth';
import { TierValidationService, AgentProvider } from '@/lib/services/tierValidationService';

// This route uses dynamic features, so it must be server-rendered
export const dynamic = 'force-dynamic';

// POST /api/partner/agents/import/validate - Validate agent import against tier limits
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
    const { provider, agentCount = 1 } = body;

    if (!provider) {
      return NextResponse.json(
        { success: false, error: 'Provider is required' },
        { status: 400 }
      );
    }

    console.log('🔍 Validating agent import:', { partnerId, provider, agentCount });

    // Get current validation status
    const validation = await TierValidationService.validateAgentCreation(partnerId, provider as AgentProvider);
    
    // Check if partner can import the requested number of agents
    const canImport = validation.allowed && (validation.remaining === null || validation.remaining >= agentCount);

    if (!canImport) {
      // Generate upgrade prompt if limit exceeded
      const upgradePrompt = await TierValidationService.generateUpgradePrompt(
        partnerId,
        'agents',
        provider as AgentProvider
      );

      return NextResponse.json({
        success: false,
        allowed: false,
        validation,
        upgradePrompt,
        message: validation.limit === null 
          ? 'No agent limit configured'
          : `Cannot import ${agentCount} agent(s). You have ${validation.remaining} remaining out of ${validation.limit} allowed.`
      });
    }

    return NextResponse.json({
      success: true,
      allowed: true,
      validation,
      message: `Can import ${agentCount} agent(s). ${validation.remaining === null ? 'No limit' : `${validation.remaining} remaining`}.`
    });

  } catch (error) {
    console.error('❌ Error validating agent import:', error);
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
