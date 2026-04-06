import { NextRequest, NextResponse } from 'next/server';
import { protectAdminRoute } from '@/lib/admin-route-protection';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

// PATCH /api/admin/partners/[id]/byoa-mode - Update manual BYOA mode enablement
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Verify admin authentication using secure MFA enforcement
    const authResult = await protectAdminRoute(request);
    if (authResult) {
      return authResult; // Return the authentication error response
    }

    const partnerId = params.id;
    const body = await request.json();
    const { manualBYOAModeEnabled } = body;

    if (typeof manualBYOAModeEnabled !== 'boolean') {
      return NextResponse.json(
        { error: 'manualBYOAModeEnabled must be a boolean' },
        { status: 400 }
      );
    }

    // Update the partner's manual BYOA mode setting
    const updatedPartner = await prisma.partner.update({
      where: { id: partnerId },
      data: {
        manualBYOAModeEnabled: manualBYOAModeEnabled,
        updatedAt: new Date(),
      },
      select: {
        id: true,
        businessName: true,
        manualBYOAModeEnabled: true,
        saasAgentTier: true,
        planId: true,
        approvalStatus: true,
      },
    });

    return NextResponse.json({
      success: true,
      partner: updatedPartner,
      message: `Manual BYOA mode ${manualBYOAModeEnabled ? 'enabled' : 'disabled'} for ${updatedPartner.businessName}`,
    });
  } catch (error) {
    console.error('Error updating manual BYOA mode:', error);
    return NextResponse.json(
      { error: 'Failed to update manual BYOA mode' },
      { status: 500 }
    );
  }
}

// GET /api/admin/partners/[id]/byoa-mode - Get current BYOA mode status
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Verify admin authentication using secure MFA enforcement
    const authResult = await protectAdminRoute(request);
    if (authResult) {
      return authResult; // Return the authentication error response
    }

    const partnerId = params.id;

    // Get the partner's current BYOA mode settings
    const partner = await prisma.partner.findUnique({
      where: { id: partnerId },
      select: {
        id: true,
        businessName: true,
        manualBYOAModeEnabled: true,
        saasAgentTier: true,
        planId: true,
        approvalStatus: true,
      },
    });

    if (!partner) {
      return NextResponse.json(
        { error: 'Partner not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      partner: partner,
    });
  } catch (error) {
    console.error('Error fetching BYOA mode status:', error);
    return NextResponse.json(
      { error: 'Failed to fetch BYOA mode status' },
      { status: 500 }
    );
  }
}

