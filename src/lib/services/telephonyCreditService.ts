import { prisma } from '@/lib/prisma';
import { Decimal } from '@prisma/client/runtime/library';
import {
  TelephonyCreditBalance,
  TelephonyCreditTransaction,
  TelephonyCreditTransactionType,
  centsToDollars
} from '@/lib/types/credits';
import { logger } from '@/lib/logger';

export class TelephonyCreditService {
  /**
   * Get partner's current telephony credit balance and related information
   */
  static async getPartnerTelephonyCreditBalance(partnerId: string): Promise<TelephonyCreditBalance | null> {
    try {
      const partner = await prisma.partner.findUnique({
        where: { id: partnerId },
        select: {
          telephonyCreditBalanceCents: true,
          telephonyLowCreditThresholdCents: true,
          telephonyLowCreditNotificationsEnabled: true,
          telephonyAutoTopUpEnabled: true,
          telephonyAutoTopUpThresholdCents: true,
          telephonyAutoTopUpAmountCents: true,
          totalTelephonyDollarsPurchased: true,
          totalTelephonyDollarsUsed: true,
        }
      });

      if (!partner) {
        return null;
      }

      const balance: TelephonyCreditBalance = {
        partnerId,
        currentBalanceCents: partner.telephonyCreditBalanceCents || 0,
        lowCreditThresholdCents: partner.telephonyLowCreditThresholdCents,
        lowCreditNotificationsEnabled: partner.telephonyLowCreditNotificationsEnabled || false,
        autoTopUpEnabled: partner.telephonyAutoTopUpEnabled || false,
        autoTopUpThresholdCents: partner.telephonyAutoTopUpThresholdCents,
        autoTopUpAmountCents: partner.telephonyAutoTopUpAmountCents,
        totalDollarsPurchased: Number(partner.totalTelephonyDollarsPurchased) || 0,
        totalDollarsUsed: Number(partner.totalTelephonyDollarsUsed) || 0,
      };

      // Check for low credit alert
      if (balance.lowCreditThresholdCents && balance.lowCreditNotificationsEnabled) {
        const shouldAlert = balance.currentBalanceCents <= balance.lowCreditThresholdCents;
        if (shouldAlert) {
          balance.lowCreditAlert = {
            shouldAlert: true,
            currentBalanceCents: balance.currentBalanceCents,
            thresholdCents: balance.lowCreditThresholdCents,
          };
        }
      }

      return balance;
    } catch (error) {
      logger.error('Error fetching telephony credit balance', error as Error, {
        operation: 'telephony_credits',
        partnerId
      });
      return null;
    }
  }

