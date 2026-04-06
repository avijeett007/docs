import { prisma } from './prisma';
import {
  saveUserOnboardingData,
  getUserOnboardingData,
  saveWorkflowSubmission,
  getWorkflowSubmissions
} from './db';
import { logger } from './logger';

async function testDatabaseOperations() {
  try {
    logger.info('Starting database tests', {
      operation: 'db_test'
    });

    // Test 1: Save user onboarding data
    logger.info('Test 1: Saving user onboarding data', {
      operation: 'db_test'
    });
    const testUser = {
      userId: 'test-user-123',
      email: 'test@example.com',
      firstName: 'Test',
      lastName: 'User',
      companyName: 'Test Company',
      businessPhone: '123-456-7890',
      monthlyCallVolume: '100-500 calls',
      peakHours: '9 AM - 5 PM EST',
      primaryUseCase: 'Customer Support',
      callComplexity: 'Moderate',
      crmSystem: 'Salesforce',
      phoneSystem: 'Twilio',
      scriptComplexity: 'Medium',
      languages: ['English', 'Spanish'], // Pass as string array instead of JSON string
      deploymentTimeline: '1-2 months',
      wantsDemo: true,
      isOnboardingCompleted: false
    };

    const saveResult = await saveUserOnboardingData(testUser);
    if (saveResult.error) {
      throw new Error(`Failed to save user data: ${saveResult.error}`);
    }
    logger.info('User data saved successfully', {
      operation: 'db_test',
      savedData: saveResult.data
    });

    // Test 2: Retrieve user onboarding data
    logger.info('Test 2: Retrieving user onboarding data', {
      operation: 'db_test'
    });
    const getUserResult = await getUserOnboardingData(testUser.userId);
    if (getUserResult.error) {
      throw new Error(`Failed to retrieve user data: ${getUserResult.error}`);
    }
    logger.info('User data retrieved successfully', {
      operation: 'db_test',
      retrievedData: getUserResult.data
    });

    // Test 3: Save workflow submission
    logger.info('Test 3: Saving workflow submission', {
      operation: 'db_test'
    });
    const testWorkflow = {
      userId: testUser.userId,
      submissionData: JSON.stringify({  // Store as JSON string for SQLite
        type: 'onboarding',
        status: 'completed',
        timestamp: new Date().toISOString()
      }),
      status: 'pending'
    };

    const workflowResult = await saveWorkflowSubmission(testWorkflow);
    if (workflowResult.error) {
      throw new Error(`Failed to save workflow: ${workflowResult.error}`);
    }
    logger.info('Workflow submission saved successfully', {
      operation: 'db_test',
      savedWorkflow: workflowResult.data
    });

    // Test 4: Retrieve workflow submissions
    logger.info('Test 4: Retrieving workflow submissions', {
      operation: 'db_test'
    });
    const getWorkflowsResult = await getWorkflowSubmissions(testUser.userId);
    if (getWorkflowsResult.error) {
      throw new Error(`Failed to retrieve workflows: ${getWorkflowsResult.error}`);
    }
    logger.info('Workflow submissions retrieved successfully', {
      operation: 'db_test',
      retrievedWorkflows: getWorkflowsResult.data
    });

    logger.info('All tests completed successfully', {
      operation: 'db_test'
    });

  } catch (error) {
    logger.error('Test failed', error as Error, {
      operation: 'db_test'
    });
  } finally {
    // Clean up test data
    logger.info('Cleaning up test data', {
      operation: 'db_test'
    });
    try {
      await prisma.workflowSubmission.deleteMany({
        where: { userId: 'test-user-123' }
      });
      await prisma.userOnboarding.delete({
        where: { userId: 'test-user-123' }
      });
      logger.info('Test data cleaned up successfully', {
        operation: 'db_test'
      });
    } catch (error) {
      logger.error('Failed to clean up test data', error as Error, {
        operation: 'db_test'
      });
    }

    // Disconnect Prisma client
    await prisma.$disconnect();
  }
}

// Run the tests
testDatabaseOperations();
