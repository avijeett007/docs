import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { protectAdminRoute } from '@/lib/admin-route-protection';
import { DomainCacheInvalidationService } from '@/lib/domain-cache-invalidation';

export const dynamic = 'force-dynamic';

/**
 * POST /api/admin/partners/[id]/invalidate-cache
 * Invalidate domain cache for a partner's subdomain and custom domain
 * Requires admin authentication
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Verify admin authentication
    const authResult = await protectAdminRoute(request);
    if (authResult) {
      return authResult; // Return the authentication error response
    }

    const partnerId = params.id;

    // Fetch partner's domain information
    const partner = await prisma.partner.findUnique({
      where: { id: partnerId },
      select: {
        id: true,
        businessName: true,
        subdomain: true,
        customDomain: true,
      },
    });

    if (!partner) {
      return NextResponse.json(
        { error: 'Partner not found' },
        { status: 404 }
      );
    }

    const domains: string[] = [];
    const invalidationResults: { domain: string; success: boolean }[] = [];

    // Collect domains to invalidate
    if (partner.subdomain) {
      domains.push(partner.subdomain);
    }
    if (partner.customDomain) {
      domains.push(partner.customDomain);
    }

    if (domains.length === 0) {
      return NextResponse.json(
        { 
          error: 'No domains configured',
          message: 'Partner has no subdomain or custom domain to invalidate'
        },
        { status: 400 }
      );
    }

    // Invalidate cache for each domain
    for (const domain of domains) {
      try {
        await DomainCacheInvalidationService.invalidateDomain(domain);
        invalidationResults.push({ domain, success: true });
      } catch (error) {
        console.error(`Failed to invalidate cache for domain ${domain}:`, error);
        invalidationResults.push({ domain, success: false });
      }
    }

    const allSuccessful = invalidationResults.every(r => r.success);

    return NextResponse.json({
      success: allSuccessful,
      partnerId: partner.id,
      partnerName: partner.businessName,
      domains: invalidationResults,
      message: allSuccessful 
        ? `Cache invalidated successfully for ${domains.join(', ')}`
        : 'Some cache invalidations failed',
    });

  } catch (error) {
    console.error('Error invalidating partner cache:', error);
    return NextResponse.json(
      { error: 'Failed to invalidate cache' },
      { status: 500 }
    );
  }
}

