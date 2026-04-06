import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';

/**
 * POST /api/test/process-phone-number-releases-test
 * TEST VERSION: Process phone numbers eligible for release after 30-day period
 * 
 * This is a test version without authentication for testing purposes.
 */
export async function POST(_request: NextRequest) {
  try {
    logger.info('Starting TEST phone number release processing');

    const today = new Date();
    let processedCount = 0;
    let errorCount = 0;
    const results: any[] = [];

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
        }
      }
    });

    logger.info(`Found ${eligibleForRelease.length} phone numbers eligible for release`);

    if (eligibleForRelease.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'TEST phone number release processing completed',
        testMode: true,
        stats: {
          total: 0,
          processed: 0,
          errors: 0
        },
        results: []
      });
    }

    // Process each eligible phone number
    for (const phoneNumber of eligibleForRelease) {
      try {
        await prisma.$transaction(async (tx) => {
          // Cancel any active billing for this phone number
          await tx.phoneNumberBilling.updateMany({
            where: {
              phoneNumberId: phoneNumber.id,
              status: 'active'
            },
            data: {
              status: 'cancelled'
            }
          });

          // Update phone number to global pool status
          await tx.phoneNumber.update({
            where: { id: phoneNumber.id },
            data: {
              customerId: null, // Remove customer assignment
              poolStatus: 'global_pool',
              status: 'available',
              webhookUrl: null, // Clear webhook configuration
              webhookStatus: 'cancelled'
            }
          });

          processedCount++;
          results.push({
            phoneNumber: phoneNumber.phoneNumber,
            partnerId: phoneNumber.partner.id,
            partnerName: phoneNumber.partner.businessName,
            customerId: phoneNumber.customer?.id,
            customerName: phoneNumber.customer ? `${phoneNumber.customer.firstName} ${phoneNumber.customer.lastName}` : null,
            status: 'released',
            releasedAt: today.toISOString(),
            newPoolStatus: 'global_pool'
          });

          logger.info('TEST phone number released to global pool', {
            phoneNumber: phoneNumber.phoneNumber,
            partnerId: phoneNumber.partner.id,
            customerId: phoneNumber.customer?.id,
            releaseEligibleAt: phoneNumber.releaseEligibleAt,
            processedAt: today
          });
        });

      } catch (error) {
        errorCount++;
        logger.error('Error processing TEST phone number release', error instanceof Error ? error : new Error(String(error)), {
          phoneNumberId: phoneNumber.id,
          phoneNumber: phoneNumber.phoneNumber
        });

        results.push({
          phoneNumber: phoneNumber.phoneNumber,
          partnerId: phoneNumber.partner.id,
          customerId: phoneNumber.customer?.id,
          status: 'error',
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    const response = {
      success: true,
      message: 'TEST phone number release processing completed',
      testMode: true,
      stats: {
        total: eligibleForRelease.length,
        processed: processedCount,
        errors: errorCount
      },
      results
    };

    logger.info('TEST phone number release processing completed', response.stats);

    return NextResponse.json(response);

  } catch (error) {
    logger.error('Phone number release processing failed', error instanceof Error ? error : new Error(String(error)));

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
