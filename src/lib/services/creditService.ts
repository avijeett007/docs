import { prisma } from '@/lib/prisma';
import {
  CreditBalance,
  CreditTransaction,
  CreditTransactionType,
  CreditUsageLog,
  UsageType,
  CREDIT_USAGE_RATES
} from '@/lib/types/credits';
import { logger } from '@/lib/logger';

export class CreditService {
  /**
   * Get partner's current credit balance and related information
   */
  static async getPartnerCreditBalance(partnerId: string): Promise<CreditBalance | null> {
    try {
      const partner = await prisma.partner.findUnique({
        where: { id: partnerId },
        select: {
          creditBalance: true,
          fractionalCredits: true,
          monthlyCreditAllocation: true,
          lastCreditAllocationDate: true,
          lowCreditThreshold: true,
          lowCreditNotificationsEnabled: true,
          totalCreditsPurchased: true,
          totalCreditsUsed: true,
        }
      });

      if (!partner) {
        return null;
      }

      // Calculate combined credits (whole - fractional debt)
      // fractionalCredits represents debt units, so we subtract them
      const fractionalCredits = partner.fractionalCredits || 0;
      const combinedBalance = partner.creditBalance - (fractionalCredits / 100);

      return {
        partnerId,
        currentBalance: Math.round(combinedBalance * 100) / 100, // Round to 2 decimal places
        monthlyCreditAllocation: partner.monthlyCreditAllocation,
        lastCreditAllocationDate: partner.lastCreditAllocationDate || undefined,
        lowCreditThreshold: partner.lowCreditThreshold || undefined,
        lowCreditNotificationsEnabled: partner.lowCreditNotificationsEnabled,
        totalCreditsPurchased: partner.totalCreditsPurchased,
        totalCreditsUsed: partner.totalCreditsUsed,
      };
    } catch (error) {
      logger.error('Error getting partner credit balance', error as Error, {
        operation: 'credit_service',
        partnerId
      });
      return null;
    }
  }

