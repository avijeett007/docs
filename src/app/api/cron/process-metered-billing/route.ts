import { NextRequest, NextResponse } from 'next/server';
import { MeteredBillingService } from '@/lib/billing/meteredBilling';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

/**
 * POST /api/cron/process-metered-billing
 * Process metered billing for all active subscriptions
 * This endpoint should be called by a cron job (e.g., daily)
 */
export async function POST(request: NextRequest) {
  try {
    // Verify cron authorization
    const authHeader = request.headers.get('authorization');
    const expectedAuth = `Bearer ${process.env.CRON_SECRET}`;
    
    if (!authHeader || authHeader !== expectedAuth) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    console.log('Starting metered billing processing...');

    // Get all active metered subscriptions that are due for billing
    const currentDate = new Date();
    const subscriptionsDue = await prisma.customerMeteredSubscription.findMany({
      where: {
        status: 'active',
        nextBillingDate: {
          lte: currentDate,
        },
      },
      include: {
        plan: true,
        customer: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
        partner: {
          select: {
            id: true,
            businessName: true,
          },
        },
      },
    });

    console.log(`Found ${subscriptionsDue.length} subscriptions due for billing`);

    const results = {
      processed: 0,
      invoicesCreated: 0,
      errors: 0,
      details: [] as any[],
    };

    // Process each subscription
    for (const subscription of subscriptionsDue) {
      try {
        console.log(`Processing subscription ${subscription.id} for customer ${subscription.customer.email}`);

        const result = await MeteredBillingService.processMeteredBilling(subscription.id);

        if (result) {
          results.invoicesCreated++;
          results.details.push({
            subscriptionId: subscription.id,
            customerId: subscription.customerId,
            customerEmail: subscription.customer.email,
            planName: subscription.plan.name,
            invoiceId: result.invoice.id,
            totalUsage: result.totalUsage,
            finalAmount: result.calculation.finalAmount,
            status: 'success',
          });

          console.log(`Created invoice ${result.invoice.id} for $${result.calculation.finalAmount}`);
        } else {
          results.details.push({
            subscriptionId: subscription.id,
            customerId: subscription.customerId,
            customerEmail: subscription.customer.email,
            planName: subscription.plan.name,
            status: 'no_charges',
            reason: 'No billable usage or below minimum charge',
          });

          console.log(`No charges for subscription ${subscription.id}`);
        }

        results.processed++;
      } catch (error: any) {
        console.error(`Error processing subscription ${subscription.id}:`, error);
        
        results.errors++;
        results.details.push({
          subscriptionId: subscription.id,
          customerId: subscription.customerId,
          customerEmail: subscription.customer.email,
          planName: subscription.plan.name,
          status: 'error',
          error: error.message,
        });
      }
    }

    // Log summary
    console.log('Metered billing processing completed:', {
      totalSubscriptions: subscriptionsDue.length,
      processed: results.processed,
      invoicesCreated: results.invoicesCreated,
      errors: results.errors,
    });

    // Return results
    return NextResponse.json({
      success: true,
      message: 'Metered billing processing completed',
      data: {
        summary: {
          totalSubscriptions: subscriptionsDue.length,
          processed: results.processed,
          invoicesCreated: results.invoicesCreated,
          errors: results.errors,
          processedAt: currentDate.toISOString(),
        },
        details: results.details,
      },
    });
  } catch (error: any) {
    console.error('Error in metered billing cron job:', error);
    
    return NextResponse.json(
      { 
        success: false, 
        error: 'Internal server error',
        details: error.message,
      },
      { status: 500 }
    );
  }
}
