import { NextResponse } from 'next/server';
import { prisma, withAutoRecovery, getPrismaConnectionMetrics } from '@/lib/prisma';
import { signJWT } from '@/lib/jwt';

export const dynamic = 'force-dynamic';

// SECURITY: Only allow in development/staging environments
function isTestingAllowed(): boolean {
  const env = process.env.NODE_ENV;
  const allowTesting = process.env.ALLOW_CONNECTION_TESTING === 'true';
  return env === 'development' || allowTesting;
}

function getUnauthorizedResponse() {
  return NextResponse.json({
    success: false,
    error: 'Connection testing endpoints are disabled in production for security',
    environment: process.env.NODE_ENV,
  }, { status: 403 });
}

async function getTestPartnerId(): Promise<string | null> {
  const partnerEmail = process.env.TEST_PARTNER_EMAIL;

  if (partnerEmail) {
    // Look up partner by email
    const partner = await prisma.partner.findUnique({
      where: { emailAddress: partnerEmail },
      select: { id: true }
    });
    if (partner) return partner.id;
  }

  // Fallback: find first active partner
  const testPartner = await prisma.partner.findFirst({
    where: { approvalStatus: 'ACTIVE' },
    select: { id: true }
  });
  return testPartner?.id || null;
}

/**
 * GET - Dashboard Stress Test - Simulates real dashboard API load
 */
export async function GET() {
  if (!isTestingAllowed()) {
    return getUnauthorizedResponse();
  }

  const startTime = Date.now();
  const results: Array<{ name: string; success: boolean; duration: number; error?: string; rowCount?: number }> = [];

  try {
    const partnerId = await getTestPartnerId();
    if (!partnerId) {
      return NextResponse.json({ success: false, error: 'No active partner found. Set TEST_PARTNER_EMAIL in environment.' }, { status: 400 });
    }

    console.log(`🧪 [Dashboard Stress Test] Using partner: ${partnerId}`);
    const token = await signJWT({ partnerId, email: 'stress-test@test.com' });
    console.log(`🔑 [Dashboard Stress Test] Token created: ${token.substring(0, 20)}...`);

    // Use CustomerCredential to find customers for a partner (Customer model doesn't have partnerId directly)
    const dashboardQueries = [
      { name: 'customer_credentials_count', query: () => prisma.customerCredential.count({ where: { partnerId } }) },
      { name: 'customer_credentials_list', query: () => prisma.customerCredential.findMany({ where: { partnerId }, take: 10, select: { id: true, email: true, status: true } }) },
      { name: 'agents_retell', query: () => prisma.retellAgent.count({ where: { partnerId } }) },
      { name: 'agents_vapi', query: () => prisma.vapiAgent.count({ where: { partnerId } }) },
      { name: 'phone_numbers', query: () => prisma.phoneNumber.count({ where: { partnerId } }) },
      { name: 'partner_profile', query: () => prisma.partner.findUnique({ where: { id: partnerId }, select: { id: true, businessName: true, creditBalance: true } }) },
      { name: 'team_members', query: () => prisma.partnerTeamMember.count({ where: { partnerId } }) },
      { name: 'recent_credentials', query: () => prisma.customerCredential.findMany({ where: { partnerId }, orderBy: { createdAt: 'desc' }, take: 5, select: { id: true, createdAt: true } }) },
    ];

    console.log(`📊 [Dashboard Stress Test] Running ${dashboardQueries.length} concurrent queries...`);

    const queryPromises = dashboardQueries.map(async (q) => {
      const queryStart = Date.now();
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const result = await withAutoRecovery(() => q.query() as Promise<any>, q.name);
        return { name: q.name, success: true, duration: Date.now() - queryStart, rowCount: Array.isArray(result) ? result.length : (typeof result === 'number' ? result : 1) };
      } catch (error) {
        return { name: q.name, success: false, duration: Date.now() - queryStart, error: error instanceof Error ? error.message : 'Unknown error' };
      }
    });

    const queryResults = await Promise.all(queryPromises);
    results.push(...queryResults);

    const totalDuration = Date.now() - startTime;
    const successCount = results.filter(r => r.success).length;
    const failureCount = results.filter(r => !r.success).length;
    const avgDuration = results.reduce((sum, r) => sum + r.duration, 0) / results.length;
    const metrics = getPrismaConnectionMetrics();

    console.log(`✅ [Dashboard Stress Test] Completed: ${successCount}/${results.length} queries succeeded`);

    return NextResponse.json({
      success: failureCount === 0,
      summary: { totalQueries: results.length, successCount, failureCount, totalDuration: `${totalDuration}ms`, avgQueryDuration: `${Math.round(avgDuration)}ms`, partnerId },
      results,
      connectionMetrics: metrics,
      timestamp: new Date().toISOString(),
    }, { status: failureCount === 0 ? 200 : 500 });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('❌ [Dashboard Stress Test] Failed:', errorMessage);
    return NextResponse.json({ success: false, error: errorMessage, results, duration: `${Date.now() - startTime}ms`, timestamp: new Date().toISOString() }, { status: 500 });
  }
}

