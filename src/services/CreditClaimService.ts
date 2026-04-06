import { PrismaClient } from '@prisma/client';
import { CreditService } from '@/lib/services/creditService';

export interface CreditClaimResult {
  success: boolean;
  message: string;
  creditsAwarded: number;
  bonusCredits?: number;
  totalCredits: number;
  claimId: string;
  socialShareUrl?: string;
}

export interface CreditClaimOptions {
  claimMethod: 'direct' | 'social_share';
  socialMessage?: string;
}

export class CreditClaimService {
  constructor(private prisma: PrismaClient) {}

  /**
   * Check if a partner can claim credits for onboarding
   */
  async canClaimOnboardingCredits(partnerId: string): Promise<{
    canClaim: boolean;
    reason?: string;
    creditsAvailable: number;
  }> {
    try {
      // Check if onboarding is complete
      const partner = await this.prisma.partner.findUnique({
        where: { id: partnerId },
        select: { walkthroughCompletedAt: true }
      });

      if (!partner) {
        return { canClaim: false, reason: 'Partner not found', creditsAvailable: 0 };
      }

      // Check if already claimed
      const existingClaim = await this.prisma.creditClaim.findFirst({
        where: {
          partnerId,
          claimType: 'onboarding',
          referenceId: null
        }
      });

      if (existingClaim) {
        return { canClaim: false, reason: 'Already claimed', creditsAvailable: 0 };
      }

      // Check if onboarding is complete (all 6 steps)
      const { OnboardingTracker } = await import('./OnboardingTracker');
      const tracker = new OnboardingTracker(this.prisma);
      const progress = await tracker.getProgress(partnerId);

      if (!progress.isComplete) {
        return { 
          canClaim: false, 
          reason: 'Onboarding not complete', 
          creditsAvailable: 0 
        };
      }

      return { canClaim: true, creditsAvailable: 100 };
    } catch (error) {
      console.error('Error checking onboarding credit eligibility:', error);
      return { canClaim: false, reason: 'System error', creditsAvailable: 0 };
    }
  }

  /**
   * Check if a partner can claim credits for a daily challenge
   */
  async canClaimChallengeCredits(partnerId: string, challengeId: string): Promise<{
    canClaim: boolean;
    reason?: string;
    creditsAvailable: number;
  }> {
    try {
      // Check if challenge is completed
      const progress = await this.prisma.partnerChallengeProgress.findUnique({
        where: {
          partnerId_challengeId: {
            partnerId,
            challengeId
          }
        },
        include: {
          challenge: {
            select: {
              rewardCredits: true,
              title: true
            }
          }
        }
      });

      if (!progress || progress.status !== 'completed') {
        return { canClaim: false, reason: 'Challenge not completed', creditsAvailable: 0 };
      }

      // Check if already claimed
      const existingClaim = await this.prisma.creditClaim.findFirst({
        where: {
          partnerId,
          claimType: 'daily_challenge',
          referenceId: challengeId
        }
      });

      if (existingClaim) {
        return { canClaim: false, reason: 'Already claimed', creditsAvailable: 0 };
      }

      return { 
        canClaim: true, 
        creditsAvailable: progress.challenge.rewardCredits 
      };
    } catch (error) {
      console.error('Error checking challenge credit eligibility:', error);
      return { canClaim: false, reason: 'System error', creditsAvailable: 0 };
    }
  }

