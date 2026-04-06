import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

/**
 * @deprecated This debug endpoint and its associated ReferralDebugger component are not used
 * in the application UI and are scheduled for removal.
 * TODO: Delete this route and src/components/debug/ReferralDebugger.tsx in a future cleanup sprint.
 *
 * DEBUG ENDPOINT - Remove before production
 * GET /api/debug/referral
 *
 * Provides debugging information about the referral system
 * @route GET /api/debug/referral?action={overview|affiliates|conversions|partner}
 */
export async function GET(request: NextRequest) {
  // Only allow in development
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Debug endpoint not available in production' }, { status: 404 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action') || 'overview';

    switch (action) {
      case 'overview':
        return await getOverview();
      case 'affiliates':
        return await getAffiliates();
      case 'conversions':
        return await getConversions();
      case 'partner':
        const partnerId = searchParams.get('partnerId');
        if (!partnerId) {
          return NextResponse.json({ error: 'partnerId required' }, { status: 400 });
        }
        return await getPartnerDetails(partnerId);
      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }
  } catch (error: any) {
    console.error('Debug referral error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

async function getOverview() {
  const stats = await prisma.$transaction([
    // Total affiliates
    prisma.partner.count({
      where: { rewardfulAffiliateId: { not: null } }
    }),
    // Active affiliates
    prisma.partner.count({
      where: { 
        rewardfulAffiliateId: { not: null },
        affiliateStatus: 'ACTIVE'
      }
    }),
    // Total conversions
    prisma.affiliateConversion.count(),
    // Conversions with amount > 0 (indicating payment)
    prisma.affiliateConversion.count({
      where: { amount: { gt: 0 } }
    }),
  ]);

  return NextResponse.json({
    success: true,
    data: {
      totalAffiliates: stats[0],
      activeAffiliates: stats[1],
      totalConversions: stats[2],
      paidConversions: stats[3],
      timestamp: new Date().toISOString(),
    }
  });
}

async function getAffiliates() {
  const affiliates = await prisma.partner.findMany({
    where: { rewardfulAffiliateId: { not: null } },
    select: {
      id: true,
      businessName: true,
      emailAddress: true,
      rewardfulAffiliateId: true,
      affiliateStatus: true,
      affiliateCommissionRate: true,
      affiliateCommissionTier: true,
      affiliateTotalConversions: true,
      affiliateTotalCommissionEarned: true,
      affiliateCreatedAt: true,
      affiliateActivatedAt: true,
    },
    orderBy: { affiliateCreatedAt: 'desc' }
  });

  return NextResponse.json({
    success: true,
    data: affiliates
  });
}

async function getConversions() {
  const conversions = await prisma.affiliateConversion.findMany({
    select: {
      id: true,
      referralId: true,
      stripeCustomerId: true,
      amount: true,
      currency: true,
      orderId: true,
      isRecurring: true,
      metadata: true,
      createdAt: true,
    },
    orderBy: { createdAt: 'desc' },
    take: 50 // Limit to recent 50
  });

  return NextResponse.json({
    success: true,
    data: conversions
  });
}

async function getPartnerDetails(partnerId: string) {
  const partner = await prisma.partner.findUnique({
    where: { id: partnerId },
    select: {
      id: true,
      businessName: true,
      emailAddress: true,
      rewardfulAffiliateId: true,
      affiliateStatus: true,
      affiliateCommissionRate: true,
      affiliateCommissionTier: true,
      affiliateTotalConversions: true,
      affiliateTotalCommissionEarned: true,
      affiliateCreatedAt: true,
      affiliateActivatedAt: true,
    }
  });

  if (!partner) {
    return NextResponse.json({ error: 'Partner not found' }, { status: 404 });
  }

  return NextResponse.json({
    success: true,
    data: {
      partner: {
        id: partner.id,
        businessName: partner.businessName,
        emailAddress: partner.emailAddress,
        isAffiliate: !!partner.rewardfulAffiliateId,
        affiliateData: partner.rewardfulAffiliateId ? {
          rewardfulId: partner.rewardfulAffiliateId,
          status: partner.affiliateStatus,
          commissionRate: partner.affiliateCommissionRate,
          commissionTier: partner.affiliateCommissionTier,
          totalConversions: partner.affiliateTotalConversions,
          totalCommissionEarned: partner.affiliateTotalCommissionEarned,
          createdAt: partner.affiliateCreatedAt,
          activatedAt: partner.affiliateActivatedAt,
        } : null,
      },
    }
  });
}

/**
 * POST /api/debug/referral
 * Create test data for debugging
 */
export async function POST(request: NextRequest) {
  // Only allow in development
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Debug endpoint not available in production' }, { status: 404 });
  }

  try {
    const body = await request.json();
    const { action } = body;

    switch (action) {
      case 'create_test_affiliate':
        return await createTestAffiliate(body);
      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }
  } catch (error: any) {
    console.error('Debug referral POST error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

async function createTestAffiliate(data: any) {
  const testPartner = await prisma.partner.create({
    data: {
      businessName: data.businessName || 'Test Affiliate Business',
      emailAddress: data.email || `test-affiliate-${Date.now()}@example.com`,
      contactName: data.contactName || 'Test Contact',
      businessAddress: '123 Test Street, Test City, TC 12345',
      phoneNumber: '+1-555-0123',
      areaOfBusiness: 'Technology',
      expertise: 'AI Voice Agents',
      partnershipType: 'Agency',
      partnerCode: `TEST_${Date.now()}`,
      rewardfulAffiliateId: `test_affiliate_${Date.now()}`,
      affiliateStatus: 'ACTIVE',
      affiliateCommissionRate: 10,
      affiliateCommissionTier: 'public',
      affiliateCreatedAt: new Date(),
      affiliateActivatedAt: new Date(),
    }
  });

  return NextResponse.json({
    success: true,
    data: {
      id: testPartner.id,
      businessName: testPartner.businessName,
      emailAddress: testPartner.emailAddress,
      rewardfulAffiliateId: testPartner.rewardfulAffiliateId,
      affiliateStatus: testPartner.affiliateStatus,
    }
  });
}


