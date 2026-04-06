import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { protectAdminRoute } from '@/lib/admin-route-protection';
import { getRewardfulService } from '@/lib/rewardful';
import { logger } from '@/lib/logger';
import { validateAffiliateUpdateRequest, AffiliateUpdateRequest } from '@/types/rewardful';

export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/partners/[id]/affiliate
 * Get affiliate information for a partner
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Verify admin authentication
    const authResult = await protectAdminRoute(request);
    if (authResult) {
      return authResult;
    }

    const partnerId = params.id;

    // Get partner with affiliate data
    const partner = await prisma.partner.findUnique({
      where: { id: partnerId },
      select: {
        id: true,
        businessName: true,
        emailAddress: true,
        contactName: true,
        rewardfulAffiliateId: true,
        rewardfulToken: true,
        affiliateStatus: true,
        affiliateCommissionRate: true,
        affiliateCommissionDuration: true,
        affiliateCommissionTier: true,
        affiliateCreatedAt: true,
        affiliateActivatedAt: true,
        affiliateLastConversionAt: true,
        affiliateTotalConversions: true,
        affiliateTotalCommissionEarned: true,
      },
    });

    if (!partner) {
      return NextResponse.json(
        { error: 'Partner not found' },
        { status: 404 }
      );
    }

    // If partner has Rewardful affiliate ID, fetch latest data from Rewardful
    let rewardfulData = null;
    if (partner.rewardfulAffiliateId) {
      try {
        const rewardfulService = getRewardfulService();
        rewardfulData = await rewardfulService.getAffiliate(partner.rewardfulAffiliateId);
      } catch (error) {
        logger.error('Error fetching Rewardful data', error as Error, {
          operation: 'admin_affiliate_get',
          partnerId,
          affiliateId: partner.rewardfulAffiliateId
        });
        // Continue without Rewardful data if API fails
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        partner: {
          id: partner.id,
          businessName: partner.businessName,
          email: partner.emailAddress,
          contactName: partner.contactName,
        },
        affiliate: {
          rewardfulId: partner.rewardfulAffiliateId,
          token: partner.rewardfulToken,
          status: partner.affiliateStatus,
          commissionRate: partner.affiliateCommissionRate,
          commissionDuration: partner.affiliateCommissionDuration,
          commissionTier: partner.affiliateCommissionTier,
          createdAt: partner.affiliateCreatedAt,
          activatedAt: partner.affiliateActivatedAt,
          lastConversionAt: partner.affiliateLastConversionAt,
          totalConversions: partner.affiliateTotalConversions,
          totalCommissionEarned: partner.affiliateTotalCommissionEarned,
        },
        rewardfulData,
      },
    });
  } catch (error) {
    console.error('Error fetching affiliate data:', error);
    return NextResponse.json(
      { error: 'Failed to fetch affiliate data' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/partners/[id]/affiliate
 * Create or update affiliate for a partner
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Verify admin authentication
    const authResult = await protectAdminRoute(request);
    if (authResult) {
      return authResult;
    }

    const partnerId = params.id;
    const body = await request.json();

    // Validate input data
    if (!validateAffiliateUpdateRequest(body)) {
      logger.warn('Invalid affiliate update request', {
        operation: 'admin_affiliate_update',
        partnerId,
        body: JSON.stringify(body)
      });
      return NextResponse.json(
        {
          error: 'Invalid request data',
          details: 'Commission rate must be 0-100%, tier must be valid, status must be valid'
        },
        { status: 400 }
      );
    }

    const {
      commissionRate,
      commissionDuration,
      commissionTier,
      status,
    } = body as AffiliateUpdateRequest;

    // Get partner details
    const partner = await prisma.partner.findUnique({
      where: { id: partnerId },
      select: {
        id: true,
        businessName: true,
        emailAddress: true,
        contactName: true,
        rewardfulAffiliateId: true,
      },
    });

    if (!partner) {
      return NextResponse.json(
        { error: 'Partner not found' },
        { status: 404 }
      );
    }

    let rewardfulAffiliate;

    try {
      const rewardfulService = getRewardfulService();

      // Create or update affiliate in Rewardful
      if (partner.rewardfulAffiliateId) {
        // Update existing affiliate
        rewardfulAffiliate = await rewardfulService.updateAffiliate(
          partner.rewardfulAffiliateId,
          {
            commission_rate: commissionRate,
            commission_duration: commissionDuration,
            status: status.toLowerCase() as 'active' | 'inactive',
          }
        );

        logger.info('Updated affiliate in Rewardful', {
          operation: 'admin_affiliate_update',
          partnerId,
          affiliateId: partner.rewardfulAffiliateId,
          commissionRate,
          status
        });
      } else {
        // Create new affiliate
        rewardfulAffiliate = await rewardfulService.createAffiliate({
          email: partner.emailAddress,
          first_name: partner.contactName?.split(' ')[0],
          last_name: partner.contactName?.split(' ').slice(1).join(' '),
          company: partner.businessName,
          commission_rate: commissionRate,
          commission_duration: commissionDuration,
          status: status.toLowerCase() as 'active' | 'inactive',
          metadata: {
            partnerId: partner.id,
            tier: commissionTier,
          },
        });

        logger.info('Created new affiliate in Rewardful', {
          operation: 'admin_affiliate_update',
          partnerId,
          affiliateId: rewardfulAffiliate.id,
          commissionRate,
          status
        });
      }
    } catch (rewardfulError) {
      logger.error('Failed to sync with Rewardful', rewardfulError as Error, {
        operation: 'admin_affiliate_update',
        partnerId,
        affiliateId: partner.rewardfulAffiliateId
      });

      return NextResponse.json(
        { error: 'Failed to sync with Rewardful service' },
        { status: 502 }
      );
    }

    // Update partner record with affiliate data
    const updatedPartner = await prisma.partner.update({
      where: { id: partnerId },
      data: {
        rewardfulAffiliateId: rewardfulAffiliate.id,
        rewardfulToken: rewardfulAffiliate.token,
        affiliateStatus: status as any,
        affiliateCommissionRate: commissionRate,
        affiliateCommissionDuration: commissionDuration,
        affiliateCommissionTier: commissionTier,
        affiliateCreatedAt: partner.rewardfulAffiliateId ? undefined : new Date(),
        affiliateActivatedAt: status === 'ACTIVE' ? new Date() : undefined,
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        rewardfulAffiliate,
        updatedPartner,
      },
    });
  } catch (error) {
    console.error('Error creating/updating affiliate:', error);
    return NextResponse.json(
      { error: 'Failed to create/update affiliate' },
      { status: 500 }
    );
  }
}
