import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyPartnerAuth } from '@/lib/auth/partnerAuth';
import { overdueInvoiceService } from '@/lib/billing/overdueInvoiceService';
import { recurringPaymentService } from '@/lib/billing/recurringPaymentService';

export const dynamic = 'force-dynamic';

/**
 * Get comprehensive billing analytics for a partner
 */
export async function GET(request: NextRequest) {
  try {
    // Verify partner authentication
    const authResult = await verifyPartnerAuth(request);
    if (!authResult) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const partnerId = authResult.id;
    const { searchParams } = new URL(request.url);
    const period = searchParams.get('period') || '30'; // days
    const periodDays = parseInt(period);

    const now = new Date();
    const startDate = new Date(now.getTime() - (periodDays * 24 * 60 * 60 * 1000));

    // Get basic invoice statistics
    const invoiceStats = await prisma.invoice.groupBy({
      by: ['status'],
      where: {
        partnerId,
        createdAt: {
          gte: startDate,
        },
      },
      _count: {
        id: true,
      },
      _sum: {
        amount: true,
      },
    });

    // Get total revenue (paid invoices)
    const totalRevenue = await prisma.invoice.aggregate({
      where: {
        partnerId,
        status: 'paid',
        paidAt: {
          gte: startDate,
        },
      },
      _sum: {
        amount: true,
      },
      _count: {
        id: true,
      },
    });

    // Get pending revenue (sent invoices)
    const pendingRevenue = await prisma.invoice.aggregate({
      where: {
        partnerId,
        status: 'sent',
      },
      _sum: {
        amount: true,
      },
      _count: {
        id: true,
      },
    });

    // Get overdue statistics
    const overdueStats = await overdueInvoiceService.getOverdueStats(partnerId);

    // Get recurring invoice statistics
    const recurringStats = await recurringPaymentService.getRecurringStats(partnerId);

    // Get payment trends (daily revenue for the period)
    const paymentTrends = await prisma.$queryRaw`
      SELECT
        DATE(paid_at) as date,
        COUNT(*)::int as invoice_count,
        SUM(amount)::int as total_amount
      FROM invoices
      WHERE partner_id = ${partnerId}
        AND status = 'paid'
        AND paid_at >= ${startDate}
        AND paid_at <= ${now}
      GROUP BY DATE(paid_at)
      ORDER BY date ASC
    ` as Array<{
      date: Date;
      invoice_count: number;
      total_amount: number;
    }>;

    // Get customer payment behavior
    const customerStats = await prisma.$queryRaw`
      SELECT
        c.id,
        c.email,
        c.first_name,
        c.last_name,
        COUNT(i.id)::int as total_invoices,
        COUNT(CASE WHEN i.status = 'paid' THEN 1 END)::int as paid_invoices,
        COUNT(CASE WHEN i.status = 'overdue' THEN 1 END)::int as overdue_invoices,
        SUM(CASE WHEN i.status = 'paid' THEN i.amount ELSE 0 END)::int as total_paid,
        SUM(CASE WHEN i.status = 'overdue' THEN i.amount ELSE 0 END)::int as total_overdue,
        AVG(CASE WHEN i.status = 'paid' AND i.paid_at IS NOT NULL
            THEN EXTRACT(EPOCH FROM (i.paid_at - i.created_at))/86400
            ELSE NULL END)::float as avg_payment_days
      FROM customers c
      LEFT JOIN invoices i ON c.id = i.customer_id AND i.partner_id = ${partnerId}
      WHERE EXISTS (
        SELECT 1 FROM customer_credentials cc
        WHERE cc.customer_id = c.id AND cc.partner_id = ${partnerId}
      )
      GROUP BY c.id, c.email, c.first_name, c.last_name
      HAVING COUNT(i.id) > 0
      ORDER BY total_paid DESC
      LIMIT 20
    ` as Array<{
      id: string;
      email: string;
      first_name: string | null;
      last_name: string | null;
      total_invoices: number;
      paid_invoices: number;
      overdue_invoices: number;
      total_paid: number;
      total_overdue: number;
      avg_payment_days: number | null;
    }>;

    // Get invoice status distribution
    const statusDistribution = invoiceStats.reduce((acc, stat) => {
      acc[stat.status] = {
        count: stat._count.id,
        amount: stat._sum.amount || 0,
      };
      return acc;
    }, {} as Record<string, { count: number; amount: number }>);

    // Calculate key metrics
    const totalInvoices = invoiceStats.reduce((sum, stat) => sum + stat._count.id, 0);
    const totalAmount = invoiceStats.reduce((sum, stat) => sum + (stat._sum.amount || 0), 0);
    const paymentRate = totalInvoices > 0 ? (totalRevenue._count.id / totalInvoices) * 100 : 0;
    const averageInvoiceValue = totalInvoices > 0 ? totalAmount / totalInvoices : 0;

    // Format customer stats
    const formattedCustomerStats = customerStats.map(customer => ({
      id: customer.id,
      email: customer.email,
      name: `${customer.first_name || ''} ${customer.last_name || ''}`.trim() || 'Customer',
      totalInvoices: customer.total_invoices,
      paidInvoices: customer.paid_invoices,
      overdueInvoices: customer.overdue_invoices,
      totalPaid: customer.total_paid,
      totalOverdue: customer.total_overdue,
      paymentRate: customer.total_invoices > 0 ? (customer.paid_invoices / customer.total_invoices) * 100 : 0,
      avgPaymentDays: customer.avg_payment_days ? Math.round(customer.avg_payment_days * 10) / 10 : null,
    }));

    return NextResponse.json({
      success: true,
      data: {
        period: {
          days: periodDays,
          startDate,
          endDate: now,
        },
        overview: {
          totalRevenue: totalRevenue._sum.amount || 0,
          totalInvoices,
          pendingRevenue: pendingRevenue._sum.amount || 0,
          pendingInvoices: pendingRevenue._count.id,
          paymentRate: Math.round(paymentRate * 10) / 10,
          averageInvoiceValue: Math.round(averageInvoiceValue),
        },
        statusDistribution,
        overdueStats,
        recurringStats,
        paymentTrends: paymentTrends.map(trend => ({
          date: trend.date,
          invoiceCount: trend.invoice_count,
          totalAmount: trend.total_amount,
        })),
        topCustomers: formattedCustomerStats,
      },
    });
  } catch (error) {
    console.error('Error fetching billing analytics:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch billing analytics' },
      { status: 500 }
    );
  }
}
