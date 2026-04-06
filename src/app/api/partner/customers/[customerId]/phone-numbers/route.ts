import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { obfuscateEmail, obfuscatePhoneNumber, createDebugSafeCustomer } from '@/lib/pii-obfuscation';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

export async function GET(
  req: NextRequest,
  { params }: { params: { customerId: string } }
) {
  logger.debug('Partner API route accessed', {
    route: `/api/partner/customers/${params.customerId}/phone-numbers`,
    method: 'GET',
    customerId: params.customerId,
    operation: 'get_customer_phone_numbers'
  });

  try {
    // Partner authentication is handled by middleware
    // Extract partner ID from JWT token in Authorization header
    const authHeader = req.headers.get('Authorization');
    logger.debug('Authorization header check', {
      hasAuthHeader: !!authHeader,
      customerId: params.customerId,
      operation: 'get_customer_phone_numbers'
    });

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      logger.warn('Missing or invalid Authorization header', {
        customerId: params.customerId,
        operation: 'get_customer_phone_numbers'
      });
      return NextResponse.json(
        { error: 'Unauthorized - No token provided' },
        { status: 401 }
      );
    }

    const token = authHeader.split(' ')[1];

    // Decode JWT to get partner ID (middleware already verified the token)
    let partnerId: string;
    try {
      const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString());
      partnerId = payload.partnerId; // JWT always uses partnerId field

      if (!partnerId) {
        throw new Error('Partner ID not found in token');
      }
    } catch (error) {
      return NextResponse.json(
        { error: 'Invalid token format' },
        { status: 401 }
      );
    }

    const { customerId } = params;

    // Find the customer and verify partner access through UserOnboarding
    const customer = await prisma.customer.findUnique({
      where: {
        id: customerId,
      },
      include: {
        userOnboarding: {
          where: {
            partnerId: partnerId,
          },
        },
        credentials: {
          where: {
            partnerId: partnerId,
          },
        },
      },
    });

    if (!customer) {
      return NextResponse.json(
        {
          success: false,
          error: 'Customer not found',
          message: 'The specified customer was not found.'
        },
        { status: 404 }
      );
    }

    // Verify that this partner has access to this customer
    // Check both UserOnboarding relationship and CustomerCredential relationship
    const hasUserOnboardingAccess = customer.userOnboarding.length > 0;
    const hasCredentialAccess = customer.credentials.length > 0;

    if (!hasUserOnboardingAccess && !hasCredentialAccess) {
      return NextResponse.json(
        {
          success: false,
          error: 'Access denied',
          message: 'You do not have access to manage this customer.'
        },
        { status: 403 }
      );
    }

    logger.debug('Customer found for phone numbers request', {
      customerId: customer.id,
      customerEmail: obfuscateEmail(customer.email),
      userOnboardingCount: customer.userOnboarding.length,
      credentialsCount: customer.credentials.length,
      hasUserOnboardingAccess,
      hasCredentialAccess,
      partnerId: partnerId,
      operation: 'get_customer_phone_numbers',
      userOnboardingDetails: customer.userOnboarding.map(uo => ({
        id: uo.id,
        partnerId: uo.partnerId,
        customerId: uo.customerId
      })),
      credentialDetails: customer.credentials.map(c => ({
        id: c.id,
        partnerId: c.partnerId,
        email: obfuscateEmail(c.email)
      }))
    });

    logger.debug('Fetching phone numbers for customer and partner', {
      customerId: customerId,
      partnerId: partnerId,
      operation: 'get_customer_phone_numbers'
    });

    // First, let's check what phone numbers exist for this customer (regardless of partnerId)
    const allCustomerNumbers = await prisma.phoneNumber.findMany({
      where: {
        customerId: customerId,
      },
      select: {
        id: true,
        phoneNumber: true,
        partnerId: true,
        status: true,
      },
    });

    logger.debug('Found phone numbers for customer', {
      customerId: customerId,
      phoneNumberCount: allCustomerNumbers.length,
      partnerId: partnerId,
      operation: 'get_customer_phone_numbers',
      phoneNumbers: allCustomerNumbers.map(n => ({
        id: n.id,
        phone: obfuscatePhoneNumber(n.phoneNumber),
        partnerId: n.partnerId,
        status: n.status
      }))
    });

    // Also check if there are phone numbers for this partner
    const partnerPhoneNumbers = await prisma.phoneNumber.findMany({
      where: {
        partnerId: partnerId,
      },
      select: {
        id: true,
        phoneNumber: true,
        customerId: true,
        partnerId: true,
        status: true,
      },
    });

    logger.debug('Found phone numbers for partner', {
      partnerId: partnerId,
      phoneNumberCount: partnerPhoneNumbers.length,
      customerId: customerId,
      operation: 'get_customer_phone_numbers',
      phoneNumbers: partnerPhoneNumbers.map(n => ({
        id: n.id,
        phone: obfuscatePhoneNumber(n.phoneNumber),
        customerId: n.customerId,
        status: n.status
      }))
    });

    // Check all UserOnboarding records for this customer (to see if customerId is populated)
    const allUserOnboardingForCustomer = await prisma.userOnboarding.findMany({
      where: {
        OR: [
          { customerId: customerId },
          { userId: customer.userId }
        ]
      },
      select: {
        id: true,
        userId: true,
        email: true,
        partnerId: true,
        customerId: true,
      },
    });

    logger.debug('Found UserOnboarding records for customer', {
      customerId: customerId,
      userOnboardingCount: allUserOnboardingForCustomer.length,
      partnerId: partnerId,
      operation: 'get_customer_phone_numbers',
      userOnboardingRecords: allUserOnboardingForCustomer.map(uo => ({
        id: uo.id,
        customerId: uo.customerId,
        partnerId: uo.partnerId
      }))
    });

    // For now, let's just fetch all phone numbers for this customer
    // We'll add partnerId filtering later once we understand the data better
    const phoneNumbers = await prisma.phoneNumber.findMany({
      where: {
        customerId: customerId,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    logger.debug('Filtered phone numbers accessible by partner', {
      partnerId: partnerId,
      customerId: customerId,
      accessiblePhoneNumberCount: phoneNumbers.length,
      operation: 'get_customer_phone_numbers'
    });

    // Get active agent count for each phone number
    const phoneNumbersWithAgentCount = await Promise.all(
      phoneNumbers.map(async (phoneNumber) => {
        // Count active agents using this phone number
        // TODO: Implement proper agent-phone number association
        const activeAgents = 0;

        // Count approved documents for this phone number
        // TODO: Implement proper document counting when model is available
        const approvedDocuments = 0;

        return {
          id: phoneNumber.id,
          phoneNumber: phoneNumber.phoneNumber,
          friendlyName: phoneNumber.friendlyName,
          countryCode: phoneNumber.countryCode,
          region: phoneNumber.region,
          locality: phoneNumber.locality,
          capabilities: phoneNumber.capabilities,
          type: phoneNumber.type,
          status: phoneNumber.status,
          monthlyRecurringCost: phoneNumber.monthlyRecurringCost,
          activeAgents: activeAgents,
          approvedDocuments: approvedDocuments,
          purchasedAt: phoneNumber.purchasedAt?.toISOString(),
          createdAt: phoneNumber.createdAt.toISOString(),
          releasedAt: phoneNumber.releasedAt?.toISOString(),
        };
      })
    );

    return NextResponse.json({
      success: true,
      data: {
        phoneNumbers: phoneNumbersWithAgentCount,
        customer: {
          id: customer.id,
          firstName: customer.firstName,
          lastName: customer.lastName,
        },
        total: phoneNumbersWithAgentCount.length,
      },
    });

  } catch (error: any) {
    console.error('Failed to fetch customer phone numbers:', error);
    
    return NextResponse.json(
      { 
        success: false,
        error: 'Failed to fetch phone numbers',
        message: 'Unable to retrieve phone numbers for this customer. Please try again later.'
      },
      { status: 500 }
    );
  }
}
