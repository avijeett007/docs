import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
// import { z } from 'zod';
import { verifyAdminAuth } from '@/lib/adminAuth';

/**
 * GET /api/admin/n8n-workflow-deployments/stats
 * Get deployment statistics for admin dashboard
 */
export async function GET(request: NextRequest) {
  try {
    // Verify admin authentication
    const user = await verifyAdminAuth(request);
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized - Admin access required' },
        { status: 401 }
      );
    }
    const { searchParams } = new URL(request.url);
    
    // Parse date range parameters
    const dateFromParam = searchParams.get('dateFrom');
    const dateToParam = searchParams.get('dateTo');
    const partnerId = searchParams.get('partnerId');
    
    let dateFrom: Date | undefined;
    let dateTo: Date | undefined;
    
    if (dateFromParam) {
      dateFrom = new Date(dateFromParam);
      if (isNaN(dateFrom.getTime())) {
        return NextResponse.json(
          { success: false, error: 'Invalid dateFrom parameter' },
          { status: 400 }
        );
      }
    }
    
    if (dateToParam) {
      dateTo = new Date(dateToParam);
      if (isNaN(dateTo.getTime())) {
        return NextResponse.json(
          { success: false, error: 'Invalid dateTo parameter' },
          { status: 400 }
        );
      }
    }

    // Build where clause for date filtering
    const whereClause: any = {};
    if (dateFrom || dateTo) {
      whereClause.createdAt = {};
      if (dateFrom) whereClause.createdAt.gte = dateFrom;
      if (dateTo) whereClause.createdAt.lte = dateTo;
    }
    if (partnerId) {
      whereClause.partnerId = partnerId;
    }

    // Get total deployment counts by status
    const deploymentsByStatus = await prisma.n8nWorkflowDeployment.groupBy({
      by: ['status'],
      where: whereClause,
      _count: {
        id: true,
      },
    });

    // Get deployment counts by product
    const deploymentsByProduct = await prisma.n8nWorkflowDeployment.groupBy({
      by: ['productId'],
      where: whereClause,
      _count: {
        id: true,
      },
      orderBy: {
        _count: {
          id: 'desc',
        },
      },
      take: 10, // Top 10 products
    });

    // Get product details for the top products
    const productIds = deploymentsByProduct.map(d => d.productId);
    const products = await prisma.n8nWorkflowProduct.findMany({
      where: { id: { in: productIds } },
      select: { id: true, name: true, category: true },
    });

    // Combine product data with deployment counts
    const deploymentsByProductWithDetails = deploymentsByProduct.map(deployment => {
      const product = products.find(p => p.id === deployment.productId);
      return {
        productId: deployment.productId,
        productName: product?.name || 'Unknown Product',
        productCategory: product?.category || 'unknown',
        deploymentCount: deployment._count.id,
      };
    });

    // Get deployment counts by partner
    const deploymentsByPartner = await prisma.n8nWorkflowDeployment.groupBy({
      by: ['partnerId'],
      where: whereClause,
      _count: {
        id: true,
      },
      orderBy: {
        _count: {
          id: 'desc',
        },
      },
      take: 10, // Top 10 partners
    });

    // Get partner details
    const partnerIds = deploymentsByPartner.map(d => d.partnerId);
    const partners = await prisma.partner.findMany({
      where: { id: { in: partnerIds } },
      select: { id: true, businessName: true },
    });

    // Combine partner data with deployment counts
    const deploymentsByPartnerWithDetails = deploymentsByPartner.map(deployment => {
      const partner = partners.find(p => p.id === deployment.partnerId);
      return {
        partnerId: deployment.partnerId,
        partnerName: partner?.businessName || 'Unknown Partner',
        deploymentCount: deployment._count.id,
      };
    });

    // Get recent deployments
    const recentDeployments = await prisma.n8nWorkflowDeployment.findMany({
      where: whereClause,
      orderBy: { createdAt: 'desc' },
      take: 20,
      include: {
        product: {
          select: { id: true, name: true, category: true },
        },
        partner: {
          select: { id: true, businessName: true },
        },
        customer: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
      },
    });

    // Calculate success rate and average deployment time
    const completedDeployments = await prisma.n8nWorkflowDeployment.findMany({
      where: {
        ...whereClause,
        status: 'completed',
        startedAt: { not: null },
        completedAt: { not: null },
      },
      select: {
        startedAt: true,
        completedAt: true,
      },
    });

    const totalDeployments = deploymentsByStatus.reduce((sum, status) => sum + status._count.id, 0);
    const successfulDeployments = deploymentsByStatus.find(s => s.status === 'completed')?._count.id || 0;
    const failedDeployments = deploymentsByStatus.find(s => s.status === 'failed')?._count.id || 0;
    const pendingDeployments = deploymentsByStatus.find(s => s.status === 'pending')?._count.id || 0;
    const inProgressDeployments = deploymentsByStatus.find(s => s.status === 'in_progress')?._count.id || 0;

    const successRate = totalDeployments > 0 ? (successfulDeployments / totalDeployments) * 100 : 0;

    // Calculate average deployment time
    const deploymentTimes = completedDeployments
      .filter(d => d.startedAt && d.completedAt)
      .map(d => {
        const started = new Date(d.startedAt!).getTime();
        const completed = new Date(d.completedAt!).getTime();
        return completed - started;
      });

    const averageDeploymentTime = deploymentTimes.length > 0
      ? deploymentTimes.reduce((sum, time) => sum + time, 0) / deploymentTimes.length
      : 0;

    // Get deployment trends (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const deploymentTrends = await prisma.n8nWorkflowDeployment.groupBy({
      by: ['status'],
      where: {
        ...whereClause,
        createdAt: { gte: thirtyDaysAgo },
      },
      _count: {
        id: true,
      },
    });

    // Format status counts
    const statusCounts = deploymentsByStatus.reduce((acc, status) => {
      acc[status.status] = status._count.id;
      return acc;
    }, {} as Record<string, number>);

    return NextResponse.json({
      success: true,
      data: {
        totalDeployments,
        successfulDeployments,
        failedDeployments,
        pendingDeployments,
        inProgressDeployments,
        successRate: Math.round(successRate * 100) / 100,
        averageDeploymentTime: Math.round(averageDeploymentTime / 1000), // Convert to seconds
        deploymentsByStatus: statusCounts,
        deploymentsByProduct: deploymentsByProductWithDetails,
        deploymentsByPartner: deploymentsByPartnerWithDetails,
        recentDeployments: recentDeployments.map(deployment => ({
          id: deployment.id,
          status: deployment.status,
          createdAt: deployment.createdAt,
          startedAt: deployment.startedAt,
          completedAt: deployment.completedAt,
          product: deployment.product,
          partner: deployment.partner,
          customer: deployment.customer,
          deploymentMode: deployment.deploymentMode,
          errorMessage: deployment.errorMessage,
        })),
        trends: {
          last30Days: deploymentTrends.reduce((acc, trend) => {
            acc[trend.status] = trend._count.id;
            return acc;
          }, {} as Record<string, number>),
        },
      },
    });
  } catch (error) {
    console.error('Error fetching deployment statistics:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch deployment statistics',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
