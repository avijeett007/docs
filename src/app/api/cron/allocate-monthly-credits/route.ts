import { NextRequest, NextResponse } from 'next/server';
import { SubscriptionCreditService } from '@/lib/services/subscriptionCreditService';

export const dynamic = 'force-dynamic';

/**
 * POST /api/cron/allocate-monthly-credits
 * Cron job to automatically allocate monthly credits to all eligible partners
 * 
 * This endpoint should be called by a cron service (like Vercel Cron or external cron)
 * on a daily basis to check for partners who need their monthly credit allocation.
 * 
 * Headers:
 * Authorization: Bearer <CRON_SECRET>
 */
export async function POST(request: NextRequest) {
  try {
    // Verify cron authorization
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;

    if (!cronSecret) {
      console.error('CRON_SECRET environment variable not set');
      return NextResponse.json(
        { success: false, error: 'Cron secret not configured' },
        { status: 500 }
      );
    }

    if (!authHeader || authHeader !== `Bearer ${cronSecret}`) {
      console.error('Invalid or missing cron authorization');
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    console.log('🕐 Starting automated monthly credit allocation...');

    // Run bulk credit allocation
    const result = await SubscriptionCreditService.bulkAllocateCredits();

    if (result.success) {
      console.log(`✅ Bulk allocation completed: ${result.allocated}/${result.processed} partners allocated credits, ${result.expired} had credits expired`);

      return NextResponse.json({
        success: true,
        message: 'Monthly credit allocation completed',
        data: {
          processed: result.processed,
          allocated: result.allocated,
          expired: result.expired,
          errors: result.errors.length,
          errorDetails: result.errors
        }
      });
    } else {
      console.error('❌ Bulk allocation failed');
      
      return NextResponse.json(
        { 
          success: false, 
          error: 'Bulk allocation failed',
          data: {
            processed: result.processed,
            allocated: result.allocated,
            expired: result.expired,
            errors: result.errors.length,
            errorDetails: result.errors
          }
        },
        { status: 500 }
      );
    }

  } catch (error) {
    console.error('Error in automated credit allocation:', error);
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
 * GET /api/cron/allocate-monthly-credits
 * Check which partners need credit allocation (for monitoring)
 */
export async function GET(request: NextRequest) {
  try {
    // Verify cron authorization
    const { searchParams } = new URL(request.url);
    const cronSecret = searchParams.get('secret');

    if (!cronSecret || cronSecret !== process.env.CRON_SECRET) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get partners needing allocation
    const partnersNeedingAllocation = await SubscriptionCreditService.getPartnersNeedingAllocation();

    return NextResponse.json({
      success: true,
      message: 'Partners needing allocation retrieved',
      data: {
        count: partnersNeedingAllocation.length,
        partners: partnersNeedingAllocation.map(p => ({
          id: p.id,
          businessName: p.businessName,
          lastAllocation: p.lastCreditAllocationDate,
          monthlyAllocation: p.monthlyCreditAllocation
        }))
      }
    });

  } catch (error) {
    console.error('Error checking partners needing allocation:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      },
      { status: 500 }
    );
  }
}
