import { NextRequest, NextResponse } from 'next/server';
import { verifyPartnerJWT } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { RegulatoryBundleService } from '@/lib/services/RegulatoryBundleService';

export async function POST(req: NextRequest) {
  try {
    // Verify partner authentication
    const partnerAuth = await verifyPartnerJWT(req);
    if (!partnerAuth || !partnerAuth.isValid || !partnerAuth.payload?.partnerId) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const partnerId = partnerAuth.payload.partnerId;
    const body = await req.json();

    if (!body.activationId) {
      return NextResponse.json(
        { success: false, error: 'Missing activationId' },
        { status: 400 }
      );
    }

    // Verify the activation belongs to this partner and is in a resubmittable state
    const activation = await prisma.phoneServiceActivation.findFirst({
      where: {
        id: body.activationId,
        partnerId,
        status: { in: ['rejected', 'resubmission_needed'] },
      },
    });

    if (!activation) {
      return NextResponse.json(
        { success: false, error: 'Activation not found or not eligible for resubmission' },
        { status: 404 }
      );
    }

    logger.info('Phone activation resubmission received', {
      operation: 'phone_activation_api',
      partnerId,
      activationId: body.activationId
    });

    // Update documents if new ones provided
    const updateData: any = {
      status: 'draft',
      rejectionReason: null,
      regulatoryBundleStatus: null, // Reset so bundle can be resubmitted
    };

    if (body.documents && Array.isArray(body.documents) && body.documents.length > 0) {
      updateData.documents = body.documents;
    }

    // Update business info if provided
    if (body.businessName) updateData.businessName = body.businessName;
    if (body.businessAddress) updateData.businessAddress = body.businessAddress;
    if (body.businessRegistrationNumber) updateData.businessRegistrationNumber = body.businessRegistrationNumber;
    if (body.businessRegistrationAuthority) updateData.businessRegistrationAuthority = body.businessRegistrationAuthority;
    if (body.businessWebsite) updateData.businessWebsite = body.businessWebsite;
    if (body.contactFirstName) updateData.contactFirstName = body.contactFirstName;
    if (body.contactLastName) updateData.contactLastName = body.contactLastName;
    if (body.contactEmail) updateData.contactEmail = body.contactEmail;
    if (body.contactPhone) updateData.contactPhone = body.contactPhone;

    await prisma.phoneServiceActivation.update({
      where: { id: body.activationId },
      data: updateData,
    });

    // Re-process the activation
    const service = new RegulatoryBundleService();
    service.processAndSubmit(body.activationId).catch((error) => {
      logger.error('Background phone activation resubmission failed', error as Error, {
        operation: 'phone_activation_api',
        activationId: body.activationId,
        partnerId
      });
    });

    return NextResponse.json({
      success: true,
      data: {
        activationId: body.activationId,
        status: 'resubmitted',
        message: 'Your phone service activation has been resubmitted for review.',
      },
    });
  } catch (error) {
    logger.error('Phone activation resubmission failed', error as Error, {
      operation: 'phone_activation_api'
    });
    return NextResponse.json(
      { success: false, error: 'Failed to resubmit phone activation' },
      { status: 500 }
    );
  }
}

