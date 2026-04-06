import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';

/**
 * POST /api/test/process-phone-number-billing-test
 * Test version of phone number billing that processes per-minute instead of monthly
 * 
 * This is for E2E testing only - processes billing entries where nextBillingDate <= now
 */
export async function POST(request: NextRequest) {
  try {
    // For testing, we'll allow this without cron secret
    const isTestMode = process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test';
    
    if (!isTestMode) {
      // In production, still require cron secret
      const authHeader = request.headers.get('authorization');
      const cronSecret = process.env.CRON_SECRET;
      
      if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
    }

    logger.info('Starting TEST phone number billing processing (per-minute mode)');

    const now = new Date();

    // Find all phone number billing entries that are due (using per-minute logic)
    const dueForBilling = await prisma.phoneNumberBilling.findMany({
      where: {
        nextBillingDate: { lte: now },
        status: 'active'
      },
      include: {
        phoneNumber: {
          include: {
            partner: {
              select: {
                id: true,
                businessName: true,
                telephonyCreditBalanceCents: true
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
        }
      }
    });

    logger.info(`Found ${dueForBilling.length} phone numbers due for billing (TEST MODE)`);

    let processedCount = 0;
    let errorCount = 0;
    const results = [];

    for (const billing of dueForBilling) {
      try {
        const partner = billing.phoneNumber.partner;
        const customer = billing.phoneNumber.customer;
        const phoneNumber = billing.phoneNumber;

        await prisma.$transaction(async (tx) => {
          // Check if partner has sufficient credits
          if (partner.telephonyCreditBalanceCents < billing.monthlyAmount) {
            // Mark billing as failed but don't stop processing
            await tx.phoneNumberBilling.update({
              where: { id: billing.id },
              data: {
                status: 'failed',
                nextBillingDate: new Date(now.getTime() + 60000) // Try again in 1 minute
              }
            });

            results.push({
              phoneNumber: phoneNumber.phoneNumber,
              partnerId: partner.id,
              customerId: customer?.id,
              status: 'failed',
              reason: 'Insufficient credits',
              amount: billing.monthlyAmount
            });

            logger.warn('Billing failed due to insufficient credits', {
              phoneNumber: phoneNumber.phoneNumber,
              partnerId: partner.id,
              requiredAmount: billing.monthlyAmount,
              availableAmount: partner.telephonyCreditBalanceCents
            });

            return;
          }

          // Deduct the monthly amount from partner's telephony credits
          const updatedPartner = await tx.partner.update({
            where: { id: partner.id },
            data: {
              telephonyCreditBalanceCents: {
                decrement: billing.monthlyAmount
              },
              totalTelephonyDollarsUsed: {
                increment: billing.monthlyAmount / 100
              }
            }
          });

          // Create telephony credit transaction record
          await tx.telephonyCreditTransaction.create({
            data: {
              partnerId: partner.id,
              customerId: customer?.id || null,
              type: 'phone_number_monthly',
              amount: -billing.monthlyAmount,
              balanceAfter: updatedPartner.telephonyCreditBalanceCents,
              description: `Monthly phone number billing: ${phoneNumber.phoneNumber}`,
              referenceId: phoneNumber.id,
              metadata: {
                phoneNumber: phoneNumber.phoneNumber,
                phoneNumberId: phoneNumber.id,
                billingId: billing.id,
                billingPeriod: 'TEST_MINUTE',
                originalAmount: billing.monthlyAmount,
                previousBillingDate: null,
                nextBillingDate: new Date(now.getTime() + 60000) // Next minute for testing
              }
            }
          });

          // Update billing record for next cycle (1 minute for testing)
          await tx.phoneNumberBilling.update({
            where: { id: billing.id },
            data: {
              nextBillingDate: new Date(now.getTime() + 60000), // 1 minute for testing
              status: 'active'
            }
          });

          processedCount++;
          results.push({
            phoneNumber: phoneNumber.phoneNumber,
            partnerId: partner.id,
            customerId: customer?.id,
            status: 'success',
            amount: billing.monthlyAmount,
            newBalance: updatedPartner.telephonyCreditBalanceCents
          });

          logger.info('TEST billing processed successfully', {
            phoneNumber: phoneNumber.phoneNumber,
            partnerId: partner.id,
            amount: billing.monthlyAmount,
            newBalance: updatedPartner.telephonyCreditBalanceCents
          });
        });

      } catch (error) {
        errorCount++;
        logger.error('Error processing TEST billing', error instanceof Error ? error : new Error(String(error)), {
          billingId: billing.id,
          phoneNumber: billing.phoneNumber.phoneNumber
        });

        results.push({
          phoneNumber: billing.phoneNumber.phoneNumber,
          partnerId: billing.phoneNumber.partnerId,
          customerId: billing.phoneNumber.customerId,
          status: 'error',
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    logger.info('TEST phone number billing processing completed', {
      total: dueForBilling.length,
      processed: processedCount,
      errors: errorCount
    });

    return NextResponse.json({
      success: true,
      message: 'TEST phone number billing processing completed',
      testMode: true,
      billingInterval: '1 minute',
      stats: {
        total: dueForBilling.length,
        processed: processedCount,
        errors: errorCount
      },
      results
    });

  } catch (error) {
    logger.error('TEST phone number billing cron job failed', error instanceof Error ? error : new Error(String(error)));

    return NextResponse.json(
      { 
        success: false, 
        error: 'TEST phone number billing processing failed',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
