import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyWhitelabelAuth } from '@/lib/whitelabelAuth';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    // Verify customer authentication
    const authResult = await verifyWhitelabelAuth(request);
    if (!authResult) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { customerId, partnerId } = authResult;

    // Get customer email from database
    const customer = await prisma.customer.findUnique({
      where: { id: customerId },
      select: { email: true }
    });

    if (!customer) {
      return NextResponse.json({ error: 'Customer not found' }, { status: 404 });
    }

    // Check if there's a prospect entry for this customer
    // Either by convertedToCustomerId or by matching email
    const prospect = await prisma.prospect.findFirst({
      where: {
        OR: [
          {
            convertedToCustomerId: customerId
          },
          {
            AND: [
              { email: customer.email.toLowerCase() },
              { partnerId: partnerId }
            ]
          }
        ]
      },
      select: {
        id: true,
        isCompleted: true,
        currentStep: true,
        convertedToCustomerId: true
      }
    });

    return NextResponse.json({
      success: true,
      hasProspectEntry: !!prospect,
      prospect: prospect ? {
        id: prospect.id,
        isCompleted: prospect.isCompleted,
        currentStep: prospect.currentStep,
        isConverted: !!prospect.convertedToCustomerId
      } : null
    });

  } catch (error) {
    console.error('Error checking prospect entry:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
