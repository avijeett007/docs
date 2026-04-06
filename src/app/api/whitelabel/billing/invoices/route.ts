import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyCustomerAuth } from '@/lib/auth/customerAuth';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    // Verify customer authentication
    const authResult = await verifyCustomerAuth(request);
    if (!authResult) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { customerId, partnerId } = authResult;

    // Get invoices for this customer (exclude draft invoices)
    const invoices = await prisma.invoice.findMany({
      where: {
        customerId: customerId,
        partnerId: partnerId,
        status: {
          not: 'draft', // Customers should not see draft invoices
        },
      },
      include: {
        partner: {
          select: {
            businessName: true,
            emailAddress: true,
          },
        },
        customer: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            businessName: true,
          },
        },
        payments: {
          select: {
            id: true,
            amount: true,
            status: true,
            paidAt: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    // Format invoices for frontend
    const formattedInvoices = invoices.map(invoice => ({
      id: invoice.id,
      invoiceNumber: invoice.invoiceNumber,
      title: invoice.title,
      description: invoice.description,
      amount: invoice.amount,
      currency: invoice.currency,
      status: invoice.status,
      type: invoice.type,
      recurringInterval: invoice.recurringInterval,
      recurringCount: invoice.recurringCount,
      nextPaymentDate: invoice.nextPaymentDate,
      hostedInvoiceUrl: invoice.hostedInvoiceUrl,
      dueDate: invoice.dueDate,
      paidAt: invoice.paidAt,
      createdAt: invoice.createdAt,
      updatedAt: invoice.updatedAt,
      partner: {
        businessName: invoice.partner.businessName,
        email: invoice.partner.emailAddress,
      },
      customer: {
        id: invoice.customer.id,
        firstName: invoice.customer.firstName,
        lastName: invoice.customer.lastName,
        email: invoice.customer.email,
        companyName: invoice.customer.businessName,
        displayName: invoice.customer.businessName ||
          (invoice.customer.firstName && invoice.customer.lastName
            ? `${invoice.customer.firstName} ${invoice.customer.lastName}`.trim()
            : invoice.customer.email),
      },
      payments: invoice.payments,
      totalPaid: invoice.payments
        .filter(payment => payment.status === 'succeeded')
        .reduce((sum, payment) => sum + payment.amount, 0),
    }));

    return NextResponse.json({
      success: true,
      data: {
        invoices: formattedInvoices,
        summary: {
          totalInvoices: formattedInvoices.length,
          totalAmount: formattedInvoices.reduce((sum, inv) => sum + inv.amount, 0),
          paidAmount: formattedInvoices
            .filter(inv => inv.status === 'paid')
            .reduce((sum, inv) => sum + inv.amount, 0),
          pendingAmount: formattedInvoices
            .filter(inv => inv.status === 'sent' || inv.status === 'overdue')
            .reduce((sum, inv) => sum + inv.amount, 0),
          overdueCount: formattedInvoices.filter(inv => inv.status === 'overdue').length,
        },
      },
    });
  } catch (error) {
    console.error('Error fetching customer invoices:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch invoices' },
      { status: 500 }
    );
  }
}
