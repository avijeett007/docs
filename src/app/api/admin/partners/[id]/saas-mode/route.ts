import { NextRequest, NextResponse } from 'next/server';
import { protectAdminRoute } from '@/lib/admin-route-protection';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

// PATCH /api/admin/partners/[id]/saas-mode - Update manual SaaS mode enablement
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
    const { manualSaasModeEnabled } = body;

    if (typeof manualSaasModeEnabled !== 'boolean') {
      return NextResponse.json(
        { error: 'manualSaasModeEnabled must be a boolean' },
        { status: 400 }
      );
    }

    // Update the partner's manual SaaS mode setting
    const updatedPartner = await prisma.partner.update({
      where: { id: partnerId },
      data: {
        manualSaasModeEnabled: manualSaasModeEnabled,
        updatedAt: new Date(),
      },
      select: {
        id: true,
        businessName: true,
        manualSaasModeEnabled: true,
        portalMode: true,
        planId: true,
        approvalStatus: true,
      },
    });

    return NextResponse.json({
      success: true,
      partner: updatedPartner,
      message: `Manual SaaS mode ${manualSaasModeEnabled ? 'enabled' : 'disabled'} for ${updatedPartner.businessName}`,
    });
  } catch (error) {
    console.error('Error updating manual SaaS mode:', error);
    return NextResponse.json(
      { error: 'Failed to update manual SaaS mode' },
      { status: 500 }
    );
  }
}

// GET /api/admin/partners/[id]/saas-mode - Get current SaaS mode status
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

    // Get the partner's current SaaS mode settings
    const partner = await prisma.partner.findUnique({
      where: { id: partnerId },
      select: {
        id: true,
        businessName: true,
        manualSaasModeEnabled: true,
        portalMode: true,
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
    console.error('Error fetching SaaS mode status:', error);
    return NextResponse.json(
      { error: 'Failed to fetch SaaS mode status' },
      { status: 500 }
    );
  }
}
