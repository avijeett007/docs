import { prisma } from './prisma';
import { calculatePrice } from './pricing';
import { logger } from './logger';

// Export prisma as db for compatibility with existing code
export const db = prisma;

// Re-export prisma for backward compatibility
export { prisma };

// Database connection configured

interface OnboardingData {
  userId: string;
  email: string;
  firstName?: string | null;
  lastName?: string | null;
  companyName?: string | null;
  businessPhone?: string | null;
  monthlyCallVolume?: string | null;
  peakHours?: string | null;
  primaryUseCase?: string | null;
  callComplexity?: string | null;
  crmSystem?: string | null;
  phoneSystem?: string | null;
  scriptComplexity?: string | null;
  languages?: string[];
  deploymentTimeline?: string | null;
  wantsDemo?: boolean;
  isOnboardingCompleted?: boolean;
  estimated_price?: number;
  price_breakdown?: string;
  orderStatus?: string;
}

interface WorkflowData {
  userId: string;
  submissionData: any;
}

interface UserAnswers {
  userId: string;
  answers: Record<string, string>;
}

export async function saveUserOnboardingData(data: OnboardingData) {
  try {
    logger.debug('Starting to save onboarding data', {
      operation: 'db',
      userId: data.userId
    });
    
    // Convert languages array to JSON string
    const languagesString = JSON.stringify(data.languages || []);

    // Parse price breakdown if it's a string
    const priceBreakdown = typeof data.price_breakdown === 'string' 
      ? data.price_breakdown 
      : JSON.stringify(data.price_breakdown || {});

    const result = await prisma.userOnboarding.upsert({
      where: {
        userId: data.userId,
      },
      update: {
        email: data.email,
        firstName: data.firstName || null,
        lastName: data.lastName || null,
        companyName: data.companyName || null,
        businessPhone: data.businessPhone || null,
        monthlyCallVolume: data.monthlyCallVolume || null,
        peakHours: data.peakHours || null,
        primaryUseCase: data.primaryUseCase || null,
        callComplexity: data.callComplexity || null,
        crmSystem: data.crmSystem || null,
        phoneSystem: data.phoneSystem || null,
        scriptComplexity: data.scriptComplexity || null,
        languages: languagesString,
        deploymentTimeline: data.deploymentTimeline || null,
        wantsDemo: data.wantsDemo || false,
        isOnboardingCompleted: data.isOnboardingCompleted || false,
        estimatedPrice: data.estimated_price || 0,
        priceBreakdown: priceBreakdown,
        orderStatus: 'submitted',  // Always set to 'submitted' when saving onboarding data
        updatedAt: new Date(),
      },
      create: {
        userId: data.userId,
        email: data.email,
        firstName: data.firstName || null,
        lastName: data.lastName || null,
        companyName: data.companyName || null,
        businessPhone: data.businessPhone || null,
        monthlyCallVolume: data.monthlyCallVolume || null,
        peakHours: data.peakHours || null,
        primaryUseCase: data.primaryUseCase || null,
        callComplexity: data.callComplexity || null,
        crmSystem: data.crmSystem || null,
        phoneSystem: data.phoneSystem || null,
        scriptComplexity: data.scriptComplexity || null,
        languages: languagesString,
        deploymentTimeline: data.deploymentTimeline || null,
        wantsDemo: data.wantsDemo || false,
        isOnboardingCompleted: data.isOnboardingCompleted || false,
        estimatedPrice: data.estimated_price || 0,
        priceBreakdown: priceBreakdown,
        orderStatus: 'submitted',  // Always set to 'submitted' for new entries
      },
    });


    
    return { data: result };
  } catch (error) {
    logger.error('Error saving user onboarding data', error as Error, {
      operation: 'db',
      userId: data.userId
    });
    
    // Type guard to check if error is an Error object
    const err = error as Error;
    logger.error('Error details for onboarding save', err, {
      operation: 'db',
      userId: data.userId,
      errorName: err.name,
      errorMessage: err.message
    });
    
    return { error: err.message };
  }
}

