import { NextRequest, NextResponse } from 'next/server';
import { verifyPartnerJWT } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';

export async function PATCH(
  req: NextRequest,
  { params }: { params: { phoneNumberId: string } }
) {
  try {
    // Verify partner authentication
    const partnerAuth = await verifyPartnerJWT(req);
    if (!partnerAuth || !partnerAuth.isValid || !partnerAuth.payload?.partnerId) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const partnerId = partnerAuth.payload.partnerId;
    const { phoneNumberId } = params;
    const { hideFromCustomer } = await req.json();

    if (typeof hideFromCustomer !== 'boolean') {
      return NextResponse.json(
        { success: false, error: 'hideFromCustomer must be a boolean' },
        { status: 400 }
      );
    }

    // Verify the phone number belongs to this partner
    const phoneNumber = await prisma.phoneNumber.findFirst({
      where: {
        id: phoneNumberId,
        partnerId: partnerId,
      },
    });

    if (!phoneNumber) {
      return NextResponse.json(
        { success: false, error: 'Phone number not found or access denied' },
        { status: 404 }
      );
    }

    // Update the visibility setting
    const updatedPhoneNumber = await prisma.phoneNumber.update({
      where: {
        id: phoneNumberId,
      },
      data: {
        hideFromCustomer: hideFromCustomer,
      },
    });

    logger.info('Phone number visibility updated', {
      operation: 'update_phone_visibility',
      phoneNumberId: phoneNumberId,
      partnerId: partnerId,
      hideFromCustomer: hideFromCustomer,
      phoneNumber: phoneNumber.phoneNumber
    });

    return NextResponse.json({
      success: true,
      data: {
        phoneNumber: {
          id: updatedPhoneNumber.id,
          phoneNumber: updatedPhoneNumber.phoneNumber,
          hideFromCustomer: updatedPhoneNumber.hideFromCustomer,
        },
      },
    });
  } catch (error) {
    logger.error('Error updating phone number visibility', error as Error, {
      operation: 'update_phone_visibility',
      phoneNumberId: params.phoneNumberId
    });
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
