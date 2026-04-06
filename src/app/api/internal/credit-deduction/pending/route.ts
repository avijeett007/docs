import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

/**
 * GET /api/internal/credit-deduction/pending
 * Get pending credit deductions for scheduler processing
 */
export async function GET(request: NextRequest) {
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

    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '100');
    const olderThanMinutes = parseInt(searchParams.get('olderThanMinutes') || '5');

    // Calculate cutoff time (only process records older than X minutes to avoid race conditions)
    const cutoffTime = new Date(Date.now() - (olderThanMinutes * 60 * 1000));

    // Get pending credit deductions
    const pendingDeductions = await prisma.callCreditDeduction.findMany({
      where: {
        deductionStatus: 'pending',
        createdAt: {
          lt: cutoffTime
        }
      },
      orderBy: {
        createdAt: 'asc'
      },
      take: limit,
      select: {
        id: true,
        callId: true,
        customerId: true,
        partnerId: true,
        agentId: true,
        provider: true,
        callDurationSeconds: true,
        agentName: true,
        callStartedAt: true,
        callEndedAt: true,
        webhookId: true,
        createdAt: true
      }
    });

    return NextResponse.json({
      success: true,
      data: {
        count: pendingDeductions.length,
        deductions: pendingDeductions
      }
    });

  } catch (error) {
    console.error('Error fetching pending credit deductions:', error);
    return NextResponse.json({
      success: false,
      error: 'Internal server error'
    }, { status: 500 });
  }
}

/**
 * PUT /api/internal/credit-deduction/pending
 * Process pending credit deductions
 */
