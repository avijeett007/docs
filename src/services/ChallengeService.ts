import { PrismaClient } from '@prisma/client';
import { CreditService } from '@/lib/services/creditService';

export interface ChallengeStep {
  id: string;
  title: string;
  description: string;
  type: 'video' | 'action' | 'verification' | 'reading';
  videoUrl?: string;
  guideUrl?: string;
  targetPage?: string;
  completionCriteria?: string;
  requiresProof?: boolean;
  proofInstructions?: string;
  notes?: string;
  estimatedTime?: number;
}

export interface DailyChallenge {
  id: string;
  title: string;
  description?: string | null;
  steps: ChallengeStep[];
  rewardCredits: number;
  requiresProof: boolean;
  scheduledDate?: Date | null;
  isActive: boolean;
  createdBy?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface PartnerChallengeProgress {
  id: string;
  partnerId: string;
  challengeId: string;
  status: 'not_started' | 'in_progress' | 'completed' | 'skipped';
  completedSteps: string[];
  proofSubmitted?: string | null;
  proofStatus: 'pending' | 'approved' | 'rejected';
  startedAt?: Date | null;
  completedAt?: Date | null;
  creditsAwarded: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface ChallengeWithProgress extends DailyChallenge {
  partnerProgress?: PartnerChallengeProgress;
}

export class ChallengeService {
  constructor(private prisma: PrismaClient) {}

  async getCurrentChallenge(partnerId: string): Promise<ChallengeWithProgress | null> {
    // Check if partner should see daily challenges (onboarding completed)
    const partner = await this.prisma.partner.findUnique({
      where: { id: partnerId },
      select: {
        walkthroughCompletedAt: true,
      }
    });

    if (!partner?.walkthroughCompletedAt) {
      return null;
    }

    // Check if it's been at least 1 day since onboarding completion (skip in development)
    const nodeEnv = process.env.NODE_ENV || '';
    const isDevelopment = ['development', 'local'].includes(nodeEnv) ||
                         process.env.DATABASE_PROVIDER === 'sqlite';
    if (!isDevelopment) {
      const oneDayAfterCompletion = new Date(partner.walkthroughCompletedAt);
      oneDayAfterCompletion.setDate(oneDayAfterCompletion.getDate() + 1);

      if (new Date() < oneDayAfterCompletion) {
        return null;
      }
    }

    // Get today's challenge
    const today = new Date().toISOString().split('T')[0];
    
    const challenge = await this.prisma.dailyChallenge.findFirst({
      where: {
        scheduledDate: new Date(today),
        isActive: true
      }
    });

    if (!challenge) {
      return null;
    }

    // Get partner's progress for this challenge
    const progress = await this.prisma.partnerChallengeProgress.findUnique({
      where: {
        partnerId_challengeId: {
          partnerId,
          challengeId: challenge.id
        }
      }
    });

    return {
      ...challenge,
      steps: (challenge.steps as unknown) as ChallengeStep[],
      partnerProgress: progress ? {
        ...progress,
        status: progress.status as 'not_started' | 'in_progress' | 'completed' | 'skipped',
        completedSteps: (progress.completedSteps as unknown) as string[],
        proofStatus: progress.proofStatus as 'pending' | 'approved' | 'rejected'
      } : undefined
    };
  }

  async startChallenge(partnerId: string, challengeId: string): Promise<PartnerChallengeProgress> {
    // Verify challenge exists and is active
    const challenge = await this.prisma.dailyChallenge.findUnique({
      where: { id: challengeId }
    });

    if (!challenge || !challenge.isActive) {
      throw new Error('Challenge not found or not active');
    }

    // Check if challenge is scheduled for today
    const today = new Date().toISOString().split('T')[0];
    const challengeDate = challenge.scheduledDate?.toISOString().split('T')[0];
    
    if (challengeDate !== today) {
      throw new Error('Challenge is not available today');
    }

    // Start or update challenge progress
    const progress = await this.prisma.partnerChallengeProgress.upsert({
      where: {
        partnerId_challengeId: {
          partnerId,
          challengeId
        }
      },
      update: {
        status: 'in_progress',
        startedAt: new Date(),
        updatedAt: new Date()
      },
      create: {
        partnerId,
        challengeId,
        status: 'in_progress',
        startedAt: new Date(),
        completedSteps: []
      }
    });

    return {
      ...progress,
      status: progress.status as 'not_started' | 'in_progress' | 'completed' | 'skipped',
      completedSteps: (progress.completedSteps as unknown) as string[],
      proofStatus: progress.proofStatus as 'pending' | 'approved' | 'rejected'
    };
  }

  async completeStep(
    partnerId: string, 
    challengeId: string, 
    stepId: string
  ): Promise<PartnerChallengeProgress> {
    const progress = await this.prisma.partnerChallengeProgress.findUnique({
      where: {
        partnerId_challengeId: {
          partnerId,
          challengeId
        }
      }
    });

    if (!progress) {
      throw new Error('Challenge not started');
    }

    if (progress.status === 'completed') {
      throw new Error('Challenge already completed');
    }

    // Get challenge details to validate step
    const challenge = await this.prisma.dailyChallenge.findUnique({
      where: { id: challengeId }
    });

    if (!challenge) {
      throw new Error('Challenge not found');
    }

    const steps = (challenge.steps as unknown) as ChallengeStep[];
    const stepExists = steps.some(step => step.id === stepId);

    if (!stepExists) {
      throw new Error('Invalid step ID');
    }

    // Add step to completed steps if not already completed
    const completedSteps = progress.completedSteps as string[];
    if (!completedSteps.includes(stepId)) {
      const updatedCompletedSteps = [...completedSteps, stepId];

      const updatedProgress = await this.prisma.partnerChallengeProgress.update({
        where: { id: progress.id },
        data: {
          completedSteps: updatedCompletedSteps,
          updatedAt: new Date()
        }
      });

      return {
        ...updatedProgress,
        status: updatedProgress.status as 'not_started' | 'in_progress' | 'completed' | 'skipped',
        completedSteps: (updatedProgress.completedSteps as unknown) as string[],
        proofStatus: updatedProgress.proofStatus as 'pending' | 'approved' | 'rejected'
      };
    }

    return {
      ...progress,
      status: progress.status as 'not_started' | 'in_progress' | 'completed' | 'skipped',
      completedSteps: (progress.completedSteps as unknown) as string[],
      proofStatus: progress.proofStatus as 'pending' | 'approved' | 'rejected'
    };
  }

  async completeChallenge(
    partnerId: string, 
    challengeId: string, 
    proofSubmitted?: string
  ): Promise<PartnerChallengeProgress> {
    const [challenge, progress] = await Promise.all([
      this.prisma.dailyChallenge.findUnique({
        where: { id: challengeId }
      }),
      this.prisma.partnerChallengeProgress.findUnique({
        where: {
          partnerId_challengeId: {
            partnerId,
            challengeId
          }
        }
      })
    ]);

    if (!challenge) {
      throw new Error('Challenge not found');
    }

    if (!progress) {
      throw new Error('Challenge not started');
    }

    if (progress.status === 'completed') {
      throw new Error('Challenge already completed');
    }

    // Parse steps from JSON string to array
    let steps: ChallengeStep[];
    try {
      steps = typeof challenge.steps === 'string'
        ? JSON.parse(challenge.steps)
        : (challenge.steps as unknown) as ChallengeStep[];
    } catch (error) {
      console.error('Error parsing challenge steps:', error);
      throw new Error('Invalid challenge data');
    }

    // Validate all steps are completed
    const completedSteps = progress.completedSteps as string[];

    if (completedSteps.length < steps.length) {
      throw new Error('All steps must be completed before finishing the challenge');
    }

    // Check if proof is required
    if (challenge.requiresProof && !proofSubmitted) {
      throw new Error('Proof submission is required for this challenge');
    }

    // Complete the challenge and award credits
    const updatedProgress = await this.prisma.partnerChallengeProgress.update({
      where: { id: progress.id },
      data: {
        status: 'completed',
        completedAt: new Date(),
        creditsAwarded: challenge.rewardCredits,
        proofSubmitted: proofSubmitted || null,
        proofStatus: challenge.requiresProof ? 'pending' : 'approved',
        updatedAt: new Date()
      }
    });

    // Award credits to partner (only if no proof required or proof is auto-approved)
    if (challenge.rewardCredits > 0 && !challenge.requiresProof) {
      await CreditService.addCredits(
        partnerId,
        challenge.rewardCredits,
        'allocation',
        `Daily Challenge completion: ${challenge.title}`,
        `challenge-${challengeId}-${Date.now()}`,
        'system',
        {
          challengeId: challengeId,
          challengeTitle: challenge.title,
          completedAt: new Date().toISOString()
        }
      );
    }

    return {
      ...updatedProgress,
      status: updatedProgress.status as 'not_started' | 'in_progress' | 'completed' | 'skipped',
      completedSteps: (updatedProgress.completedSteps as unknown) as string[],
      proofStatus: updatedProgress.proofStatus as 'pending' | 'approved' | 'rejected'
    };
  }


}
