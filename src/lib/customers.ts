import { prisma } from '@/lib/prisma';
import { logger } from './logger';

/**
 * Get a customer by ID
 * @param customerId The ID of the customer to retrieve
 * @returns The customer object or null if not found
 */
export async function getCustomerById(customerId: string) {
  try {
    const customer = await prisma.customer.findUnique({
      where: { id: customerId },
      include: {
        userOnboarding: {
          select: {
            partnerId: true,
            enableAdvancedAnalytics: true,
            enableDetailedCallAnalysis: true,
            enableActionPointAnalysis: true,
            customerPortalEnabled: true,
            showKnowledgeBase: true,
            showIntegration: true,
            showDocsAndMedia: true,
            showScheduleMeeting: true,
            maxTeamMembers: true,
            enableTeamMembers: true,
          }
        }
      }
    });

    return customer;
  } catch (error) {
    logger.error('Error getting customer by ID', error as Error, {
      operation: 'get_customer_by_id',
      customerId
    });
    return null;
  }
}

/**
 * Get all customers for a partner
 * @param partnerId The ID of the partner
 * @returns Array of customer objects
 */
export async function getCustomersByPartnerId(partnerId: string) {
  try {
    const customers = await prisma.customer.findMany({
      where: {
        userOnboarding: {
          some: {
            partnerId: partnerId
          }
        }
      },
      include: {
        userOnboarding: {
          select: {
            partnerId: true,
            enableAdvancedAnalytics: true,
            enableDetailedCallAnalysis: true,
            enableActionPointAnalysis: true,
            customerPortalEnabled: true,
            showKnowledgeBase: true,
            showIntegration: true,
            showDocsAndMedia: true,
            showScheduleMeeting: true,
            maxTeamMembers: true,
            enableTeamMembers: true,
          }
        }
      }
    });

    return customers;
  } catch (error) {
    logger.error('Error getting customers by partner ID', error as Error, {
      operation: 'get_customers_by_partner',
      partnerId
    });
    return [];
  }
}

/**
 * Check if a customer has API key access enabled
 * @param customerId The ID of the customer
 * @returns Boolean indicating if API key access is enabled
 */
export async function hasApiKeyAccess(customerId: string) {
  try {
    logger.info('Checking API key access for customer', {
      operation: 'check_api_key_access',
      customerId
    });

    // First, check if the customer exists
    const customerExists = await prisma.customer.findUnique({
      where: { id: customerId },
      select: { id: true }
    });

    if (!customerExists) {
      logger.error('Customer not found for API key access check', new Error('Customer not found'), {
        operation: 'check_api_key_access',
        customerId
      });
      return false;
    }

    // Get the user onboarding record directly
    const userOnboarding = await prisma.userOnboarding.findFirst({
      where: { customerId: customerId },
      select: {
        enableApiAccess: true,
        showApiKeys: true,
      }
    });

    logger.info('User onboarding record for API access check', {
      operation: 'check_api_key_access',
      customerId,
      userOnboarding
    });

    // Check if both enableApiAccess and showApiKeys are true
    const hasAccess = userOnboarding?.enableApiAccess === true && userOnboarding?.showApiKeys === true;

    logger.info('API access check result', {
      operation: 'check_api_key_access',
      customerId,
      hasAccess
    });

    return hasAccess;
  } catch (error) {
    logger.error('Error checking API key access', error as Error, {
      operation: 'check_api_key_access',
      customerId
    });
    return false;
  }
}

/**
 * Enable or disable API key access for a customer
 * @param customerId The ID of the customer
 * @param partnerId The ID of the partner
 * @param enabled Whether to enable or disable API key access
 * @returns Boolean indicating success
 */
export async function setApiKeyAccess(customerId: string, partnerId: string, enabled: boolean) {
  try {
    // Find the user onboarding record for this customer and partner
    const userOnboarding = await prisma.userOnboarding.findFirst({
      where: {
        customerId: customerId,
        partnerId: partnerId
      }
    });

    if (!userOnboarding) {
      return false;
    }

    // Update the user onboarding record
    // For now, we'll tie API key access to advanced analytics
    await prisma.userOnboarding.update({
      where: { id: userOnboarding.id },
      data: {
        enableAdvancedAnalytics: enabled
      }
    });

    return true;
  } catch (error) {
    logger.error('Error setting API key access', error as Error, {
      operation: 'set_api_key_access',
      customerId,
      partnerId,
      enabled
    });
    return false;
  }
}
