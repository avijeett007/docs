import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { protectAdminRoute } from '@/lib/admin-route-protection';

export const dynamic = 'force-dynamic'; // Required because this route uses request.headers

export async function GET(request: NextRequest) {
  try {
    // Verify admin authentication using secure MFA enforcement
    const authResult = await protectAdminRoute(request);
    if (authResult) {
      return authResult; // Return the authentication error response
    }

    // Fetch partners with customer count and affiliate data
    const partners = await prisma.partner.findMany({
      select: {
        id: true,
        businessName: true,
        emailAddress: true,
        createdAt: true,
        // status field doesn't exist in the model, we'll handle it in the mapping
        // profitMultiplier field doesn't exist in the model, we'll handle it in the mapping
        logo: true,
        manualSaasModeEnabled: true,
        planId: true,
        portalMode: true,
        subdomain: true,
        customDomain: true,
        // Affiliate fields
        rewardfulAffiliateId: true,
        affiliateStatus: true,
        affiliateCommissionRate: true,
        affiliateCommissionTier: true,
        affiliateTotalConversions: true,
        affiliateTotalCommissionEarned: true,
        // Committed Partner fields
        isCommittedPartner: true,
        committedMonthlyAmount: true,
        committedStartDate: true,
        committedEndDate: true,
        _count: {
          select: {
            customers: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    // Format the response
    const formattedPartners = partners.map((partner: any) => ({
      id: partner.id,
      businessName: partner.businessName,
      email: partner.emailAddress,
      createdAt: partner.createdAt.toISOString(),
      status: partner.status || 'active',
      customersCount: partner._count.customers,
      profitMultiplier: partner.profitMultiplier || 1.0,
      logo: partner.logo || undefined,
      manualSaasModeEnabled: partner.manualSaasModeEnabled || false,
      planId: partner.planId || null,
      portalMode: partner.portalMode || null,
      subdomain: partner.subdomain || null,
      customDomain: partner.customDomain || null,
      // Affiliate data
      affiliate: {
        rewardfulId: partner.rewardfulAffiliateId,
        status: partner.affiliateStatus,
        commissionRate: partner.affiliateCommissionRate,
        commissionTier: partner.affiliateCommissionTier,
        totalConversions: partner.affiliateTotalConversions,
        totalCommissionEarned: partner.affiliateTotalCommissionEarned,
        isAffiliate: !!partner.rewardfulAffiliateId,
      },
      // Committed Partner data
      committedPartner: {
        isCommitted: partner.isCommittedPartner || false,
        monthlyAmount: partner.committedMonthlyAmount ? Number(partner.committedMonthlyAmount) : null,
        startDate: partner.committedStartDate?.toISOString() || null,
        endDate: partner.committedEndDate?.toISOString() || null,
      },
    }));

    return NextResponse.json(formattedPartners);
  } catch (error) {
    console.error('Error fetching partners:', error);
    return NextResponse.json(
      { error: 'Failed to fetch partners' },
      { status: 500 }
    );
  }
}
