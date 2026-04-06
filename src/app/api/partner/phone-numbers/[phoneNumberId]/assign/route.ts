import { NextRequest, NextResponse } from 'next/server';
import { verifyPartnerJWT } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';

const assignSchema = z.object({
  customerId: z.string().uuid().nullable() // null to unassign
});

export async function POST(
  req: NextRequest,
  { params }: { params: { phoneNumberId: string } }
) {
  try {
    console.log(`[DEBUG] Assignment route called - phoneNumberId: ${params.phoneNumberId}`);

    // Authenticate partner
    const partnerAuth = await verifyPartnerJWT(req);
    if (!partnerAuth || !partnerAuth.isValid || !partnerAuth.payload?.partnerId) {
      console.log(`[DEBUG] Authentication failed`);
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const partnerId = partnerAuth.payload.partnerId;
    const phoneNumberId = params.phoneNumberId;

    // Parse and validate request body
    const body = await req.json();

    const validationResult = assignSchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'INVALID_REQUEST_DATA', 
          message: 'Invalid request data',
          details: validationResult.error.errors 
        },
        { status: 400 }
      );
    }

    const { customerId } = validationResult.data;

    // If assigning to a customer, verify customer belongs to partner
    if (customerId) {
      const customer = await prisma.customer.findFirst({
        where: {
          id: customerId,
          userOnboarding: {
            some: {
              partnerId: partnerId
            }
          }
        }
      });

      if (!customer) {
        return NextResponse.json(
          { success: false, error: 'Customer not found or not accessible' },
          { status: 404 }
        );
      }
    }

    // Verify phone number belongs to partner
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
        }
      }
    });

    if (!phoneNumber) {
      return NextResponse.json(
        { success: false, error: 'Phone number not found' },
        { status: 404 }
      );
    }

    // Update phone number assignment
    const updatedPhoneNumber = await prisma.phoneNumber.update({
      where: {
        id: phoneNumberId
      },
      data: {
        customerId: customerId
      },
      include: {
        customer: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true
          }
        }
      }
    });
    console.log(`[DEBUG] phoneNumber.update completed successfully`);

    // Handle automatic agent unassignment when customer is unassigned
    if (!customerId && phoneNumber.customer) {
      console.log(`[DEBUG] Customer unassigned, checking for agent mappings to unassign`);
      await handleAutomaticAgentUnassignment(phoneNumberId, phoneNumber.customer.id, partnerId);
    }

    const action = customerId ? 'assigned' : 'unassigned';

    // Transform customer objects to include computed name field
    const transformCustomer = (customer: any) => {
      if (!customer) return null;
      return {
        ...customer,
        name: `${customer.firstName || ''} ${customer.lastName || ''}`.trim()
      };
    };

    const customerInfo = customerId ? transformCustomer(updatedPhoneNumber.customer) : null;
    const previousCustomerInfo = transformCustomer(phoneNumber.customer);

    return NextResponse.json({
      success: true,
      message: `Phone number ${action} successfully`,
      data: {
        phoneNumber: {
          id: updatedPhoneNumber.id,
          phoneNumber: updatedPhoneNumber.phoneNumber,
          friendlyName: updatedPhoneNumber.friendlyName,
          isAssigned: !!updatedPhoneNumber.customerId,
          customer: customerInfo
        },
        action,
        previousCustomer: previousCustomerInfo,
        newCustomer: customerInfo
      }
    });

  } catch (error: any) {
    console.error('Error assigning phone number:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'INTERNAL_ERROR',
        message: 'An error occurred while assigning phone number'
      },
      { status: 500 }
    );
  }
}

/**
 * Handle automatic agent unassignment when a customer is unassigned from a phone number
 */
async function handleAutomaticAgentUnassignment(phoneNumberId: string, customerId: string, partnerId: string) {
  try {
    console.log(`[DEBUG] Looking for active agent mappings for phone number ${phoneNumberId} and customer ${customerId}`);

    // Find active agent mappings for this phone number that belong to the same customer
    const activeAgentMappings = await prisma.agentPhoneMapping.findMany({
      where: {
        phoneNumberId: phoneNumberId,
        customerId: customerId,
        status: 'active'
      }
    });

    console.log(`[DEBUG] Found ${activeAgentMappings.length} active agent mappings to unassign`);

    for (const mapping of activeAgentMappings) {
      console.log(`[DEBUG] Processing agent mapping ${mapping.id} for agent ${mapping.agentId} (${mapping.agentProvider})`);

      // Handle Retell agent unassignment
      if (mapping.agentProvider === 'retell') {
        await handleRetellAgentUnassignment(mapping, partnerId);
      }

      // Update agent mapping status to inactive
      await prisma.agentPhoneMapping.update({
        where: { id: mapping.id },
        data: {
          status: 'inactive',
          updatedAt: new Date()
        }
      });

      console.log(`[DEBUG] Successfully unassigned agent ${mapping.agentId} from phone number`);
    }

  } catch (error: any) {
    console.error('Error during automatic agent unassignment:', error);
    // Don't throw error - we don't want to fail the customer unassignment if agent unassignment fails
  }
}

/**
 * Handle Retell-specific agent unassignment — DB cleanup only.
 * We never call the Retell API to delete the phone number here.
 * The partner may use this number outside of Knotie; provider deletion
 * is an explicit opt-in via the "also delete from provider" checkbox
 * in the delete confirmation modal (future feature).
 */
async function handleRetellAgentUnassignment(mapping: any, _partnerId: string) {
  console.log(`[DEBUG] Retell agent unassignment — DB cleanup only for agent ${mapping.agentId}`);
}