export async function PUT(request: NextRequest) {
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
    const { deductionIds } = body;

    if (!Array.isArray(deductionIds) || deductionIds.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Deduction IDs array is required'
      }, { status: 400 });
    }

    const results = [];

    for (const deductionId of deductionIds) {
      try {
        // Get the deduction record
        const deduction = await prisma.callCreditDeduction.findUnique({
          where: { id: deductionId },
          select: {
            id: true,
            callId: true,
            customerId: true,
            partnerId: true,
            agentId: true,
            provider: true,
            callDurationSeconds: true,
            agentName: true,
            callStartedAt: true,
            callEndedAt: true,
            webhookId: true,
            deductionStatus: true
          }
        });

        if (!deduction) {
          results.push({
            deductionId,
            success: false,
            error: 'Deduction record not found'
          });
          continue;
        }

        if (deduction.deductionStatus !== 'pending') {
          results.push({
            deductionId,
            success: false,
            error: `Deduction already processed with status: ${deduction.deductionStatus}`
          });
          continue;
        }

        // Process the deduction using the same logic as the main endpoint
        const result = await processCallCreditDeduction({
          callId: deduction.callId,
          customerId: deduction.customerId,
          partnerId: deduction.partnerId,
          agentId: deduction.agentId,
          provider: deduction.provider as any,
          callDurationSeconds: deduction.callDurationSeconds,
          agentName: deduction.agentName || undefined,
          callStartedAt: deduction.callStartedAt?.toISOString(),
          callEndedAt: deduction.callEndedAt?.toISOString(),
          webhookId: deduction.webhookId || undefined
        }, deductionId);

        results.push({
          deductionId,
          success: true,
          result
        });

      } catch (error) {
        console.error(`Error processing deduction ${deductionId}:`, error);
        results.push({
          deductionId,
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    const successCount = results.filter(r => r.success).length;
    const failureCount = results.length - successCount;

    return NextResponse.json({
      success: true,
      data: {
        processed: results.length,
        successful: successCount,
        failed: failureCount,
        results
      }
    });

  } catch (error) {
    console.error('Error processing pending credit deductions:', error);
    return NextResponse.json({
      success: false,
      error: 'Internal server error'
    }, { status: 500 });
  }
}

/**
 * Process credit deduction for a single call (with existing deduction record)
 */
async function processCallCreditDeduction(
  data: {
    callId: string;
    customerId: string;
    partnerId: string;
    agentId: string;
    provider: 'vapi' | 'retell' | 'ultravox' | 'knova' | 'ghl';
    callDurationSeconds: number;
    agentName?: string;
    callStartedAt?: string;
    callEndedAt?: string;
    webhookId?: string;
  },
  existingDeductionId?: string
) {
  const {
    callId,
    customerId,
    partnerId,
    agentId,
    provider,
    callDurationSeconds,
    agentName,
    callStartedAt,
    callEndedAt,
    webhookId
  } = data;

  // Get customer settings
  const customer = await prisma.customer.findUnique({
    where: { id: customerId },
    select: {
      aiCreditsEnabled: true,
      aiCreditPricePerMinute: true,
      aiCreditGracePeriodSeconds: true,
      creditBalance: true
    }
  });

  if (!customer) {
    throw new Error(`Customer ${customerId} not found`);
  }

  // If AI Credits are not enabled, mark as skipped
  if (!customer.aiCreditsEnabled) {
    if (existingDeductionId) {
      await prisma.callCreditDeduction.update({
        where: { id: existingDeductionId },
        data: {
          deductionStatus: 'skipped',
          deductionCompletedAt: new Date()
        }
      });
    }

    return {
      status: 'skipped',
      reason: 'AI Credits not enabled for customer',
      creditsDeducted: 0
    };
  }

  // Calculate credits to deduct
  // Note: The pending/batch path does not have access to agent-level minCallDuration,
  // so it always uses the customer's aiCreditGracePeriodSeconds. The primary direct API
  // path (POST /api/internal/credit-deduction) supports minCallDuration override.
  const gracePeriodSeconds = customer.aiCreditGracePeriodSeconds;
  const creditRatePerMinute = customer.aiCreditPricePerMinute;

  // Apply grace period logic
  const effectiveDurationSeconds = Math.max(0, callDurationSeconds - gracePeriodSeconds);
  const durationMinutes = Math.ceil(effectiveDurationSeconds / 60);
  const creditsToDeduct = durationMinutes * creditRatePerMinute;

  // Check if customer has sufficient credits
  if (customer.creditBalance < creditsToDeduct) {
    if (existingDeductionId) {
      await prisma.callCreditDeduction.update({
        where: { id: existingDeductionId },
        data: {
          deductionStatus: 'failed',
          errorMessage: 'Insufficient credit balance'
        }
      });
    }

    return {
      status: 'failed',
      reason: 'Insufficient credit balance',
      creditsDeducted: 0,
      requiredCredits: creditsToDeduct,
      availableCredits: customer.creditBalance
    };
  }

  // Process the deduction in a transaction
  const result = await prisma.$transaction(async (tx) => {
    // Deduct credits from customer balance (sync both integer and decimal fields)
    const updatedCustomer = await tx.customer.update({
      where: { id: customerId },
      data: {
        creditBalance: {
          decrement: creditsToDeduct
        },
        totalCreditsUsed: {
          increment: creditsToDeduct
        }
      }
    });

    // Update existing deduction record or create new one
    let deduction;
    if (existingDeductionId) {
      deduction = await tx.callCreditDeduction.update({
        where: { id: existingDeductionId },
        data: {
          creditsDeducted: creditsToDeduct,
          creditRatePerMinute,
          deductionStatus: 'completed',
          deductionCompletedAt: new Date()
        }
      });
    } else {
      deduction = await tx.callCreditDeduction.create({
        data: {
          callId,
          customerId,
          partnerId,
          agentId,
          provider,
          callDurationSeconds,
          creditsDeducted: creditsToDeduct,
          creditRatePerMinute,
          deductionStatus: 'completed',
          deductionCompletedAt: new Date(),
          agentName,
          callStartedAt: callStartedAt ? new Date(callStartedAt) : null,
          callEndedAt: callEndedAt ? new Date(callEndedAt) : null,
          webhookId
        }
      });
    }

    // Create credit transaction record for audit trail
    await tx.creditTransaction.create({
      data: {
        customerId,
        partnerId,
        type: 'usage',
        amount: -creditsToDeduct, // Negative for deduction
        balanceAfter: updatedCustomer.creditBalance,
        description: `AI call usage: ${agentName || 'Unknown Agent'} (${Math.ceil(callDurationSeconds / 60)} min)`,
        referenceId: callId,
        metadata: {
          source: 'ai_credit_deduction_scheduler',
          callId,
          agentId,
          provider,
          callDurationSeconds,
          effectiveDurationSeconds,
          durationMinutes,
          creditRatePerMinute
        }
      }
    });

    return {
      deduction,
      newBalance: updatedCustomer.creditBalance
    };
  });

  return {
    status: 'completed',
    deductionId: result.deduction.id,
    creditsDeducted: creditsToDeduct,
    newBalance: result.newBalance,
    callDurationMinutes: Math.ceil(callDurationSeconds / 60),
    effectiveDurationSeconds: Math.max(0, callDurationSeconds - gracePeriodSeconds)
  };
}
