import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { Decimal } from '@prisma/client/runtime/library';
import { getLiteLLMClient } from '@/lib/litellm';
import { decryptData } from '@/lib/encryption';
import { CreditService } from '@/lib/services/creditService';
import {
  checkAndSendLowCreditNotification,
  checkAndNotifyPartnerLowBalance,
} from '@/lib/services/lowCreditNotificationService';

export const dynamic = 'force-dynamic';

/**
 * POST /api/internal/ai-gateway/spend-webhook
 *
 * Receives real-time spend events from a Supabase Database Webhook
 * (pg_net trigger on LiteLLM_SpendLogs INSERT).
 *
 * Payload format (Supabase Database Webhook):
 *   { type: "INSERT", table: "LiteLLM_SpendLogs", record: { ... }, schema: "public" }
 *
 * Auth: Bearer INTERNAL_API_KEY
 */
export async function POST(request: NextRequest) {
  try {
    // 1. Verify internal API key (check header first, then query param as fallback
    //    for Supabase pg_net webhooks which send auth as a query parameter)
    const authHeader = request.headers.get('authorization');
    const authQueryParam = request.nextUrl.searchParams.get('Authorization');
    const authValue = authHeader || authQueryParam;
    const expectedAuth = `Bearer ${process.env.INTERNAL_API_KEY}`;

    if (!authValue || authValue !== expectedAuth) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 },
      );
    }

    const body = await request.json().catch(() => null);
    if (!body) {
      return NextResponse.json(
        { success: false, error: 'Invalid JSON body' },
        { status: 400 },
      );
    }

    // 2. Extract the record from Supabase webhook payload
    //    Supabase Dashboard Webhook wraps: { type, table, record, schema, old_record }
    const record = body.record ?? body;

    const requestId: string | undefined = record.request_id;
    const teamId: string | undefined = record.team_id;
    const spend: number | undefined = record.spend;
    const status: string | undefined = record.status;
    const model: string | undefined = record.model;
    const totalTokens: number | undefined = record.total_tokens;

    // 3. Validate required fields
    if (!requestId || !teamId) {
      return NextResponse.json({
        success: true, processed: false,
        reason: 'missing_required_fields',
      });
    }

    // 4. Skip non-success, zero-spend, and internal health checks
    if (status !== 'success') {
      return NextResponse.json({ success: true, processed: false, reason: 'non_success_status' });
    }
    if (!spend || spend <= 0) {
      return NextResponse.json({ success: true, processed: false, reason: 'zero_spend' });
    }
    if (teamId === 'litellm-internal-health-check') {
      return NextResponse.json({ success: true, processed: false, reason: 'health_check' });
    }

    // 5. Deduplication — check if this request_id was already processed
    const existing = await prisma.aiGatewaySpendSync.findFirst({
      where: { litellmRequestId: requestId },
    });
    if (existing) {
      return NextResponse.json({ success: true, processed: false, reason: 'duplicate' });
    }

    // 6. Look up AiGatewayKey by litellmTeamId
    const key = await prisma.aiGatewayKey.findFirst({
      where: { litellmTeamId: teamId, status: 'active' },
      select: {
        id: true,
        partnerId: true,
        customerId: true,
        name: true,
        litellmTeamId: true,
        encryptedVirtualKey: true, // needed for block/unblock via /key/block and /key/unblock
        budgetCreditsReserved: true,
        budgetCreditsUsed: true,
        budgetUsd: true,
        profitMultiplier: true,
        customerCreditPriceCents: true,
        adminFeePercent: true,
        totalSpendUsd: true,
        lastSyncedSpendUsd: true,
        autoTopUpEnabled: true,
        autoTopUpThresholdUsd: true,
        autoTopUpAmountUsd: true,
      },
    });

    if (!key) {
      logger.warn('[SpendWebhook] Unknown team_id — no matching active key', { teamId, requestId });
      return NextResponse.json({ success: true, processed: false, reason: 'unknown_team' });
    }

    // 7. Calculate credits (exact fractional — no rounding)
    //    1 USD cent = 1 Knotie Credit, so $1 = 100 credits
    const rawCredits = spend * 100;
    const adminFeeCredits = key.adminFeePercent > 0
      ? parseFloat((rawCredits * (key.adminFeePercent / 100)).toFixed(4))
      : 0;
    const partnerCreditsDeducted = parseFloat((rawCredits + adminFeeCredits).toFixed(4));

    const creditPriceCents = Number(key.customerCreditPriceCents) || 1;
    const customerCreditsDeducted = key.customerId
      ? parseFloat(((rawCredits * key.profitMultiplier) / creditPriceCents).toFixed(4))
      : 0;

    // 8. Deduct in a transaction
    await prisma.$transaction(async (tx) => {
      // Update key spend tracking (all increments — atomic, no race conditions)
      await tx.aiGatewayKey.update({
        where: { id: key.id },
        data: {
          budgetCreditsUsed: { increment: partnerCreditsDeducted },
          totalSpendUsd: { increment: spend }, // atomic increment, not SET
          lastSyncedSpendUsd: { increment: spend }, // KEY: keeps cron delta = 0
          lastSyncedAt: new Date(),
          totalRequests: { increment: 1 },
        },
      });

      // Deduct customer credits if assigned (fractional precision)
      // creditBalance (integer) is managed by all existing routes — we only touch it here
      // when the fractional part borrows a whole credit.
      // creditBalanceDecimal stores ONLY the fractional part (0 to < 1).
      if (key.customerId && customerCreditsDeducted > 0) {
        const cust = await tx.customer.findUnique({
          where: { id: key.customerId },
          select: { creditBalanceDecimal: true, creditBalance: true },
        });
        if (cust) {
          const currentFractional = Number(cust.creditBalanceDecimal ?? 0);
          const newFractional = parseFloat((currentFractional - customerCreditsDeducted).toFixed(4));

          // Borrow from integer balance when fractional goes below 0
          let integerDecrement = 0;
          let adjustedFractional = newFractional;
          if (newFractional < 0) {
            // e.g. fractional was 0.30, deducted 0.50 → newFractional = -0.20
            // borrow 1 from creditBalance, fractional becomes 0.80
            integerDecrement = Math.ceil(Math.abs(newFractional));
            adjustedFractional = parseFloat((newFractional + integerDecrement).toFixed(4));
          }

          const updateData: Record<string, unknown> = {
            creditBalanceDecimal: new Decimal(adjustedFractional),
          };
          if (integerDecrement > 0) {
            updateData.creditBalance = { decrement: integerDecrement };
          }

          await tx.customer.update({
            where: { id: key.customerId },
            data: updateData,
          });

          // Calculate total balance after for transaction log
          const newTotalBalance = (cust.creditBalance - integerDecrement) + adjustedFractional;

          // Log customer credit transaction
          await tx.creditTransaction.create({
            data: {
              partnerId: key.partnerId,
              customerId: key.customerId,
              type: 'usage',
              amount: -Math.ceil(customerCreditsDeducted), // Legacy integer field
              amountDecimal: new Decimal(parseFloat((-customerCreditsDeducted).toFixed(4))),
              balanceAfter: Math.floor(newTotalBalance), // Legacy integer field
              balanceAfterDecimal: new Decimal(parseFloat(newTotalBalance.toFixed(4))),
              description: `AI usage — ${customerCreditsDeducted.toFixed(4)} credits`,
              referenceId: key.id,
              metadata: {
                source: 'ai_gateway_webhook_customer',
                litellmRequestId: requestId,
                profitMultiplier: key.profitMultiplier,
                customerCreditsDeducted,
                model: model ?? null,
              },
            },
          });
        }
      }

      // Log partner credit transaction
      const currentBudgetUsed = Number(key.budgetCreditsUsed ?? 0);
      const currentBudgetReserved = Number(key.budgetCreditsReserved ?? 0);
      const newBudgetUsed = parseFloat((currentBudgetUsed + partnerCreditsDeducted).toFixed(4));
      await tx.creditTransaction.create({
        data: {
          partnerId: key.partnerId,
          customerId: key.customerId,
          type: 'usage',
          amount: -Math.ceil(partnerCreditsDeducted), // legacy integer field
          amountDecimal: new Decimal(parseFloat((-partnerCreditsDeducted).toFixed(4))),
          balanceAfter: Math.floor(currentBudgetReserved - newBudgetUsed), // legacy integer field
          balanceAfterDecimal: new Decimal(parseFloat((currentBudgetReserved - newBudgetUsed).toFixed(4))),
          description: `AI Gateway spend — key "${key.name}" — $${spend.toFixed(6)} LLM cost (webhook)`,
          referenceId: key.id,
          metadata: {
            source: 'ai_gateway_webhook',
            litellmRequestId: requestId,
            spendDeltaUsd: spend,
            profitMultiplier: key.profitMultiplier,
            adminFeePercent: key.adminFeePercent,
            adminFeeCredits,
            rawCredits,
            model: model ?? null,
            totalTokens: totalTokens ?? null,
          },
        },
      });

      // Log sync record
      await tx.aiGatewaySpendSync.create({
        data: {
          aiGatewayKeyId: key.id,
          litellmRequestId: requestId,
          spendDeltaUsd: new Decimal(spend),
          cumulativeSpendUsd: new Decimal(parseFloat((Number(key.totalSpendUsd) + spend).toFixed(6))),
          partnerCreditsDeducted,
          customerCreditsDeducted: customerCreditsDeducted > 0 ? customerCreditsDeducted : null,
          profitMultiplierApplied: key.profitMultiplier,
          adminFeeCreditsDeducted: adminFeeCredits > 0 ? adminFeeCredits : null,
          adminFeePercent: key.adminFeePercent > 0 ? key.adminFeePercent : null,
          syncSource: 'webhook',
        },
      });
    });

    logger.info('[SpendWebhook] Processed spend event', {
      requestId,
      teamId,
      keyId: key.id,
      spend,
      model,
      partnerCreditsDeducted,
      customerCreditsDeducted,
    });

    // 9. Real-time auto-top-up check (runs AFTER transaction commits)
    let autoTopUpTriggered = false;
    if (key.autoTopUpEnabled && key.autoTopUpThresholdUsd && key.autoTopUpAmountUsd) {
      try {
        autoTopUpTriggered = await handleAutoTopUp({
          keyId: key.id,
          partnerId: key.partnerId,
          keyName: key.name,
          litellmTeamId: key.litellmTeamId,
          budgetUsd: Number(key.budgetUsd),
          totalSpendUsd: Number(key.totalSpendUsd) + spend, // include current spend
          autoTopUpThresholdUsd: Number(key.autoTopUpThresholdUsd),
          autoTopUpAmountUsd: Number(key.autoTopUpAmountUsd),
          adminFeePercent: key.adminFeePercent,
        });
      } catch (topUpError) {
        // Non-blocking — log and continue. Cron will catch it.
        logger.error('[SpendWebhook] Auto-top-up failed (non-blocking)', topUpError as Error, {
          keyId: key.id,
          partnerId: key.partnerId,
        });
      }
    }

    // 10. Key suspension checks (non-blocking, run after transaction commits)
    let customerKeySuspended = false;
    let partnerKeysSuspended = 0;
    let partnerKeySuspended = false;
    try {
      // 10a. If this is a customer key, check if customer AI Credits hit zero
      if (key.customerId && customerCreditsDeducted > 0) {
        const freshCustomer = await prisma.customer.findUnique({
          where: { id: key.customerId },
          select: { creditBalance: true, creditBalanceDecimal: true },
        });
        const totalCustomerBalance =
          (freshCustomer?.creditBalance ?? 0) + Number(freshCustomer?.creditBalanceDecimal ?? 0);
        if (totalCustomerBalance <= 0) {
          customerKeySuspended = await suspendKey(key.id, key.encryptedVirtualKey, 'customer_credits_depleted');
        }

        // Fire-and-forget low-credit notification — let the service decide if threshold is met
        const notifyBalance = Math.floor(totalCustomerBalance);
        checkAndSendLowCreditNotification(key.customerId, notifyBalance).catch(() => {
          logger.warn('[SpendWebhook] Customer low-credit notification error (non-blocking)', {
            customerId: key.customerId ?? undefined,
          });
        });
      }

      // 10b. Always check if partner Knotie Credits dropped below the per-key reserve threshold.
      //      (Runs even if we already suspended the customer key — other customer keys may still be active.)
      const freshPartnerBalance = await CreditService.getPartnerCreditBalance(key.partnerId);
      if (freshPartnerBalance && freshPartnerBalance.currentBalance < PARTNER_SUSPEND_THRESHOLD) {
        partnerKeysSuspended = await suspendAllPartnerCustomerKeys(key.partnerId);
      }

      // Fire-and-forget partner low-balance notification — let the service decide if threshold is met
      checkAndNotifyPartnerLowBalance(key.partnerId).catch(() => {
        logger.warn('[SpendWebhook] Partner low-credit notification error (non-blocking)', {
          partnerId: key.partnerId,
        });
      });

      // 10c. If this is a partner-owned key (no customer) and auto-pay is off, suspend when budget is exhausted.
      if (!key.customerId && !key.autoTopUpEnabled && !autoTopUpTriggered) {
        const updatedSpendUsd = Number(key.totalSpendUsd) + spend;
        const budgetUsd = Number(key.budgetUsd ?? 0);
        if (budgetUsd > 0 && updatedSpendUsd >= budgetUsd) {
          partnerKeySuspended = await suspendKey(key.id, key.encryptedVirtualKey, 'partner_key_budget_exhausted_no_autopay');
        }
      }
    } catch (suspendError) {
      // Non-blocking — log and continue
      logger.error('[SpendWebhook] Key suspension check failed (non-blocking)', suspendError as Error, {
        keyId: key.id, partnerId: key.partnerId,
      });
    }

    return NextResponse.json({
      success: true, processed: true, autoTopUpTriggered,
      customerKeySuspended, partnerKeysSuspended, partnerKeySuspended,
    });
  } catch (error) {
    logger.error('[SpendWebhook] Endpoint error', error as Error);
    // Always return 200 — pg_net is fire-and-forget, no retry mechanism
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 200 },
    );
  }
}



