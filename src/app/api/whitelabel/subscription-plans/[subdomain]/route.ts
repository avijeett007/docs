import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(
  request: NextRequest,
  { params }: { params: { subdomain: string } }
) {
  try {
    const { subdomain } = params;

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
        { error: 'Partner not found' },
        { status: 404 }
      );
    }

    // Fetch subscription plans for this partner
    const subscriptionPlans = await prisma.subscriptionPlan.findMany({
      where: {
        partnerId: partner.id,
        isActive: true
      },
      orderBy: {
        amount: 'asc'
      }
    });

    return NextResponse.json(subscriptionPlans);
  } catch (error) {
    console.error('Error fetching subscription plans:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
