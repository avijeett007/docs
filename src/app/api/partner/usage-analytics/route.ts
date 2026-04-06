import { NextRequest, NextResponse } from 'next/server';
import { verifyPartnerAuth } from '@/lib/auth/partnerAuth';
import { UsageTrackingService } from '@/lib/services/usageTrackingService';
import { CreditService } from '@/lib/services/creditService';

export const dynamic = 'force-dynamic';

/**
 * GET /api/partner/usage-analytics
 * Get usage analytics for the authenticated partner
 */
export async function GET(request: NextRequest) {
  try {
    // Verify partner authentication
    const partner = await verifyPartnerAuth(request);
    if (!partner) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const provider = searchParams.get('provider');

    // Parse dates
    const start = startDate ? new Date(startDate) : undefined;
    const end = endDate ? new Date(endDate) : undefined;

    // Get usage analytics
    const analytics = await UsageTrackingService.getPartnerUsageAnalytics(
      partner.id,
      start,
      end,
      provider || undefined
    );

    // Get current credit balance
    const creditBalance = await CreditService.getPartnerCreditBalance(partner.id);

    // Calculate efficiency metrics
    const efficiencyMetrics = calculateEfficiencyMetrics(analytics);

    return NextResponse.json({
      success: true,
      data: {
        ...analytics,
        currentBalance: creditBalance?.currentBalance || 0,
        efficiency: efficiencyMetrics,
        period: {
          startDate: start?.toISOString(),
          endDate: end?.toISOString(),
          provider
        }
      }
    });

  } catch (error) {
    console.error('Error fetching usage analytics:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      },
      { status: 500 }
    );
  }
}

function calculateEfficiencyMetrics(analytics: any) {
  const {
    totalCreditsUsed,
    totalCalls,
    totalDuration,
    averageCallDuration
  } = analytics;

  // Calculate cost per minute
  const costPerMinute = totalDuration > 0
    ? (totalCreditsUsed / (totalDuration / 60))
    : 0;

  // Calculate cost per call
  const costPerCall = totalCalls > 0
    ? (totalCreditsUsed / totalCalls)
    : 0;

  // Calculate efficiency score (lower is better)
  // Based on average call duration vs credits used
  const efficiencyScore = averageCallDuration > 0 
    ? Math.round((totalCreditsUsed / totalCalls) / (averageCallDuration / 60) * 100) / 100
    : 0;

  // Determine efficiency rating
  let efficiencyRating = 'excellent';
  if (efficiencyScore > 2) efficiencyRating = 'poor';
  else if (efficiencyScore > 1.5) efficiencyRating = 'fair';
  else if (efficiencyScore > 1) efficiencyRating = 'good';

  return {
    costPerMinute: Math.round(costPerMinute * 100) / 100,
    costPerCall: Math.round(costPerCall * 100) / 100,
    efficiencyScore,
    efficiencyRating,
    averageCallDurationMinutes: Math.round(averageCallDuration / 60 * 100) / 100
  };
}
