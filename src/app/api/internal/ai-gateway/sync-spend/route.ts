import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getLiteLLMClient } from '@/lib/litellm';
import { logger } from '@/lib/logger';
import { Decimal } from '@prisma/client/runtime/library';

export const dynamic = 'force-dynamic';

/**
 * POST /api/internal/ai-gateway/sync-spend
 *
 * Manually trigger a spend sync for one or all active AI Gateway keys.
 * Called by KnotieManager cron or webhook-based triggers.
 *
 * Body (optional):
 *   { keyId?: string }  — sync a single key; omit to sync all active keys.
 *
 * Auth: Bearer INTERNAL_API_KEY
 */
export async function POST(request: NextRequest) {
  try {
    // Verify internal API key
    const authHeader = request.headers.get('authorization');
    const expectedAuth = `Bearer ${process.env.INTERNAL_API_KEY}`;

    if (!authHeader || authHeader !== expectedAuth) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 },
      );
    }

    const body = await request.json().catch(() => ({}));
    const { keyId } = body as { keyId?: string };

    // Fetch keys to sync
    const keys = await prisma.aiGatewayKey.findMany({
      where: {
        status: 'active',
        ...(keyId ? { id: keyId } : {}),
      },
      select: {
        id: true,
        partnerId: true,
        customerId: true,
        name: true,
        litellmTeamId: true,
        budgetUsd: true,
        budgetCreditsReserved: true,
        lastSyncedSpendUsd: true,
        profitMultiplier: true,
        customerCreditPriceCents: true,
        adminFeePercent: true,
      },
    });

    if (keys.length === 0) {
      return NextResponse.json({
        success: true,
        message: keyId ? 'Key not found or not active' : 'No active keys to sync',
        synced: 0,
      });
    }

    const litellmClient = getLiteLLMClient();
    const results: Array<{ keyId: string; status: string; spendDeltaUsd?: number; error?: string }> = [];

    for (const key of keys) {
      try {
        // Fetch current spend from LiteLLM
        const teamInfo = await litellmClient.getTeamInfo(key.litellmTeamId);
        const currentSpendUsd = teamInfo.team_info.spend ?? 0;
        const previousSpendUsd = Number(key.lastSyncedSpendUsd);
        const spendDeltaUsd = currentSpendUsd - previousSpendUsd;

        if (spendDeltaUsd <= 0) {
          results.push({ keyId: key.id, status: 'no_change' });
          continue;
        }

        // Calculate credits to deduct
        const rawCredits = spendDeltaUsd * 100; // $1 = 100 credits (keep as float for precision)
        const adminFeeCredits = key.adminFeePercent > 0
          ? Math.ceil(rawCredits * (key.adminFeePercent / 100))
          : 0;
        const partnerCreditsDeducted = Math.ceil(rawCredits) + adminFeeCredits;
        const creditPriceCents = Number(key.customerCreditPriceCents) || 1;
        // Fractional customer credits — NO rounding for precise tracking
        const customerCreditsDeducted = key.customerId
          ? parseFloat(((rawCredits * key.profitMultiplier) / creditPriceCents).toFixed(4))
          : 0;

        // Update in a transaction
        await prisma.$transaction(async (tx) => {
          // Update key spend
          await tx.aiGatewayKey.update({
            where: { id: key.id },
            data: {
              totalSpendUsd: new Decimal(currentSpendUsd),
              lastSyncedSpendUsd: new Decimal(currentSpendUsd),
              lastSyncedAt: new Date(),
            },
          });

          // Deduct partner credits
          await tx.partner.update({
            where: { id: key.partnerId },
            data: { creditBalance: { decrement: partnerCreditsDeducted } },
          });

          // Deduct customer credits if assigned (precise decimal)
          if (key.customerId && customerCreditsDeducted > 0) {
            const cust = await tx.customer.findUnique({
              where: { id: key.customerId },
              select: { creditBalanceDecimal: true, creditBalance: true },
            });
            if (cust) {
              const currentDecBal = Number(cust.creditBalanceDecimal ?? cust.creditBalance ?? 0);
              const newDecBal = parseFloat((currentDecBal - customerCreditsDeducted).toFixed(4));
              await tx.customer.update({
                where: { id: key.customerId },
                data: {
                  creditBalance: Math.floor(newDecBal),
                  creditBalanceDecimal: new Decimal(newDecBal),
                },
              });
            }
          }

          // Log sync record
          await tx.aiGatewaySpendSync.create({
            data: {
              aiGatewayKeyId: key.id,
              spendDeltaUsd: new Decimal(spendDeltaUsd),
              cumulativeSpendUsd: new Decimal(currentSpendUsd),
              partnerCreditsDeducted,
              customerCreditsDeducted: customerCreditsDeducted || null,
              profitMultiplierApplied: key.profitMultiplier,
              adminFeeCreditsDeducted: adminFeeCredits || null,
              adminFeePercent: key.adminFeePercent || null,
              syncSource: 'api',
            },
          });
        });

        results.push({ keyId: key.id, status: 'synced', spendDeltaUsd });
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : String(err);
        logger.error('[SyncSpend] Failed to sync key', err as Error, { keyId: key.id });
        results.push({ keyId: key.id, status: 'error', error: errMsg });
      }
    }

    const synced = results.filter(r => r.status === 'synced').length;
    const errors = results.filter(r => r.status === 'error').length;

    logger.info('[SyncSpend] Manual sync completed', { total: keys.length, synced, errors });

    return NextResponse.json({ success: true, synced, errors, results });
  } catch (error) {
    logger.error('[SyncSpend] Endpoint error', error as Error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 },
    );
  }
}

