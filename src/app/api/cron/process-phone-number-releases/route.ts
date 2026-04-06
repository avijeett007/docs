import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';

/**
 * Generate random cooling period between 1-3 days
 */
function generateCoolingPeriod(): { days: number; availableAt: Date } {
  const days = Math.floor(Math.random() * 3) + 1; // 1-3 days
  const availableAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
  return { days, availableAt };
}

/**
 * POST /api/cron/process-phone-number-releases
 * Process phone numbers eligible for release after 30-day period
 * 
 * This cron job runs daily to check for phone numbers that have completed
 * their 30-day minimum period and can be released to the global pool.
 */
export async function POST(request: NextRequest) {
  try {
    // Verify cron secret
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;
    
    if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
      logger.warn('Unauthorized phone number release cron attempt', {
        hasAuth: !!authHeader,
        hasCronSecret: !!cronSecret
      });
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    logger.info('Starting phone number release processing');

    const today = new Date();

    // Find phone numbers eligible for release
    const eligibleForRelease = await prisma.phoneNumber.findMany({
      where: {
        releaseEligibleAt: {
          lte: today
        },
        status: 'active',
        poolStatus: {
          not: 'global_pool' // Don't process numbers already in global pool
        }
      },
      include: {
        partner: {
          select: {
            id: true,
            businessName: true
          }
        },
        customer: {
          select: {
            id: true,
            firstName: true,
            lastName: true
          }
        },
        billingEntries: {
          where: {
            status: 'active'
          }
        }
      }
    });

    logger.info(`Found ${eligibleForRelease.length} phone numbers eligible for release`);

    let processedCount = 0;
    let errorCount = 0;
    const results = [];

    for (const phoneNumber of eligibleForRelease) {
      try {
        await prisma.$transaction(async (tx) => {
          // Webhooks will be cancelled via webhookStatus: 'cancelled' in phone number update

          // Stop monthly billing
          await tx.phoneNumberBilling.updateMany({
            where: {
              phoneNumberId: phoneNumber.id,
              status: 'active'
            },
            data: {
              status: 'cancelled'
            }
          });

          // Generate random cooling period (1-3 days)
          const cooling = generateCoolingPeriod();

          // Move to global pool with cooling period
          await tx.phoneNumberPool.create({
            data: {
              phoneNumberId: phoneNumber.id,
              partnerId: null, // Global pool
              poolType: 'global',
              status: 'cooling' // Cooling period before available
            }
          });

          // Update phone number status with cooling metadata
          await tx.phoneNumber.update({
            where: { id: phoneNumber.id },
            data: {
              customerId: null, // Remove customer assignment
              poolStatus: 'global_pool',
              releasedAt: new Date(),
              releaseRequestedAt: null,
              releaseEligibleAt: null,
              webhookStatus: 'cancelled',
              importMetadata: {
                coolingDays: cooling.days,
                availableAt: cooling.availableAt.toISOString(),
                releasedFrom: phoneNumber.partnerId,
                releaseReason: '30-day minimum period completed'
              }
            }
          });
        });

        processedCount++;
        results.push({
          phoneNumber: phoneNumber.phoneNumber,
          partnerId: phoneNumber.partnerId,
          customerId: phoneNumber.customerId,
          status: 'released_to_global_pool'
        });

        logger.info('Phone number released to global pool', {
          phoneNumber: phoneNumber.phoneNumber,
          partnerId: phoneNumber.partnerId,
          customerId: phoneNumber.customerId || undefined
        });

      } catch (error) {
        errorCount++;
        logger.error('Error processing phone number release', error instanceof Error ? error : new Error(String(error)), {
          phoneNumberId: phoneNumber.id,
          phoneNumber: phoneNumber.phoneNumber
        });

        results.push({
          phoneNumber: phoneNumber.phoneNumber,
          partnerId: phoneNumber.partnerId,
          customerId: phoneNumber.customerId,
          status: 'error',
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    logger.info('Phone number release processing completed', {
      total: eligibleForRelease.length,
      processed: processedCount,
      errors: errorCount
    });

    return NextResponse.json({
      success: true,
      message: 'Phone number release processing completed',
      stats: {
        total: eligibleForRelease.length,
        processed: processedCount,
        errors: errorCount
      },
      results
    });

  } catch (error) {
    logger.error('Phone number release cron job failed', error instanceof Error ? error : new Error(String(error)));

    return NextResponse.json(
      { 
        success: false, 
        error: 'Phone number release processing failed',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
