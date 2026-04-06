import { NextRequest, NextResponse } from 'next/server';

// This route uses dynamic features, so it must be server-rendered
export const dynamic = 'force-dynamic';

import { prisma } from '@/lib/prisma';
import { verifyPartnerAuth } from '@/lib/auth/partnerAuth';
import { logger } from '@/lib/logger';

/**
 * API route to toggle customer portal access (block/unblock)
 * If credential is active -> suspend (block)
 * If credential is suspended -> activate (grant access)
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { customerId: string } }
) {
  try {
    logger.info('Toggle portal access API called', {
      operation: 'toggle-portal-access',
      customerId: params.customerId
    });
    
    // Verify partner authentication
    const partner = await verifyPartnerAuth(request);
    if (!partner) {
      logger.warn('Partner authentication failed', {
        operation: 'toggle-portal-access',
        customerId: params.customerId
      });
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { customerId } = params;

    // First check if the user onboarding record exists for this partner
    const userOnboarding = await prisma.userOnboarding.findFirst({
      where: {
        partnerId: partner.id,
        id: customerId
      }
    });

    if (!userOnboarding) {
      logger.warn('UserOnboarding not found', {
        operation: 'toggle-portal-access',
        customerId,
        partnerId: partner.id
      });
      return NextResponse.json(
        { error: 'Customer not found or not associated with this partner' },
        { status: 404 }
      );
    }

    // Check if a Customer record exists for this user
    const customer = await prisma.customer.findFirst({
      where: {
        userId: userOnboarding.userId
      }
    });

    if (!customer) {
      logger.warn('Customer record not found', {
        operation: 'toggle-portal-access',
        userId: userOnboarding.userId
      });
      return NextResponse.json(
        { error: 'Customer record not found' },
        { status: 404 }
      );
    }

    // Find existing credentials
    const existingCredentials = await prisma.customerCredential.findFirst({
      where: {
        customerId: customer.id,
        partnerId: partner.id
      }
    });

    if (!existingCredentials) {
      logger.warn('No credentials found', {
        operation: 'toggle-portal-access',
        customerId: customer.id,
        partnerId: partner.id
      });
      return NextResponse.json(
        { error: 'No portal access found for this customer' },
        { status: 404 }
      );
    }

    // Toggle logic: if suspended -> active, if active -> suspended
    const currentStatus = existingCredentials.status;
    const newStatus = currentStatus === 'suspended' ? 'active' : 'suspended';
    const action = newStatus === 'suspended' ? 'blocked' : 'granted';

    await prisma.customerCredential.update({
      where: { id: existingCredentials.id },
      data: {
        status: newStatus
      }
    });

    logger.info('Portal access toggled successfully', {
      operation: 'toggle-portal-access',
      customerId: customer.id,
      partnerId: partner.id,
      credentialId: existingCredentials.id,
      previousStatus: currentStatus,
      newStatus,
      action
    });

    return NextResponse.json({
      success: true,
      message: `Customer portal access has been ${action}`,
      newStatus,
      action
    });
  } catch (error: any) {
    logger.error(
      'Error toggling customer portal access',
      error instanceof Error ? error : new Error(String(error)),
      {
        operation: 'toggle-portal-access',
        customerId: params.customerId
      }
    );
    return NextResponse.json(
      { error: error.message || 'Failed to toggle customer portal access' },
      { status: 500 }
    );
  }
}
