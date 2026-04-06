import { NextRequest, NextResponse } from 'next/server';
import { BillingMonitoringService } from '@/lib/billing/monitoring';
import { BillingQueueService } from '@/lib/billing/queueSystem';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

/**
 * GET /api/health/billing
 * Health check endpoint for billing system
 */
export async function GET(request: NextRequest) {
  try {
    const startTime = Date.now();

    // Check if partner ID is provided for partner-specific health check
    const url = new URL(request.url);
    const partnerId = url.searchParams.get('partnerId');

    // Get overall health check
    const healthCheck = await BillingMonitoringService.getHealthCheck(partnerId || undefined);

    // Get queue statistics
    const queueStats = await BillingQueueService.getQueueStats();

    // Check database connectivity
    let databaseHealth = 'healthy';
    let databaseResponseTime = 0;
    try {
      const dbStartTime = Date.now();
      await prisma.$queryRaw`SELECT 1`;
      databaseResponseTime = Date.now() - dbStartTime;
      
      if (databaseResponseTime > 1000) {
        databaseHealth = 'slow';
      }
    } catch (error) {
      databaseHealth = 'unhealthy';
      console.error('Database health check failed:', error);
    }

    // Check critical thresholds
    const criticalIssues = [];
    
    if (healthCheck.metrics.errorRate > 10) {
      criticalIssues.push('High error rate detected');
    }
    
    if (healthCheck.metrics.failedPayments > 20) {
      criticalIssues.push('Critical number of failed payments');
    }
    
    if (queueStats.failed > queueStats.completed * 0.1) {
      criticalIssues.push('High queue failure rate');
    }
    
    if (databaseHealth === 'unhealthy') {
      criticalIssues.push('Database connectivity issues');
    }

    // Determine overall status
    let overallStatus = 'healthy';
    if (criticalIssues.length > 0 || healthCheck.status === 'critical') {
      overallStatus = 'critical';
    } else if (healthCheck.status === 'warning' || databaseHealth === 'slow') {
      overallStatus = 'warning';
    }

    const responseTime = Date.now() - startTime;

    const response = {
      status: overallStatus,
      timestamp: new Date().toISOString(),
      responseTime,
      version: '1.0.0',
      environment: process.env.NODE_ENV || 'development',
      partnerId: partnerId || 'global',
      
      // Core metrics
      metrics: healthCheck.metrics,
      
      // System health
      system: {
        database: {
          status: databaseHealth,
          responseTime: databaseResponseTime,
        },
        queue: {
          status: queueStats.failed > queueStats.completed * 0.2 ? 'unhealthy' : 'healthy',
          stats: queueStats,
        },
      },
      
      // Active alerts
      alerts: healthCheck.alerts,
      
      // Critical issues
      criticalIssues,
      
      // Additional details
      details: {
        activeSubscriptions: healthCheck.metrics.activeSubscriptions,
        pendingInvoices: healthCheck.metrics.pendingInvoices,
        queueBacklog: queueStats.pending + queueStats.processing,
        lastProcessedAt: new Date().toISOString(),
      },
    };

    // Set appropriate HTTP status code
    let httpStatus = 200;
    if (overallStatus === 'critical') {
      httpStatus = 503; // Service Unavailable
    } else if (overallStatus === 'warning') {
      httpStatus = 200; // OK but with warnings
    }

    return NextResponse.json(response, { 
      status: httpStatus,
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
      },
    });

  } catch (error) {
    console.error('Health check failed:', error);
    
    return NextResponse.json({
      status: 'critical',
      timestamp: new Date().toISOString(),
      error: 'Health check failed',
      details: {
        message: error instanceof Error ? error.message : 'Unknown error',
      },
    }, { 
      status: 503,
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
      },
    });
  }
}

/**
 * POST /api/health/billing
 * Trigger manual health check and alert processing
 */
export async function POST(request: NextRequest) {
  try {
    // This endpoint could be used by monitoring systems to trigger manual checks
    const body = await request.json();
    const { action, partnerId } = body;

    let result: any = {};

    switch (action) {
      case 'check_alerts':
        const alerts = await BillingMonitoringService.checkAlerts(partnerId);
        if (alerts.length > 0) {
          await BillingMonitoringService.sendAlertNotifications(alerts);
        }
        result = { alertsGenerated: alerts.length };
        break;

      case 'process_queue':
        const queueResults = await BillingQueueService.processJobs();
        result = queueResults;
        break;

      case 'cleanup_queue':
        const cleanedJobs = await BillingQueueService.cleanupOldJobs();
        result = { cleanedJobs };
        break;

      default:
        return NextResponse.json({
          success: false,
          error: 'Invalid action',
          availableActions: ['check_alerts', 'process_queue', 'cleanup_queue'],
        }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      action,
      result,
      timestamp: new Date().toISOString(),
    });

  } catch (error) {
    console.error('Manual health check action failed:', error);
    
    return NextResponse.json({
      success: false,
      error: 'Action failed',
      details: {
        message: error instanceof Error ? error.message : 'Unknown error',
      },
    }, { status: 500 });
  }
}
