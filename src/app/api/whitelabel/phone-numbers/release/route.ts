import { NextRequest, NextResponse } from 'next/server';
import { verifyWhitelabelAuth } from '@/lib/whitelabelAuth';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

interface ReleaseRequest {
  phoneNumberId: string;
  reason?: string;
}

export async function POST(req: NextRequest) {
  try {
    // Use whitelabel authentication
    const authResult = await verifyWhitelabelAuth(req);

    if (!authResult) {
      return new NextResponse('Unauthorized', { status: 401 });
    }

    const { customerId, partnerId } = authResult;
    const body: ReleaseRequest = await req.json();
    const { phoneNumberId, reason } = body;

    if (!phoneNumberId) {
      return new NextResponse('Phone number ID is required', { status: 400 });
    }

    // Verify the phone number belongs to this customer
    const phoneNumber = await prisma.phoneNumber.findFirst({
      where: {
        id: phoneNumberId,
        customerId: customerId,
        partnerId: partnerId
      },
      include: {
        poolEntries: true,
        billingEntries: true,
        agentMappings: {
          where: { status: 'active' }
        }
      }
    });

    if (!phoneNumber) {
      return new NextResponse('Phone number not found or not owned by customer', { status: 404 });
    }

    // Check if number is assigned to any active agents
    if (phoneNumber.agentMappings.length > 0) {
      return NextResponse.json({
        success: false,
        error: 'number_in_use',
        message: 'Cannot release phone number that is assigned to active agents. Please unassign from agents first.',
        activeAgents: phoneNumber.agentMappings.map(mapping => ({
          agentId: mapping.agentId,
          agentName: mapping.agentName,
          agentProvider: mapping.agentProvider
        }))
      }, { status: 400 });
    }

    return await prisma.$transaction(async (tx) => {
      // Update phone number to remove customer assignment
      await tx.phoneNumber.update({
        where: { id: phoneNumberId },
        data: {
          customerId: null,
          status: 'available'
        }
      });

      // Update pool entry to available
      const poolEntry = phoneNumber.poolEntries[0];
      if (poolEntry) {
        await tx.phoneNumberPool.update({
          where: { id: poolEntry.id },
          data: {
            status: 'available',
            releasedAt: new Date()
          }
        });
      }

      // Cancel billing entries
      if (phoneNumber.billingEntries.length > 0) {
        await tx.phoneNumberBilling.updateMany({
          where: {
            phoneNumberId: phoneNumberId,
            status: 'active'
          },
          data: {
            status: 'cancelled'
          }
        });
      }

      // Log the release action
      await tx.auditLog.create({
        data: {
          customerId: customerId,
          partnerId: partnerId,
          action: 'phone_number_released',
          entityType: 'phone_number',
          entityId: phoneNumberId,
          details: {
            phoneNumber: phoneNumber.phoneNumber,
            reason: reason || 'Customer requested release',
            releasedAt: new Date().toISOString()
          }
        }
      });

      return NextResponse.json({
        success: true,
        data: {
          phoneNumber: phoneNumber.phoneNumber,
          status: 'released',
          message: 'Phone number has been released and is now available for other customers.',
          poolStatus: poolEntry ? 'returned_to_partner_pool' : 'released'
        }
      });
    });

  } catch (error) {
    console.error('Error releasing phone number:', error);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}
