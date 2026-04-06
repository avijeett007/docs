import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

const gateCheckSchema = z.object({
  agentId: z.string().min(1, 'Agent ID is required'),
  provider: z.string().min(1, 'Provider is required'),
  partnerId: z.string().optional(),
  customerId: z.string().optional(),
});

/**
 * POST /api/internal/analytics-gate-check
 * 3-tier enablement check: Partner → Customer → Agent + credit check
 * Called by the Python analytics service before running AI analysis.
 * Fail-closed: returns enabled=false on any error.
 */
export async function POST(request: NextRequest) {
  try {
    // Verify internal API key
    const authHeader = request.headers.get('authorization');
    const expectedAuth = `Bearer ${process.env.INTERNAL_API_KEY}`;

    if (!authHeader || authHeader !== expectedAuth) {
      return NextResponse.json(
        { enabled: false, reason: 'Unauthorized', partnerCredits: 0 },
        { status: 401 }
      );
    }

    const body = await request.json();
    const data = gateCheckSchema.parse(body);

    // If partnerId not provided, we can't do the check
    if (!data.partnerId) {
      return NextResponse.json({
        enabled: false,
        partnerCredits: 0,
        reason: 'partnerId is required for gate check',
        details: { partnerEnabled: false, customerEnabled: false, agentEnabled: null },
      });
    }

    // --- Tier 1: Partner-level check ---
    const partner = await prisma.partner.findUnique({
      where: { id: data.partnerId },
      select: {
        enableAiAnalytics: true,
        creditBalance: true,
        fractionalCredits: true,
      },
    });

    if (!partner) {
      return NextResponse.json({
        enabled: false,
        partnerCredits: 0,
        reason: 'partner not found',
        details: { partnerEnabled: false, customerEnabled: false, agentEnabled: null },
      });
    }

    if (!partner.enableAiAnalytics) {
      return NextResponse.json({
        enabled: false,
        partnerCredits: partner.creditBalance,
        reason: 'partner AI analytics disabled',
        details: { partnerEnabled: false, customerEnabled: false, agentEnabled: null },
      });
    }

    // --- Tier 2: Customer-level check ---
    let customerEnabled = true; // Default: enabled if no customer context
    if (data.customerId) {
      const userOnboarding = await prisma.userOnboarding.findFirst({
        where: {
          customerId: data.customerId,
          partnerId: data.partnerId,
        },
        select: { enableAdvancedAnalytics: true },
      });

      if (userOnboarding && !userOnboarding.enableAdvancedAnalytics) {
        return NextResponse.json({
          enabled: false,
          partnerCredits: partner.creditBalance,
          reason: 'customer advanced analytics disabled',
          details: { partnerEnabled: true, customerEnabled: false, agentEnabled: null },
        });
      }

      // If userOnboarding not found, default to enabled (don't block)
      if (userOnboarding) {
        customerEnabled = userOnboarding.enableAdvancedAnalytics;
      }
    }

    // --- Tier 3: Agent-level check is done in the analytics DB by the Python service ---
    // The Python service checks agents.ai_analytics_enabled locally.
    // We only handle Partner + Customer tiers here.

    // --- Credit check ---
    const combinedBalance = partner.creditBalance - ((partner.fractionalCredits || 0) / 100);
    if (combinedBalance < -100) {
      return NextResponse.json({
        enabled: false,
        partnerCredits: combinedBalance,
        reason: 'insufficient credits',
        details: { partnerEnabled: true, customerEnabled, agentEnabled: null },
      });
    }

    // All checks passed
    return NextResponse.json({
      enabled: true,
      partnerCredits: combinedBalance,
      reason: 'all tiers enabled',
      details: { partnerEnabled: true, customerEnabled, agentEnabled: null },
    });

  } catch (error) {
    console.error('Error in analytics gate check:', error);

    if (error instanceof z.ZodError) {
      return NextResponse.json({
        enabled: false,
        partnerCredits: 0,
        reason: 'validation error',
        details: { errors: error.errors },
      }, { status: 400 });
    }

    // Fail-closed: on any unexpected error, disable analytics
    return NextResponse.json({
      enabled: false,
      partnerCredits: 0,
      reason: 'internal error - fail closed',
    }, { status: 500 });
  }
}