// ============================================
// Key Suspension Helpers
// ============================================

/**
 * Partner Knotie Credit balance below which all their customer keys are suspended.
 * Matches the per-key CUSTOMER_KEY_CREDIT_RESERVE in aiGatewayService.ts.
 */
const PARTNER_SUSPEND_THRESHOLD = 1000;

/**
 * Suspend a single AI Gateway key — blocks it in LiteLLM via /key/block (requires the
 * raw virtual key) and sets DB status = 'suspended'.
 * Returns true if the key was newly suspended.
 */
async function suspendKey(keyId: string, encryptedVirtualKey: string, reason: string): Promise<boolean> {
  try {
    const rawVirtualKey = await decryptData(encryptedVirtualKey);
    const litellmClient = getLiteLLMClient();
    await litellmClient.blockKey(rawVirtualKey);
    await prisma.aiGatewayKey.update({
      where: { id: keyId },
      data: { status: 'suspended' },
    });
    logger.info('[SpendWebhook] Key suspended', { keyId, reason });
    return true;
  } catch (err) {
    logger.error('[SpendWebhook] Failed to suspend key', err as Error, { keyId, reason });
    return false;
  }
}

/**
 * Suspend all active customer keys for a partner when their balance is below threshold.
 * Returns the count of keys successfully suspended.
 */
