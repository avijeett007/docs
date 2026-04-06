import { prisma } from '@/lib/prisma';
import { CreditService } from './creditService';
import { CREDIT_USAGE_RATES } from '@/lib/types/credits';
import { logger } from '@/lib/logger';

export interface CallUsageData {
  partnerId: string;
  customerId?: string;
  agentId: string;
  provider: 'vapi' | 'retell' | 'ultravox' | 'elevenlabs' | 'ghl';
  sessionId: string;
  durationSeconds: number;
  callCost?: number; // Provider's cost in cents
  metadata?: Record<string, any>;
}

export interface UsageCalculation {
  creditsToDeduct: number;
  costBreakdown: {
    baseCost: number;
    durationMinutes: number;
    ratePerMinute: number;
    multiplier: number;
    minimumCharge: number;
    providerCost?: number;
  };
}

export class UsageTrackingService {
  /**
   * Calculate credits to deduct based on call usage
   */
  static calculateCallCredits(
    durationSeconds: number,
    provider: 'vapi' | 'retell' | 'ultravox' | 'elevenlabs' | 'ghl',
    callCost?: number
  ): UsageCalculation {
    const durationMinutes = Math.ceil(durationSeconds / 60); // Round up to next minute
    const usageRate = CREDIT_USAGE_RATES.voice_ai;
    
    // Provider-specific multipliers
    const providerMultipliers = {
      vapi: 1.0,
      retell: 1.1, // Slightly higher due to premium features
      ultravox: 1.2,  // Highest due to advanced capabilities
      elevenlabs: 1.15, // Premium voice AI with advanced features
      ghl: 0.8  // Lower cost due to webhook-only integration
    };

    const baseRate = usageRate.baseRate;
    const multiplier = (usageRate.multiplier || 1.0) * providerMultipliers[provider];
    const minimumCharge = usageRate.minimumCharge || 1;

    // Calculate base cost
    const baseCost = durationMinutes * baseRate * multiplier;
    
    // Apply minimum charge
    const creditsToDeduct = Math.max(baseCost, minimumCharge);

    return {
      creditsToDeduct: Math.ceil(creditsToDeduct),
      costBreakdown: {
        baseCost,
        durationMinutes,
        ratePerMinute: baseRate,
        multiplier,
        minimumCharge,
        providerCost: callCost
      }
    };
  }

