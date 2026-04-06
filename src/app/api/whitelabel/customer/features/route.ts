import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyCustomerJWT } from '@/lib/customerJwt';
import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';

// Mark this route as dynamic
export const dynamic = 'force-dynamic';

export async function GET(_request: NextRequest) {
  try {
    // Get the customer token from cookies
    const cookieStore = cookies();
    const token = cookieStore.get('customer_token')?.value;

    if (!token) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Verify the token
    const payload = await verifyCustomerJWT(token);
    if (!payload) {
      return NextResponse.json(
        { error: 'Invalid token' },
        { status: 401 }
      );
    }



    // Get the customer ID and partner ID from the token
    const { customerId, partnerId } = payload;

    logger.info('Fetching customer features', { operation: 'get_customer_features', customerId, partnerId });

    // Get the customer record and partner gateway settings in parallel
    const [customer, partner] = await Promise.all([
      prisma.customer.findUnique({
        where: { id: customerId },
        include: {
          credentials: {
            where: { partnerId },
            select: { partnerId: true }
          }
        }
      }),
      prisma.partner.findUnique({
        where: { id: partnerId },
        select: {
          customerGatewayEnabled: true,
        }
      })
    ]);

    if (!customer) {
      logger.warn('Customer not found', { operation: 'get_customer_features', customerId });
      return NextResponse.json({ error: 'Customer not found' }, { status: 404 });
    }

    logger.debug('Customer found', { operation: 'get_customer_features', customerId: customer.id });

    // Get the customer record to find their email and AI Credits settings
    const customerRecord = await prisma.customer.findUnique({
      where: { id: customerId },
      select: {
        email: true,
        aiCreditsEnabled: true
      }
    });

    if (!customerRecord || !customerRecord.email) {
      logger.warn('Customer has no email, returning defaults', { operation: 'get_customer_features', customerId });
      return NextResponse.json({
        enableAdvancedAnalytics: false,
        enableDetailedCallAnalysis: false,
        enableActionPointAnalysis: false,
        // API access
        enableApiAccess: false,
        // Menu visibility options
        showKnowledgeBase: false,
        showIntegration: false,
        showDocsAndMedia: false,
        showScheduleMeeting: false,
        showApiKeys: false,
        // Billing
        showBilling: false,
        // Phone numbers
        showPhoneNumbers: false,
        // Team management
        maxTeamMembers: 0,
        enableTeamMembers: false
      });
    }

    logger.debug('Looking for UserOnboarding record', { operation: 'get_customer_features', email: customerRecord.email, partnerId });

    // Get the customer's features from the UserOnboarding table using email match
    const userOnboarding = await prisma.userOnboarding.findFirst({
      where: {
        email: customerRecord.email,
        partnerId: partnerId
      },
      select: {
        enableAdvancedAnalytics: true,
        enableDetailedCallAnalysis: true,
        enableActionPointAnalysis: true,
        // API access
        enableApiAccess: true,
        // Menu visibility options
        showKnowledgeBase: true,
        showIntegration: true,
        allowedApps: true,
        showDocsAndMedia: true,
        showScheduleMeeting: true,
        showApiKeys: true,
        // Pricing information visibility
        showPricingInformation: true,
        // Phone numbers
        showPhoneNumbers: true,
        // Team management
        maxTeamMembers: true,
        enableTeamMembers: true,
        // AI Gateway
        showAiGateway: true
      }
    });

    // If no user onboarding record is found, return default values (all features disabled)
    if (!userOnboarding) {
      logger.info('No user onboarding record found, returning defaults', { operation: 'get_customer_features', customerId, partnerId });

      // Check if AI Credits are enabled even without onboarding record
      const aiCreditsEnabled = customerRecord?.aiCreditsEnabled || false;

      return NextResponse.json({
        enableAdvancedAnalytics: false,
        enableDetailedCallAnalysis: false,
        enableActionPointAnalysis: false,
        // API access
        enableApiAccess: false,
        // Menu visibility options
        showKnowledgeBase: false,
        showIntegration: false,
        allowedApps: [],
        showDocsAndMedia: false,
        showScheduleMeeting: false,
        showApiKeys: false,
        // Billing
        showBilling: false,
        // Pricing information visibility - disabled if AI Credits are enabled
        showPricingInformation: false,
        // Phone numbers
        showPhoneNumbers: false,
        // Team management
        maxTeamMembers: 0,
        enableTeamMembers: false,
        // AI Credits status
        aiCreditsEnabled: aiCreditsEnabled
      });
    }

    // Check if customer has credentials (portal access) to enable billing
    const hasCredentials = customer.credentials && customer.credentials.length > 0;



    // Check if AI Credits are enabled - if so, disable pricing information
    const aiCreditsEnabled = customerRecord?.aiCreditsEnabled || false;
    const showPricingInformation = aiCreditsEnabled ? false : (userOnboarding.showPricingInformation || false);

    // AI Gateway is enabled when:
    // 1. Customer has AI Credits enabled
    // 2. Customer has showAiGateway flag set (either auto-enabled for new customers or manually by partner)
    // 3. Partner has the master customerGatewayEnabled toggle on
    // Note: customerGatewayForExistingCustomers only governs self-service enrollment,
    //       NOT customers who were individually authorized via showAiGateway.
    const aiGatewayEnabled = aiCreditsEnabled && (userOnboarding.showAiGateway || false) && (partner?.customerGatewayEnabled || false);

    // Return the customer's features
    return NextResponse.json({
      enableAdvancedAnalytics: userOnboarding.enableAdvancedAnalytics || false,
      enableDetailedCallAnalysis: userOnboarding.enableDetailedCallAnalysis || false,
      enableActionPointAnalysis: userOnboarding.enableActionPointAnalysis || false,
      // API access
      enableApiAccess: userOnboarding.enableApiAccess || false,
      // Menu visibility options
      showKnowledgeBase: userOnboarding.showKnowledgeBase || false,
      showIntegration: userOnboarding.showIntegration || false,
      allowedApps: (() => { try { return JSON.parse(userOnboarding.allowedApps || '[]'); } catch { return []; } })(),
      showDocsAndMedia: userOnboarding.showDocsAndMedia || false,
      showScheduleMeeting: userOnboarding.showScheduleMeeting || false,
      showApiKeys: userOnboarding.showApiKeys || false,
      // Billing - enabled if customer has portal access credentials
      showBilling: hasCredentials,
      // Pricing information visibility - disabled if AI Credits are enabled
      showPricingInformation: showPricingInformation,
      // Phone numbers
      showPhoneNumbers: userOnboarding.showPhoneNumbers || false,
      // Team management
      maxTeamMembers: userOnboarding.maxTeamMembers || 0,
      enableTeamMembers: userOnboarding.enableTeamMembers || false,
      // AI Credits status
      aiCreditsEnabled: aiCreditsEnabled,
      // AI Gateway
      aiGatewayEnabled: aiGatewayEnabled
    });
  } catch (error) {
    logger.error('Failed to fetch customer features', error instanceof Error ? error : new Error(String(error)), { operation: 'get_customer_features' });
    return NextResponse.json({
      error: 'Internal server error',
      message: 'An unexpected error occurred. Please try again later.'
    }, { status: 500 });
  }
}
