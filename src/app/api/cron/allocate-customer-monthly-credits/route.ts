import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getLiteLLMClient } from '@/lib/litellm';
import { decryptData } from '@/lib/encryption';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

/**
 * Re-enable any suspended AI Gateway keys for a customer after credits are restored.
 * Fire-and-forget: failures are logged but never propagate to the caller.
 */
async function reEnableCustomerGatewayKeys(customerId: string): Promise<void> {
  try {
    const suspendedKeys = await prisma.aiGatewayKey.findMany({
      where: { customerId, status: 'suspended' },
      select: { id: true, encryptedVirtualKey: true },
    });
    if (suspendedKeys.length === 0) return;

    const litellm = getLiteLLMClient();
    for (const key of suspendedKeys) {
      try {
        const rawVirtualKey = await decryptData(key.encryptedVirtualKey);
        await litellm.unblockKey(rawVirtualKey);
        await prisma.aiGatewayKey.update({
          where: { id: key.id },
          data: { status: 'active' },
        });
        logger.info(`[MonthlyCreditsCron] Re-enabled AI Gateway key ${key.id} for customer ${customerId}`, {
          operation: 'monthly_credits_cron',
          customerId,
          keyId: key.id,
        });
      } catch (err) {
        logger.error(`[MonthlyCreditsCron] Failed to re-enable key ${key.id}`, err instanceof Error ? err : new Error(String(err)), {
          operation: 'monthly_credits_cron',
          customerId,
          keyId: key.id,
        });
      }
    }
  } catch (err) {
    logger.error('[MonthlyCreditsCron] reEnableCustomerGatewayKeys error', err instanceof Error ? err : new Error(String(err)), {
      operation: 'monthly_credits_cron',
      customerId,
    });
  }
}

// Verify cron authorization
function verifyCronAuth(request: NextRequest): boolean {
  const authHeader = request.headers.get('authorization');
  const expectedToken = process.env.CRON_SECRET;

  if (!expectedToken) {
    logger.error('CRON_SECRET environment variable not set', new Error('Missing CRON_SECRET'), {
      operation: 'monthly_credits_cron',
    });
    return false;
  }
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return false;
  }
  
  const token = authHeader.substring(7);
  return token === expectedToken;
}

