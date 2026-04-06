import { NextRequest, NextResponse } from 'next/server';
import { verifyPartnerJWT } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

/**
 * GET /api/partner/retell-kb-count
 * Get the count of Retell knowledge bases created by this partner
 */
export async function GET(request: NextRequest) {
  try {
    // Verify partner authentication
    const auth = await verifyPartnerJWT(request);
    if (!auth.isValid) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const partnerId = auth.payload?.partnerId!;

    // Count Retell knowledge base mappings for this partner
    const count = await prisma.knowledgeBaseProviderMapping.count({
      where: {
        partnerId,
        provider: 'retell',
        syncStatus: 'active', // Only count active mappings
      },
    });

    return NextResponse.json({
      success: true,
      count,
      freeLimit: 10,
      remaining: Math.max(0, 10 - count),
      willBeCharged: count >= 10,
    });

  } catch (error) {
    console.error('Error fetching Retell KB count:', error);
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}
