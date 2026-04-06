import { NextRequest, NextResponse } from 'next/server';

// This route uses dynamic features, so it must be server-rendered
export const dynamic = 'force-dynamic';

import { cookies } from 'next/headers';
import { verifyCustomerJWT } from '@/lib/customerJwt';
import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';

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

    // Get customer information
    const customer = await prisma.customer.findUnique({
      where: { id: payload.customerId },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        customerPortalEnabled: true,
        deploymentStatus: true,
        deploymentRequestedAt: true,
      },
    });

    // Get subscription for trial expiry checking
    // Include canceled/incomplete_expired so we can detect expired trials
    const activeSubscription = await prisma.customerSubscription.findFirst({
      where: {
        customerId: payload.customerId,
        partnerId: payload.partnerId,
        status: {
          in: ['active', 'trialing', 'past_due', 'canceled', 'incomplete_expired', 'unpaid']
        }
      },
      orderBy: {
        createdAt: 'desc'
      },
      select: {
        id: true,
        status: true,
        trialEnd: true,
        currentPeriodEnd: true,
        cancelAtPeriodEnd: true,
        plan: {
          select: {
            id: true,
            name: true,
            amount: true,
            currency: true,
            interval: true
          }
        }
      }
    });

    // Initialize credential variable
    let credential = null;

    // Check if this is a team member or regular customer
    let teamMember = null;

    if (payload.isTeamMember && payload.teamMemberId) {
      // For team members, get their information
      teamMember = await prisma.customerTeamMember.findUnique({
        where: { id: payload.teamMemberId },
        select: {
          lastLogin: true,
          passwordHash: true,
          name: true,
        },
      });

      // Use team member data for login status
      if (teamMember) {
        credential = {
          lastLogin: teamMember.lastLogin,
          // For team members, we consider password reset status based on whether they have a password
          lastReset: teamMember.passwordHash ? new Date() : null,
        };
      }
    } else if (payload.credentialId) {
      // For regular customers, get credential information
      credential = await prisma.customerCredential.findUnique({
        where: { id: payload.credentialId },
        select: {
          lastReset: true,
          lastLogin: true,
        },
      });
    }

    if (!customer) {
      return NextResponse.json(
        { error: 'Customer not found' },
        { status: 404 }
      );
    }

    // Debug logging
    logger.info('Customer data retrieved', {
      operation: 'whitelabel-auth-me',
      customerId: customer?.id,
      hasDeploymentStatus: !!customer?.deploymentStatus
    });
    logger.info('Processing /auth/me request', {
      operation: 'whitelabel-auth-me',
      customerId: payload.customerId,
      partnerId: payload.partnerId
    });

    // Check if customer portal is enabled
    if (!customer.customerPortalEnabled) {
      return NextResponse.json(
        { error: 'Customer portal access is not enabled' },
        { status: 403 }
      );
    }

    // Determine if this is the first login or if password has never been reset
    // We'll consider it a first login if:
    // 1. There's no lastLogin record (truly first login)
    // 2. There's no lastReset record (password has never been changed)
    const isFirstLogin = credential ?
      (!credential.lastLogin || !credential.lastReset)
      : false;


    // Prepare response data
    const responseData: {
      customer: {
        id: string;
        name: string;
        email: string;
        deploymentStatus?: string;
        deploymentRequestedAt?: Date;
      };
      customerId: string;
      partnerId: string;
      isFirstLogin: boolean;
      lastPasswordReset: Date | null;
      isTeamMember?: boolean;
      teamMemberId?: string;
      role?: string;
      magicLinkType?: string;
      isFromMagicLinkReset?: boolean;
      subscription?: {
        id: string;
        status: string;
        trialEnd: Date | null;
        currentPeriodEnd: Date;
        cancelAtPeriodEnd: boolean;
        plan: {
          id: string;
          name: string;
          amount: number;
          currency: string;
          interval: string;
        };
      };
      impersonationContext?: {
        isImpersonating: boolean;
        impersonatedBy: string;
        sessionId: string;
        partnerName?: string;
      };
    } = {
      customer: {
        id: customer.id,
        name: `${customer.firstName || ''} ${customer.lastName || ''}`.trim() || 'Customer',
        email: customer.email,
        deploymentStatus: customer.deploymentStatus || undefined,
        deploymentRequestedAt: customer.deploymentRequestedAt || undefined,
      },
      customerId: payload.customerId,
      partnerId: payload.partnerId,
      isFirstLogin,
      lastPasswordReset: credential?.lastReset || null,
      magicLinkType: payload.magicLinkType,
      isFromMagicLinkReset: payload.magicLinkType === 'password_reset',
    };

    // Add subscription information if exists
    if (activeSubscription) {
      logger.info('Active subscription retrieved', {
        operation: 'whitelabel-auth-me',
        subscriptionId: activeSubscription.id,
        status: activeSubscription.status,
        hasTrialEnd: !!activeSubscription.trialEnd
      });
      responseData.subscription = {
        id: activeSubscription.id,
        status: activeSubscription.status,
        trialEnd: activeSubscription.trialEnd,
        currentPeriodEnd: activeSubscription.currentPeriodEnd,
        cancelAtPeriodEnd: activeSubscription.cancelAtPeriodEnd,
        plan: activeSubscription.plan
      };
    }

    // Add team member information if applicable
    if (payload.isTeamMember && payload.teamMemberId) {
      responseData.isTeamMember = true;
      responseData.teamMemberId = payload.teamMemberId;
      responseData.role = payload.role || 'member';

      // If this is a team member, use their email from the JWT payload
      if (payload.email) {
        responseData.customer.email = payload.email;
      }

      // Use the team member name if available
      if (teamMember?.name) {
        responseData.customer.name = teamMember.name;
      }
    } else {
      // For regular customers (not team members), default to admin role
      responseData.isTeamMember = false;
      responseData.role = 'admin'; // Regular customers are considered admins of their own account
    }

    // Add impersonation context if this is an impersonation session
    if (payload.isImpersonating && payload.impersonatedBy && payload.impersonationSessionId) {
      // Get partner information for the impersonating partner
      const impersonatingPartner = await prisma.partner.findUnique({
        where: { id: payload.impersonatedBy },
        select: {
          businessName: true,
          contactName: true,
        },
      });

      responseData.impersonationContext = {
        isImpersonating: true,
        impersonatedBy: payload.impersonatedBy,
        sessionId: payload.impersonationSessionId,
        partnerName: impersonatingPartner?.businessName || impersonatingPartner?.contactName || 'Partner',
      };
    }

    // Return the response
    return NextResponse.json(responseData);
  } catch (error) {
    logger.error(
      'Error fetching customer data',
      error instanceof Error ? error : new Error(String(error)),
      {
        operation: 'whitelabel-auth-me'
      }
    );
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
