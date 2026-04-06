import { NextRequest, NextResponse } from 'next/server';
import { verifyJWT } from '@/lib/jwt';
import { prisma } from '@/lib/prisma';
import { cookies } from 'next/headers';

export const dynamic = 'force-dynamic';

interface RouteParams {
  params: {
    customerId: string;
  };
}

/**
 * GET /api/partner/customers/[customerId]/usage-metrics
 * Get customer's usage metrics for partner management
 */
export async function GET(
  request: NextRequest,
  { params }: RouteParams
) {
  console.log('GET /api/partner/customers/[customerId]/usage-metrics called with customerId:', params.customerId);
  try {
    // Try to get token from cookies first, then from Authorization header as fallback
    let token = cookies().get('partner_token')?.value;

    if (!token) {
      // Fallback to Authorization header
      const authHeader = request.headers.get('Authorization');
      if (authHeader && authHeader.startsWith('Bearer ')) {
        token = authHeader.split(' ')[1];
      }
    }

    if (!token) {
      console.log('No token found in cookies or Authorization header');
      return NextResponse.json({
        success: false,
        error: 'Unauthorized',
        message: 'No partner token found'
      }, { status: 401 });
    }

    console.log('Token found, verifying JWT...');

    // Verify JWT token
    const decodedToken = await verifyJWT(token);
    if (!decodedToken || !decodedToken.email) {
      return NextResponse.json({
        success: false,
        error: 'Invalid token',
        message: 'Your session has expired. Please log in again.'
      }, { status: 401 });
    }

    // Get partner using the JWT token's email
    const partner = await prisma.partner.findFirst({
      where: {
        AND: [
          { emailAddress: decodedToken.email },
          { approvalStatus: 'ACTIVE' }
        ]
      }
    });

    if (!partner) {
      return NextResponse.json({
        success: false,
        error: 'Partner not found or not active',
        message: 'Please ensure your partner account is active.'
      }, { status: 403 });
    }

    const { customerId } = params;
    console.log('Looking for customer with ID:', customerId);

    // Handle both UserOnboarding IDs (uo_*) and Customer IDs
    let customer;
    let actualCustomerId;

    if (customerId.startsWith('uo_')) {
      // This is a UserOnboarding ID, get the actual customer
      console.log('UserOnboarding ID detected, finding linked customer...');
      const userOnboarding = await prisma.userOnboarding.findFirst({
        where: {
          id: customerId,
          partnerId: partner.id,
        },
        include: {
          customer: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
            },
          },
        },
      });

      if (!userOnboarding || !userOnboarding.customer) {
        console.log('UserOnboarding record not found or no linked customer');
        return NextResponse.json(
          { success: false, error: 'Customer not found' },
          { status: 404 }
        );
      }

      customer = userOnboarding.customer;
      actualCustomerId = customer.id;
      console.log('Found linked customer:', actualCustomerId);
    } else {
      // This is a direct Customer ID
      console.log('Direct customer ID, looking up customer...');
      customer = await prisma.customer.findFirst({
        where: {
          id: customerId,
          credentials: {
            some: {
              partnerId: partner.id,
            },
          },
        },
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
        },
      });
      actualCustomerId = customerId;
    }

    if (!customer) {
      return NextResponse.json(
        { success: false, error: 'Customer not found' },
        { status: 404 }
      );
    }

    // Parse query parameters for filtering
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');
    const metricType = searchParams.get('metricType');
    const metricName = searchParams.get('metricName');
    const billingStatus = searchParams.get('billingStatus');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    // Build where clause
    const whereClause: any = {
      customerId: actualCustomerId,
      partnerId: partner.id,
    };

    if (metricType) {
      whereClause.metricType = metricType;
    }

    if (metricName) {
      whereClause.metricName = metricName;
    }

    if (billingStatus) {
      whereClause.billingStatus = billingStatus;
    }

    if (startDate || endDate) {
      whereClause.usageDate = {};
      if (startDate) {
        whereClause.usageDate.gte = new Date(startDate);
      }
      if (endDate) {
        whereClause.usageDate.lte = new Date(endDate);
      }
    }

    // Get usage metrics
    const [usageMetrics, totalCount] = await Promise.all([
      prisma.usageMetric.findMany({
        where: whereClause,
        orderBy: { usageDate: 'desc' },
        take: limit,
        skip: offset,
        select: {
          id: true,
          metricType: true,
          metricName: true,
          metricCategory: true,
          quantity: true,
          unitPrice: true,
          totalCost: true,
          usageDate: true,
          billingStatus: true,
          sourceReference: true,
          metadata: true,
          billingPeriodStart: true,
          billingPeriodEnd: true,
        },
      }),
      prisma.usageMetric.count({
        where: whereClause,
      }),
    ]);

    // Format the response
    const formattedMetrics = usageMetrics.map(metric => ({
      id: metric.id,
      metricType: metric.metricType,
      metricName: metric.metricName,
      metricCategory: metric.metricCategory,
      quantity: Number(metric.quantity),
      unitPrice: metric.unitPrice ? Number(metric.unitPrice) : null,
      totalCost: metric.totalCost ? Number(metric.totalCost) : null,
      usageDate: metric.usageDate.toISOString(),
      billingStatus: metric.billingStatus,
      sourceReference: metric.sourceReference,
      metadata: metric.metadata,
      billingPeriodStart: metric.billingPeriodStart.toISOString(),
      billingPeriodEnd: metric.billingPeriodEnd.toISOString(),
    }));

    // Calculate summary statistics
    const summary = {
      totalEvents: totalCount,
      totalQuantity: formattedMetrics.reduce((sum, m) => sum + m.quantity, 0),
      totalCost: formattedMetrics.reduce((sum, m) => sum + (m.totalCost || 0), 0),
      uniqueMetrics: new Set(formattedMetrics.map(m => m.metricName)).size,
      billingStatusBreakdown: formattedMetrics.reduce((acc, m) => {
        acc[m.billingStatus] = (acc[m.billingStatus] || 0) + 1;
        return acc;
      }, {} as Record<string, number>),
    };

    return NextResponse.json({
      success: true,
      data: {
        customer: {
          id: customer.id,
          email: customer.email,
          firstName: customer.firstName,
          lastName: customer.lastName,
        },
        metrics: formattedMetrics,
        summary,
        pagination: {
          limit,
          offset,
          total: totalCount,
          hasMore: offset + limit < totalCount,
        },
      },
    });
  } catch (error: any) {
    console.error('Error fetching customer usage metrics:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
