import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(
  request: NextRequest,
  { params }: { params: { partnerId: string } }
) {
  try {
    const { partnerId } = params;

    if (!partnerId) {
      return NextResponse.json(
        { error: 'Partner ID is required' },
        { status: 400 }
      );
    }

    // Get partner with business lookup settings
    const partner = await prisma.partner.findUnique({
      where: { id: partnerId },
      select: {
        id: true,
        businessName: true,
        // @ts-ignore - Business lookup fields
        businessLookupEnabled: true,
        businessLookupDailyLimit: true,
        businessLookupMonthlyBudgetUsd: true,
      }
    });

    if (!partner) {
      return NextResponse.json(
        { error: 'Partner not found' },
        { status: 404 }
      );
    }

    // Return business lookup settings
    return NextResponse.json({
      success: true,
      businessLookupEnabled: (partner as any).businessLookupEnabled || false,
      businessLookupDailyLimit: (partner as any).businessLookupDailyLimit || 1000,
      businessLookupMonthlyBudgetUsd: (partner as any).businessLookupMonthlyBudgetUsd || 100,
    });

  } catch (error) {
    console.error('Error fetching partner settings:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
