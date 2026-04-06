import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyPartnerAuth } from '@/lib/auth/partnerAuth';
import { 
  ReportLogsResponse,
  ReportLogEntry,
  ReportPeriod,
  ReportData
} from '@/types/customerReport';

export const dynamic = 'force-dynamic';

/**
 * GET /api/partner/customers/[customerId]/report-logs
 * Fetch recent report logs for a customer
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { customerId: string } }
) {
  try {
    // Verify partner authentication
    const partner = await verifyPartnerAuth(request);
    if (!partner) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Look up UserOnboarding to get the actual Customer.id
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

    // Verify this customer belongs to the authenticated partner
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

    // Fetch report logs (last 20)
    const logs = await prisma.customerReportLog.findMany({
      where: {
        customerId: userOnboarding.customerId,
        partnerId: partner.id
      },
      orderBy: {
        sentAt: 'desc'
      },
      take: 20
    });

    // Transform to response format
    const logEntries: ReportLogEntry[] = logs.map(log => ({
      id: log.id,
      reportType: log.reportType as 'instant' | 'scheduled',
      period: log.period as ReportPeriod,
      reportData: log.reportData as unknown as ReportData,
      sentAt: log.sentAt.toISOString(),
      emailStatus: log.emailStatus as 'sent' | 'failed'
    }));

    const response: ReportLogsResponse = {
      logs: logEntries,
      total: logEntries.length
    };

    return NextResponse.json(response);

  } catch (error) {
    console.error('Error fetching report logs:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