async function suspendAllPartnerCustomerKeys(partnerId: string): Promise<number> {
  const activeCustomerKeys = await prisma.aiGatewayKey.findMany({
    where: { partnerId, status: 'active', customerId: { not: null } },
    select: { id: true, encryptedVirtualKey: true },
  });

  if (activeCustomerKeys.length === 0) return 0;

  logger.warn('[SpendWebhook] Partner credits below threshold — suspending all customer keys', {
    partnerId, keyCount: activeCustomerKeys.length, threshold: PARTNER_SUSPEND_THRESHOLD,
  });

  let suspended = 0;
  for (const k of activeCustomerKeys) {
    const ok = await suspendKey(k.id, k.encryptedVirtualKey, 'partner_credits_below_threshold');
    if (ok) suspended++;
  }
  return suspended;
}

// ============================================
// Auto-Top-Up Helper
// ============================================

/** 1 Knotie Credit = $0.01 */
const CREDITS_PER_DOLLAR = 100;

/** Max auto-top-ups per key per 24h */
const MAX_AUTO_TOPUPS_PER_DAY = 5;

/** Minimum interval between auto-top-ups (1 hour in ms) */
const MIN_TOPUP_INTERVAL_MS = 60 * 60 * 1000;

interface AutoTopUpParams {
  keyId: string;
  partnerId: string;
  keyName: string;
  litellmTeamId: string;
  budgetUsd: number;
  totalSpendUsd: number;
  autoTopUpThresholdUsd: number;
  autoTopUpAmountUsd: number;
  adminFeePercent: number;
}

