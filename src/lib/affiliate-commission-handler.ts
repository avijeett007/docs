/**
 * Free Forever Plan Commission Handler
 * 
 * Handles affiliate commission attribution and payment for users who:
 * 1. Sign up for Free Forever plan via referral link
 * 2. Later upgrade to paid plans
 */

import { prisma } from '@/lib/prisma';
import { getRewardfulService } from '@/lib/rewardful';
import { logger } from '@/lib/logger';

interface CommissionCalculationResult {
  shouldPayCommission: boolean;
  commissionAmount: number;
  referringAffiliateId?: string;
  conversionType: 'immediate_paid' | 'free_to_paid_upgrade' | 'none';
}

export class AffiliateCommissionHandler {
  private getRewardfulService() {
    return getRewardfulService();
  }

  /**
   * Store referral attribution for Free Forever signups
   * Called during partner registration (no payment yet)
   */
  async trackReferralAttribution(partnerId: string, referralId: string): Promise<void> {
    try {
      await prisma.partner.update({
        where: { id: partnerId },
        data: {
          referralSource: referralId,
          referralDate: new Date(),
          referralCommissionPaid: false, // Will be set to true when they upgrade and commission is paid
        }
      });

      logger.info('Referral attribution stored for Free Forever signup', {
        operation: 'affiliate_attribution',
        partnerId,
        referralId,
      });
    } catch (error) {
      logger.error('Failed to store referral attribution', error as Error, {
        operation: 'affiliate_attribution',
        partnerId,
        referralId
      });
      // Don't throw - referral tracking failure shouldn't break signup
    }
  }

  /**
   * Calculate and process commission for payment events
   * Called from Stripe webhooks on successful payments
   */
  async processCommissionForPayment(
    stripeCustomerId: string,
    paymentAmount: number,
    subscriptionId: string,
    planId?: string
  ): Promise<CommissionCalculationResult> {
    try {
      const partner = await prisma.partner.findFirst({
        where: { stripeCustomerId }
      });

      if (!partner) {
        return { shouldPayCommission: false, commissionAmount: 0, conversionType: 'none' };
      }

      // Check if this is a Free Forever upgrade (has referral source but commission not yet paid)
      if (partner.referralSource && !partner.referralCommissionPaid) {
        return await this.handleFreeForeverUpgrade(partner, paymentAmount, subscriptionId, planId);
      }

      // Check if this is an immediate paid signup with referral
      const currentReferralId = this.getCurrentReferralId(); // From localStorage or session
      if (currentReferralId && !partner.referralSource) {
        return await this.handleImmediatePaidSignup(partner, currentReferralId, paymentAmount, subscriptionId, planId);
      }

      return { shouldPayCommission: false, commissionAmount: 0, conversionType: 'none' };
    } catch (error) {
      logger.error('Failed to process affiliate commission', error as Error, {
        operation: 'affiliate_commission',
        stripeCustomerId,
        paymentAmount
      });
      return { shouldPayCommission: false, commissionAmount: 0, conversionType: 'none' };
    }
  }

  /**
   * Handle commission for Free Forever → Paid upgrade
   */
  private async handleFreeForeverUpgrade(
    partner: any,
    paymentAmount: number,
    subscriptionId: string,
    planId?: string
  ): Promise<CommissionCalculationResult> {
    const referringAffiliate = await prisma.partner.findFirst({
      where: { rewardfulAffiliateId: partner.referralSource }
    });

    if (!referringAffiliate) {
      logger.warn('Referring affiliate not found for Free Forever upgrade', {
        operation: 'affiliate_commission',
        partnerId: partner.id,
        referralSource: partner.referralSource
      });
      return { shouldPayCommission: false, commissionAmount: 0, conversionType: 'free_to_paid_upgrade' };
    }

    // Calculate commission based on upgrade tier
    const commissionRate = this.getUpgradeCommissionRate(planId, paymentAmount);
    const commissionAmount = Math.round(paymentAmount * commissionRate / 100);

    // Create conversion record
    await prisma.affiliateConversion.create({
      data: {
        referralId: partner.referralSource,
        stripeCustomerId: partner.stripeCustomerId || '',
        amount: paymentAmount,
        currency: 'usd',
        orderId: subscriptionId,
        metadata: {
          conversionType: 'free_to_paid_upgrade',
          originalSignupDate: partner.referralDate,
          upgradeDate: new Date(),
          planId: planId || 'unknown',
          commissionRate
        }
      }
    });

    // Update referring affiliate stats
    await prisma.partner.update({
      where: { id: referringAffiliate.id },
      data: {
        affiliateTotalConversions: { increment: 1 },
        affiliateTotalCommissionEarned: { increment: commissionAmount / 100 }, // Convert cents to dollars
        affiliateLastConversionAt: new Date()
      }
    });

    // Mark commission as paid to prevent double-payment
    await prisma.partner.update({
      where: { id: partner.id },
      data: { referralCommissionPaid: true }
    });

    // Notify Rewardful
    await this.notifyRewardful(partner.referralSource, paymentAmount, subscriptionId);

    logger.info('Free Forever upgrade commission processed', {
      operation: 'affiliate_commission',
      partnerId: partner.id,
      referringAffiliateId: referringAffiliate.id,
      commissionAmount,
      commissionRate
    });

    return {
      shouldPayCommission: true,
      commissionAmount,
      referringAffiliateId: referringAffiliate.id,
      conversionType: 'free_to_paid_upgrade'
    };
  }

  /**
   * Handle commission for immediate paid signup
   */
  private async handleImmediatePaidSignup(
    partner: any,
    referralId: string,
    paymentAmount: number,
    subscriptionId: string,
    planId?: string
  ): Promise<CommissionCalculationResult> {
    // Similar logic but for immediate paid signups
    // Implementation would be similar to handleFreeForeverUpgrade
    // but with different commission rates and no "upgrade" metadata
    
    return { shouldPayCommission: false, commissionAmount: 0, conversionType: 'immediate_paid' };
  }

  /**
   * Get commission rate based on upgrade tier
   */
  private getUpgradeCommissionRate(planId?: string, amount?: number): number {
    // Free Forever → Paid upgrade commission rates
    if (amount && amount >= 69900) return 30; // $699+ plans = 30%
    if (amount && amount >= 14900) return 25; // $149+ plans = 25%
    return 20; // Default upgrade rate = 20%
  }

  /**
   * Get current referral ID from request context
   * This would need to be implemented based on your session/request handling
   */
  private getCurrentReferralId(): string | null {
    // Implementation depends on how you store referral ID during checkout
    // Could be from session, request metadata, etc.
    return null;
  }

  /**
   * Notify Rewardful of conversion
   */
  private async notifyRewardful(referralId: string, amount: number, orderId: string): Promise<void> {
    try {
      await this.getRewardfulService().trackConversion({
        referral_id: referralId,
        amount,
        currency: 'usd',
        order_id: orderId
      });
    } catch (error) {
      logger.error('Failed to notify Rewardful of conversion', error as Error, {
        operation: 'rewardful_notification',
        referralId,
        amount,
        orderId
      });
      // Don't throw - Rewardful notification failure shouldn't break commission processing
    }
  }
}

export const affiliateCommissionHandler = new AffiliateCommissionHandler();
