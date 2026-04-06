import { NextRequest, NextResponse } from 'next/server';
import { verifyPartnerJWT } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

/**
 * Test route to reset migration status and force show popup
 * This is for testing purposes only
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

    // Reset migration status to force show popup
    await prisma.migrationStatus.upsert({
      where: { partnerId },
      update: {
        migrationWarningShown: false,
        lastWarningShownAt: null,
        migrationCompleted: false,
        migrationCompletedAt: null
      },
      create: {
        partnerId,
        migrationWarningShown: false,
        lastWarningShownAt: null,
        migrationCompleted: false,
        migrationCompletedAt: null
      }
    });

    return NextResponse.json({
      success: true,
      message: 'Migration status reset. Refresh the dashboard to see the popup.'
    });

  } catch (error) {
    console.error('Error resetting migration status:', error);
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}