export async function getUserOnboardingData(userId: string) {
  try {
    logger.debug('Starting to fetch onboarding data', {
      operation: 'db',
      userId
    });
    const data = await prisma.userOnboarding.findUnique({
      where: {
        userId,
      },
    });

    logger.debug('Retrieved onboarding data from database', {
      operation: 'db',
      userId,
      hasData: !!data
    });

    if (data) {
      // Parse JSON strings back to objects/arrays
      const languages = data.languages ? JSON.parse(data.languages) : [];
      const priceBreakdown = data.priceBreakdown ? JSON.parse(data.priceBreakdown) : {};
      
      const processedData = { 
        ...data, 
        languages,
        priceBreakdown,
      };

      logger.debug('Processed onboarding data for client', {
        operation: 'db',
        userId,
        hasProcessedData: !!processedData
      });
      return { data: processedData };
    }

    return { data: null };
  } catch (error) {
    logger.error('Error fetching user onboarding data', error as Error, {
      operation: 'db',
      userId
    });
    
    // Type guard to check if error is an Error object
    const err = error as Error;
    logger.error('Error details for onboarding fetch', err, {
      operation: 'db',
      userId,
      errorName: err.name,
      errorMessage: err.message
    });
    
    return { error: err.message };
  }
}

export async function saveWorkflowSubmission(data: WorkflowData) {
  try {
    const result = await prisma.workflowSubmission.create({
      data: {
        userId: data.userId,
        submissionData: JSON.stringify(data.submissionData),
      },
    });

    return {
      data: {
        ...result,
        submissionData: JSON.parse(result.submissionData),
      },
      error: null
    };
  } catch (error) {
    logger.error('Error saving workflow submission', error as Error, {
      operation: 'db',
      userId: data.userId
    });
    
    // Type guard to check if error is an Error object
    const err = error as Error;
    logger.error('Error details for workflow submission', err, {
      operation: 'db',
      userId: data.userId,
      errorName: err.name,
      errorMessage: err.message
    });
    
    return { data: null, error: err.message };
  }
}

export async function getWorkflowSubmissions(userId: string) {
  try {
    logger.debug('Starting to fetch workflow submissions', {
      operation: 'db',
      userId
    });
    const submissions = await prisma.workflowSubmission.findMany({
      where: {
        userId,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    logger.debug('Retrieved workflow submissions from database', {
      operation: 'db',
      userId,
      submissionsCount: submissions.length
    });
    return { 
      data: submissions.map(sub => ({
        ...sub,
        submissionData: JSON.parse(sub.submissionData),
      })),
      error: null 
    };
  } catch (error) {
    logger.error('Error getting workflow submissions', error as Error, {
      operation: 'db',
      userId
    });
    
    // Type guard to check if error is an Error object
    const err = error as Error;
    logger.error('Error details for workflow submissions fetch', err, {
      operation: 'db',
      userId,
      errorName: err.name,
      errorMessage: err.message
    });
    
    return { data: null, error: err.message };
  }
}

export async function saveUserAnswers(data: UserAnswers) {
  try {
    logger.debug('Starting to save user answers', {
      operation: 'db',
      userId: data.userId
    });
    
    const result = await prisma.userAnswers.upsert({
      where: {
        userId: data.userId,
      },
      update: {
        answers: JSON.stringify(data.answers),
        updatedAt: new Date(),
      },
      create: {
        userId: data.userId,
        answers: JSON.stringify(data.answers),
      },
    });

    return { data: result };
  } catch (error) {
    logger.error('Error saving user answers', error as Error, {
      operation: 'db',
      userId: data.userId
    });
    
    // Type guard to check if error is an Error object
    const err = error as Error;
    logger.error('Error details for user answers save', err, {
      operation: 'db',
      userId: data.userId,
      errorName: err.name,
      errorMessage: err.message
    });
    
    return { error: err.message };
  }
}

export async function getUserAnswers(userId: string) {
  try {
    logger.debug('Getting user answers', {
      operation: 'db',
      userId
    });
    
    const result = await prisma.userAnswers.findUnique({
      where: {
        userId: userId,
      },
    });

    if (!result) {
      return { data: { answers: {} } };
    }

    return { data: { answers: JSON.parse(result.answers) } };
  } catch (error) {
    logger.error('Error getting user answers', error as Error, {
      operation: 'db',
      userId
    });
    
    // Type guard to check if error is an Error object
    const err = error as Error;
    logger.error('Error details for user answers fetch', err, {
      operation: 'db',
      userId,
      errorName: err.name,
      errorMessage: err.message
    });
    
    return { error: err.message };
  }
}
