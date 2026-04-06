import { NextRequest, NextResponse } from 'next/server';
import { verifyPartnerAuth } from '@/lib/auth/partnerAuth';
import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';

/**
 * POST /api/partner/phone-numbers/request-release
 * Request release of a phone number to global pool after 30-day period
 */
export async function POST(request: NextRequest) {
  try {
    // Verify partner authentication
    const partner = await verifyPartnerAuth(request);
    if (!partner) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const partnerId = partner.id;
    const { phoneNumberId } = await request.json();

    if (!phoneNumberId) {
      return NextResponse.json({ error: 'Phone number ID is required' }, { status: 400 });
    }

    // Verify phone number belongs to partner
    const phoneNumber = await prisma.phoneNumber.findFirst({
      where: {
        id: phoneNumberId,
        partnerId: partnerId,
        status: 'active'
      },
      include: {
        customer: {
          select: {
            id: true,
            firstName: true,
            lastName: true
          }
        },
        agentMappings: {
          where: {
            status: 'active'
          },
          select: {
            id: true,
            agentId: true
          }
        }
      }
    });

    if (!phoneNumber) {
      return NextResponse.json({ 
        error: 'Phone number not found or not owned by your organization' 
      }, { status: 404 });
    }

    // Check if number is already requested for release
    if (phoneNumber.releaseRequestedAt) {
      const releaseEligibleAt = phoneNumber.releaseEligibleAt;
      const daysRemaining = releaseEligibleAt 
        ? Math.ceil((releaseEligibleAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
        : 0;

      return NextResponse.json({
        error: 'Phone number is already scheduled for release',
        releaseRequestedAt: phoneNumber.releaseRequestedAt,
        releaseEligibleAt: phoneNumber.releaseEligibleAt,
        daysRemaining: Math.max(0, daysRemaining)
      }, { status: 400 });
    }

    // Check if number has active agent mappings
    if (phoneNumber.agentMappings.length > 0) {
      return NextResponse.json({
        error: 'Cannot release phone number with active agent assignments. Please unassign all agents first.',
        activeAgents: phoneNumber.agentMappings.length
      }, { status: 400 });
    }

    // Calculate release eligible date (30 days from now)
    const releaseRequestedAt = new Date();
    const releaseEligibleAt = new Date();
    releaseEligibleAt.setDate(releaseEligibleAt.getDate() + 30);

    // Update phone number with release request
    await prisma.phoneNumber.update({
      where: { id: phoneNumberId },
      data: {
        releaseRequestedAt,
        releaseEligibleAt
      }
    });

    logger.info('Phone number release requested', {
      phoneNumberId,
      phoneNumber: phoneNumber.phoneNumber,
      partnerId,
      customerId: phoneNumber.customerId || undefined,
      releaseRequestedAt,
      releaseEligibleAt
    });

    return NextResponse.json({
      success: true,
      message: 'Phone number release requested successfully',
      data: {
        phoneNumber: phoneNumber.phoneNumber,
        releaseRequestedAt,
        releaseEligibleAt,
        daysUntilRelease: 30
      }
    });

  } catch (error) {
    logger.error('Error requesting phone number release', error instanceof Error ? error : new Error(String(error)));

    return NextResponse.json(
      { error: 'Failed to request phone number release' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/partner/phone-numbers/request-release
 * Cancel a pending release request
 */
export async function DELETE(request: NextRequest) {
  try {
    // Verify partner authentication
    const partner = await verifyPartnerAuth(request);
    if (!partner) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const partnerId = partner.id;
    const { phoneNumberId } = await request.json();

    if (!phoneNumberId) {
      return NextResponse.json({ error: 'Phone number ID is required' }, { status: 400 });
    }

    // Verify phone number belongs to partner and has pending release
    const phoneNumber = await prisma.phoneNumber.findFirst({
      where: {
        id: phoneNumberId,
        partnerId: partnerId,
        status: 'active',
        releaseRequestedAt: {
          not: null
        },
        releaseEligibleAt: {
          gt: new Date() // Only allow cancellation if not yet eligible
        }
      }
    });

    if (!phoneNumber) {
      return NextResponse.json({ 
        error: 'Phone number not found, not owned by your organization, or not eligible for cancellation' 
      }, { status: 404 });
    }

    // Cancel the release request
    await prisma.phoneNumber.update({
      where: { id: phoneNumberId },
      data: {
        releaseRequestedAt: null,
        releaseEligibleAt: null
      }
    });

    logger.info('Phone number release request cancelled', {
      phoneNumberId,
      phoneNumber: phoneNumber.phoneNumber,
      partnerId
    });

    return NextResponse.json({
      success: true,
      message: 'Phone number release request cancelled successfully',
      data: {
        phoneNumber: phoneNumber.phoneNumber
      }
    });

  } catch (error) {
    logger.error('Error cancelling phone number release request', error instanceof Error ? error : new Error(String(error)));

    return NextResponse.json(
      { error: 'Failed to cancel phone number release request' },
      { status: 500 }
    );
  }
}
