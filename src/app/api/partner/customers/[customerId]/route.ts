import { NextResponse } from 'next/server';

// This route uses dynamic features, so it must be server-rendered
export const dynamic = 'force-dynamic';

import { prisma } from '@/lib/prisma';
import { cookies } from 'next/headers';
import { verifyJWT } from '@/lib/jwt';
import type { NextRequest } from 'next/server';
import { logger } from '@/lib/logger';

// GET /api/partner/customers/[customerId] - Get a single customer
export async function GET(
  request: NextRequest,
  { params }: { params: { customerId: string } }
) {
  try {
    // Get token from cookies or Authorization header
    let token = cookies().get('partner_token')?.value;

    if (!token) {
      // Try to get token from Authorization header
      const authHeader = request.headers.get('authorization');
      if (authHeader && authHeader.startsWith('Bearer ')) {
        token = authHeader.substring(7);
      }
    }

    if (!token) {
      return NextResponse.json({
        error: 'Unauthorized',
        message: 'No partner token found'
      }, { status: 401 });
    }

    // Verify JWT token
    const decodedToken = await verifyJWT(token);
    if (!decodedToken || !decodedToken.email) {
      return NextResponse.json({
        error: 'Invalid token',
        message: 'Your session has expired. Please log in again.'
      }, { status: 401 });
    }

    // Get partner using the JWT token's email
    const partner = await prisma.partner.findFirst({
      where: {
        AND: [
          { emailAddress: decodedToken.email },
          { approvalStatus: 'ACTIVE' }
        ]
      }
    });

    if (!partner) {
      return NextResponse.json({
        error: 'Partner not found or not approved',
        message: 'Please ensure your partner account is approved.'
      }, { status: 403 });
    }

    // Since we now pass the actual Customer ID directly, verify it exists and belongs to this partner
    const customer = await prisma.customer.findFirst({
      where: {
        id: params.customerId,
      },
      select: {
        id: true,
        kbProcessingEnabled: true,
        aiCreditsEnabled: true,
        aiCreditPricePerMinute: true,
        aiCreditGracePeriodSeconds: true,
        lowCreditThreshold: true,
        lowCreditNotificationsEnabled: true,
        // Deployment status fields
        deploymentStatus: true,
        deploymentNotes: true,
        deploymentRequestedAt: true,
        phoneProvisionedAt: true,
        agentDeployingAt: true,
        agentReadyAt: true,
        deploymentCompletedAt: true,
        userOnboarding: {
          where: {
            partnerId: partner.id,
          },
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            monthlyCallVolume: true,
            estimatedPrice: true,
            priceBreakdown: true,
            orderStatus: true,
            companyName: true,
            userId: true,
            isOnboardingCompleted: true,
            createdAt: true,
            updatedAt: true,
            dealStatus: true,
            billingType: true,
            agreedPrice: true,
            enableAdvancedAnalytics: true,
            enableDetailedCallAnalysis: true,
            enableActionPointAnalysis: true,
            enableApiAccess: true,
            customerPortalEnabled: true,
            showKnowledgeBase: true,
            showIntegration: true,
            allowedApps: true,
            showDocsAndMedia: true,
            showScheduleMeeting: true,
            showApiKeys: true,
            showPricingInformation: true,
            maxTeamMembers: true,
            enableTeamMembers: true,
            autoEmbeddingEnabled: true,
            showAiGateway: true,
          },
        },
      },
    });

    if (!customer || customer.userOnboarding.length === 0) {
      return NextResponse.json({
        error: 'Customer not found',
        message: 'The requested customer was not found or does not belong to your account.'
      }, { status: 404 });
    }

    // Get the UserOnboarding record for additional data
    const userOnboarding = customer.userOnboarding[0];

    // Get KB processing status and AI Credits settings from Customer table
    const kbProcessingEnabled = customer.kbProcessingEnabled ?? false;
    const aiCreditsEnabled = customer.aiCreditsEnabled ?? false;
    const aiCreditPricePerMinute = customer.aiCreditPricePerMinute ?? 1;
    const aiCreditGracePeriodSeconds = customer.aiCreditGracePeriodSeconds ?? 10;
    const lowCreditThreshold = customer.lowCreditThreshold;
    const lowCreditNotificationsEnabled = customer.lowCreditNotificationsEnabled ?? true;

    logger.info('Customer retrieved successfully', {
      operation: 'get_customer',
      customerId: customer.id,
      customerEmail: userOnboarding.email,
      kbProcessingEnabled,
      aiCreditsEnabled
    });

    return NextResponse.json({
      success: true,
      data: {
        // Return UserOnboarding data with Customer settings
        id: userOnboarding.id,
        firstName: userOnboarding.firstName,
        lastName: userOnboarding.lastName,
        email: userOnboarding.email,
        monthlyCallVolume: userOnboarding.monthlyCallVolume,
        estimatedPrice: userOnboarding.estimatedPrice,
        priceBreakdown: userOnboarding.priceBreakdown,
        orderStatus: userOnboarding.orderStatus,
        companyName: userOnboarding.companyName,
        userId: userOnboarding.userId,
        isOnboardingCompleted: userOnboarding.isOnboardingCompleted,
        customerId: customer.id, // The actual Customer ID
        createdAt: userOnboarding.createdAt,
        updatedAt: userOnboarding.updatedAt,
        dealStatus: userOnboarding.dealStatus,
        billingType: userOnboarding.billingType,
        agreedPrice: userOnboarding.agreedPrice,
        enableAdvancedAnalytics: userOnboarding.enableAdvancedAnalytics,
        enableDetailedCallAnalysis: userOnboarding.enableDetailedCallAnalysis,
        enableActionPointAnalysis: userOnboarding.enableActionPointAnalysis,
        enableApiAccess: userOnboarding.enableApiAccess,
        customerPortalEnabled: userOnboarding.customerPortalEnabled,
        // Menu visibility options
        showKnowledgeBase: userOnboarding.showKnowledgeBase,
        showIntegration: userOnboarding.showIntegration,
        allowedApps: (() => { try { return JSON.parse(userOnboarding.allowedApps || '[]'); } catch { return []; } })(),
        showDocsAndMedia: userOnboarding.showDocsAndMedia,
        showScheduleMeeting: userOnboarding.showScheduleMeeting,
        showApiKeys: userOnboarding.showApiKeys,
        // Pricing information visibility
        showPricingInformation: userOnboarding.showPricingInformation,
        // Team management
        maxTeamMembers: userOnboarding.maxTeamMembers,
        enableTeamMembers: userOnboarding.enableTeamMembers,
        // Auto embedding setting
        autoEmbeddingEnabled: userOnboarding.autoEmbeddingEnabled,
        // AI Gateway visibility
        showAiGateway: userOnboarding.showAiGateway || false,
        // Customer settings
        kbProcessingEnabled,
        aiCreditsEnabled,
        aiCreditPricePerMinute,
        aiCreditGracePeriodSeconds,
        lowCreditThreshold,
        lowCreditNotificationsEnabled,
        // Deployment status fields from Customer table
        deploymentStatus: customer.deploymentStatus,
        deploymentNotes: customer.deploymentNotes,
        deploymentRequestedAt: customer.deploymentRequestedAt,
        phoneProvisionedAt: customer.phoneProvisionedAt,
        agentDeployingAt: customer.agentDeployingAt,
        agentReadyAt: customer.agentReadyAt,
        deploymentCompletedAt: customer.deploymentCompletedAt
      }
    });

  } catch (error) {
    logger.error('Failed to fetch customer', error as Error, {
      operation: 'get_customer',
      customerId: params.customerId
    });
    return NextResponse.json({
      error: 'Failed to fetch customer',
      message: 'An error occurred while fetching the customer. Please try again.'
    }, { status: 500 });
  }
}

