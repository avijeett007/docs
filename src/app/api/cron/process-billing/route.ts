import { NextRequest, NextResponse } from 'next/server';
import { recurringPaymentService } from '@/lib/billing/recurringPaymentService';
import { overdueInvoiceService } from '@/lib/billing/overdueInvoiceService';
import { MeteredBillingService } from '@/lib/billing/meteredBilling';
import { StripeUsageReportingService } from '@/lib/billing/stripeUsageReporting';
import { BillingQueueService } from '@/lib/billing/queueSystem';
import { BillingMonitoringService } from '@/lib/billing/monitoring';
import { MeteredAnalyticsSyncService } from '@/lib/billing/meteredAnalyticsSync';
import { prisma } from '@/lib/prisma';
import { cronLogger, measurePerformance } from '@/lib/logger';
import { rateLimit } from '@/lib/rateLimit';

export const dynamic = 'force-dynamic';

/**
 * Cron job endpoint to process recurring invoices and overdue reminders
 * This should be called daily by a cron service like Vercel Cron or external scheduler
 */
export async function POST(request: NextRequest) {
  try {
    // Apply rate limiting for CRON endpoints (very restrictive)
    const rateLimitResult = rateLimit(request, {
      windowMs: 60 * 1000, // 1 minute
      maxRequests: 5, // Only 5 CRON requests per minute
      keyGenerator: (req) => {
        const ip = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown';
        return `cron:${ip}`;
      }
    });

    if (!rateLimitResult.success) {
      console.warn('CRON endpoint rate limit exceeded', {
        ip: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip'),
        userAgent: request.headers.get('user-agent'),
        timestamp: new Date().toISOString(),
      });

      return NextResponse.json(
        {
          error: 'Rate limit exceeded for CRON endpoint',
          retryAfter: Math.ceil((rateLimitResult.resetTime - Date.now()) / 1000)
        },
        { status: 429 }
      );
    }

    // Enhanced authentication with multiple checks
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;
    const userAgent = request.headers.get('user-agent');

    // Validate CRON secret
    if (!cronSecret || cronSecret === 'default-cron-secret') {
      console.error('CRON_SECRET not properly configured');
      return NextResponse.json(
        { error: 'Server configuration error' },
        { status: 500 }
      );
    }

    if (!authHeader || authHeader !== `Bearer ${cronSecret}`) {
      console.warn('Unauthorized CRON request attempt', {
        ip: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip'),
        userAgent,
        authHeader: authHeader ? 'present' : 'missing',
        timestamp: new Date().toISOString(),
      });

      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Additional security: Check for expected User-Agent patterns
    const allowedUserAgents = [
      'vercel-cron',
      'github-actions',
      'curl', // For manual testing
      'node-fetch', // For programmatic calls
    ];

    const isValidUserAgent = !userAgent || allowedUserAgents.some(agent =>
      userAgent.toLowerCase().includes(agent.toLowerCase())
    );

    if (!isValidUserAgent) {
      console.warn('Suspicious User-Agent for CRON request', {
        userAgent,
        ip: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip'),
        timestamp: new Date().toISOString(),
      });
    }

    cronLogger.info('Starting daily billing processing', {
      userAgent,
      timestamp: new Date().toISOString()
    });

    const results = {
      recurringInvoicesProcessed: 0,
      overdueInvoicesProcessed: 0,
      meteredBillingProcessed: 0,
      usageReported: 0,
      pendingCancellationsProcessed: 0,
      queueJobsProcessed: 0,
      queueJobsFailed: 0,
      alertsGenerated: 0,
      metricsSynced: 0,
      syncDuplicates: 0,
      errors: [] as string[],
    };

    // Process recurring invoices
    try {
      results.recurringInvoicesProcessed = await measurePerformance(
        'process_recurring_invoices',
        async () => {
          cronLogger.info('Processing recurring invoices');
          return await recurringPaymentService.processRecurringInvoices();
        }
      );
      cronLogger.info('Recurring invoices processed', {
        count: results.recurringInvoicesProcessed
      });
    } catch (error) {
      cronLogger.error('Error processing recurring invoices', error as Error);
      results.errors.push(`Recurring invoices: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    // Process overdue invoices and send reminders
    try {
      console.log('Processing overdue invoices...');
      results.overdueInvoicesProcessed = await overdueInvoiceService.processOverdueInvoices();
      console.log(`Processed ${results.overdueInvoicesProcessed} overdue invoices`);
    } catch (error) {
      console.error('Error processing overdue invoices:', error);
      results.errors.push(`Overdue invoices: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    // Step 1: Sync pending metrics from analytics service
    try {
      console.log('Syncing pending metrics from analytics service...');
      const syncResult = await measurePerformance(
        'sync_pending_metrics',
        () => MeteredAnalyticsSyncService.syncPendingMetrics(500), // Process up to 500 metrics per run
        {}
      );

      results.metricsSynced = syncResult.processed;
      results.syncDuplicates = syncResult.duplicates;

      if (syncResult.errors > 0) {
        results.errors.push(`Metrics sync errors: ${syncResult.errors}`);
      }

      cronLogger.info('Metrics sync completed', {
        processed: syncResult.processed,
        errors: syncResult.errors,
        duplicates: syncResult.duplicates
      });
    } catch (error) {
      console.error('Error syncing metrics from analytics service:', error);
      results.errors.push(`Metrics sync: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    // Step 2: Report usage to Stripe for metered billing
    try {
      console.log('Reporting usage to Stripe for metered billing...');
      const usageResults = await StripeUsageReportingService.reportAllUsage();
      results.usageReported = usageResults?.processed || 0; // Use actual count from service
      console.log(`Usage reporting completed successfully: ${results.usageReported} subscriptions processed`);
    } catch (error) {
      console.error('Error reporting usage to Stripe:', error);
      results.errors.push(`Usage reporting: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    // Step 3: Process metered billing (generate invoices for completed billing periods)
    try {
      console.log('Processing metered billing subscriptions...');
      const today = new Date();
      const subscriptions = await prisma.customerMeteredSubscription.findMany({
        where: {
          status: 'active',
          nextBillingDate: {
            lte: today,
          },
        },
        include: {
          plan: true,
          customer: true,
          partner: true,
        },
      });

      let processed = 0;
      for (const subscription of subscriptions) {
        try {
          // First, sync any remaining metrics for this specific subscription
          await measurePerformance(
            'sync_subscription_metrics',
            () => MeteredAnalyticsSyncService.processSubscriptionMetrics(subscription.id),
            { subscriptionId: subscription.id }
          );

          // Then process the billing
          await measurePerformance(
            'process_metered_billing_subscription',
            () => MeteredBillingService.processMeteredBilling(subscription.id),
            { subscriptionId: subscription.id }
          );
          processed++;
        } catch (subError) {
          cronLogger.error('Error processing metered billing subscription', subError as Error, {
            subscriptionId: subscription.id,
            customerId: subscription.customerId,
            planId: subscription.planId
          });
          results.errors.push(`Subscription ${subscription.id}: ${subError instanceof Error ? subError.message : 'Unknown error'}`);
        }
      }

      results.meteredBillingProcessed = processed;
      cronLogger.info('Metered billing subscriptions processed', {
        count: processed,
        total: subscriptions.length
      });
    } catch (error) {
      console.error('Error processing metered billing:', error);
      results.errors.push(`Metered billing: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    // Process pending subscription cancellations
    try {
      console.log('Processing pending subscription cancellations...');
      const cancelledCount = await MeteredBillingService.processPendingCancellations();
      results.pendingCancellationsProcessed = cancelledCount;
      console.log(`Processed ${cancelledCount} pending cancellations`);
    } catch (error) {
      console.error('Error processing pending cancellations:', error);
      results.errors.push(`Pending cancellations: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    // Process queue jobs
    try {
      console.log('Processing queue jobs...');
      const queueResults = await BillingQueueService.processJobs();
      results.queueJobsProcessed = queueResults.processed;
      results.queueJobsFailed = queueResults.failed;
      console.log(`Processed ${queueResults.processed} queue jobs, ${queueResults.failed} failed`);
    } catch (error) {
      console.error('Error processing queue jobs:', error);
      results.errors.push(`Queue processing: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    // Check for alerts and send notifications
    try {
      console.log('Checking for billing system alerts...');
      const alerts = await BillingMonitoringService.checkAlerts();
      results.alertsGenerated = alerts.length;

      if (alerts.length > 0) {
        await BillingMonitoringService.sendAlertNotifications(alerts);
        console.log(`Generated and sent ${alerts.length} alerts`);
      }
    } catch (error) {
      console.error('Error checking alerts:', error);
      results.errors.push(`Alert monitoring: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    // Clean up old queue jobs
    try {
      console.log('Cleaning up old queue jobs...');
      const cleanedJobs = await BillingQueueService.cleanupOldJobs(7); // Keep jobs for 7 days
      console.log(`Cleaned up ${cleanedJobs} old queue jobs`);
    } catch (error) {
      console.error('Error cleaning up queue jobs:', error);
      results.errors.push(`Queue cleanup: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    console.log('Daily billing processing completed:', results);

    return NextResponse.json({
      success: true,
      message: 'Billing processing completed',
      data: results,
    });
  } catch (error) {
    console.error('Error in billing cron job:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Billing processing failed',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

/**
 * Manual trigger endpoint for testing (GET request)
 */
export async function GET(request: NextRequest) {
  try {
    // Only allow in development or with proper authentication
    if (process.env.NODE_ENV === 'production') {
      const authHeader = request.headers.get('authorization');
      const cronSecret = process.env.CRON_SECRET || 'default-cron-secret';
      
      if (authHeader !== `Bearer ${cronSecret}`) {
        return NextResponse.json(
          { error: 'Unauthorized - manual trigger not allowed in production without auth' },
          { status: 401 }
        );
      }
    }

    console.log('Manual billing processing triggered...');

    const results = {
      recurringInvoicesProcessed: 0,
      overdueInvoicesProcessed: 0,
      errors: [] as string[],
    };

    // Process recurring invoices
    try {
      results.recurringInvoicesProcessed = await recurringPaymentService.processRecurringInvoices();
    } catch (error) {
      console.error('Error processing recurring invoices:', error);
      results.errors.push(`Recurring invoices: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    // Process overdue invoices
    try {
      results.overdueInvoicesProcessed = await overdueInvoiceService.processOverdueInvoices();
    } catch (error) {
      console.error('Error processing overdue invoices:', error);
      results.errors.push(`Overdue invoices: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    return NextResponse.json({
      success: true,
      message: 'Manual billing processing completed',
      data: results,
    });
  } catch (error) {
    console.error('Error in manual billing processing:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Manual billing processing failed',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
