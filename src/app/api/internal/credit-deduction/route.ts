import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';
import { checkAndSendLowCreditNotification } from '@/lib/services/lowCreditNotificationService';

export const dynamic = 'force-dynamic';

// Schema for credit deduction request
const creditDeductionSchema = z.object({
  callId: z.string().min(1, 'Call ID is required'),
  customerId: z.string().min(1, 'Customer ID is required'),
  partnerId: z.string().min(1, 'Partner ID is required'),
  agentId: z.string().min(1, 'Agent ID is required'),
  provider: z.enum(['vapi', 'retell', 'ultravox', 'knova', 'ghl', 'elevenlabs']),
  callDurationSeconds: z.number().int().min(0, 'Duration must be non-negative'),
  agentName: z.string().nullable().optional(),
  callStartedAt: z.string().nullable().optional(),
  callEndedAt: z.string().nullable().optional(),
  webhookId: z.string().nullable().optional(),
  // Agent-level min call duration threshold (in seconds).
  // When provided, overrides the customer's aiCreditGracePeriodSeconds for grace period calculation.
  minCallDuration: z.number().int().min(0).nullable().optional(),
});

// Schema for batch credit deduction
const batchCreditDeductionSchema = z.object({
  deductions: z.array(creditDeductionSchema).min(1, 'At least one deduction is required')
});

/**
 * POST /api/internal/credit-deduction
 * Process credit deduction for a single call
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
    const validatedData = creditDeductionSchema.parse(body);

    const result = await processCallCreditDeduction(validatedData);

    return NextResponse.json({
      success: true,
      data: result
    });

  } catch (error) {
    console.error('Error processing credit deduction:', error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json({
        success: false,
        error: 'Validation error',
        details: error.errors
      }, { status: 400 });
    }

    return NextResponse.json({
      success: false,
      error: 'Internal server error'
    }, { status: 500 });
  }
}

/**
 * PUT /api/internal/credit-deduction/batch
 * Process multiple credit deductions in batch
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
    const validatedData = batchCreditDeductionSchema.parse(body);

    const results = [];
    
    for (const deduction of validatedData.deductions) {
      try {
        const result = await processCallCreditDeduction(deduction);
        results.push({ success: true, callId: deduction.callId, data: result });
      } catch (error) {
        console.error(`Error processing deduction for call ${deduction.callId}:`, error);
        results.push({ 
          success: false, 
          callId: deduction.callId, 
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
    console.error('Error processing batch credit deductions:', error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json({
        success: false,
        error: 'Validation error',
        details: error.errors
      }, { status: 400 });
    }

    return NextResponse.json({
      success: false,
      error: 'Internal server error'
    }, { status: 500 });
  }
}

/**
 * Process credit deduction for a single call
 */
