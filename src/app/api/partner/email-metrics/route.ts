import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getPartnerFromToken } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    // Get the authenticated partner
    const partner = await getPartnerFromToken(request);
    if (!partner) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get date range for filtering (default to last 30 days)
    const url = new URL(request.url);
    const daysParam = url.searchParams.get('days');
    const days = daysParam ? parseInt(daysParam) : 30;
    
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    // Get email statistics for this partner
    const emailStats = await prisma.emailLog.groupBy({
      by: ['status'],
      where: {
        partnerId: partner.id,
        sentAt: {
          gte: startDate,
        },
      },
      _count: {
        id: true,
      },
    });

    // Get email type breakdown
    const emailTypeStats = await prisma.emailLog.groupBy({
      by: ['emailType'],
      where: {
        partnerId: partner.id,
        sentAt: {
          gte: startDate,
        },
      },
      _count: {
        id: true,
      },
    });

    // Calculate totals
    const totalEmails = emailStats.reduce((sum, stat) => sum + stat._count.id, 0);
    const successfulEmails = emailStats.find(stat => stat.status === 'sent')?._count.id || 0;
    const failedEmails = emailStats.find(stat => stat.status === 'failed')?._count.id || 0;

    // Calculate success rate
    const successRate = totalEmails > 0 ? Math.round((successfulEmails / totalEmails) * 100) : 0;

    // Get recent email activity (last 7 days by day)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const dailyStats = await prisma.$queryRaw<Array<{ date: string; count: number }>>`
      SELECT 
        DATE(sent_at) as date,
        COUNT(*)::int as count
      FROM email_logs 
      WHERE partner_id = ${partner.id}
        AND sent_at >= ${sevenDaysAgo}
        AND status = 'sent'
      GROUP BY DATE(sent_at)
      ORDER BY date DESC
    `;

    // Format email type stats for better readability
    const emailTypeBreakdown = emailTypeStats.map(stat => ({
      type: stat.emailType,
      count: stat._count.id,
      label: formatEmailTypeLabel(stat.emailType),
    }));

    return NextResponse.json({
      success: true,
      data: {
        totalEmails,
        successfulEmails,
        failedEmails,
        successRate,
        emailTypeBreakdown,
        dailyStats,
        period: `Last ${days} days`,
      },
    });
  } catch (error) {
    console.error('Error fetching email metrics:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// Helper function to format email type labels
function formatEmailTypeLabel(emailType: string): string {
  const labels: Record<string, string> = {
    'customer_portal_invite': 'Portal Invitations',
    'customer_team_invite': 'Team Invitations',
    'welcome_email': 'Welcome Emails',
    'customer_password_reset': 'Password Resets',
    'magic_link_login': 'Magic Link Logins',
    'magic_link_password_reset': 'Magic Link Password Resets',
    'low_credit_notification': 'Customer Low Credit Notifications',
    'partner_low_credit_notification': 'Partner Low Credit Notifications',
    'unknown': 'Other',
  };

  return labels[emailType] || emailType;
}
