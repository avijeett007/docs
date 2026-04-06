import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';

/**
 * POST /api/cron/process-cooling-period
 * Process phone numbers that have completed their cooling period
 * 
 * This cron job runs daily to check for phone numbers in the global pool
 * that have completed their 1-3 day cooling period and can be made available.
 */
export async function POST(request: NextRequest) {
  try {
    // Verify cron secret
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;
    
    if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
      logger.warn('Unauthorized cooling period cron attempt', {
        hasAuth: !!authHeader,
        hasCronSecret: !!cronSecret
      });
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    logger.info('Starting cooling period processing');

    const now = new Date();

    // Find phone numbers that have completed their cooling period
    const coolingNumbers = await prisma.phoneNumberPool.findMany({
      where: {
        status: 'cooling',
        poolType: 'global'
      },
      include: {
        phoneNumber: {
          select: {
            phoneNumber: true,
            importMetadata: true
          }
        }
      }
    });

    logger.info(`Found ${coolingNumbers.length} numbers in cooling period`);

    let processedCount = 0;
    let stillCoolingCount = 0;
    const results = [];

    for (const poolNumber of coolingNumbers) {
      try {
        const phoneMetadata = poolNumber.phoneNumber.importMetadata as any;
        const availableAt = new Date(phoneMetadata.availableAt);

        // Check if cooling period is complete
        if (now >= availableAt) {
          // Cooling period complete - make available
          await prisma.phoneNumberPool.update({
            where: { id: poolNumber.id },
            data: {
              status: 'available'
            }
          });

          processedCount++;
          results.push({
            phoneNumber: poolNumber.phoneNumber.phoneNumber,
            phoneNumberId: poolNumber.phoneNumberId,
            status: 'available',
            coolingDays: phoneMetadata.coolingDays,
            availableAt: availableAt.toISOString()
          });

          logger.info('Phone number cooling period completed', {
            phoneNumber: poolNumber.phoneNumber.phoneNumber,
            phoneNumberId: poolNumber.phoneNumberId,
            coolingDays: phoneMetadata.coolingDays,
            availableAt
          });

        } else {
          stillCoolingCount++;
          const hoursRemaining = Math.ceil((availableAt.getTime() - now.getTime()) / (1000 * 60 * 60));

          logger.debug('Phone number still cooling', {
            phoneNumber: poolNumber.phoneNumber.phoneNumber,
            phoneNumberId: poolNumber.phoneNumberId,
            availableAt,
            hoursRemaining
          });
        }

      } catch (error) {
        logger.error('Error processing cooling period', error instanceof Error ? error : new Error(String(error)), {
          phoneNumberPoolId: poolNumber.id,
          phoneNumberId: poolNumber.phoneNumberId
        });
      }
    }

    logger.info('Cooling period processing completed', {
      total: coolingNumbers.length,
      processed: processedCount,
      stillCooling: stillCoolingCount
    });

    return NextResponse.json({
      success: true,
      message: 'Cooling period processing completed',
      stats: {
        total: coolingNumbers.length,
        processed: processedCount,
        stillCooling: stillCoolingCount
      },
      results
    });

  } catch (error) {
    logger.error('Cooling period cron job failed', error instanceof Error ? error : new Error(String(error)));

    return NextResponse.json(
      { 
        success: false, 
        error: 'Cooling period processing failed',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/cron/process-cooling-period
 * Get status of numbers in cooling period (for monitoring)
 */
export async function GET() {
  try {
    const coolingNumbers = await prisma.phoneNumberPool.findMany({
      where: {
        status: 'cooling',
        poolType: 'global'
      },
      include: {
        phoneNumber: {
          select: {
            phoneNumber: true,
            importMetadata: true
          }
        }
      }
    });

    const now = new Date();
    const stats = coolingNumbers.map(poolNumber => {
      const metadata = poolNumber.phoneNumber.importMetadata as any;
      const availableAt = new Date(metadata.availableAt);
      const hoursRemaining = Math.max(0, Math.ceil((availableAt.getTime() - now.getTime()) / (1000 * 60 * 60)));

      return {
        phoneNumber: poolNumber.phoneNumber?.phoneNumber,
        coolingDays: metadata.coolingDays,
        availableAt: availableAt.toISOString(),
        hoursRemaining,
        isReady: now >= availableAt
      };
    });

    return NextResponse.json({
      success: true,
      total: coolingNumbers.length,
      ready: stats.filter(s => s.isReady).length,
      cooling: stats.filter(s => !s.isReady).length,
      numbers: stats
    });

  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to get cooling period status' },
      { status: 500 }
    );
  }
}