interface CustomerUpdateRequest {
  // Basic customer information (editable)
  firstName?: string;
  lastName?: string;
  companyName?: string;
  businessPhone?: string;
  email?: string;
  // Business details (editable)
  monthlyCallVolume?: string;
  primaryUseCase?: string;
  callComplexity?: string;
  crmSystem?: string;
  phoneSystem?: string;
  scriptComplexity?: string;
  languages?: string;
  deploymentTimeline?: string;
  customAutomation?: string;
  // Existing fields
  orderStatus?: string;
  dealStatus?: string;
  billingType?: string;
  agreedPrice?: number | null;
  enableAdvancedAnalytics?: boolean;
  enableDetailedCallAnalysis?: boolean;
  enableActionPointAnalysis?: boolean;
  enableApiAccess?: boolean;
  customerPortalEnabled?: boolean;
  // Menu visibility options
  showKnowledgeBase?: boolean;
  showIntegration?: boolean;
  allowedApps?: string[];
  showDocsAndMedia?: boolean;
  showScheduleMeeting?: boolean;
  showApiKeys?: boolean;
  // Pricing information visibility
  showPricingInformation?: boolean;
  // Phone numbers
  showPhoneNumbers?: boolean;
  // Team management
  maxTeamMembers?: number;
  enableTeamMembers?: boolean;
  // Knowledge Base processing
  kbProcessingEnabled?: boolean;
  autoEmbeddingEnabled?: boolean;
  // AI Credit Management
  aiCreditsEnabled?: boolean;
  aiCreditPricePerMinute?: number;
  aiCreditGracePeriodSeconds?: number;
  lowCreditThreshold?: number;
  lowCreditNotificationsEnabled?: boolean;
  // AI Gateway
  showAiGateway?: boolean;
  // Deployment tracking fields
  deploymentStatus?: string;
  deploymentNotes?: string;
  deploymentRequestedAt?: Date | string;
  phoneProvisionedAt?: Date | string;
  agentDeployingAt?: Date | string;
  agentReadyAt?: Date | string;
  deploymentCompletedAt?: Date | string;
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { customerId: string } }
) {
  try {
    // Get token from cookies or Authorization header
    let token = cookies().get('partner_token')?.value;

    if (!token) {
      // Try to get token from Authorization header
      const authHeader = request.headers.get('authorization');
      if (authHeader && authHeader.startsWith('Bearer ')) {
        token = authHeader.substring(7);
      }
    }

    if (!token) {
      return NextResponse.json({
        error: 'Unauthorized',
        message: 'No partner token found'
      }, { status: 401 });
    }

    // Verify JWT token
    const decodedToken = await verifyJWT(token);
    if (!decodedToken || !decodedToken.email) {
      return NextResponse.json({
        error: 'Invalid token',
        message: 'Your session has expired. Please log in again.'
      }, { status: 401 });
    }

    // Get partner using the JWT token's email
    const partner = await prisma.partner.findFirst({
      where: {
        AND: [
          { emailAddress: decodedToken.email },
          { approvalStatus: 'ACTIVE' }
        ]
      }
    });

    if (!partner) {
      return NextResponse.json({
        error: 'Partner not found or not approved',
        message: 'Please ensure your partner account is approved.'
      }, { status: 403 });
    }

    const body = await request.json() as CustomerUpdateRequest;

    // Validate email format if provided
    if (body.email) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(body.email)) {
        return NextResponse.json({
          error: 'Invalid email format',
          message: 'Please provide a valid email address.'
        }, { status: 400 });
      }
    }

    // Validate the customer belongs to this partner
    const customer = await prisma.userOnboarding.findFirst({
      where: {
        id: params.customerId,
        partnerId: partner.id
      }
    });

    if (!customer) {
      return NextResponse.json({
        error: 'Customer not found',
        message: 'The requested customer was not found or does not belong to your account.'
      }, { status: 404 });
    }

    // Check for email uniqueness within partner scope if email is being updated
    if (body.email && body.email !== customer.email) {
      const existingCustomer = await prisma.userOnboarding.findFirst({
        where: {
          email: body.email,
          partnerId: partner.id,
          id: { not: params.customerId }
        }
      });

      if (existingCustomer) {
        return NextResponse.json({
          error: 'Email already in use',
          message: 'This email address is already associated with another customer.'
        }, { status: 400 });
      }
    }

    // Log the API access fields
    logger.debug('API access fields updated', {
      operation: 'update_customer',
      customerId: params.customerId,
      enableApiAccess: body.enableApiAccess,
      showApiKeys: body.showApiKeys
    });

    // Prepare update data for UserOnboarding
    const updateData: any = {};

    // Basic customer information
    if (body.firstName !== undefined) updateData.firstName = body.firstName;
    if (body.lastName !== undefined) updateData.lastName = body.lastName;
    if (body.companyName !== undefined) updateData.companyName = body.companyName;
    if (body.businessPhone !== undefined) updateData.businessPhone = body.businessPhone;
    if (body.email !== undefined) updateData.email = body.email;

    // Business details
    if (body.monthlyCallVolume !== undefined) updateData.monthlyCallVolume = body.monthlyCallVolume;
    if (body.primaryUseCase !== undefined) updateData.primaryUseCase = body.primaryUseCase;
    if (body.callComplexity !== undefined) updateData.callComplexity = body.callComplexity;
    if (body.crmSystem !== undefined) updateData.crmSystem = body.crmSystem;
    if (body.phoneSystem !== undefined) updateData.phoneSystem = body.phoneSystem;
    if (body.scriptComplexity !== undefined) updateData.scriptComplexity = body.scriptComplexity;
    if (body.languages !== undefined) updateData.languages = body.languages;
    if (body.deploymentTimeline !== undefined) updateData.deploymentTimeline = body.deploymentTimeline;
    if (body.customAutomation !== undefined) updateData.customAutomation = body.customAutomation;

    // Existing fields
    if (body.orderStatus !== undefined) updateData.orderStatus = body.orderStatus;
    if (body.dealStatus !== undefined) updateData.dealStatus = body.dealStatus;
    if (body.billingType !== undefined) updateData.billingType = body.billingType;
    if (body.agreedPrice !== undefined) updateData.agreedPrice = body.agreedPrice;
    if (body.enableAdvancedAnalytics !== undefined) updateData.enableAdvancedAnalytics = body.enableAdvancedAnalytics;
    if (body.enableDetailedCallAnalysis !== undefined) updateData.enableDetailedCallAnalysis = body.enableDetailedCallAnalysis;
    if (body.enableActionPointAnalysis !== undefined) updateData.enableActionPointAnalysis = body.enableActionPointAnalysis;
    if (body.enableApiAccess !== undefined) updateData.enableApiAccess = body.enableApiAccess;
    if (body.customerPortalEnabled !== undefined) updateData.customerPortalEnabled = body.customerPortalEnabled;
    if (body.showKnowledgeBase !== undefined) updateData.showKnowledgeBase = body.showKnowledgeBase;
    if (body.showIntegration !== undefined) updateData.showIntegration = body.showIntegration;
    if (body.allowedApps !== undefined) updateData.allowedApps = JSON.stringify(body.allowedApps);
    if (body.showDocsAndMedia !== undefined) updateData.showDocsAndMedia = body.showDocsAndMedia;
    if (body.showScheduleMeeting !== undefined) updateData.showScheduleMeeting = body.showScheduleMeeting;
    if (body.showApiKeys !== undefined) updateData.showApiKeys = body.showApiKeys;
    if (body.showPricingInformation !== undefined) updateData.showPricingInformation = body.showPricingInformation;
    if (body.showPhoneNumbers !== undefined) updateData.showPhoneNumbers = body.showPhoneNumbers;
    if (body.maxTeamMembers !== undefined) updateData.maxTeamMembers = body.maxTeamMembers;
    if (body.enableTeamMembers !== undefined) updateData.enableTeamMembers = body.enableTeamMembers;
    if (body.autoEmbeddingEnabled !== undefined) updateData.autoEmbeddingEnabled = body.autoEmbeddingEnabled;
    if (body.showAiGateway !== undefined) updateData.showAiGateway = body.showAiGateway;

    // Update the customer with the provided data
    const updatedCustomer = await prisma.userOnboarding.update({
      where: {
        id: params.customerId
      },
      data: updateData
    });

    // Update Customer table if customer portal is enabled
    if (updatedCustomer.customerId) {
      try {
        const customerUpdateData: any = {};

        // Update basic customer information in Customer table
        if (body.firstName !== undefined) customerUpdateData.firstName = body.firstName;
        if (body.lastName !== undefined) customerUpdateData.lastName = body.lastName;
        if (body.email !== undefined) customerUpdateData.email = body.email;

        // Handle deployment status fields - preserve existing values if not provided
        if (body.deploymentStatus !== undefined) customerUpdateData.deploymentStatus = body.deploymentStatus;
        if (body.deploymentNotes !== undefined) customerUpdateData.deploymentNotes = body.deploymentNotes;
        if (body.deploymentRequestedAt !== undefined) customerUpdateData.deploymentRequestedAt = body.deploymentRequestedAt;
        if (body.phoneProvisionedAt !== undefined) customerUpdateData.phoneProvisionedAt = body.phoneProvisionedAt;
        if (body.agentDeployingAt !== undefined) customerUpdateData.agentDeployingAt = body.agentDeployingAt;
        if (body.agentReadyAt !== undefined) customerUpdateData.agentReadyAt = body.agentReadyAt;
        if (body.deploymentCompletedAt !== undefined) customerUpdateData.deploymentCompletedAt = body.deploymentCompletedAt;

        // Handle KB processing
        if (body.kbProcessingEnabled !== undefined) {
          customerUpdateData.kbProcessingEnabled = body.kbProcessingEnabled;
        }

        // Handle AI Credits settings
        if (body.aiCreditsEnabled !== undefined) {
          customerUpdateData.aiCreditsEnabled = body.aiCreditsEnabled;

          // If enabling AI Credits, disable showPricingInformation
          if (body.aiCreditsEnabled) {
            await prisma.userOnboarding.update({
              where: { id: params.customerId },
              data: { showPricingInformation: false }
            });
          }
        }

        if (body.aiCreditPricePerMinute !== undefined) {
          customerUpdateData.aiCreditPricePerMinute = body.aiCreditPricePerMinute;
        }

        if (body.aiCreditGracePeriodSeconds !== undefined) {
          customerUpdateData.aiCreditGracePeriodSeconds = body.aiCreditGracePeriodSeconds;
        }

        if (body.lowCreditThreshold !== undefined) {
          customerUpdateData.lowCreditThreshold = body.lowCreditThreshold;
        }

        if (body.lowCreditNotificationsEnabled !== undefined) {
          customerUpdateData.lowCreditNotificationsEnabled = body.lowCreditNotificationsEnabled;
        }

        // Only update if there's data to update
        if (Object.keys(customerUpdateData).length > 0) {
          await prisma.customer.update({
            where: { id: updatedCustomer.customerId },
            data: customerUpdateData
          });
        }
      } catch (customerUpdateError) {
        logger.warn('Failed to update customer settings', {
          operation: 'update_customer',
          customerId: params.customerId,
          error: customerUpdateError instanceof Error ? customerUpdateError.message : 'Unknown error'
        });
        // Don't fail the entire request if customer update fails
      }
    }

    // Update CustomerCredential email if email was changed and customer portal is enabled
    if (body.email && body.email !== customer.email && updatedCustomer.customerPortalEnabled && updatedCustomer.customerId) {
      try {
        await prisma.customerCredential.updateMany({
          where: {
            customerId: updatedCustomer.customerId,
            partnerId: partner.id
          },
          data: {
            email: body.email
          }
        });
      } catch (credentialUpdateError) {
        logger.warn('Failed to update customer credential email', {
          operation: 'update_customer',
          customerId: params.customerId,
          newEmail: body.email,
          error: credentialUpdateError instanceof Error ? credentialUpdateError.message : 'Unknown error'
        });
        // Don't fail the entire request if credential update fails
      }
    }



    logger.info('Customer updated successfully', {
      operation: 'update_customer',
      customerId: params.customerId,
      updatedFields: Object.keys(body),
      autoEmbeddingEnabled: body.autoEmbeddingEnabled,
      kbProcessingEnabled: body.kbProcessingEnabled,
      aiCreditsEnabled: body.aiCreditsEnabled
    });

    return NextResponse.json({
      success: true,
      message: 'Customer updated successfully',
      data: updatedCustomer
    });

  } catch (error) {
    logger.error('Failed to update customer', error as Error, {
      operation: 'update_customer',
      customerId: params.customerId
    });
    return NextResponse.json({
      error: 'Failed to update customer',
      message: 'An error occurred while updating the customer. Please try again.'
    }, { status: 500 });
  }
}
