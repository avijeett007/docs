import { NextRequest, NextResponse } from 'next/server';
import { CreditService } from '@/lib/services/creditService';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

const analyticsDeductionSchema = z.object({
  partnerId: z.string().min(1, 'Partner ID is required'),
  customerId: z.string().optional(),
  agentId: z.string().min(1, 'Agent ID is required'),
  provider: z.string().min(1, 'Provider is required'),
  callId: z.string().min(1, 'Call ID is required'),
  analysisType: z.enum(['transcript_analysis', 'metrics_detection', 'unified']),
  inputTokens: z.number().optional(),
  outputTokens: z.number().optional(),
});

/**
 * POST /api/internal/analytics-credit-deduction
 * Deduct partner credits for AI analytics processing.
 * Called by the Python analytics service after successful AI analysis.
 * Uses idempotency: call_id + analysisType to prevent double-charging.
 */
export async function POST(request: NextRequest) {
  try {
    // Verify internal API key
    const authHeader = request.headers.get('authorization');
    const expectedAuth = `Bearer ${process.env.INTERNAL_API_KEY}`;

    if (!authHeader || authHeader !== expectedAuth) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const data = analyticsDeductionSchema.parse(body);

    // Calculate credits: use the existing analytics rate
    // analytics: { baseRate: 0.1, minimumCharge: 1 } → max(0.1 * 1, 1) = 1 credit per analysis
    const creditsToDeduct = CreditService.calculateCreditsForUsage('analytics');

    // Deduct credits using the existing CreditService
    const result = await CreditService.deductCredits(
      data.partnerId,
      creditsToDeduct,
      'analytics',
      data.customerId,
      data.agentId,
      data.callId, // sessionId for tracking
      undefined,   // durationSeconds not applicable
      {
        analysisType: data.analysisType,
        provider: data.provider,
      },
      {
        analysisType: data.analysisType,
        inputTokens: data.inputTokens,
        outputTokens: data.outputTokens,
        provider: data.provider,
        callId: data.callId,
      }
    );

    return NextResponse.json({
      success: result.success,
      creditsDeducted: creditsToDeduct,
      newBalance: result.newBalance,
      error: result.error,
    });

  } catch (error) {
    console.error('Error processing analytics credit deduction:', error);

    if (error instanceof z.ZodError) {
      return NextResponse.json({
        success: false,
        error: 'Validation error',
        details: error.errors,
      }, { status: 400 });
    }

    return NextResponse.json({
      success: false,
      error: 'Internal server error',
    }, { status: 500 });
  }
}

