import { NextRequest, NextResponse } from 'next/server';

// This route uses dynamic features, so it must be server-rendered
export const dynamic = 'force-dynamic';

import { prisma } from '@/lib/prisma';
import { verifyPartnerAuth } from '@/lib/auth/partnerAuth';

/**
 * API route to delete customer portal access
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { customerId: string } }
) {
  try {
    console.log('Delete portal access API called for customer ID:', params.customerId);
    
    // Verify partner authentication
    const partner = await verifyPartnerAuth(request);
    if (!partner) {
      console.log('Partner authentication failed');
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { customerId } = params;

    // First check if the user onboarding record exists for this partner
    const userOnboarding = await prisma.userOnboarding.findFirst({
      where: {
        partnerId: partner.id,
        id: customerId
      }
    });

    if (!userOnboarding) {
      console.log(`UserOnboarding with ID ${customerId} not found for partner ${partner.id}`);
      return NextResponse.json(
        { error: 'Customer not found or not associated with this partner' },
        { status: 404 }
      );
    }

    // Check if a Customer record exists for this user
    const customer = await prisma.customer.findFirst({
      where: {
        userId: userOnboarding.userId
      }
    });

    if (!customer) {
      console.log(`Customer record not found for userId ${userOnboarding.userId}`);
      return NextResponse.json(
        { error: 'Customer record not found' },
        { status: 404 }
      );
    }

    // Find existing credentials
    const existingCredentials = await prisma.customerCredential.findFirst({
      where: {
        customerId: customer.id,
        partnerId: partner.id
      }
    });

    if (!existingCredentials) {
      console.log(`No credentials found for customer ${customer.id}`);
      return NextResponse.json(
        { error: 'No portal access found for this customer' },
        { status: 404 }
      );
    }

    // Delete the credentials
    await prisma.customerCredential.delete({
      where: { id: existingCredentials.id }
    });

    // Update UserOnboarding record to disable customer portal
    await prisma.userOnboarding.update({
      where: { id: customerId },
      data: {
        customerPortalEnabled: false
      }
    });

    console.log(`Portal access deleted for customer ${customer.id}`);

    return NextResponse.json({
      success: true,
      message: 'Customer portal access has been deleted'
    });
  } catch (error: any) {
    console.error('Error deleting customer portal:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to delete customer portal' },
      { status: 500 }
    );
  }
}
