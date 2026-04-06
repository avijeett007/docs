import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyPartnerJWT } from '@/lib/auth';



export const dynamic = 'force-dynamic';

// Get migration status for partner's agents
export async function GET(request: NextRequest) {
  try {
    // Verify JWT and get partner
    const auth = await verifyPartnerJWT(request);
    if (!auth.isValid) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const partnerId = auth.payload?.partnerId;
    if (!partnerId) {
      return NextResponse.json(
        { error: 'Invalid partner ID' },
        { status: 401 }
      );
    }

    // Get VAPI agent statistics
    const vapiStats = await prisma.vapiAgent.groupBy({
      by: ['apiKeyStatus'],
      where: {
        partnerId: partnerId
      },
      _count: true
    });

    // Get Retell agent statistics
    const retellStats = await prisma.retellAgent.groupBy({
      by: ['apiKeyStatus'],
      where: {
        partnerId: partnerId
      },
      _count: true
    });

    // Get total counts
    const totalVapi = await prisma.vapiAgent.count({
      where: { partnerId: partnerId }
    });

    const totalRetell = await prisma.retellAgent.count({
      where: { partnerId: partnerId }
    });

    // Process VAPI statistics
    const vapiByStatus = vapiStats.reduce((acc, stat) => {
      acc[stat.apiKeyStatus] = stat._count;
      return acc;
    }, {} as Record<string, number>);

    // Process Retell statistics
    const retellByStatus = retellStats.reduce((acc, stat) => {
      acc[stat.apiKeyStatus] = stat._count;
      return acc;
    }, {} as Record<string, number>);

    // Calculate migration progress
    const vapiMigrated = (vapiByStatus.valid || 0) + (vapiByStatus.invalid || 0) + (vapiByStatus.migrated_from_partner || 0);
    const retellMigrated = (retellByStatus.valid || 0) + (retellByStatus.invalid || 0) + (retellByStatus.migrated_from_partner || 0);
    
    const totalAgents = totalVapi + totalRetell;
    const totalMigrated = vapiMigrated + retellMigrated;
    const migrationProgress = totalAgents > 0 ? (totalMigrated / totalAgents) * 100 : 0;

    // Get agents needing attention (invalid keys)
    const agentsNeedingAttention = await prisma.$transaction([
      prisma.vapiAgent.findMany({
        where: {
          partnerId: partnerId,
          apiKeyStatus: 'invalid'
        },
        select: {
          id: true,
          name: true,
          apiKeyErrorMessage: true,
          apiKeyLastVerified: true
        }
      }),
      prisma.retellAgent.findMany({
        where: {
          partnerId: partnerId,
          apiKeyStatus: 'invalid'
        },
        select: {
          id: true,
          name: true,
          apiKeyErrorMessage: true,
          apiKeyLastVerified: true
        }
      })
    ]);

    const invalidAgents = [
      ...agentsNeedingAttention[0].map(agent => ({ ...agent, provider: 'vapi' })),
      ...agentsNeedingAttention[1].map(agent => ({ ...agent, provider: 'retell' }))
    ];

    return NextResponse.json({
      summary: {
        totalAgents,
        totalMigrated,
        migrationProgress: Math.round(migrationProgress * 10) / 10, // Round to 1 decimal
        needsAttention: invalidAgents.length
      },
      vapi: {
        total: totalVapi,
        migrated: vapiMigrated,
        byStatus: {
          not_set: vapiByStatus.not_set || 0,
          valid: vapiByStatus.valid || 0,
          invalid: vapiByStatus.invalid || 0,
          expired: vapiByStatus.expired || 0,
          rate_limited: vapiByStatus.rate_limited || 0,
          revoked: vapiByStatus.revoked || 0,
          migrated_from_partner: vapiByStatus.migrated_from_partner || 0
        }
      },
      retell: {
        total: totalRetell,
        migrated: retellMigrated,
        byStatus: {
          not_set: retellByStatus.not_set || 0,
          valid: retellByStatus.valid || 0,
          invalid: retellByStatus.invalid || 0,
          expired: retellByStatus.expired || 0,
          rate_limited: retellByStatus.rate_limited || 0,
          revoked: retellByStatus.revoked || 0,
          migrated_from_partner: retellByStatus.migrated_from_partner || 0
        }
      },
      invalidAgents
    });

  } catch (error) {
    console.error('Error getting migration status:', error);
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}
