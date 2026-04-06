import { NextRequest, NextResponse } from 'next/server';
import { protectAdminRoute } from '@/lib/admin-route-protection';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

// PATCH /api/admin/partners/[id]/committed-partner - Update committed partner settings
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
    const { isCommittedPartner, committedMonthlyAmount, committedStartDate, committedEndDate } = body;

    // Validate isCommittedPartner
    if (typeof isCommittedPartner !== 'boolean') {
      return NextResponse.json(
        { error: 'isCommittedPartner must be a boolean' },
        { status: 400 }
      );
    }

    // Validate committedMonthlyAmount if partner is being set as committed
    if (isCommittedPartner && (committedMonthlyAmount === undefined || committedMonthlyAmount === null)) {
      return NextResponse.json(
        { error: 'committedMonthlyAmount is required when enabling committed partner status' },
        { status: 400 }
      );
    }

    // Prepare update data
    const updateData: any = {
      isCommittedPartner: isCommittedPartner,
      updatedAt: new Date(),
    };

    if (isCommittedPartner) {
      updateData.committedMonthlyAmount = parseFloat(committedMonthlyAmount);
      updateData.committedStartDate = committedStartDate ? new Date(committedStartDate) : new Date();
      updateData.committedEndDate = committedEndDate ? new Date(committedEndDate) : null;
    } else {
      // When disabling, optionally clear the dates but keep the amount for history
      updateData.committedEndDate = new Date(); // Mark when commitment ended
    }

    // Update the partner's committed partner settings
    const updatedPartner = await prisma.partner.update({
      where: { id: partnerId },
      data: updateData,
      select: {
        id: true,
        businessName: true,
        isCommittedPartner: true,
        committedMonthlyAmount: true,
        committedStartDate: true,
        committedEndDate: true,
      },
    });

    return NextResponse.json({
      success: true,
      partner: {
        ...updatedPartner,
        committedMonthlyAmount: updatedPartner.committedMonthlyAmount 
          ? Number(updatedPartner.committedMonthlyAmount) 
          : null,
      },
      message: `Committed partner status ${isCommittedPartner ? 'enabled' : 'disabled'} for ${updatedPartner.businessName}`,
    });
  } catch (error) {
    console.error('Error updating committed partner status:', error);
    return NextResponse.json(
      { error: 'Failed to update committed partner status' },
      { status: 500 }
    );
  }
}

// GET /api/admin/partners/[id]/committed-partner - Get current committed partner status
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

    // Get the partner's current committed partner settings
    const partner = await prisma.partner.findUnique({
      where: { id: partnerId },
      select: {
        id: true,
        businessName: true,
        isCommittedPartner: true,
        committedMonthlyAmount: true,
        committedStartDate: true,
        committedEndDate: true,
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
      partner: {
        ...partner,
        committedMonthlyAmount: partner.committedMonthlyAmount 
          ? Number(partner.committedMonthlyAmount) 
          : null,
      },
    });
  } catch (error) {
    console.error('Error fetching committed partner status:', error);
    return NextResponse.json(
      { error: 'Failed to fetch committed partner status' },
      { status: 500 }
    );
  }
}

