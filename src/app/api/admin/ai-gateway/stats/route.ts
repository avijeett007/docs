import { NextRequest, NextResponse } from 'next/server';
import { protectAdminRoute } from '@/lib/admin-route-protection';
import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/ai-gateway/stats
 * Global AI Gateway usage statistics for Mission Control.
 */
export async function GET(request: NextRequest) {
  try {
    const authResult = await protectAdminRoute(request);
    if (authResult) return authResult;

    // Aggregate key stats
    const [keyStats, syncStats, recentSyncs] = await Promise.all([
      prisma.aiGatewayKey.groupBy({
        by: ['status'],
        _count: { id: true },
        _sum: {
          budgetCreditsReserved: true,
          totalRequests: true,
          totalTokens: true,
        },
      }),
      prisma.aiGatewaySpendSync.aggregate({
        _sum: {
          partnerCreditsDeducted: true,
          customerCreditsDeducted: true,
          adminFeeCreditsDeducted: true,
        },
        _count: { id: true },
        _max: { syncedAt: true },
      }),
      prisma.aiGatewaySpendSync.findMany({
        take: 20,
        orderBy: { syncedAt: 'desc' },
        select: {
          id: true,
          spendDeltaUsd: true,
          cumulativeSpendUsd: true,
          partnerCreditsDeducted: true,
          customerCreditsDeducted: true,
          autoTopUpTriggered: true,
          syncedAt: true,
          aiGatewayKey: {
            select: { name: true, partnerId: true },
          },
        },
      }),
    ]);

    // Build summary
    const totalKeys = keyStats.reduce((sum, g) => sum + g._count.id, 0);
    const activeKeys = keyStats.find(g => g.status === 'active')?._count.id ?? 0;
    const revokedKeys = keyStats.find(g => g.status === 'revoked')?._count.id ?? 0;
    const totalCreditsReserved = keyStats.reduce(
      (sum, g) => sum + Number(g._sum.budgetCreditsReserved ?? 0), 0
    );
    const totalRequests = keyStats.reduce(
      (sum, g) => sum + (g._sum.totalRequests ?? 0), 0
    );
    const totalTokens = keyStats.reduce(
      (sum, g) => sum + (g._sum.totalTokens ?? 0), 0
    );

    // Count unique partners using AI Gateway
    const uniquePartners = await prisma.aiGatewayKey.findMany({
      where: { status: 'active' },
      select: { partnerId: true },
      distinct: ['partnerId'],
    });

    return NextResponse.json({
      summary: {
        totalKeys,
        activeKeys,
        revokedKeys,
        totalCreditsReserved,
        totalRequests,
        totalTokens,
        uniquePartners: uniquePartners.length,
        totalSyncs: syncStats._count.id,
        lastSyncAt: syncStats._max.syncedAt,
        totalPartnerCreditsDeducted: syncStats._sum.partnerCreditsDeducted ?? 0,
        totalCustomerCreditsDeducted: syncStats._sum.customerCreditsDeducted ?? 0,
        totalAdminFeeCredits: syncStats._sum.adminFeeCreditsDeducted ?? 0,
      },
      recentSyncs: recentSyncs.map(s => ({
        id: s.id,
        keyName: s.aiGatewayKey.name,
        partnerId: s.aiGatewayKey.partnerId,
        spendDeltaUsd: Number(s.spendDeltaUsd),
        cumulativeSpendUsd: Number(s.cumulativeSpendUsd),
        partnerCreditsDeducted: s.partnerCreditsDeducted,
        customerCreditsDeducted: s.customerCreditsDeducted,
        autoTopUpTriggered: s.autoTopUpTriggered,
        syncedAt: s.syncedAt,
      })),
    });
  } catch (error) {
    logger.error('Error fetching AI Gateway stats', error as Error, {
      operation: 'ai_gateway_admin',
    });
    return NextResponse.json(
      { error: 'Failed to fetch AI Gateway stats' },
      { status: 500 }
    );
  }
}

