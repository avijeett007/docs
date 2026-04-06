import { NextRequest, NextResponse } from 'next/server';
import { verifyCustomerAuth } from '@/lib/auth/customerAuth';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

/**
 * GET /api/whitelabel/credits/balance
 * Get customer's current credit balance and related information
 */
export async function GET(request: NextRequest) {
  try {
    // Verify customer authentication
    const customerAuth = await verifyCustomerAuth(request);

    if (!customerAuth) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const customerId = customerAuth.customerId;
    const partnerId = customerAuth.partnerId;

    // Get customer credit information (includes decimal balance for fractional credits)
    const customer = await prisma.customer.findUnique({
      where: { id: customerId },
      select: {
        id: true,
        creditBalance: true,
        creditBalanceDecimal: true,
        monthlyCreditAllocation: true,
        lastCreditAllocationDate: true,
        lowCreditThreshold: true,
        lowCreditNotificationsEnabled: true,
        totalCreditsAllocated: true,
        totalCreditsUsed: true,
        creditRolloverEnabled: true,
        aiCreditsEnabled: true,
      },
    });

    if (!customer) {
      return NextResponse.json(
        { success: false, error: 'Customer not found' },
        { status: 404 }
      );
    }

    // Total balance = integer credits + fractional part from AI Gateway
    // creditBalance: managed by all existing routes (Voice AI, Stripe, manual, cron)
    // creditBalanceDecimal: managed only by AI Gateway for sub-integer precision
    const preciseBalance = (customer.creditBalance ?? 0) + Number(customer.creditBalanceDecimal ?? 0);

    // Check for low credit alert using the precise balance
    const lowCreditAlert = customer.lowCreditThreshold &&
      preciseBalance <= customer.lowCreditThreshold;

    // Get recent credit transactions (last 5)
    // Filter to customer-facing transactions only — exclude partner-internal records
    // that happen to carry a customerId (e.g. ai_gateway_webhook, ai_gateway_sync)
    const recentTransactions = await prisma.creditTransaction.findMany({
      where: {
        customerId: customerId,
        partnerId: partnerId,
        // Exclude partner-internal AI Gateway sources that carry a customerId
        NOT: {
          OR: [
            { metadata: { path: ['source'], equals: 'ai_gateway_webhook' } },
            { metadata: { path: ['source'], equals: 'ai_gateway_sync' } },
            { metadata: { path: ['source'], equals: 'ai_gateway_auto_topup' } },
            { metadata: { path: ['source'], equals: 'webhook_auto_topup' } },
          ],
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: 5,
      select: {
        id: true,
        type: true,
        amount: true,
        amountDecimal: true,
        balanceAfter: true,
        balanceAfterDecimal: true,
        description: true,
        createdAt: true,
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        customerId: customer.id,
        creditBalance: preciseBalance, // Send the precise decimal value
        monthlyCreditAllocation: customer.monthlyCreditAllocation,
        lastCreditAllocationDate: customer.lastCreditAllocationDate,
        lowCreditThreshold: customer.lowCreditThreshold,
        lowCreditNotificationsEnabled: customer.lowCreditNotificationsEnabled,
        totalCreditsAllocated: customer.totalCreditsAllocated,
        totalCreditsUsed: customer.totalCreditsUsed,
        creditRolloverEnabled: customer.creditRolloverEnabled,
        aiCreditsEnabled: customer.aiCreditsEnabled,
        lowCreditAlert,
        recentTransactions: recentTransactions.map(tx => ({
          id: tx.id,
          type: tx.type,
          amount: Number(tx.amountDecimal ?? tx.amount), // Prefer decimal
          balanceAfter: Number(tx.balanceAfterDecimal ?? tx.balanceAfter), // Prefer decimal
          description: tx.description,
          createdAt: tx.createdAt.toISOString(),
        })),
      },
    });

  } catch (error) {
    console.error('Error getting customer credit balance:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
