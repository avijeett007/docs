import { NextRequest, NextResponse } from 'next/server';
import { protectAdminRoute } from '@/lib/admin-route-protection';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

// GET /api/admin/partners/[id]/phone-activations - Get all phone activations for a partner
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const authResult = await protectAdminRoute(request);
    if (authResult) return authResult;

    const partnerId = params.id;

    const activations = await prisma.phoneServiceActivation.findMany({
      where: { partnerId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        country: true,
        businessName: true,
        businessType: true,
        businessAddress: true,
        businessRegistrationNumber: true,
        businessRegistrationAuthority: true,
        businessWebsite: true,
        contactFirstName: true,
        contactLastName: true,
        contactEmail: true,
        contactPhone: true,
        documents: true,
        twilioSubaccountSid: true,
        twilioAddressSid: true,
        twilioEndUserSid: true,
        twilioSupportingDocSids: true,
        regulatoryBundleSid: true,
        regulatoryBundleStatus: true,
        regulatoryBundleType: true,
        rejectionReason: true,
        status: true,
        submittedAt: true,
        approvedAt: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return NextResponse.json({ success: true, data: activations });
  } catch (error) {
    console.error('Error fetching phone activations:', error);
    return NextResponse.json(
      { error: 'Failed to fetch phone activations' },
      { status: 500 }
    );
  }
}

// PATCH /api/admin/partners/[id]/phone-activations - Update activation status
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const authResult = await protectAdminRoute(request);
    if (authResult) return authResult;

    const partnerId = params.id;
    const body = await request.json();
    const { activationId, status, rejectionReason } = body;

    if (!activationId) {
      return NextResponse.json(
        { error: 'Missing activationId' },
        { status: 400 }
      );
    }

    const validStatuses = ['submitted', 'under_review', 'approved', 'active', 'rejected', 'more_info_needed', 'resubmission_needed', 'pending_review'];
    if (!status || !validStatuses.includes(status)) {
      return NextResponse.json(
        { error: `Invalid status. Must be one of: ${validStatuses.join(', ')}` },
        { status: 400 }
      );
    }

    // Verify the activation belongs to this partner
    const activation = await prisma.phoneServiceActivation.findFirst({
      where: { id: activationId, partnerId },
    });

    if (!activation) {
      return NextResponse.json(
        { error: 'Activation not found for this partner' },
        { status: 404 }
      );
    }

    const updateData: any = { status };

    if (status === 'approved' || status === 'active') {
      updateData.approvedAt = new Date();
      updateData.regulatoryBundleStatus = 'twilio_approved';
    }

    if (status === 'rejected') {
      updateData.rejectionReason = rejectionReason || 'Rejected by admin team';
      updateData.regulatoryBundleStatus = 'twilio_rejected';
    }

    if (status === 'more_info_needed' || status === 'resubmission_needed') {
      updateData.rejectionReason = rejectionReason || null;
    }

    const updated = await prisma.phoneServiceActivation.update({
      where: { id: activationId },
      data: updateData,
    });

    return NextResponse.json({
      success: true,
      data: {
        id: updated.id,
        status: updated.status,
        regulatoryBundleStatus: updated.regulatoryBundleStatus,
        rejectionReason: updated.rejectionReason,
        approvedAt: updated.approvedAt,
      },
    });
  } catch (error) {
    console.error('Error updating phone activation status:', error);
    return NextResponse.json(
      { error: 'Failed to update phone activation status' },
      { status: 500 }
    );
  }
}