  /**
   * Process call usage and deduct credits
   */
  static async processCallUsage(usageData: CallUsageData): Promise<{
    success: boolean;
    creditsDeducted?: number;
    newBalance?: number;
    error?: string;
  }> {
    try {
      // Calculate credits to deduct
      const calculation = this.calculateCallCredits(
        usageData.durationSeconds,
        usageData.provider,
        usageData.callCost
      );

      // Deduct credits from partner
      const result = await CreditService.deductCredits(
        usageData.partnerId,
        calculation.creditsToDeduct,
        'voice_ai',
        usageData.customerId,
        usageData.agentId,
        usageData.sessionId,
        usageData.durationSeconds,
        calculation.costBreakdown,
        {
          provider: usageData.provider,
          callDuration: usageData.durationSeconds,
          callCost: usageData.callCost,
          ...usageData.metadata
        }
      );

      if (!result.success) {
        return { success: false, error: result.error };
      }

      // Log the usage for analytics
      await this.logUsageAnalytics(usageData, calculation);

      logger.info('Processed call usage', {
        operation: 'usage_tracking',
        provider: usageData.provider,
        creditsDeducted: calculation.creditsToDeduct,
        partnerId: usageData.partnerId,
        sessionId: usageData.sessionId
      });

      return {
        success: true,
        creditsDeducted: calculation.creditsToDeduct,
        newBalance: result.newBalance
      };

    } catch (error) {
      logger.error('Error processing call usage', error as Error, {
        operation: 'usage_tracking',
        partnerId: usageData.partnerId,
        provider: usageData.provider,
        sessionId: usageData.sessionId
      });
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Log usage analytics for reporting
   */
  private static async logUsageAnalytics(
    usageData: CallUsageData,
    calculation: UsageCalculation
  ): Promise<void> {
    try {
      await prisma.creditUsageLog.create({
        data: {
          partnerId: usageData.partnerId,
          customerId: usageData.customerId,
          agentId: usageData.agentId,
          usageType: 'voice_ai',
          creditsUsed: calculation.creditsToDeduct,
          costCalculation: calculation.costBreakdown,
          sessionId: usageData.sessionId,
          durationSeconds: usageData.durationSeconds,
          metadata: {
            provider: usageData.provider,
            callCost: usageData.callCost,
            ...usageData.metadata
          }
        }
      });
    } catch (error) {
      logger.error('Error logging usage analytics', error as Error, {
        operation: 'usage_tracking',
        partnerId: usageData.partnerId,
        sessionId: usageData.sessionId,
        creditsUsed: calculation.creditsToDeduct
      });
      // Don't throw - logging shouldn't break the main operation
    }
  }

  /**
   * Get usage analytics for a partner
   */
  static async getPartnerUsageAnalytics(
    partnerId: string,
    startDate?: Date,
    endDate?: Date,
    provider?: string
  ): Promise<{
    totalCreditsUsed: number;
    totalCalls: number;
    totalDuration: number;
    averageCallDuration: number;
    costBreakdown: Record<string, number>;
    usageByProvider: Record<string, {
      credits: number;
      calls: number;
      duration: number;
    }>;
    dailyUsage: Array<{
      date: string;
      credits: number;
      calls: number;
      duration: number;
    }>;
  }> {
    try {
      const whereClause: any = {
        partnerId,
        usageType: 'voice_ai'
      };

      if (startDate || endDate) {
        whereClause.createdAt = {};
        if (startDate) whereClause.createdAt.gte = startDate;
        if (endDate) whereClause.createdAt.lte = endDate;
      }

      if (provider) {
        whereClause.metadata = {
          path: ['provider'],
          equals: provider
        };
      }

      // Get usage logs
      const usageLogs = await prisma.creditUsageLog.findMany({
        where: whereClause,
        orderBy: { createdAt: 'desc' }
      });

      // Calculate totals
      const totalCreditsUsed = usageLogs.reduce((sum, log) => sum + log.creditsUsed, 0);
      const totalCalls = usageLogs.length;
      const totalDuration = usageLogs.reduce((sum, log) => sum + (log.durationSeconds || 0), 0);
      const averageCallDuration = totalCalls > 0 ? Math.round(totalDuration / totalCalls) : 0;

      // Cost breakdown
      const costBreakdown = usageLogs.reduce((acc, log) => {
        const cost = log.costCalculation as any;
        acc.totalBaseCost = (acc.totalBaseCost || 0) + (cost.baseCost || 0);
        acc.totalProviderCost = (acc.totalProviderCost || 0) + (cost.providerCost || 0);
        return acc;
      }, {} as Record<string, number>);

      // Usage by provider
      const usageByProvider = usageLogs.reduce((acc, log) => {
        const provider = (log.metadata as any)?.provider || 'unknown';
        if (!acc[provider]) {
          acc[provider] = { credits: 0, calls: 0, duration: 0 };
        }
        acc[provider].credits += log.creditsUsed;
        acc[provider].calls += 1;
        acc[provider].duration += log.durationSeconds || 0;
        return acc;
      }, {} as Record<string, { credits: number; calls: number; duration: number }>);

      // Daily usage (last 30 days)
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const dailyUsageData = await prisma.creditUsageLog.groupBy({
        by: ['createdAt'],
        where: {
          ...whereClause,
          createdAt: { gte: thirtyDaysAgo }
        },
        _sum: {
          creditsUsed: true,
          durationSeconds: true
        },
        _count: {
          id: true
        }
      });

      // Format daily usage
      const dailyUsage = dailyUsageData.map(day => ({
        date: day.createdAt.toISOString().split('T')[0],
        credits: day._sum.creditsUsed || 0,
        calls: day._count.id,
        duration: day._sum.durationSeconds || 0
      }));

      return {
        totalCreditsUsed,
        totalCalls,
        totalDuration,
        averageCallDuration,
        costBreakdown,
        usageByProvider,
        dailyUsage
      };

    } catch (error) {
      logger.error('Error fetching usage analytics', error as Error, {
        operation: 'usage_tracking',
        partnerId
      });
      throw error;
    }
  }

  /**
   * Check if partner has sufficient credits for a call
   */
  static async checkCreditAvailability(
    partnerId: string,
    estimatedDurationSeconds: number,
    provider: 'vapi' | 'retell' | 'ultravox' | 'elevenlabs' | 'ghl'
  ): Promise<{
    hasCredits: boolean;
    currentBalance: number;
    estimatedCost: number;
    remainingAfter: number;
  }> {
    try {
      // Get current balance
      const creditBalance = await CreditService.getPartnerCreditBalance(partnerId);
      if (!creditBalance) {
        return {
          hasCredits: false,
          currentBalance: 0,
          estimatedCost: 0,
          remainingAfter: 0
        };
      }

      // Calculate estimated cost
      const calculation = this.calculateCallCredits(estimatedDurationSeconds, provider);
      const estimatedCost = calculation.creditsToDeduct;
      const remainingAfter = creditBalance.currentBalance - estimatedCost;

      return {
        hasCredits: remainingAfter >= 0,
        currentBalance: creditBalance.currentBalance,
        estimatedCost,
        remainingAfter: Math.max(0, remainingAfter)
      };

    } catch (error) {
      logger.error('Error checking credit availability', error as Error, {
        operation: 'usage_tracking',
        partnerId,
        estimatedDurationSeconds,
        provider
      });
      return {
        hasCredits: false,
        currentBalance: 0,
        estimatedCost: 0,
        remainingAfter: 0
      };
    }
  }
}
