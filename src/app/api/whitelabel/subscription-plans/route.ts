import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

/**
 * Get public subscription plans for a partner's whitelabel landing page
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const subdomain = searchParams.get('subdomain');
    const customDomain = searchParams.get('customDomain');

    if (!subdomain && !customDomain) {
      return NextResponse.json(
        { success: false, error: 'Subdomain or custom domain required' },
        { status: 400 }
      );
    }

    // Find partner by subdomain or custom domain
    // Fix 2: Use case-insensitive lookup for existing data compatibility
    let partner;
    if (customDomain) {
      partner = await prisma.partner.findFirst({
        where: {
          customDomain: { equals: customDomain, mode: 'insensitive' },
          customDomainVerified: true,
        },
      });
    } else if (subdomain) {
      partner = await prisma.partner.findFirst({
        where: { subdomain: { equals: subdomain, mode: 'insensitive' } },
      });
    }

    if (!partner) {
      return NextResponse.json(
        { success: false, error: 'Partner not found' },
        { status: 404 }
      );
    }

    // Get active subscription plans that should be shown on landing page
    const plans = await prisma.subscriptionPlan.findMany({
      where: {
        partnerId: partner.id,
        isActive: true,
        showOnLandingPage: true,
      },
      select: {
        id: true,
        name: true,
        description: true,
        amount: true,
        currency: true,
        interval: true,
        intervalCount: true,
        trialPeriodDays: true,
        features: true,
        createdAt: true,
      },
      orderBy: [
        { amount: 'asc' }, // Order by price, lowest first
        { createdAt: 'asc' },
      ],
    });

    return NextResponse.json({
      success: true,
      data: {
        partner: {
          id: partner.id,
          businessName: partner.businessName,
          logo: partner.logo,
          primaryColor: partner.primaryColor,
          secondaryColor: partner.secondaryColor,
          portalTitle: partner.portalTitle,
          portalSlogan: partner.portalSlogan,
        },
        plans,
      },
    });
  } catch (error) {
    console.error('Error fetching public subscription plans:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch subscription plans' },
      { status: 500 }
    );
  }
}
