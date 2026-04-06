import { NextRequest, NextResponse } from 'next/server';
import { verifyPartnerJWT } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

/**
 * Get migration status for a partner
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await verifyPartnerJWT(request);
    if (!auth.isValid) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const partnerId = auth.payload?.partnerId!;

    // Get or create migration status
    let migrationStatus = await prisma.migrationStatus.findUnique({
      where: { partnerId }
    });

    if (!migrationStatus) {
      migrationStatus = await prisma.migrationStatus.create({
        data: { partnerId }
      });
    }

    // Check if partner has agents
    const [vapiAgentCount, retellAgentCount] = await Promise.all([
      prisma.vapiAgent.count({
        where: { partnerId, isActive: true }
      }),
      prisma.retellAgent.count({
        where: { partnerId, isActive: true }
      })
    ]);

    const hasAgents = vapiAgentCount > 0 || retellAgentCount > 0;

    // Check if migration is needed (agents without individual API keys)
    const [vapiAgentsNeedingMigration, retellAgentsNeedingMigration] = await Promise.all([
      prisma.vapiAgent.count({
        where: {
          partnerId,
          isActive: true,
          apiKey: null
        }
      }),
      prisma.retellAgent.count({
        where: {
          partnerId,
          isActive: true,
          apiKey: null
        }
      })
    ]);

    const needsMigration = vapiAgentsNeedingMigration > 0 || retellAgentsNeedingMigration > 0;

    // Check if it's been shown today
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const shownToday = migrationStatus.lastWarningShownAt && 
      migrationStatus.lastWarningShownAt >= today;

    // Determine if we should show the warning
    const shouldShowWarning = hasAgents && needsMigration && !shownToday && !migrationStatus.migrationCompleted;

    return NextResponse.json({
      success: true,
      migrationStatus: {
        partnerId,
        hasAgents,
        needsMigration,
        migrationCompleted: migrationStatus.migrationCompleted,
        shouldShowWarning,
        lastWarningShownAt: migrationStatus.lastWarningShownAt,
        agentCounts: {
          vapi: vapiAgentCount,
          retell: retellAgentCount,
          vapiNeedingMigration: vapiAgentsNeedingMigration,
          retellNeedingMigration: retellAgentsNeedingMigration
        }
      }
    });

  } catch (error) {
    console.error('Error getting migration status:', error);
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}

/**
 * Update migration status
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await verifyPartnerJWT(request);
    if (!auth.isValid) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const partnerId = auth.payload?.partnerId!;
    const body = await request.json();
    const { action } = body;

    if (action === 'mark_warning_shown') {
      // Mark that the warning has been shown today
      await prisma.migrationStatus.upsert({
        where: { partnerId },
        update: {
          migrationWarningShown: true,
          lastWarningShownAt: new Date()
        },
        create: {
          partnerId,
          migrationWarningShown: true,
          lastWarningShownAt: new Date()
        }
      });

      return NextResponse.json({
        success: true,
        message: 'Migration warning marked as shown'
      });
    }

    if (action === 'mark_completed') {
      // Mark migration as completed
      await prisma.migrationStatus.upsert({
        where: { partnerId },
        update: {
          migrationCompleted: true,
          migrationCompletedAt: new Date()
        },
        create: {
          partnerId,
          migrationCompleted: true,
          migrationCompletedAt: new Date()
        }
      });

      return NextResponse.json({
        success: true,
        message: 'Migration marked as completed'
      });
    }

    return NextResponse.json(
      { error: 'Invalid action' },
      { status: 400 }
    );

  } catch (error) {
    console.error('Error updating migration status:', error);
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}