  /**
   * Claim onboarding credits
   */
  async claimOnboardingCredits(
    partnerId: string, 
    options: CreditClaimOptions
  ): Promise<CreditClaimResult> {
    try {
      // Verify eligibility
      const eligibility = await this.canClaimOnboardingCredits(partnerId);
      if (!eligibility.canClaim) {
        return {
          success: false,
          message: eligibility.reason || 'Cannot claim credits',
          creditsAwarded: 0,
          totalCredits: 0,
          claimId: ''
        };
      }

      const baseCredits = 100;
      const bonusCredits = options.claimMethod === 'social_share' ? 100 : 0;
      const totalCredits = baseCredits + (options.claimMethod === 'direct' ? 0 : bonusCredits);

      // Create social share URL if needed
      let socialShareUrl: string | undefined;
      if (options.claimMethod === 'social_share') {
        const partner = await this.prisma.partner.findUnique({
          where: { id: partnerId },
          select: { businessName: true }
        });

        const message = options.socialMessage ||
          `🎉 Just completed my onboarding with @KnotieAIPro! Excited to start building amazing voice AI experiences for my clients. The future of customer engagement is here! 🚀\n\nCheckout https://knotie-ai.pro?ref=${partner?.businessName?.replace(/\s+/g, '') || partnerId}\n\n#VoiceAI #KnotieAI #CustomerExperience`;

        socialShareUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(message)}`;
      }

      // Award base credits immediately
      await CreditService.addCredits(
        partnerId,
        baseCredits,
        'allocation',
        'Onboarding completion reward - 100 Knotie Credits',
        `onboarding-completion-${partnerId}-${Date.now()}`,
        'system',
        {
          onboardingCompletion: true,
          claimMethod: options.claimMethod,
          completedAt: new Date().toISOString()
        }
      );

      // Create credit claim record
      const claim = await this.prisma.creditClaim.create({
        data: {
          partnerId,
          claimType: 'onboarding',
          referenceId: null,
          baseCredits,
          bonusCredits,
          totalCredits,
          claimMethod: options.claimMethod,
          socialShareUrl,
          bonusAwarded: options.claimMethod === 'direct'
        }
      });

      // Mark onboarding as completed
      await this.prisma.partner.update({
        where: { id: partnerId },
        data: { walkthroughCompletedAt: new Date() }
      });

      // Schedule bonus credit award if social share
      if (options.claimMethod === 'social_share') {
        this.scheduleBonusCredits(claim.id, partnerId, bonusCredits);
      }

      return {
        success: true,
        message: options.claimMethod === 'direct' 
          ? 'Congratulations! 100 Knotie Credits have been added to your account!'
          : 'Base credits awarded! Share on X to get your bonus credits!',
        creditsAwarded: baseCredits,
        bonusCredits: options.claimMethod === 'social_share' ? bonusCredits : undefined,
        totalCredits: baseCredits,
        claimId: claim.id,
        socialShareUrl
      };
    } catch (error) {
      console.error('Error claiming onboarding credits:', error);
      return {
        success: false,
        message: 'Failed to claim credits. Please try again.',
        creditsAwarded: 0,
        totalCredits: 0,
        claimId: ''
      };
    }
  }

  /**
   * Claim daily challenge credits
   */
  async claimChallengeCredits(
    partnerId: string,
    challengeId: string,
    options: CreditClaimOptions
  ): Promise<CreditClaimResult> {
    try {
      // Verify eligibility
      const eligibility = await this.canClaimChallengeCredits(partnerId, challengeId);
      if (!eligibility.canClaim) {
        return {
          success: false,
          message: eligibility.reason || 'Cannot claim credits',
          creditsAwarded: 0,
          totalCredits: 0,
          claimId: ''
        };
      }

      const baseCredits = eligibility.creditsAvailable;
      const bonusCredits = options.claimMethod === 'social_share' ? baseCredits : 0;
      const totalCredits = baseCredits + (options.claimMethod === 'direct' ? 0 : bonusCredits);

      // Get challenge info
      const challenge = await this.prisma.dailyChallenge.findUnique({
        where: { id: challengeId },
        select: { title: true }
      });

      // Create social share URL if needed
      let socialShareUrl: string | undefined;
      if (options.claimMethod === 'social_share') {
        const partner = await this.prisma.partner.findUnique({
          where: { id: partnerId },
          select: { businessName: true }
        });

        const message = options.socialMessage ||
          `🚀 Just completed the "${challenge?.title}" challenge with @KnotieAIPro! Another step forward in mastering voice AI technology. 💪\n\nCheckout https://knotie-ai.pro?ref=${partner?.businessName?.replace(/\s+/g, '') || partnerId}\n\n#VoiceAI #KnotieAI #DailyChallenge`;

        socialShareUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(message)}`;
      }

      // Award base credits immediately
      await CreditService.addCredits(
        partnerId,
        baseCredits,
        'allocation',
        `Daily Challenge completion: ${challenge?.title}`,
        `challenge-${challengeId}-${Date.now()}`,
        'system',
        {
          challengeId,
          challengeTitle: challenge?.title,
          claimMethod: options.claimMethod,
          completedAt: new Date().toISOString()
        }
      );

      // Create credit claim record
      const claim = await this.prisma.creditClaim.create({
        data: {
          partnerId,
          claimType: 'daily_challenge',
          referenceId: challengeId,
          baseCredits,
          bonusCredits,
          totalCredits,
          claimMethod: options.claimMethod,
          socialShareUrl,
          bonusAwarded: options.claimMethod === 'direct'
        }
      });

      // Schedule bonus credit award if social share
      if (options.claimMethod === 'social_share') {
        this.scheduleBonusCredits(claim.id, partnerId, bonusCredits);
      }

      return {
        success: true,
        message: options.claimMethod === 'direct' 
          ? `Congratulations! ${baseCredits} Knotie Credits have been added to your account!`
          : `Base credits awarded! Share on X to get ${bonusCredits} bonus credits!`,
        creditsAwarded: baseCredits,
        bonusCredits: options.claimMethod === 'social_share' ? bonusCredits : undefined,
        totalCredits: baseCredits,
        claimId: claim.id,
        socialShareUrl
      };
    } catch (error) {
      console.error('Error claiming challenge credits:', error);
      return {
        success: false,
        message: 'Failed to claim credits. Please try again.',
        creditsAwarded: 0,
        totalCredits: 0,
        claimId: ''
      };
    }
  }

  /**
   * Schedule bonus credits to be awarded after a random delay (1-3 days)
   */
  private scheduleBonusCredits(claimId: string, partnerId: string, bonusCredits: number) {
    // Random delay between 1-3 days (in milliseconds)
    const minDelay = 24 * 60 * 60 * 1000; // 1 day
    const maxDelay = 72 * 60 * 60 * 1000; // 3 days
    const delay = Math.floor(Math.random() * (maxDelay - minDelay + 1)) + minDelay;

    setTimeout(async () => {
      try {
        // Award bonus credits
        await CreditService.addCredits(
          partnerId,
          bonusCredits,
          'allocation',
          'Social sharing bonus credits',
          `social-bonus-${claimId}-${Date.now()}`,
          'system',
          {
            claimId,
            socialSharingBonus: true,
            awardedAt: new Date().toISOString()
          }
        );

        // Update claim record
        await this.prisma.creditClaim.update({
          where: { id: claimId },
          data: {
            bonusAwarded: true,
            bonusAwardedAt: new Date()
          }
        });

        console.log(`Bonus credits awarded for claim ${claimId}: ${bonusCredits} credits`);
      } catch (error) {
        console.error(`Error awarding bonus credits for claim ${claimId}:`, error);
      }
    }, delay);
  }

  /**
   * Get pending credit claims for a partner
   */
  async getPendingClaims(partnerId: string) {
    try {
      const onboardingEligibility = await this.canClaimOnboardingCredits(partnerId);
      const pendingClaims = [];

      if (onboardingEligibility.canClaim) {
        pendingClaims.push({
          type: 'onboarding',
          credits: onboardingEligibility.creditsAvailable,
          title: 'Onboarding Completion',
          description: 'Complete all 6 onboarding steps'
        });
      }

      // Check for completed but unclaimed daily challenges
      const completedChallenges = await this.prisma.partnerChallengeProgress.findMany({
        where: {
          partnerId,
          status: 'completed'
        },
        include: {
          challenge: {
            select: {
              id: true,
              title: true,
              rewardCredits: true
            }
          }
        }
      });

      for (const progress of completedChallenges) {
        const eligibility = await this.canClaimChallengeCredits(partnerId, progress.challengeId);
        if (eligibility.canClaim) {
          pendingClaims.push({
            type: 'daily_challenge',
            referenceId: progress.challengeId,
            credits: eligibility.creditsAvailable,
            title: progress.challenge.title,
            description: 'Daily challenge completed'
          });
        }
      }

      return pendingClaims;
    } catch (error) {
      console.error('Error getting pending claims:', error);
      return [];
    }
  }
}
