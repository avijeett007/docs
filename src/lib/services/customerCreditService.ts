import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';

export interface CustomerCreditOperationResult {
  success: boolean;
  error?: string;
  newBalance?: number;
  transactionId?: string;
  customerId?: string; // Actual Customer.id (resolved from UserOnboarding.userId)
}

export interface CustomerCreditGrantResult {
  success: boolean;
  error?: string;
  grantId?: string;
  nextGrantDate?: Date;
}

export class CustomerCreditService {
  /**
   * Add credits to a customer account
   */
  static async addCredits(
    userOnboardingId: string, // This is the ID from UserOnboarding table
    partnerId: string,
    amount: number,
    reason: string,
    grantedBy: string,
    grantType: 'one_time' | 'monthly_recurring' = 'one_time',
    recurringMonths?: number
  ): Promise<CustomerCreditOperationResult> {
    try {
      const result = await prisma.$transaction(async (tx) => {
        // First, get the UserOnboarding record to validate partner relationship
        const userOnboarding = await tx.userOnboarding.findFirst({
          where: {
            id: userOnboardingId,
            partnerId: partnerId
          }
        });

        if (!userOnboarding) {
          throw new Error('Customer not found or does not belong to this partner');
        }

        // Get the actual Customer record (must exist for credit operations)
        const customer = await tx.customer.findFirst({
          where: {
            userId: userOnboarding.userId
          },
          select: {
            id: true,
            creditBalance: true,
            customerPortalEnabled: true
          }
        });

        if (!customer) {
          throw new Error('Customer has not been provisioned for portal access yet. Please enable portal access first.');
        }

        if (!customer.customerPortalEnabled) {
          throw new Error('Customer portal is not enabled. Credits can only be assigned to customers with active portal access.');
        }

        const newBalance = customer.creditBalance + amount;

        // Update customer balance (sync both integer and decimal fields)
        await tx.customer.update({
          where: { id: customer.id },
          data: {
            creditBalance: newBalance,
            totalCreditsAllocated: {
              increment: amount
            }
          }
        });

        // Create transaction record with new decimal fields
        const transaction = await tx.creditTransaction.create({
          data: {
            partnerId,
            customerId: customer.id,
            type: 'allocation',
            amount: Math.round(amount), // Legacy field: rounded integer
            amountDecimal: amount, // New field: exact decimal value
            balanceAfter: Math.round(newBalance), // Legacy field: rounded integer
            balanceAfterDecimal: newBalance, // New field: exact decimal value
            description: reason,
            createdBy: grantedBy,
            metadata: {
              grantType,
              recurringMonths: recurringMonths || null,
              source: 'partner_allocation',
              userOnboardingId: userOnboardingId
            }
          }
        });

        // Create grant record if recurring
        if (grantType === 'monthly_recurring' && recurringMonths) {
          const nextGrantDate = new Date();
          nextGrantDate.setMonth(nextGrantDate.getMonth() + 1);
          
          const recurringEndDate = new Date();
          recurringEndDate.setMonth(recurringEndDate.getMonth() + recurringMonths);

          await tx.customerCreditGrant.create({
            data: {
              customerId: customer.id,
              partnerId,
              grantedBy,
              creditsGranted: amount,
              grantType,
              recurringEndDate,
              nextGrantDate,
              reason,
              totalGranted: amount
            }
          });
        }

        return { newBalance, transactionId: transaction.id, customerId: customer.id };
      });

      return {
        success: true,
        newBalance: result.newBalance,
        transactionId: result.transactionId,
        customerId: result.customerId
      };
    } catch (error) {
      logger.error('Error adding customer credits', error as Error, {
        operation: 'customer_credits',
        userOnboardingId,
        partnerId,
        amount
      });
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Deduct credits from a customer account
   */
  static async deductCredits(
    userOnboardingId: string, // This is the ID from UserOnboarding table
    partnerId: string,
    amount: number,
    reason: string,
    deductedBy: string
  ): Promise<CustomerCreditOperationResult> {
    try {
      const result = await prisma.$transaction(async (tx) => {
        // First, get the UserOnboarding record to validate partner relationship
        const userOnboarding = await tx.userOnboarding.findFirst({
          where: {
            id: userOnboardingId,
            partnerId: partnerId
          }
        });

        if (!userOnboarding) {
          throw new Error('Customer not found or does not belong to this partner');
        }

        // Get the actual Customer record (must exist for credit operations)
        const customer = await tx.customer.findFirst({
          where: {
            userId: userOnboarding.userId
          },
          select: {
            id: true,
            creditBalance: true,
            customerPortalEnabled: true
          }
        });

        if (!customer) {
          throw new Error('Customer has not been provisioned for portal access yet. Please enable portal access first.');
        }

        if (!customer.customerPortalEnabled) {
          throw new Error('Customer portal is not enabled. Credits can only be managed for customers with active portal access.');
        }

        if (customer.creditBalance < amount) {
          throw new Error('Insufficient credits');
        }

        const newBalance = customer.creditBalance - amount;

        // Update customer balance (sync both integer and decimal fields)
        await tx.customer.update({
          where: { id: customer.id },
          data: {
            creditBalance: newBalance,
            totalCreditsUsed: {
              increment: amount
            }
          }
        });

        // Create transaction record with new decimal fields
        const transaction = await tx.creditTransaction.create({
          data: {
            partnerId,
            customerId: customer.id,
            type: 'deduction',
            amount: -Math.round(amount), // Legacy field: rounded integer (negative for deduction)
            amountDecimal: -amount, // New field: exact decimal value (negative for deduction)
            balanceAfter: Math.round(newBalance), // Legacy field: rounded integer
            balanceAfterDecimal: newBalance, // New field: exact decimal value
            description: reason,
            createdBy: deductedBy,
            metadata: {
              source: 'partner_deduction',
              userOnboardingId: userOnboardingId
            }
          }
        });

        return { newBalance, transactionId: transaction.id, customerId: customer.id };
      });

      return {
        success: true,
        newBalance: result.newBalance,
        transactionId: result.transactionId,
        customerId: result.customerId
      };
    } catch (error) {
      logger.error('Error deducting customer credits', error as Error, {
        operation: 'customer_credits',
        userOnboardingId,
        partnerId,
        amount
      });
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Set monthly credit allocation for a customer
   */
  static async setMonthlyAllocation(
    userOnboardingId: string, // This is the ID from UserOnboarding table
    partnerId: string,
    monthlyAmount: number,
    reason: string,
    setBy: string,
    rolloverEnabled: boolean = false
  ): Promise<CustomerCreditOperationResult> {
    try {
      const result = await prisma.$transaction(async (tx) => {
        // First, get the UserOnboarding record to validate partner relationship
        const userOnboarding = await tx.userOnboarding.findFirst({
          where: {
            id: userOnboardingId,
            partnerId: partnerId
          }
        });

        if (!userOnboarding) {
          throw new Error('Customer not found or does not belong to this partner');
        }

        // Get the actual Customer record (must exist for credit operations)
        const customer = await tx.customer.findFirst({
          where: {
            userId: userOnboarding.userId
          },
          select: {
            id: true,
            creditBalance: true,
            customerPortalEnabled: true
          }
        });

        if (!customer) {
          throw new Error('Customer has not been provisioned for portal access yet. Please enable portal access first.');
        }

        if (!customer.customerPortalEnabled) {
          throw new Error('Customer portal is not enabled. Credits can only be managed for customers with active portal access.');
        }

        // Update customer monthly allocation
        await tx.customer.update({
          where: { id: customer.id },
          data: {
            monthlyCreditAllocation: monthlyAmount,
            creditRolloverEnabled: rolloverEnabled,
            lastCreditAllocationDate: new Date()
          }
        });

        // Create transaction record with new decimal fields
        const transaction = await tx.creditTransaction.create({
          data: {
            partnerId,
            customerId: customer.id,
            type: 'allocation_update',
            amount: 0, // Legacy field: no immediate credit change
            amountDecimal: 0, // New field: no immediate credit change
            balanceAfter: Math.round(customer.creditBalance), // Legacy field: rounded integer
            balanceAfterDecimal: customer.creditBalance, // New field: exact decimal value
            description: reason,
            createdBy: setBy,
            metadata: {
              monthlyAllocation: monthlyAmount,
              rolloverEnabled,
              source: 'partner_allocation_update',
              userOnboardingId: userOnboardingId
            }
          }
        });

        return { newBalance: customer.creditBalance, transactionId: transaction.id, customerId: customer.id };
      });

      return {
        success: true,
        newBalance: result.newBalance,
        transactionId: result.transactionId,
        customerId: result.customerId
      };
    } catch (error) {
      logger.error('Error setting customer monthly allocation', error as Error, {
        operation: 'customer_credits',
        userOnboardingId,
        partnerId,
        monthlyAmount,
        rolloverEnabled
      });
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Get customer credit balance and details
   */
  static async getCustomerCreditInfo(userOnboardingId: string, partnerId: string) {
    try {
      // First, get the UserOnboarding record to validate partner relationship
      const userOnboarding = await prisma.userOnboarding.findFirst({
        where: {
          id: userOnboardingId,
          partnerId: partnerId
        }
      });

      if (!userOnboarding) {
        return { success: false, error: 'Customer not found or does not belong to this partner' };
      }

      // Get the actual Customer record
      const customer = await prisma.customer.findFirst({
        where: {
          userId: userOnboarding.userId
        },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          creditBalance: true,
          monthlyCreditAllocation: true,
          lastCreditAllocationDate: true,
          lowCreditThreshold: true,
          lowCreditNotificationsEnabled: true,
          totalCreditsAllocated: true,
          totalCreditsUsed: true,
          creditRolloverEnabled: true,
          customerPortalEnabled: true
        }
      });

      if (!customer) {
        return { success: false, error: 'Customer has not been provisioned for portal access yet. Please enable portal access first.' };
      }

      if (!customer.customerPortalEnabled) {
        return { success: false, error: 'Customer portal is not enabled. Credits can only be viewed for customers with active portal access.' };
      }

      return {
        success: true,
        data: customer
      };
    } catch (error) {
      logger.error('Error getting customer credit info', error as Error, {
        operation: 'customer_credits',
        userOnboardingId,
        partnerId
      });
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Get customer credit transactions
   */
  static async getCustomerTransactions(
    userOnboardingId: string,
    partnerId: string,
    limit: number = 50,
    offset: number = 0
  ) {
    try {
      // First, get the UserOnboarding record to validate partner relationship
      const userOnboarding = await prisma.userOnboarding.findFirst({
        where: {
          id: userOnboardingId,
          partnerId: partnerId
        }
      });

      if (!userOnboarding) {
        return { success: false, error: 'Customer not found or does not belong to this partner' };
      }

      // Get the actual Customer record
      const customer = await prisma.customer.findFirst({
        where: {
          userId: userOnboarding.userId
        },
        select: {
          id: true,
          customerPortalEnabled: true
        }
      });

      if (!customer) {
        return { success: false, error: 'Customer has not been provisioned for portal access yet. Please enable portal access first.' };
      }

      if (!customer.customerPortalEnabled) {
        return { success: false, error: 'Customer portal is not enabled. Transactions can only be viewed for customers with active portal access.' };
      }

      const transactions = await prisma.creditTransaction.findMany({
        where: {
          customerId: customer.id,
          partnerId
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
        select: {
          id: true,
          type: true,
          amount: true,
          balanceAfter: true,
          description: true,
          createdBy: true,
          createdAt: true,
          metadata: true
        }
      });

      const total = await prisma.creditTransaction.count({
        where: {
          customerId: customer.id,
          partnerId
        }
      });

      return {
        success: true,
        data: {
          transactions,
          total,
          hasMore: offset + limit < total
        }
      };
    } catch (error) {
      logger.error('Error getting customer transactions', error as Error, {
        operation: 'customer_credits',
        userOnboardingId,
        partnerId
      });
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Cancel recurring credit grant
   */
  static async cancelRecurringGrant(
    grantId: string,
    partnerId: string,
    cancelledBy: string
  ): Promise<CustomerCreditGrantResult> {
    try {
      const grant = await prisma.customerCreditGrant.findUnique({
        where: { id: grantId },
        select: { id: true, partnerId: true, status: true }
      });

      if (!grant) {
        return { success: false, error: 'Grant not found' };
      }

      if (grant.partnerId !== partnerId) {
        return { success: false, error: 'Grant does not belong to this partner' };
      }

      if (grant.status !== 'active') {
        return { success: false, error: 'Grant is not active' };
      }

      await prisma.customerCreditGrant.update({
        where: { id: grantId },
        data: {
          status: 'cancelled',
          updatedAt: new Date()
        }
      });

      return { success: true, grantId };
    } catch (error) {
      logger.error('Error cancelling recurring grant', error as Error, {
        operation: 'customer_credits',
        grantId
      });
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }
}