/**
 * POST - Run multiple rounds of stress tests
 * Body: { rounds?: number, delayMs?: number }
 */
export async function POST(request: Request) {
  if (!isTestingAllowed()) {
    return getUnauthorizedResponse();
  }

  const startTime = Date.now();

  try {
    const body = await request.json().catch(() => ({}));
    const rounds = Math.min(body.rounds || 5, 20);
    const delayMs = Math.min(body.delayMs || 100, 1000);

    const partnerId = await getTestPartnerId();
    if (!partnerId) {
      return NextResponse.json({ success: false, error: 'No active partner found. Set TEST_PARTNER_EMAIL in environment.' }, { status: 400 });
    }

    console.log(`🧪 [Multi-Round Stress Test] Starting ${rounds} rounds with ${delayMs}ms delay...`);

    const roundResults: Array<{ round: number; success: boolean; duration: number; queryCount: number; failureCount: number }> = [];

    for (let round = 1; round <= rounds; round++) {
      const roundStart = Date.now();
      // Use CustomerCredential since Customer doesn't have partnerId directly
      const queries = [
        prisma.customerCredential.count({ where: { partnerId } }),
        prisma.retellAgent.count({ where: { partnerId } }),
        prisma.vapiAgent.count({ where: { partnerId } }),
        prisma.phoneNumber.count({ where: { partnerId } }),
        prisma.partner.findUnique({ where: { id: partnerId }, select: { id: true } }),
        prisma.partnerTeamMember.count({ where: { partnerId } }),
        prisma.customerCredential.findMany({ where: { partnerId }, take: 5, select: { id: true } }),
        prisma.$queryRaw`SELECT 1`,
      ];

      const results = await Promise.allSettled(queries);
      const failures = results.filter(r => r.status === 'rejected').length;
      roundResults.push({ round, success: failures === 0, duration: Date.now() - roundStart, queryCount: queries.length, failureCount: failures });

      if (round < rounds && delayMs > 0) {
        await new Promise(resolve => setTimeout(resolve, delayMs));
      }
    }

    const totalDuration = Date.now() - startTime;
    const successfulRounds = roundResults.filter(r => r.success).length;
    const totalQueries = roundResults.reduce((sum, r) => sum + r.queryCount, 0);
    const totalFailures = roundResults.reduce((sum, r) => sum + r.failureCount, 0);
    const avgRoundDuration = roundResults.reduce((sum, r) => sum + r.duration, 0) / rounds;
    const metrics = getPrismaConnectionMetrics();

    console.log(`✅ [Multi-Round Stress Test] Completed: ${successfulRounds}/${rounds} rounds succeeded`);

    return NextResponse.json({
      success: totalFailures === 0,
      summary: { rounds, successfulRounds, totalQueries, totalFailures, totalDuration: `${totalDuration}ms`, avgRoundDuration: `${Math.round(avgRoundDuration)}ms`, queriesPerSecond: Math.round(totalQueries / (totalDuration / 1000)) },
      roundResults,
      connectionMetrics: metrics,
      timestamp: new Date().toISOString(),
    }, { status: totalFailures === 0 ? 200 : 500 });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('❌ [Multi-Round Stress Test] Failed:', errorMessage);
    return NextResponse.json({ success: false, error: errorMessage, duration: `${Date.now() - startTime}ms`, timestamp: new Date().toISOString() }, { status: 500 });
  }
}