  /**
   * Add telephony credits to partner's balance and log the transaction
   */
  static async addTelephonyCredits(
    partnerId: string,
    amountCents: number,
    type: TelephonyCreditTransactionType,
    description?: string,
    referenceId?: string,
    createdBy?: string,
    metadata: Record<string, any> = {}
  ): Promise<{ success: boolean; newBalanceCents?: number; error?: string }> {
    try {
      const result = await prisma.$transaction(async (tx) => {
        // Get current balance
        const partner = await tx.partner.findUnique({
          where: { id: partnerId },
          select: { 
            telephonyCreditBalanceCents: true, 
            totalTelephonyDollarsPurchased: true 
          }
        });

        if (!partner) {
          throw new Error('Partner not found');
        }

        const currentBalance = partner.telephonyCreditBalanceCents || 0;
        const newBalance = currentBalance + amountCents;
        const newTotalPurchased = type === 'purchase'
          ? (partner.totalTelephonyDollarsPurchased || new Decimal(0)).add(new Decimal(centsToDollars(amountCents)))
          : partner.totalTelephonyDollarsPurchased || new Decimal(0);

        // Update partner balance
        await tx.partner.update({
          where: { id: partnerId },
          data: {
            telephonyCreditBalanceCents: newBalance,
            totalTelephonyDollarsPurchased: newTotalPurchased,
          }
        });

        // Log the transaction
        await tx.telephonyCreditTransaction.create({
          data: {
            partnerId,
            type,
            amount: amountCents,
            balanceAfter: newBalance,
            description,
            referenceId,
            createdBy,
            metadata,
          }
        });

        return { newBalanceCents: newBalance };
      });

      return { success: true, newBalanceCents: result.newBalanceCents };
    } catch (error) {
      logger.error('Error adding telephony credits', error as Error, {
        operation: 'telephony_credits',
        partnerId,
        amountCents
      });
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  }

  /**
   * Deduct telephony credits from partner's balance and log the usage
   */
  static async deductTelephonyCredits(
    partnerId: string,
    amountCents: number,
    type: TelephonyCreditTransactionType,
    description?: string,
    referenceId?: string,
    customerId?: string,
    metadata: Record<string, any> = {}
  ): Promise<{ success: boolean; newBalanceCents?: number; error?: string }> {
    try {
      const result = await prisma.$transaction(async (tx) => {
        // Get current balance
        const partner = await tx.partner.findUnique({
          where: { id: partnerId },
          select: { 
            telephonyCreditBalanceCents: true, 
            totalTelephonyDollarsUsed: true 
          }
        });

        if (!partner) {
          throw new Error('Partner not found');
        }

        const currentBalance = partner.telephonyCreditBalanceCents || 0;
        if (currentBalance < amountCents) {
          throw new Error('Insufficient telephony credits');
        }

        const newBalance = currentBalance - amountCents;
        const newTotalUsed = (partner.totalTelephonyDollarsUsed || new Decimal(0)).add(new Decimal(centsToDollars(amountCents)));

        // Update partner balance
        await tx.partner.update({
          where: { id: partnerId },
          data: {
            telephonyCreditBalanceCents: newBalance,
            totalTelephonyDollarsUsed: newTotalUsed,
          }
        });

        // Log the transaction
        await tx.telephonyCreditTransaction.create({
          data: {
            partnerId,
            customerId,
            type,
            amount: -amountCents, // Negative for deduction
            balanceAfter: newBalance,
            description,
            referenceId,
            metadata,
          }
        });

        return { newBalanceCents: newBalance };
      });

      return { success: true, newBalanceCents: result.newBalanceCents };
    } catch (error) {
      logger.error('Error deducting telephony credits', error as Error, {
        operation: 'telephony_credits',
        partnerId,
        amountCents
      });
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  }

  /**
   * Update telephony credit settings for a partner
   */
  static async updateTelephonyCreditSettings(
    partnerId: string,
    settings: {
      lowCreditThresholdCents?: number;
      lowCreditNotificationsEnabled?: boolean;
      autoTopUpEnabled?: boolean;
      autoTopUpThresholdCents?: number;
      autoTopUpAmountCents?: number;
    }
  ): Promise<{ success: boolean; error?: string }> {
    try {
      await prisma.partner.update({
        where: { id: partnerId },
        data: {
          telephonyLowCreditThresholdCents: settings.lowCreditThresholdCents,
          telephonyLowCreditNotificationsEnabled: settings.lowCreditNotificationsEnabled,
          telephonyAutoTopUpEnabled: settings.autoTopUpEnabled,
          telephonyAutoTopUpThresholdCents: settings.autoTopUpThresholdCents,
          telephonyAutoTopUpAmountCents: settings.autoTopUpAmountCents,
        }
      });

      return { success: true };
    } catch (error) {
      logger.error('Error updating telephony credit settings', error as Error, {
        operation: 'telephony_credits',
        partnerId
      });
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  }

  /**
   * Get telephony credit transaction history for a partner
   */
  static async getTelephonyCreditTransactions(
    partnerId: string,
    page: number = 1,
    limit: number = 50
  ): Promise<{
    success: boolean;
    transactions?: TelephonyCreditTransaction[];
    pagination?: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    };
    error?: string;
  }> {
    try {
      const offset = (page - 1) * limit;

      const [transactions, total] = await Promise.all([
        prisma.telephonyCreditTransaction.findMany({
          where: { partnerId },
          orderBy: { createdAt: 'desc' },
          skip: offset,
          take: limit,
        }),
        prisma.telephonyCreditTransaction.count({
          where: { partnerId },
        }),
      ]);

      return {
        success: true,
        transactions: transactions.map(tx => ({
          ...tx,
          type: tx.type as TelephonyCreditTransactionType,
          metadata: tx.metadata as Record<string, any>
        })),
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      };
    } catch (error) {
      logger.error('Error fetching telephony credit transactions', error as Error, {
        operation: 'telephony_credits',
        partnerId
      });
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Check if partner needs auto top-up and return the amount needed
   */
  static async checkAutoTopUpNeeded(partnerId: string): Promise<{
    needed: boolean;
    currentBalanceCents: number;
    thresholdCents?: number;
    topUpAmountCents?: number;
  }> {
    try {
      const partner = await prisma.partner.findUnique({
        where: { id: partnerId },
        select: {
          telephonyCreditBalanceCents: true,
          telephonyAutoTopUpEnabled: true,
          telephonyAutoTopUpThresholdCents: true,
          telephonyAutoTopUpAmountCents: true,
        }
      });

      if (!partner || !partner.telephonyAutoTopUpEnabled) {
        return {
          needed: false,
          currentBalanceCents: partner?.telephonyCreditBalanceCents || 0,
        };
      }

      const currentBalance = partner.telephonyCreditBalanceCents || 0;
      const threshold = partner.telephonyAutoTopUpThresholdCents || 0;
      const topUpAmount = partner.telephonyAutoTopUpAmountCents || 0;

      const needed = currentBalance <= threshold && topUpAmount > 0;

      return {
        needed,
        currentBalanceCents: currentBalance,
        thresholdCents: threshold,
        topUpAmountCents: topUpAmount,
      };
    } catch (error) {
      logger.error('Error checking auto top-up', error as Error, {
        operation: 'telephony_credits',
        partnerId
      });
      return {
        needed: false,
        currentBalanceCents: 0,
      };
    }
  }

  /**
   * Verify Stripe session and get purchase details
   */
  static async verifyStripeSession(partnerId: string, sessionId: string): Promise<{
    success: boolean;
    error?: string;
    data?: {
      creditsAdded: number;
      amountPaid: number;
      newBalance: number;
      transactionId: string;
    };
  }> {
    try {
      // Check if we have Stripe configured
      if (!process.env.STRIPE_SECRET_KEY) {
        return {
          success: false,
          error: 'Stripe payment processing is not configured. Please contact support.'
        };
      }

      // Import Stripe dynamically to avoid issues if not configured
      const Stripe = (await import('stripe')).default;
      const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
        apiVersion: '2023-10-16',
      });

      // Retrieve the session from Stripe
      const session = await stripe.checkout.sessions.retrieve(sessionId);

      if (!session) {
        return {
          success: false,
          error: 'Session not found'
        };
      }

      if (session.payment_status !== 'paid') {
        return {
          success: false,
          error: 'Payment not completed'
        };
      }

      // Get the amount from the session (in cents)
      const amountCents = session.amount_total || 0;
      const amountDollars = amountCents / 100;

      // Get current partner balance
      const partner = await prisma.partner.findUnique({
        where: { id: partnerId },
        select: { telephonyCreditBalanceCents: true }
      });

      if (!partner) {
        return {
          success: false,
          error: 'Partner not found'
        };
      }

      // For telephony credits, 1 dollar = 1 dollar of credits (no markup)
      const creditsToAdd = amountDollars;
      const creditsToAddCents = amountCents;

      // Update partner's telephony credit balance
      const updatedPartner = await prisma.partner.update({
        where: { id: partnerId },
        data: {
          telephonyCreditBalanceCents: {
            increment: creditsToAddCents
          }
        },
        select: { telephonyCreditBalanceCents: true }
      });

      // Create transaction record
      await prisma.telephonyCreditTransaction.create({
        data: {
          partnerId: partnerId,
          type: 'purchase',
          amount: creditsToAddCents,
          balanceAfter: updatedPartner.telephonyCreditBalanceCents || 0,
          description: `Telephony credit purchase via Stripe`,
          referenceId: session.payment_intent as string || sessionId,
          metadata: {
            stripeSessionId: sessionId,
            amountPaid: amountDollars,
            creditsAdded: creditsToAdd
          }
        }
      });

      const newBalanceDollars = centsToDollars(updatedPartner.telephonyCreditBalanceCents || 0);

      return {
        success: true,
        data: {
          creditsAdded: creditsToAdd,
          amountPaid: amountDollars,
          newBalance: newBalanceDollars,
          transactionId: sessionId.substring(0, 20) + '...' // Truncate for display
        }
      };
    } catch (error) {
      logger.error('Error verifying Stripe session', error as Error, {
        operation: 'telephony_credits',
        sessionId
      });
      return {
        success: false,
        error: 'Failed to verify purchase'
      };
    }
  }
}