/**
 * Check if budget remaining is at or below the auto-top-up threshold,
 * and if so, top up the key. Returns true if a top-up was performed.
 *
 * Guardrails:
 *  - Max 5 auto-top-ups per key per 24 hours
 *  - Minimum 1 hour between auto-top-ups
 *  - Partner must have sufficient credits
 */
async function handleAutoTopUp(params: AutoTopUpParams): Promise<boolean> {
  const {
    keyId, partnerId, keyName, litellmTeamId,
    budgetUsd, totalSpendUsd, autoTopUpThresholdUsd, autoTopUpAmountUsd,
    adminFeePercent,
  } = params;

  const remainingUsd = budgetUsd - totalSpendUsd;

  // Not at threshold yet — no action needed
  if (remainingUsd > autoTopUpThresholdUsd) {
    return false;
  }

  logger.info('[SpendWebhook] Budget at/below auto-top-up threshold', {
    keyId, remainingUsd, autoTopUpThresholdUsd, budgetUsd, totalSpendUsd,
  });

  // Guardrail: check recent auto-top-ups (last 24h)
  const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const recentTopUps = await prisma.aiGatewaySpendSync.findMany({
    where: {
      aiGatewayKeyId: keyId,
      autoTopUpTriggered: true,
      syncedAt: { gte: twentyFourHoursAgo },
    },
    orderBy: { syncedAt: 'desc' },
    take: MAX_AUTO_TOPUPS_PER_DAY,
    select: { syncedAt: true },
  });

  if (recentTopUps.length >= MAX_AUTO_TOPUPS_PER_DAY) {
    logger.warn('[SpendWebhook] Auto-top-up skipped — daily limit reached', {
      keyId, count: recentTopUps.length, limit: MAX_AUTO_TOPUPS_PER_DAY,
    });
    return false;
  }

  // Guardrail: minimum interval between top-ups
  if (recentTopUps.length > 0) {
    const lastTopUpAt = recentTopUps[0].syncedAt.getTime();
    const elapsed = Date.now() - lastTopUpAt;
    if (elapsed < MIN_TOPUP_INTERVAL_MS) {
      logger.warn('[SpendWebhook] Auto-top-up skipped — too soon since last top-up', {
        keyId, elapsedMs: elapsed, minIntervalMs: MIN_TOPUP_INTERVAL_MS,
      });
      return false;
    }
  }

  // Calculate credits to reserve (including admin fee)
  const totalCostWithFee = autoTopUpAmountUsd * (1 + adminFeePercent / 100);
  const additionalCredits = Math.ceil(totalCostWithFee * CREDITS_PER_DOLLAR);

  // Check partner balance
  const creditBalance = await CreditService.getPartnerCreditBalance(partnerId);
  if (!creditBalance || creditBalance.currentBalance < additionalCredits) {
    logger.warn('[SpendWebhook] Auto-top-up skipped — insufficient partner credits', {
      keyId, partnerId, needed: additionalCredits,
      available: creditBalance?.currentBalance ?? 0,
    });
    return false;
  }

  // Deduct credits from partner
  const deductResult = await CreditService.addCredits(
    partnerId,
    -additionalCredits,
    'ai_gateway_topup',
    `AI Gateway auto-top-up — key "${keyName}" — ${additionalCredits} credits ($${autoTopUpAmountUsd})`,
    keyId,
    undefined,
    {
      aiGatewayKeyId: keyId,
      additionalBudgetUsd: autoTopUpAmountUsd,
      adminFeePercent,
      additionalCredits,
      source: 'webhook_auto_topup',
    }
  );

  if (!deductResult.success) {
    logger.error('[SpendWebhook] Auto-top-up credit deduction failed', undefined, {
      keyId, partnerId, error: deductResult.error,
    });
    return false;
  }

  // Fire-and-forget low-balance notification after deducting from partner balance
  checkAndNotifyPartnerLowBalance(partnerId).catch(() => {
    logger.warn('[SpendWebhook] Partner low-credit notification error after auto-top-up (non-blocking)', {
      partnerId,
    });
  });

  // Increase LiteLLM team budget
  const newBudgetUsd = budgetUsd + autoTopUpAmountUsd;
  try {
    const litellmClient = getLiteLLMClient();
    await litellmClient.updateTeam({
      team_id: litellmTeamId,
      max_budget: newBudgetUsd,
    });
  } catch (error) {
    logger.error('[SpendWebhook] Auto-top-up LiteLLM budget update failed (credits already deducted, cron will reconcile)', error as Error, {
      keyId, litellmTeamId, newBudgetUsd,
    });
    // Don't return false — credits are deducted, DB update below will track the new budget
  }

  // Update key in DB
  const currentKey = await prisma.aiGatewayKey.findUnique({
    where: { id: keyId },
    select: { budgetCreditsReserved: true },
  });

  await prisma.aiGatewayKey.update({
    where: { id: keyId },
    data: {
      budgetUsd: new Decimal(newBudgetUsd),
      budgetCreditsReserved: new Decimal(
        Number(currentKey?.budgetCreditsReserved ?? 0) + additionalCredits
      ),
    },
  });

  // Log auto-top-up sync record
  await prisma.aiGatewaySpendSync.create({
    data: {
      aiGatewayKeyId: keyId,
      spendDeltaUsd: new Decimal(0),
      cumulativeSpendUsd: new Decimal(totalSpendUsd),
      partnerCreditsDeducted: 0,
      autoTopUpTriggered: true,
      autoTopUpAmount: new Decimal(autoTopUpAmountUsd),
      syncSource: 'webhook',
    },
  });

  logger.info('[SpendWebhook] Auto-top-up completed successfully', {
    keyId, partnerId, autoTopUpAmountUsd, newBudgetUsd, additionalCredits,
  });

  return true;
}