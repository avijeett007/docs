import { NextRequest, NextResponse } from 'next/server';
import { verifyPartnerJWT } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

/**
 * DELETE /api/partner/phone-numbers/[phoneNumberId]/delete
 * Delete an imported phone number (only allowed for imported numbers that are not assigned)
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { phoneNumberId: string } }
) {
  try {
    const phoneNumberId = params.phoneNumberId;

    // Verify partner authentication
    const { payload, isValid } = await verifyPartnerJWT(request);
    if (!isValid || !payload?.partnerId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const partnerId = payload.partnerId;

    // Get phone number with all related data
    const phoneNumber = await prisma.phoneNumber.findFirst({
      where: {
        id: phoneNumberId,
        partnerId: partnerId
      },
      include: {
        customer: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true
          }
        },
        agentMappings: {
          where: { status: 'active' }
        },
        sipConfig: true,
        purchases: true,
        documents: true,
        poolEntries: true,
        billingEntries: true
      }
    });

    if (!phoneNumber) {
      return NextResponse.json(
        { error: 'Phone number not found' },
        { status: 404 }
      );
    }

    // Check for billing information to include in warning
    const activeBilling = phoneNumber.billingEntries.find(b => b.status === 'active');
    const isChargeable = !phoneNumber.isImported && phoneNumber.monthlyRecurringCost > 0;
    const billingWarning = isChargeable ? {
      hadBilling: true,
      monthlyAmount: activeBilling?.monthlyAmount || phoneNumber.monthlyRecurringCost,
      message: 'This number had active billing. You will not receive a refund for the current billing period.'
    } : null;

    // Check if number is assigned to a customer
    if (phoneNumber.customerId) {
      return NextResponse.json(
        { 
          error: 'Cannot delete assigned phone number',
          message: 'Please unassign the phone number from the customer before deleting.'
        },
        { status: 400 }
      );
    }

    // Check if number has active agent mappings
    if (phoneNumber.agentMappings.length > 0) {
      return NextResponse.json(
        { 
          error: 'Cannot delete phone number with active agents',
          message: 'Please unassign all agents before deleting this phone number.'
        },
        { status: 400 }
      );
    }

    // Note: We only delete from database, not from the provider

    // Delete from database in a transaction
    await prisma.$transaction(async (tx) => {
      // Delete related records first
      if (phoneNumber.sipConfig) {
        await tx.phoneNumberSipConfig.delete({
          where: { phoneNumberId: phoneNumberId }
        });
      }

      if (phoneNumber.purchases.length > 0) {
        await tx.phoneNumberPurchase.deleteMany({
          where: { phoneNumberId: phoneNumberId }
        });
      }

      if (phoneNumber.documents.length > 0) {
        await tx.regulatoryDocument.deleteMany({
          where: { phoneNumberId: phoneNumberId }
        });
      }

      if (phoneNumber.poolEntries.length > 0) {
        await tx.phoneNumberPool.deleteMany({
          where: { phoneNumberId: phoneNumberId }
        });
      }

      if (phoneNumber.billingEntries.length > 0) {
        await tx.phoneNumberBilling.deleteMany({
          where: { phoneNumberId: phoneNumberId }
        });
      }

      // Delete any agent phone mappings (should be none due to check above)
      await tx.agentPhoneMapping.deleteMany({
        where: { phoneNumberId: phoneNumberId }
      });

      // Clean up associated provider credentials if this is an imported number
      // This ensures we don't leave orphaned credentials in the database
      if (phoneNumber.providerAccountId) {
        // Check if any other phone numbers are using the same provider credentials
        const otherNumbersUsingCredentials = await tx.phoneNumber.count({
          where: {
            providerAccountId: phoneNumber.providerAccountId,
            partnerId: partnerId,
            id: { not: phoneNumberId } // Exclude the current number being deleted
          }
        });

        // If no other numbers are using these credentials, delete them
        // This prevents credential accumulation and maintains data hygiene
        if (otherNumbersUsingCredentials === 0) {
          await tx.phoneNumberProvider.deleteMany({
            where: {
              accountIdentifier: phoneNumber.providerAccountId,
              partnerId: partnerId
            }
          });
        }
      }

      // Finally delete the phone number record
      await tx.phoneNumber.delete({
        where: { id: phoneNumberId }
      });
    });

    return NextResponse.json({
      success: true,
      message: 'Phone number and associated credentials deleted successfully',
      billingWarning
    });

  } catch (error: any) {
    console.error('Phone number deletion error:', error);
    return NextResponse.json(
      { error: 'Failed to delete phone number', details: error.message },
      { status: 500 }
    );
  }
}


