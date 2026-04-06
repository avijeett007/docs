import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: { subdomain: string } }
) {
  try {
    const { subdomain } = params;

    if (!subdomain) {
      return NextResponse.json(
        { success: false, error: 'Subdomain is required' },
        { status: 400 }
      );
    }

    // Find partner by subdomain or custom domain
    // Fix 2: Use case-insensitive lookup for existing data compatibility
    const partner = await prisma.partner.findFirst({
      where: {
        OR: [
          { subdomain: { equals: subdomain, mode: 'insensitive' } },
          { customDomain: { equals: subdomain, mode: 'insensitive' } }
        ]
      }
    });

    if (!partner) {
      return NextResponse.json(
        { success: false, error: 'Partner not found' },
        { status: 404 }
      );
    }

    // Get active credit plans for this partner
    const creditPlans = await prisma.customerCreditPlan.findMany({
      where: {
        partnerId: partner.id,
        isActive: true,
      },
      orderBy: [
        { isPopular: 'desc' },
        { sortOrder: 'asc' },
        { createdAt: 'desc' },
      ],
      select: {
        id: true,
        name: true,
        credits: true,
        priceCents: true,
        discountPercentage: true,
        isPopular: true,
        description: true,
        sortOrder: true,
      },
    });

    return NextResponse.json({
      success: true,
      data: creditPlans,
    });

  } catch (error) {
    console.error('Error fetching customer credit plans:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
