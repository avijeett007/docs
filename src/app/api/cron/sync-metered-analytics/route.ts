/**
 * Dedicated endpoint for syncing metered analytics data
 * This can be called more frequently than the main billing process
 */

import { NextRequest, NextResponse } from 'next/server';
import { MeteredAnalyticsSyncService } from '@/lib/billing/meteredAnalyticsSync';
import { cronLogger, measurePerformance } from '@/lib/logger';
import { rateLimit } from '@/lib/rateLimit';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    // Apply rate limiting
    const rateLimitResult = rateLimit(request, {
      windowMs: 60 * 1000, // 1 minute
      maxRequests: 5,
      keyGenerator: (req) => {
        const ip = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown';
        return `sync-analytics:${ip}`;
      }
    });

    if (!rateLimitResult.success) {
      return NextResponse.json(
        { error: 'Rate limit exceeded' },
        { status: 429 }
      );
    }

    // Authentication
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;

    if (!cronSecret || !authHeader || authHeader !== `Bearer ${cronSecret}`) {
      cronLogger.warn('Unauthorized sync analytics attempt', {
        ip: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip'),
        userAgent: request.headers.get('user-agent'),
      });

      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    cronLogger.info('Starting metered analytics sync', {
      timestamp: new Date().toISOString(),
      source: 'cron'
    });

    // Sync pending metrics from analytics service
    const syncResult = await measurePerformance(
      'sync_metered_analytics',
      () => MeteredAnalyticsSyncService.syncPendingMetrics(200), // Smaller batch for frequent sync
      {}
    );

    // Get sync statistics
    const stats = await MeteredAnalyticsSyncService.getSyncStatistics();

    cronLogger.info('Metered analytics sync completed', {
      processed: syncResult.processed,
      errors: syncResult.errors,
      duplicates: syncResult.duplicates,
      pendingInAnalytics: stats.pendingInAnalytics,
      syncedToUsageMetrics: stats.syncedToUsageMetrics
    });

    return NextResponse.json({
      success: true,
      message: 'Metered analytics sync completed',
      data: {
        syncResult,
        statistics: stats,
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    cronLogger.error('Metered analytics sync failed', error as Error, {});

    return NextResponse.json(
      {
        success: false,
        error: 'Sync failed',
        message: errorMessage,
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    );
  }
}