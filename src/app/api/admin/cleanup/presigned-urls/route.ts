import { NextRequest, NextResponse } from 'next/server';
import PresignedUrlService from '@/lib/services/presignedUrlService';

export const dynamic = 'force-dynamic';

/**
 * POST /api/admin/cleanup/presigned-urls
 * Clean up expired presigned URLs (for cron job)
 */
export async function POST(request: NextRequest) {
  try {
    // Verify admin/cron authorization
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET || 'default-cron-secret';
    
    if (!authHeader || authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Clean up expired URLs
    const deletedCount = await PresignedUrlService.cleanupExpiredUrls();

    return NextResponse.json({
      success: true,
      message: `Cleaned up ${deletedCount} expired presigned URLs`,
      deletedCount,
      timestamp: new Date().toISOString(),
    });

  } catch (error) {
    console.error('Error cleaning up presigned URLs:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/admin/cleanup/presigned-urls
 * Get statistics about presigned URLs (for monitoring)
 */
export async function GET(request: NextRequest) {
  try {
    // Verify admin authorization
    const authHeader = request.headers.get('authorization');
    const adminSecret = process.env.ADMIN_SECRET || 'default-admin-secret';
    
    if (!authHeader || authHeader !== `Bearer ${adminSecret}`) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { prisma } = await import('@/lib/db');

    // Get statistics
    const stats = await prisma.presignedUrl.groupBy({
      by: ['isActive'],
      _count: {
        id: true,
      },
    });

    const expiredCount = await prisma.presignedUrl.count({
      where: {
        expiresAt: {
          lt: new Date(),
        },
      },
    });

    const recentCount = await prisma.presignedUrl.count({
      where: {
        createdAt: {
          gte: new Date(Date.now() - 24 * 60 * 60 * 1000), // Last 24 hours
        },
      },
    });

    const activeStats = stats.find(s => s.isActive === true)?._count.id || 0;
    const inactiveStats = stats.find(s => s.isActive === false)?._count.id || 0;

    return NextResponse.json({
      success: true,
      data: {
        total: activeStats + inactiveStats,
        active: activeStats,
        inactive: inactiveStats,
        expired: expiredCount,
        recentlyCreated: recentCount,
        timestamp: new Date().toISOString(),
      },
    });

  } catch (error) {
    console.error('Error getting presigned URL statistics:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      },
      { status: 500 }
    );
  }
}
