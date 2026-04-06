import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

/**
 * @deprecated This debug endpoint is not used in the application UI and is scheduled for removal.
 * It was created for manual debugging of GHL sync status for prospects and customers.
 * TODO: Delete this route in a future cleanup sprint.
 *
 * @description Debug endpoint to check partner data including prospects and customers with their GHL sync status.
 * @route GET /api/debug/check-partner-data?partnerId={partnerId}
 */

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const partnerId = searchParams.get('partnerId');

    if (!partnerId) {
      return NextResponse.json(
        { error: 'partnerId is required' },
        { status: 400 }
      );
    }

    // Get prospects count
    const prospectsCount = await prisma.prospect.count({
      where: { partnerId },
    });

    // Get customers count (customers are linked to partners through userOnboarding or credentials)
    const customersCount = await prisma.customer.count({
      where: {
        userOnboarding: {
          some: { partnerId },
        },
      },
    });

    // Get prospects with their sync status
    const prospects = await prisma.prospect.findMany({
      where: { partnerId },
      select: {
        id: true,
        email: true,
        ghlSyncStatus: true,
        ghlContactId: true,
        isGhlSynced: true,
      },
      take: 10,
    });

    // Get customers with their sync status (through userOnboarding relation)
    const customers = await prisma.customer.findMany({
      where: {
        userOnboarding: {
          some: { partnerId },
        },
      },
      select: {
        id: true,
        email: true,
        ghlSyncStatus: true,
        ghlContactId: true,
        isGhlSynced: true,
      },
      take: 10,
    });

    return NextResponse.json({
      partnerId,
      prospectsCount,
      customersCount,
      prospects,
      customers,
    });
  } catch (error) {
    console.error('[check-partner-data] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