async function processCallCreditDeduction(data: z.infer<typeof creditDeductionSchema>) {
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
    webhookId,
    minCallDuration
  } = data;

  // Check if deduction already exists (idempotency check)
  const existingDeduction = await prisma.callCreditDeduction.findFirst({
    where: {
      callId,
      customerId,
      provider
    }
  });

  if (existingDeduction) {
    console.log(`Credit deduction already exists for call ${callId}, status: ${existingDeduction.deductionStatus}`);

    // If already completed or skipped, return the existing result
    if (existingDeduction.deductionStatus === 'completed') {
      return {
        status: 'already_processed',
        deductionId: existingDeduction.id,
        creditsDeducted: existingDeduction.creditsDeducted,
        reason: 'Credit deduction already completed for this call'
      };
    }

    // If already skipped, return the skipped result
    if (existingDeduction.deductionStatus === 'skipped') {
      return {
        status: 'already_processed',
        deductionId: existingDeduction.id,
        creditsDeducted: 0,
        reason: 'Credit deduction already skipped for this call (AI Credits not enabled)'
      };
    }

    // If pending, we can continue processing (might be a retry)
    if (existingDeduction.deductionStatus === 'pending') {
      console.log(`Retrying pending credit deduction for call ${callId}`);
    }

    // If failed, we can retry the processing
    if (existingDeduction.deductionStatus === 'failed') {
      console.log(`Retrying failed credit deduction for call ${callId}`);
    }
  }

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
    let deduction;

    if (existingDeduction && existingDeduction.deductionStatus !== 'skipped') {
      // Update existing record to skipped
      deduction = await prisma.callCreditDeduction.update({
        where: { id: existingDeduction.id },
        data: {
          deductionStatus: 'skipped',
          deductionCompletedAt: new Date(),
          creditsDeducted: 0,
          errorMessage: null
        }
      });
    } else if (!existingDeduction) {
      // Create new skipped record
      deduction = await prisma.callCreditDeduction.create({
        data: {
          callId,
          customerId,
          partnerId,
          agentId,
          provider,
          callDurationSeconds,
          creditsDeducted: 0,
          creditRatePerMinute: customer.aiCreditPricePerMinute,
          deductionStatus: 'skipped',
          deductionCompletedAt: new Date(),
          agentName,
          callStartedAt: callStartedAt ? new Date(callStartedAt) : null,
          callEndedAt: callEndedAt ? new Date(callEndedAt) : null,
          webhookId
        }
      });
    } else {
      // Already skipped
      deduction = existingDeduction;
    }

    return {
      status: 'skipped',
      reason: 'AI Credits not enabled for customer',
      deductionId: deduction.id,
      creditsDeducted: 0
    };
  }

  // Calculate credits to deduct
  // If agent-level minCallDuration is provided, use it as the grace period instead of
  // the customer's default aiCreditGracePeriodSeconds. This allows partners to configure
  // per-agent billing thresholds that take precedence over the customer-level setting.
  const gracePeriodSeconds = (minCallDuration !== undefined && minCallDuration !== null)
    ? minCallDuration
    : customer.aiCreditGracePeriodSeconds;
  const creditRatePerMinute = customer.aiCreditPricePerMinute;

  // Apply grace period logic
  const effectiveDurationSeconds = Math.max(0, callDurationSeconds - gracePeriodSeconds);
  const durationMinutes = Math.ceil(effectiveDurationSeconds / 60);
  const creditsToDeduct = durationMinutes * creditRatePerMinute;

  // Check if customer has sufficient credits
  if (customer.creditBalance < creditsToDeduct) {
    let deduction;

    if (existingDeduction) {
      // Update existing record to failed
      deduction = await prisma.callCreditDeduction.update({
        where: { id: existingDeduction.id },
        data: {
          deductionStatus: 'failed',
          errorMessage: 'Insufficient credit balance',
          creditsDeducted: 0,
          creditRatePerMinute
        }
      });
    } else {
      // Create new failed record
      deduction = await prisma.callCreditDeduction.create({
        data: {
          callId,
          customerId,
          partnerId,
          agentId,
          provider,
          callDurationSeconds,
          creditsDeducted: 0,
          creditRatePerMinute,
          deductionStatus: 'failed',
          errorMessage: 'Insufficient credit balance',
          agentName,
          callStartedAt: callStartedAt ? new Date(callStartedAt) : null,
          callEndedAt: callEndedAt ? new Date(callEndedAt) : null,
          webhookId
        }
      });
    }

    return {
      status: 'failed',
      reason: 'Insufficient credit balance',
      deductionId: deduction.id,
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

    // Create or update deduction record
    let deduction;
    if (existingDeduction) {
      // Update existing record to completed with new decimal field
      deduction = await tx.callCreditDeduction.update({
        where: { id: existingDeduction.id },
        data: {
          creditsDeducted: Math.round(creditsToDeduct), // Legacy field: rounded integer
          creditsDeductedDecimal: creditsToDeduct, // New field: exact decimal value
          creditRatePerMinute,
          deductionStatus: 'completed',
          deductionCompletedAt: new Date(),
          errorMessage: null // Clear any previous error
        }
      });
    } else {
      // Create new completed record with new decimal field
      deduction = await tx.callCreditDeduction.create({
        data: {
          callId,
          customerId,
          partnerId,
          agentId,
          provider,
          callDurationSeconds,
          creditsDeducted: Math.round(creditsToDeduct), // Legacy field: rounded integer
          creditsDeductedDecimal: creditsToDeduct, // New field: exact decimal value
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

    // Create credit transaction record for audit trail with new decimal fields
    await tx.creditTransaction.create({
      data: {
        customerId,
        partnerId,
        type: 'usage',
        amount: -Math.round(creditsToDeduct), // Legacy field: rounded integer (negative for deduction)
        amountDecimal: -creditsToDeduct, // New field: exact decimal value (negative for deduction)
        balanceAfter: Math.round(updatedCustomer.creditBalance), // Legacy field: rounded integer
        balanceAfterDecimal: updatedCustomer.creditBalance, // New field: exact decimal value
        description: `AI call usage: ${agentName || 'Unknown Agent'} (${Math.ceil(callDurationSeconds / 60)} min)`,
        referenceId: callId,
        metadata: {
          source: 'ai_credit_deduction',
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

  // Check and send low credit notification after successful deduction
  try {
    const notificationResult = await checkAndSendLowCreditNotification(customerId, result.newBalance);
    if (notificationResult.sent) {
      console.log(`📧 Low credit notification sent to customer ${customerId}`);
    } else if (notificationResult.reason) {
      console.log(`📧 Low credit notification not sent: ${notificationResult.reason}`);
    }
  } catch (error) {
    console.error('Error sending low credit notification:', error);
    // Don't fail the credit deduction if notification fails
  }

  return {
    status: 'completed',
    deductionId: result.deduction.id,
    creditsDeducted: creditsToDeduct,
    newBalance: result.newBalance,
    callDurationMinutes: Math.ceil(callDurationSeconds / 60),
    effectiveDurationSeconds: Math.max(0, callDurationSeconds - gracePeriodSeconds)
  };
}
