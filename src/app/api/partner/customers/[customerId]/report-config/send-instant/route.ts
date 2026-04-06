import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyPartnerAuth } from '@/lib/auth/partnerAuth';
import { sendReportEmail } from '@/lib/services/reportEmailService';
import { 
  SendInstantReportRequest,
  ReportPeriod,
  ReportData,
  AgentReportData,
  ReportMetric
} from '@/types/customerReport';

export const dynamic = 'force-dynamic';

/**
 * Type guard to validate ReportPeriod
 */
function isValidPeriod(value: unknown): value is ReportPeriod {
  return typeof value === 'string' && ['day', 'week'].includes(value);
}

/**
 * Calculate date range based on period
 */
function calculateDateRange(period: ReportPeriod): { startDate: Date; endDate: Date } {
  const now = new Date();
  const endDate = new Date(now);
  const startDate = new Date(now);
  
  if (period === 'day') {
    // Last 24 hours
    startDate.setDate(now.getDate() - 1);
  } else {
    // Last 7 days
    startDate.setDate(now.getDate() - 7);
  }
  
  return { startDate, endDate };
}

/**
 * POST /api/partner/customers/[customerId]/report-config/send-instant
 * Send an instant report for a customer
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { customerId: string } }
) {
  try {
    // Step 1: Verify partner authentication
    const partner = await verifyPartnerAuth(request);
    if (!partner) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Step 2: Look up UserOnboarding to get the actual Customer.id
    const userOnboarding = await prisma.userOnboarding.findUnique({
      where: { id: params.customerId },
      select: { 
        customerId: true,
        partnerId: true 
      }
    });

    if (!userOnboarding) {
      return NextResponse.json(
        { error: 'Customer not found' },
        { status: 404 }
      );
    }

    if (userOnboarding.partnerId !== partner.id) {
      return NextResponse.json(
        { error: 'Forbidden' },
        { status: 403 }
      );
    }

    if (!userOnboarding.customerId) {
      return NextResponse.json(
        { error: 'Customer record not linked' },
        { status: 400 }
      );
    }

    // Step 3: Parse and validate request body
    const body = await request.json();
    
    if (!isValidPeriod(body.period)) {
      return NextResponse.json(
        { error: 'Invalid period. Must be one of: day, week' },
        { status: 400 }
      );
    }

    const requestData: SendInstantReportRequest = {
      period: body.period
    };

    // Step 4: Resolve the Customer record
    const customer = await prisma.customer.findUnique({
      where: { id: userOnboarding.customerId },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true
      }
    });

    if (!customer || !customer.email) {
      return NextResponse.json(
        { error: 'Customer email not found' },
        { status: 400 }
      );
    }

    // Step 5: Calculate date range
    const { startDate, endDate } = calculateDateRange(requestData.period);
    const startDateStr = startDate.toISOString().split('T')[0];
    const endDateStr = endDate.toISOString().split('T')[0];

    // Step 6: Analytics service URL/key required for per-agent conversations endpoint
    const analyticsUrl = process.env.ANALYTICS_API_URL;
    const analyticsApiKey = process.env.ANALYTICS_STANDARD_API_KEY;

    if (!analyticsUrl || !analyticsApiKey) {
      return NextResponse.json(
        { error: 'Analytics service not configured' },
        { status: 500 }
      );
    }

    // Step 7: Fetch customer agents from database for agent breakdown
    // Query all typed agent models (VapiAgent, RetellAgent, etc.) instead of legacy Agent model
    // Note: Defensive checks added because Prisma client may not be regenerated yet
    const [vapiAgents, retellAgents, knovaAgents, ghlAgents, ultravoxAgents, elevenLabsAgents, n8nChatAgents, retellChatAgents, byoAgents] = await Promise.all([
      prisma.vapiAgent?.findMany({ where: { customerId: customer.id }, select: { id: true, name: true } }) ?? [],
      prisma.retellAgent?.findMany({ where: { customerId: customer.id }, select: { id: true, name: true } }) ?? [],
      prisma.knovaAgent?.findMany({ where: { customerId: customer.id }, select: { id: true, name: true } }) ?? [],
      prisma.ghlAgent?.findMany({ where: { customerId: customer.id }, select: { id: true, name: true } }) ?? [],
      prisma.ultravoxAgent?.findMany({ where: { customerId: customer.id }, select: { id: true, name: true } }) ?? [],
      prisma.elevenLabsAgent?.findMany({ where: { customerId: customer.id }, select: { id: true, name: true } }) ?? [],
      prisma.n8nChatAgent?.findMany({ where: { customerId: customer.id }, select: { id: true, name: true } }) ?? [],
      prisma.retellChatAgent?.findMany({ where: { customerId: customer.id }, select: { id: true, name: true } }) ?? [],
      prisma.byoAgent?.findMany({ where: { customerId: customer.id }, select: { id: true, name: true } }) ?? [],
    ]);

    // Combine all agents into a single array with provider info
    const customerAgents = [
      ...vapiAgents.map(a => ({ id: a.id, name: a.name, provider: 'vapi' as const })),
      ...retellAgents.map(a => ({ id: a.id, name: a.name, provider: 'retell' as const })),
      ...knovaAgents.map(a => ({ id: a.id, name: a.name, provider: 'knova' as const })),
      ...ghlAgents.map(a => ({ id: a.id, name: a.name, provider: 'ghl' as const })),
      ...ultravoxAgents.map(a => ({ id: a.id, name: a.name, provider: 'ultravox' as const })),
      ...elevenLabsAgents.map(a => ({ id: a.id, name: a.name, provider: 'elevenlabs' as const })),
      ...n8nChatAgents.map(a => ({ id: a.id, name: a.name, provider: 'n8n_chat' as const })),
      ...retellChatAgents.map(a => ({ id: a.id, name: a.name, provider: 'retell_chat' as const })),
      ...byoAgents.map(a => ({ id: a.id, name: a.name, provider: 'byo' as const })),
    ];

    // Step 8: Fetch per-agent data via conversations API (same approach as customer dashboard)
    // The conversations endpoint (/api/v1/app/agent/{id}/conversations) queries webhook_events + calls
    // tables which have actual data, unlike the analytics endpoint which queries empty tables.
    let agents: AgentReportData[] = [];

    if (customerAgents.length > 0) {
      // Convert report period to conversations API format
      // NOTE: conversations API is independent from the customer-level analytics API.
      // Always fetch per-agent conversations regardless of analyticsAvailable flag.
      const convPeriod = requestData.period === 'day' ? '1d' : '7d';

      const perAgentResults = await Promise.allSettled(
        customerAgents.map(async (agent) => {
          try {
            const convResponse = await fetch(
              `${analyticsUrl}/api/v1/app/agent/${agent.id}/conversations?period=${convPeriod}&limit=100`,
              {
                headers: { 'x-api-key': analyticsApiKey },
                signal: AbortSignal.timeout(10000)
              }
            );
            if (!convResponse.ok) {
              console.warn(`[Report] Conversations fetch failed for ${agent.name} (${agent.id}): HTTP ${convResponse.status}`);
              return null;
            }
            const convData = await convResponse.json();
            return convData.data || convData.conversations || [];
          } catch (error) {
            console.warn(`[Report] Conversations fetch error for ${agent.name} (${agent.id}):`, error);
            return null;
          }
        })
      );

      // Build AgentReportData from actual conversation records
      agents = customerAgents.map((agent, index) => {
        const result = perAgentResults[index];
        const conversations: any[] = (result.status === 'fulfilled' && result.value) ? result.value : [];

        const totalCalls = conversations.length;
        let totalDuration = 0;
        let completedCalls = 0;
        let failedCalls = 0;

        for (const conv of conversations) {
          // Duration: prefer explicit duration field, fall back to timestamp diff
          if (conv.duration && conv.duration > 0) {
            totalDuration += conv.duration;
          } else if (conv.duration_seconds && conv.duration_seconds > 0) {
            totalDuration += conv.duration_seconds;
          } else if (conv.startedAt && conv.endedAt) {
            const diffMs = new Date(conv.endedAt).getTime() - new Date(conv.startedAt).getTime();
            if (diffMs > 0) totalDuration += Math.round(diffMs / 1000);
          }

          // Status tracking
          const status = (conv.status || '').toLowerCase();
          if (status === 'completed' || status === 'ended' || status === 'success') {
            completedCalls++;
          } else if (status === 'failed' || status === 'error') {
            failedCalls++;
          } else {
            completedCalls++; // Default to completed for unknown statuses
          }
        }

        const avgDuration = totalCalls > 0 ? totalDuration / totalCalls : 0;
        const successRate = totalCalls > 0 ? (completedCalls / totalCalls) * 100 : 0;
        const failureRate = totalCalls > 0 ? (failedCalls / totalCalls) * 100 : 0;

        return {
          agentName: agent.name || `Agent ${index + 1}`,
          provider: agent.provider || 'unknown',
          totalCalls,
          totalDuration,
          avgDuration,
          successRate,
          failureRate
        };
      });

      const fetchedCount = perAgentResults.filter(r => r.status === 'fulfilled' && r.value !== null).length;
      console.log(`[Report] Per-agent conversations: ${fetchedCount}/${customerAgents.length} agents fetched`);
    }
    // No 'All Agents' fallback — if no agents found, the table will be empty.
    // This matches the scheduled report behavior.

    // Calculate totals purely from per-agent data — no fallback to customer-level analytics.
    // This ensures the Total row matches the sum of what each agent row shows.
    const agentTotalCalls = agents.reduce((sum, a) => sum + a.totalCalls, 0);
    const agentTotalDuration = agents.reduce((sum, a) => sum + a.totalDuration, 0);
    const totals = {
      totalCalls: agentTotalCalls,
      totalDuration: agentTotalDuration,
      avgDuration: agentTotalCalls > 0 ? agentTotalDuration / agentTotalCalls : 0,
      successRate: agentTotalCalls > 0
        ? agents.reduce((sum, a) => sum + a.successRate * a.totalCalls, 0) / agentTotalCalls
        : 0,
      failureRate: agentTotalCalls > 0
        ? agents.reduce((sum, a) => sum + a.failureRate * a.totalCalls, 0) / agentTotalCalls
        : 0
    };

    const customerName = `${customer.firstName || ''} ${customer.lastName || ''}`.trim() || customer.email;

    const reportData: ReportData = {
      customerName,
      customerEmail: customer.email,
      partnerBusinessName: partner.businessName || 'Knotie AI Pro',
      period: {
        startDate: startDateStr,
        endDate: endDateStr
      },
      frequency: 'instant',
      agents,
      totals,
      generatedAt: new Date().toISOString()
    };

    // Step 9: Look up included metrics from CustomerReportConfig
    const config = await prisma.customerReportConfig.findUnique({
      where: {
        customerId_partnerId: {
          customerId: customer.id,
          partnerId: partner.id
        }
      }
    });

    const includedMetrics: ReportMetric[] = config?.includedMetrics as ReportMetric[] || [
      'agentName', 
      'totalCalls', 
      'totalDuration', 
      'avgDuration', 
      'successRate', 
      'failureRate'
    ];

    // Step 10: Send email
    const emailResult = await sendReportEmail({
      partnerId: partner.id,
      customerId: customer.id,
      customerEmail: customer.email,
      reportData,
      includedMetrics
    });

    // Step 11: Save CustomerReportLog entry
    const reportLog = await prisma.customerReportLog.create({
      data: {
        customerId: customer.id,
        partnerId: partner.id,
        reportType: 'instant',
        period: requestData.period,
        reportData: reportData as any, // JSON field
        emailStatus: emailResult.success ? 'sent' : 'failed',
        errorMessage: emailResult.error || null
      }
    });

    // Step 12: Update lastSentAt on CustomerReportConfig (if exists)
    if (config) {
      await prisma.customerReportConfig.update({
        where: { id: config.id },
        data: { lastSentAt: new Date() }
      });
    }

    // Return response
    if (!emailResult.success) {
      return NextResponse.json(
        { 
          success: false, 
          error: emailResult.error || 'Failed to send email',
          reportId: reportLog.id
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      reportId: reportLog.id,
      message: 'Report sent successfully'
    });

  } catch (error) {
    console.error('Error sending instant report:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