  /**
   * Add credits to partner's balance and log the transaction
   */
  static async addCredits(
    partnerId: string,
    amount: number,
    type: CreditTransactionType,
    description?: string,
    referenceId?: string,
    createdBy?: string,
    metadata: Record<string, any> = {}
  ): Promise<{ success: boolean; newBalance?: number; error?: string }> {
    try {
      const result = await prisma.$transaction(async (tx) => {
        // Get current balance including fractional credits
        const partner = await tx.partner.findUnique({
          where: { id: partnerId },
          select: {
            creditBalance: true,
            fractionalCredits: true,
            totalCreditsPurchased: true
          }
        });

        if (!partner) {
          throw new Error('Partner not found');
        }

        const newBalance = partner.creditBalance + amount;
        const newTotalPurchased = type === 'purchase'
          ? partner.totalCreditsPurchased + amount
          : partner.totalCreditsPurchased;

        // Update partner balance
        await tx.partner.update({
          where: { id: partnerId },
          data: {
            creditBalance: newBalance,
            totalCreditsPurchased: newTotalPurchased,
          }
        });

        // Calculate combined balance for transaction logging
        // fractionalCredits represents debt, so we subtract them to get true balance
        const combinedBalance = newBalance - (partner.fractionalCredits / 100);

        // Log the transaction with new decimal fields
        await tx.creditTransaction.create({
          data: {
            partnerId,
            type,
            amount: Math.round(amount), // Legacy field: store as integer
            amountDecimal: amount, // New field: store exact decimal value
            balanceAfter: Math.round(combinedBalance), // Legacy field: store as integer
            balanceAfterDecimal: combinedBalance, // New field: store exact decimal value
            description,
            referenceId,
            createdBy,
            metadata,
          }
        });

        return { newBalance };
      });

      return { success: true, newBalance: result.newBalance };
    } catch (error) {
      logger.error('Error adding credits', error as Error, {
        operation: 'credit_service',
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
   * Deduct credits from partner's balance and log the usage
   */
  static async deductCredits(
    partnerId: string,
    amount: number,
    usageType: UsageType,
    customerId?: string,
    agentId?: string,
    sessionId?: string,
    durationSeconds?: number,
    costCalculation: Record<string, any> = {},
    metadata: Record<string, any> = {}
  ): Promise<{ success: boolean; newBalance?: number; error?: string }> {
    try {
      const result = await prisma.$transaction(async (tx) => {
        // Get current balance including fractional credits
        const partner = await tx.partner.findUnique({
          where: { id: partnerId },
          select: {
            creditBalance: true,
            fractionalCredits: true,
            totalCreditsUsed: true
          }
        });

        if (!partner) {
          throw new Error('Partner not found');
        }

        // Calculate combined balance for minimum check
        const currentFractionalCredits = partner.fractionalCredits || 0;
        const combinedBalance = partner.creditBalance - (currentFractionalCredits / 100);

        // Allow negative balance up to -100 credits
        const MINIMUM_CREDIT_BALANCE = -100;
        if (combinedBalance - amount < MINIMUM_CREDIT_BALANCE) {
          throw new Error('Insufficient credits');
        }

        // Handle fractional credit deduction
        const FRACTIONAL_UNITS_PER_CREDIT = 100;
        const fractionalUnitsToDeduct = Math.round(amount * FRACTIONAL_UNITS_PER_CREDIT);
        const newFractionalCredits = currentFractionalCredits + fractionalUnitsToDeduct;

        // Check if we need to convert fractional credits to whole credits
        let newWholeCredits = partner.creditBalance;
        let finalFractionalCredits = newFractionalCredits;

        if (newFractionalCredits >= FRACTIONAL_UNITS_PER_CREDIT) {
          const wholeCreditDeductions = Math.floor(newFractionalCredits / FRACTIONAL_UNITS_PER_CREDIT);
          newWholeCredits = partner.creditBalance - wholeCreditDeductions;
          finalFractionalCredits = newFractionalCredits % FRACTIONAL_UNITS_PER_CREDIT;
        }

        const newTotalUsed = partner.totalCreditsUsed + amount;

        // Update partner balance with both whole and fractional credits
        await tx.partner.update({
          where: { id: partnerId },
          data: {
            creditBalance: newWholeCredits,
            fractionalCredits: finalFractionalCredits,
            totalCreditsUsed: newTotalUsed,
          }
        });

        // Calculate final combined balance for transaction logging
        // fractionalCredits represents debt, so we subtract them
        const finalCombinedBalance = newWholeCredits - (finalFractionalCredits / 100);

        // Log the transaction with new decimal fields
        await tx.creditTransaction.create({
          data: {
            partnerId,
            customerId,
            type: 'usage',
            amount: -Math.round(amount), // Legacy field: store as integer (negative for usage)
            amountDecimal: -amount, // New field: store exact decimal value (negative for usage)
            balanceAfter: Math.round(finalCombinedBalance), // Legacy field: store as integer
            balanceAfterDecimal: finalCombinedBalance, // New field: store exact decimal value
            description: `${usageType} usage`,
            metadata: { usageType, agentId, sessionId, durationSeconds, ...metadata },
          }
        });

        // Log detailed usage with new decimal field
        await tx.creditUsageLog.create({
          data: {
            partnerId,
            customerId,
            agentId,
            usageType,
            creditsUsed: Math.round(amount), // Legacy field: store as integer
            creditsUsedDecimal: amount, // New field: store exact decimal value
            costCalculation,
            sessionId,
            durationSeconds,
            metadata,
          }
        });

        return { newBalance: finalCombinedBalance };
      });

      return { success: true, newBalance: result.newBalance };
    } catch (error) {
      logger.error('Error deducting credits', error as Error, {
        operation: 'credit_service',
        partnerId,
        amount,
        usageType
      });
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  }

  /**
   * Calculate credits needed for a specific usage type and duration
   */
  static calculateCreditsForUsage(
    usageType: UsageType,
    durationMinutes: number = 1,
    additionalFactors: Record<string, number> = {}
  ): number {
    const rate = CREDIT_USAGE_RATES[usageType];
    let credits = rate.baseRate * durationMinutes;

    // Apply multiplier if specified
    if (rate.multiplier) {
      credits *= rate.multiplier;
    }

    // Apply additional factors (e.g., complexity, quality settings)
    Object.values(additionalFactors).forEach(factor => {
      credits *= factor;
    });

    // Apply minimum charge if specified
    if (rate.minimumCharge && credits < rate.minimumCharge) {
      credits = rate.minimumCharge;
    }

    return Math.ceil(credits); // Always round up
  }

  /**
   * Get partner's credit transaction history
   */
  static async getCreditTransactions(
    partnerId: string,
    page: number = 1,
    limit: number = 50,
    type?: CreditTransactionType
  ): Promise<{
    transactions: CreditTransaction[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    };
  }> {
    try {
      const where = {
        partnerId,
        ...(type && { type })
      };

      const [transactions, total] = await Promise.all([
        prisma.creditTransaction.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          skip: (page - 1) * limit,
          take: limit,
        }),
        prisma.creditTransaction.count({ where })
      ]);

      return {
        transactions: transactions as CreditTransaction[],
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit)
        }
      };
    } catch (error) {
      logger.error('Error getting credit transactions', error as Error, {
        operation: 'credit_service',
        partnerId
      });
      return {
        transactions: [],
        pagination: { page, limit, total: 0, totalPages: 0 }
      };
    }
  }

  /**
   * Check if partner has low credits and should be notified
   */
  static async checkLowCreditAlert(partnerId: string): Promise<{
    shouldAlert: boolean;
    currentBalance: number;
    threshold: number;
  }> {
    try {
      const partner = await prisma.partner.findUnique({
        where: { id: partnerId },
        select: {
          creditBalance: true,
          fractionalCredits: true,
          lowCreditThreshold: true,
          lowCreditNotificationsEnabled: true,
        }
      });

      if (!partner || !partner.lowCreditNotificationsEnabled) {
        return { shouldAlert: false, currentBalance: 0, threshold: 0 };
      }

      const threshold = partner.lowCreditThreshold || 1000;
      const fractionalCredits = partner.fractionalCredits || 0;
      // fractionalCredits represents debt, so we subtract them to get true balance
      const combinedBalance = partner.creditBalance - (fractionalCredits / 100);
      const shouldAlert = combinedBalance <= threshold;

      return {
        shouldAlert,
        currentBalance: Math.round(combinedBalance * 100) / 100,
        threshold
      };
    } catch (error) {
      logger.error('Error checking low credit alert', error as Error, {
        operation: 'credit_service',
        partnerId
      });
      return { shouldAlert: false, currentBalance: 0, threshold: 0 };
    }
  }

  /**
   * Update partner's low credit notification settings
   */
  static async updateLowCreditSettings(
    partnerId: string,
    threshold?: number,
    notificationsEnabled?: boolean
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const updateData: any = {};
      
      if (threshold !== undefined) {
        updateData.lowCreditThreshold = threshold;
      }
      
      if (notificationsEnabled !== undefined) {
        updateData.lowCreditNotificationsEnabled = notificationsEnabled;
      }

      await prisma.partner.update({
        where: { id: partnerId },
        data: updateData
      });

      return { success: true };
    } catch (error) {
      logger.error('Error updating low credit settings', error as Error, {
        operation: 'credit_service',
        partnerId
      });
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  }
}