export async function POST(request: NextRequest) {
  try {
    // Verify cron authorization
    if (!verifyCronAuth(request)) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const startTime = Date.now();
    const today = new Date();
    const currentMonth = today.getMonth();
    const currentYear = today.getFullYear();
    
    // Get customers eligible for monthly allocation
    const eligibleCustomers = await prisma.customer.findMany({
      where: {
        monthlyCreditAllocation: {
          gt: 0
        },
        OR: [
          {
            lastCreditAllocationDate: null
          },
          {
            lastCreditAllocationDate: {
              lt: new Date(currentYear, currentMonth, 1) // Before this month
            }
          }
        ]
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        creditBalance: true,
        monthlyCreditAllocation: true,
        lastCreditAllocationDate: true,
        creditRolloverEnabled: true,
        userOnboarding: {
          select: {
            partnerId: true,
            partner: {
              select: {
                id: true,
                businessName: true,
                emailAddress: true
              }
            }
          }
        }
      }
    });

    logger.info(`[MonthlyCreditsCron] Found ${eligibleCustomers.length} customers eligible for monthly credit allocation`, {
      operation: 'monthly_credits_cron',
      count: eligibleCustomers.length,
    });

    const results = [];
    let processed = 0;
    let allocated = 0;
    let skipped = 0;
    let totalCreditsAllocated = 0;

    for (const customer of eligibleCustomers) {
      processed++;
      
      try {
        // Skip customers without partner association
        const partnerInfo = customer.userOnboarding?.[0];
        if (!partnerInfo?.partnerId || !partnerInfo.partner || partnerInfo.partnerId === null) {
          skipped++;
          results.push({
            customerId: customer.id,
            customerName: `${customer.firstName} ${customer.lastName}`,
            customerEmail: customer.email,
            partnerName: 'No Partner',
            creditsAllocated: 0,
            previousBalance: customer.creditBalance,
            newBalance: customer.creditBalance,
            rolloverEnabled: customer.creditRolloverEnabled,
            status: 'skipped',
            error: 'Customer not associated with any partner'
          });
          continue;
        }

        await prisma.$transaction(async (tx) => {
          const allocationAmount = customer.monthlyCreditAllocation;
          let newBalance = customer.creditBalance;

          // Handle rollover logic
          if (!customer.creditRolloverEnabled && customer.creditBalance > 0) {
            // Forfeit existing credits if rollover is disabled
            newBalance = 0;

            // Create forfeiture transaction
            await tx.creditTransaction.create({
              data: {
                partnerId: partnerInfo.partnerId!,
                customerId: customer.id,
                type: 'forfeiture',
                amount: -customer.creditBalance,
                balanceAfter: 0,
                description: 'Monthly credit forfeiture (rollover disabled)',
                createdBy: 'system',
                metadata: {
                  source: 'monthly_allocation_cron',
                  forfeitedAmount: customer.creditBalance,
                  rolloverEnabled: false
                }
              }
            });
          }

          // Add monthly allocation
          newBalance += allocationAmount;

          // Update customer
          await tx.customer.update({
            where: { id: customer.id },
            data: {
              creditBalance: newBalance,
              lastCreditAllocationDate: today,
              totalCreditsAllocated: {
                increment: allocationAmount
              }
            }
          });

          // Create allocation transaction
          await tx.creditTransaction.create({
            data: {
              partnerId: partnerInfo.partnerId!,
              customerId: customer.id,
              type: 'allocation',
              amount: allocationAmount,
              balanceAfter: newBalance,
              description: `Monthly credit allocation for ${today.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}`,
              createdBy: 'system',
              metadata: {
                source: 'monthly_allocation_cron',
                allocationMonth: currentMonth,
                allocationYear: currentYear,
                rolloverEnabled: customer.creditRolloverEnabled,
                previousBalance: customer.creditBalance
              }
            }
          });

          allocated++;
          totalCreditsAllocated += allocationAmount;

          results.push({
            customerId: customer.id,
            customerName: `${customer.firstName} ${customer.lastName}`,
            customerEmail: customer.email,
            partnerName: partnerInfo.partner?.businessName || 'Unknown Partner',
            creditsAllocated: allocationAmount,
            previousBalance: customer.creditBalance,
            newBalance,
            rolloverEnabled: customer.creditRolloverEnabled,
            status: 'success'
          });
        });

        // Re-enable any suspended AI Gateway keys now that credits are restored (fire-and-forget)
        reEnableCustomerGatewayKeys(customer.id);

      } catch (error) {
        logger.error(`[MonthlyCreditsCron] Failed to allocate credits for customer ${customer.id}`, error instanceof Error ? error : new Error(String(error)), {
          operation: 'monthly_credits_cron',
          customerId: customer.id,
        });
        skipped++;

        const partnerInfo = customer.userOnboarding?.[0];
        results.push({
          customerId: customer.id,
          customerName: `${customer.firstName} ${customer.lastName}`,
          customerEmail: customer.email,
          partnerName: partnerInfo?.partner?.businessName || 'Unknown Partner',
          creditsAllocated: 0,
          previousBalance: customer.creditBalance,
          newBalance: customer.creditBalance,
          rolloverEnabled: customer.creditRolloverEnabled,
          status: 'failed',
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    // Process recurring grants
    const recurringGrants = await prisma.customerCreditGrant.findMany({
      where: {
        status: 'active',
        grantType: 'monthly_recurring',
        nextGrantDate: {
          lte: today
        }
      },
      include: {
        customer: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            creditBalance: true
          }
        },
        partner: {
          select: {
            id: true,
            businessName: true
          }
        }
      }
    });

    logger.info(`[MonthlyCreditsCron] Found ${recurringGrants.length} recurring grants to process`, {
      operation: 'monthly_credits_cron',
      count: recurringGrants.length,
    });

    for (const grant of recurringGrants) {
      try {
        await prisma.$transaction(async (tx) => {
          const newBalance = grant.customer.creditBalance + grant.creditsGranted;

          // Update customer balance (sync both integer and decimal fields)
          await tx.customer.update({
            where: { id: grant.customerId },
            data: {
              creditBalance: newBalance,
              totalCreditsAllocated: {
                increment: grant.creditsGranted
              }
            }
          });

          // Create transaction record
          await tx.creditTransaction.create({
            data: {
              partnerId: grant.partnerId,
              customerId: grant.customerId,
              type: 'allocation',
              amount: grant.creditsGranted,
              balanceAfter: newBalance,
              description: `Recurring credit grant: ${grant.reason || 'Monthly recurring allocation'}`,
              createdBy: grant.grantedBy,
              metadata: {
                source: 'recurring_grant_cron',
                grantId: grant.id,
                grantType: 'monthly_recurring'
              }
            }
          });

          // Update grant
          const nextGrantDate = new Date(grant.nextGrantDate || new Date());
          nextGrantDate.setMonth(nextGrantDate.getMonth() + 1);

          // Check if grant should expire
          const shouldExpire = grant.recurringEndDate && nextGrantDate > grant.recurringEndDate;

          await tx.customerCreditGrant.update({
            where: { id: grant.id },
            data: {
              nextGrantDate: shouldExpire ? null : nextGrantDate,
              status: shouldExpire ? 'completed' : 'active',
              totalGranted: {
                increment: grant.creditsGranted
              }
            }
          });

          allocated++;
          totalCreditsAllocated += grant.creditsGranted;

          results.push({
            customerId: grant.customerId,
            customerName: `${grant.customer.firstName} ${grant.customer.lastName}`,
            customerEmail: grant.customer.email,
            partnerName: grant.partner.businessName,
            creditsAllocated: grant.creditsGranted,
            previousBalance: grant.customer.creditBalance,
            newBalance,
            grantId: grant.id,
            grantType: 'recurring',
            status: 'success'
          });
        });

        // Re-enable any suspended AI Gateway keys now that credits are restored (fire-and-forget)
        reEnableCustomerGatewayKeys(grant.customerId);

      } catch (error) {
        logger.error(`[MonthlyCreditsCron] Failed to process recurring grant ${grant.id}`, error instanceof Error ? error : new Error(String(error)), {
          operation: 'monthly_credits_cron',
          grantId: grant.id,
          customerId: grant.customerId,
        });
        skipped++;
      }
    }

    const executionTime = ((Date.now() - startTime) / 1000).toFixed(1);

    logger.info('[MonthlyCreditsCron] Customer monthly credit allocation completed', {
      operation: 'monthly_credits_cron',
      processed,
      allocated,
      skipped,
      totalCreditsAllocated,
      executionTime: `${executionTime}s`,
    });

    return NextResponse.json({
      success: true,
      message: 'Customer monthly credit allocation completed',
      data: {
        processed,
        allocated,
        skipped,
        totalCreditsAllocated,
        executionTime: `${executionTime}s`,
        details: results
      }
    });

  } catch (error) {
    logger.error('[MonthlyCreditsCron] Customer monthly credit allocation error', error instanceof Error ? error : new Error(String(error)), {
      operation: 'monthly_credits_cron',
    });
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
