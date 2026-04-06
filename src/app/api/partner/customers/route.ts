import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { cookies } from 'next/headers';
import type { NextRequest } from 'next/server';
import { verifyJWT } from '@/lib/jwt';
import { checkMCPAuthIfPresent, PERMISSIONS } from '@/lib/auth/mcpAuthHelper';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

if (!process.env.JWT_SECRET) {
  throw new Error('Missing JWT_SECRET environment variable');
}

export async function GET(request: NextRequest) {
  try {
    // Get pagination and filter parameters from URL
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 100);
    const skip = (page - 1) * limit;
    const search = searchParams.get('search') || '';
    const filterMonthlyCallVolume = searchParams.get('monthlyCallVolume') || '';
    const filterCallComplexity = searchParams.get('callComplexity') || '';
    const filterDeploymentTimeline = searchParams.get('deploymentTimeline') || '';

    // Check for MCP authentication first
    const mcpAuth = await checkMCPAuthIfPresent(request, PERMISSIONS.CUSTOMER_READ);

    // Handle MCP authentication errors
    if (mcpAuth.isMCP && mcpAuth.error) {
      return NextResponse.json({
        error: 'MCP Authentication Failed',
        message: mcpAuth.error
      }, { status: 401 });
    }

    let partner;

    if (mcpAuth.isMCP && !mcpAuth.error) {
      // Handle MCP request - find partner by ID
      partner = await prisma.partner.findFirst({
        where: {
          AND: [
            { id: mcpAuth.partnerId },
            { approvalStatus: 'ACTIVE' }
          ]
        }
      });

      if (!partner) {
        return NextResponse.json({
          error: 'Partner not found or not active',
          message: 'MCP partner account not found or not active.'
        }, { status: 403 });
      }
    } else {
      // Handle regular JWT request - try Authorization header first, then cookies
      let token = null;
      const authHeader = request.headers.get('Authorization');

      if (authHeader && authHeader.startsWith('Bearer ')) {
        token = authHeader.split(' ')[1];
      } else {
        // Fallback to cookie-based authentication
        token = cookies().get('partner_token')?.value;
      }

      if (!token) {
        return NextResponse.json({
          error: 'Unauthorized',
          message: 'No partner token found'
        }, { status: 401 });
      }

      // Verify JWT token
      const decodedToken = await verifyJWT(token);
      if (!decodedToken || !decodedToken.email) {
        return NextResponse.json({
          error: 'Invalid token',
          message: 'Your session has expired. Please log in again.'
        }, { status: 401 });
      }

      // Get partner using the JWT token's email
      partner = await prisma.partner.findFirst({
        where: {
          AND: [
            { emailAddress: decodedToken.email },
            { approvalStatus: 'ACTIVE' }
          ]
        }
      });

      if (!partner) {
        return NextResponse.json({
          error: 'Partner not found or not active',
          message: 'Please ensure your partner account is active.'
        }, { status: 403 });
      }
    } // End of MCP/JWT authentication block

    // Build where clause with search and filters using AND array to avoid OR conflicts
    const andConditions: any[] = [{ partnerId: partner.id }];

    // Add search filter (case-insensitive, searches name, company, phone, email)
    if (search) {
      andConditions.push({
        OR: [
          { firstName: { contains: search, mode: 'insensitive' } },
          { lastName: { contains: search, mode: 'insensitive' } },
          { companyName: { contains: search, mode: 'insensitive' } },
          { businessPhone: { contains: search, mode: 'insensitive' } },
          { email: { contains: search, mode: 'insensitive' } },
        ]
      });
    }

    // Helper: add a filter condition. "__none__" matches null or empty string.
    const addFilter = (field: string, value: string) => {
      if (!value) return;
      if (value === '__none__') {
        andConditions.push({
          OR: [
            { [field]: null },
            { [field]: '' },
          ]
        });
      } else {
        andConditions.push({
          [field]: { contains: value, mode: 'insensitive' }
        });
      }
    };

    addFilter('monthlyCallVolume', filterMonthlyCallVolume);
    addFilter('callComplexity', filterCallComplexity);
    addFilter('deploymentTimeline', filterDeploymentTimeline);

    const whereClause: any = { AND: andConditions };

    // Get total count for pagination
    const totalCount = await prisma.userOnboarding.count({
      where: whereClause
    });

    // Get paginated customers for this partner with portal status
    const customers = await prisma.userOnboarding.findMany({
      where: whereClause,
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        monthlyCallVolume: true,
        primaryUseCase: true,
        callComplexity: true,
        crmSystem: true,
        phoneSystem: true,
        deploymentTimeline: true,
        businessPhone: true,
        estimatedPrice: true,
        priceBreakdown: true,
        orderStatus: true,
        companyName: true,
        userId: true,
        isOnboardingCompleted: true,
        customerId: true,
        customerPortalEnabled: true,
        createdAt: true,
        updatedAt: true
      },
      orderBy: {
        createdAt: 'desc'
      },
      skip,
      take: limit
    });

    // Collect all customerIds for batch queries (avoid N+1)
    const customerIds = customers
      .map(c => c.customerId)
      .filter((id): id is string => !!id);

    // Run all enrichment queries in parallel as batch operations
    let subscriptionCounts: Record<string, number> = {};
    let unbilledAmounts: Record<string, number> = {};
    let customerRecords: Record<string, { deploymentStatus: string | null }> = {};
    let completedProspects: Set<string> = new Set();
    let knovaAgentCounts: Record<string, number> = {};
    let retellAgentCounts: Record<string, number> = {};
    let subscriptionStatuses: Record<string, { status: string; trialEnd: Date | null; isOnTrial: boolean }> = {};
    let credentialStatuses: Record<string, string> = {};

    if (customerIds.length > 0) {
      try {
        const [
          subscriptionGroups,
          unbilledGroups,
          customerDeployments,
          prospects,
          knovaAgentGroups,
          retellAgentGroups,
          customerSubscriptions,
          customerCredentials
        ] = await Promise.all([
          // Batch: subscription counts grouped by customerId
          prisma.customerMeteredSubscription.groupBy({
            by: ['customerId'],
            where: {
              customerId: { in: customerIds },
              partnerId: partner.id,
              status: 'active',
            },
            _count: { id: true },
          }),
          // Batch: unbilled amounts grouped by customerId
          prisma.usageMetric.groupBy({
            by: ['customerId'],
            where: {
              customerId: { in: customerIds },
              partnerId: partner.id,
              billingStatus: 'pending',
            },
            _sum: { totalCost: true },
          }),
          // Batch: deployment statuses
          prisma.customer.findMany({
            where: { id: { in: customerIds } },
            select: { id: true, deploymentStatus: true },
          }),
          // Batch: completed prospects
          prisma.prospect.findMany({
            where: {
              convertedToCustomerId: { in: customerIds },
              isCompleted: true,
            },
            select: { convertedToCustomerId: true },
          }),
          // Batch: Knova agent counts grouped by customerId
          prisma.knovaAgent.groupBy({
            by: ['customerId'],
            where: {
              customerId: { in: customerIds },
              isActive: true,
            },
            _count: { id: true },
          }),
          // Batch: Retell agent counts grouped by customerId
          prisma.retellAgent.groupBy({
            by: ['customerId'],
            where: {
              customerId: { in: customerIds },
              isActive: true,
            },
            _count: { id: true },
          }),
          // Batch: Customer subscription statuses for trial badges
          prisma.customerSubscription.findMany({
            where: {
              customerId: { in: customerIds },
              partnerId: partner.id,
            },
            select: {
              customerId: true,
              status: true,
              trialEnd: true,
            },
            orderBy: { createdAt: 'desc' },
            distinct: ['customerId'],
          }),
          // Batch: Customer credential statuses for blocked badges
          prisma.customerCredential.findMany({
            where: {
              customerId: { in: customerIds },
              partnerId: partner.id,
            },
            select: {
              customerId: true,
              status: true,
            },
          }),
        ]);

        // Index results by customerId for O(1) lookup
        for (const g of subscriptionGroups) {
          if (g.customerId) {
            subscriptionCounts[g.customerId] = g._count.id;
          }
        }
        for (const g of unbilledGroups) {
          if (g.customerId) {
            unbilledAmounts[g.customerId] = Number(g._sum.totalCost || 0) / 100;
          }
        }
        for (const c of customerDeployments) {
          customerRecords[c.id] = { deploymentStatus: c.deploymentStatus };
        }
        for (const p of prospects) {
          if (p.convertedToCustomerId) completedProspects.add(p.convertedToCustomerId);
        }
        for (const g of knovaAgentGroups) {
          if (g.customerId) {
            knovaAgentCounts[g.customerId] = g._count.id;
          }
        }
        for (const g of retellAgentGroups) {
          if (g.customerId) {
            retellAgentCounts[g.customerId] = g._count.id;
          }
        }
        for (const sub of customerSubscriptions) {
          if (sub.customerId) {
            const now = new Date();
            const isOnTrial = sub.status === 'trialing' && sub.trialEnd !== null && new Date(sub.trialEnd) > now;
            subscriptionStatuses[sub.customerId] = {
              status: sub.status,
              trialEnd: sub.trialEnd,
              isOnTrial,
            };
          }
        }
        for (const cred of customerCredentials) {
          if (cred.customerId) {
            credentialStatuses[cred.customerId] = cred.status;
          }
        }

        // Fix stale deployment statuses: reset 'completed'/'agent_ready' to 'not_started' if no active agents
        const staleCustomerIds = customerIds.filter(id => {
          const rec = customerRecords[id];
          const hasKnova = knovaAgentCounts[id] > 0;
          const hasRetell = retellAgentCounts[id] > 0;
          const hasAnyAgent = hasKnova || hasRetell;
          return (rec?.deploymentStatus === 'completed' || rec?.deploymentStatus === 'agent_ready') && !hasAnyAgent;
        });
        if (staleCustomerIds.length > 0) {
          await prisma.customer.updateMany({
            where: { id: { in: staleCustomerIds } },
            data: { deploymentStatus: 'not_started' },
          });
          for (const id of staleCustomerIds) {
            customerRecords[id] = { deploymentStatus: 'not_started' };
          }
        }
      } catch (error) {
        logger.error('Error fetching batch billing data', error as Error, {
          operation: 'fetch_customers',
          partnerId: partner.id,
        });
      }
    }

    // Merge enrichment data with customer records
    const customersWithBilling = customers.map((customer) => {
      if (!customer.customerId) {
        return {
          ...customer,
          subscriptions: 0,
          unbilledAmount: 0,
          deploymentStatus: null,
          hasCompletedProspect: false,
          hasKnovaAgent: false,
          hasRetellAgent: false,
        };
      }

      const cid = customer.customerId;
      const subStatus = subscriptionStatuses[cid];
      return {
        ...customer,
        subscriptions: subscriptionCounts[cid] || 0,
        unbilledAmount: unbilledAmounts[cid] || 0,
        deploymentStatus: customerRecords[cid]?.deploymentStatus || null,
        hasCompletedProspect: completedProspects.has(cid),
        hasKnovaAgent: (knovaAgentCounts[cid] || 0) > 0,
        hasRetellAgent: (retellAgentCounts[cid] || 0) > 0,
        isOnTrial: subStatus?.isOnTrial || false,
        subscriptionStatus: subStatus?.status || null,
        trialEnd: subStatus?.trialEnd || null,
        credentialStatus: credentialStatuses[cid] || null,
      };
    });

    // Calculate pagination info
    const totalPages = Math.ceil(totalCount / limit);
    const hasNextPage = page < totalPages;
    const hasPrevPage = page > 1;

    return NextResponse.json({
      success: true,
      data: customersWithBilling,
      pagination: {
        currentPage: page,
        totalPages,
        totalCount,
        limit,
        hasNextPage,
        hasPrevPage
      }
    });

  } catch (error) {
    logger.error('Error in customers route', error as Error, {
      operation: 'fetch_customers'
    });
    return NextResponse.json({
      error: 'Failed to fetch customers',
      message: 'An error occurred while fetching customers. Please try again.'
    }, { status: 500 });
  }
}