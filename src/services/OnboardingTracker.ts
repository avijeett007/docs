import { PrismaClient } from '@prisma/client';
import { CreditService } from '@/lib/services/creditService';

// Re-export types and constants from the client-safe location
export type { OnboardingProgress, OnboardingStep } from '@/types/onboarding';
export { ONBOARDING_STEPS } from '@/types/onboarding';

// Import types for internal use
import type { OnboardingProgress, OnboardingStep } from '@/types/onboarding';
import { ONBOARDING_STEPS } from '@/types/onboarding';

export class OnboardingTracker {
  constructor(private prisma: PrismaClient) {}

  async getProgress(partnerId: string): Promise<OnboardingProgress> {
    try {
      // Execute all checks in parallel for performance
      const [
        partner,
        customerCount,
        agentCounts,
        activeCustomers
      ] = await Promise.all([
        this.prisma.partner.findUnique({
          where: { id: partnerId },
          select: {
            subdomain: true,
            customDomain: true,
            useCustomSmtp: true,
            smtpHost: true,
            useSESDomain: true,
            sesDomainStatus: true,
            stripeAccountId: true,
            stripeChargesEnabled: true,
            stripeOnboardingCompleted: true,
            walkthroughCompletedAt: true
          }
        }),
        this.prisma.customer.count({
          where: {
            credentials: {
              some: { partnerId }
            }
          }
        }),
        this.getAgentCounts(partnerId),
        this.prisma.customerCredential.count({
          where: {
            partnerId,
            lastLogin: { not: null }
          }
        })
      ]);

      if (!partner) {
        throw new Error('Partner not found');
      }

      // Calculate step completion
      const step1 = !!(partner.subdomain || partner.customDomain);
      const step2 = customerCount > 0;
      const step3 = agentCounts > 0;
      const step4 = activeCustomers > 0;
      const step5 = !!(
        (partner.useCustomSmtp && partner.smtpHost) ||
        (partner.useSESDomain && partner.sesDomainStatus === 'verified')
      );
      const step6 = !!(
        partner.stripeAccountId &&
        partner.stripeChargesEnabled &&
        partner.stripeOnboardingCompleted
      );

      const completedSteps = [step1, step2, step3, step4, step5, step6]
        .filter(Boolean).length;

      const isComplete = completedSteps === 6;
      const nextStep = this.getNextStep([step1, step2, step3, step4, step5, step6]);
      const progressPercentage = Math.round((completedSteps / 6) * 100);

      return {
        step1_customizePod: step1,
        step2_onboardCustomer: step2,
        step3_importAgent: step3,
        step4_reviewAnalytics: step4,
        step5_completeWhitelabel: step5,
        step6_setupPayments: step6,
        completedSteps,
        totalSteps: 6,
        completedAt: partner.walkthroughCompletedAt,
        isComplete,
        nextStep,
        progressPercentage
      };
    } catch (error) {
      console.error('Error getting onboarding progress:', error);
      // Return default progress on error
      return {
        step1_customizePod: false,
        step2_onboardCustomer: false,
        step3_importAgent: false,
        step4_reviewAnalytics: false,
        step5_completeWhitelabel: false,
        step6_setupPayments: false,
        completedSteps: 0,
        totalSteps: 6,
        completedAt: null,
        isComplete: false,
        nextStep: 1,
        progressPercentage: 0
      };
    }
  }

  private async getAgentCounts(partnerId: string): Promise<number> {
    try {
      const [retell, vapi, ultravox, elevenlabs, ghl, byoAgents] = await Promise.all([
        this.prisma.retellAgent.count({ where: { partnerId } }).catch(() => 0),
        this.prisma.vapiAgent.count({ where: { partnerId } }).catch(() => 0),
        this.prisma.ultravoxAgent.count({ where: { partnerId } }).catch(() => 0),
        this.prisma.elevenLabsAgent.count({ where: { partnerId } }).catch(() => 0),
        this.prisma.ghlAgent.count({ where: { partnerId } }).catch(() => 0),
        this.prisma.byoAgent.count({ where: { partnerId } }).catch(() => 0)
      ]);

      return retell + vapi + ultravox + elevenlabs + ghl + byoAgents;
    } catch (error) {
      console.error('Error counting agents:', error);
      return 0;
    }
  }

  private getNextStep(steps: boolean[]): number | undefined {
    const nextIncompleteIndex = steps.findIndex(step => !step);
    return nextIncompleteIndex === -1 ? undefined : nextIncompleteIndex + 1;
  }

  async completeOnboarding(partnerId: string): Promise<{
    completedAt: Date;
    creditsAwarded: number;
    newCreditBalance: number;
  }> {
    try {
      const completedAt = new Date();
      const creditsAwarded = 100; // 100 Knotie credits reward

      // Mark onboarding as completed
      await this.prisma.partner.update({
        where: { id: partnerId },
        data: {
          walkthroughCompletedAt: completedAt
        }
      });

      // Award credits using the existing credit service
      const creditResult = await CreditService.addCredits(
        partnerId,
        creditsAwarded,
        'allocation',
        'Onboarding completion reward - 100 Knotie Credits',
        `onboarding-completion-${partnerId}-${Date.now()}`,
        'system',
        {
          onboardingCompletion: true,
          completedAt: completedAt.toISOString()
        }
      );

      if (!creditResult.success) {
        console.error('Failed to award onboarding credits:', creditResult.error);
        throw new Error('Failed to award completion credits');
      }

      return {
        completedAt,
        creditsAwarded,
        newCreditBalance: creditResult.newBalance || 0
      };
    } catch (error) {
      console.error('Error completing onboarding:', error);
      throw error;
    }
  }

  getStepInfo(stepNumber: number): OnboardingStep | undefined {
    return ONBOARDING_STEPS.find(step => step.id === stepNumber);
  }

  getAllSteps(): OnboardingStep[] {
    return ONBOARDING_STEPS;
  }
}
