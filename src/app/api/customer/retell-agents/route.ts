import { NextRequest, NextResponse } from 'next/server';
import { getAuth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/prisma';

// Mark this route as dynamic
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const { userId } = getAuth(req);
    
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get the customer record for the authenticated user
    const customer = await prisma.customer.findUnique({
      where: { userId },
      include: {
        retellAgents: {
          where: { isActive: true },
          select: {
            id: true,
            name: true,
            voiceId: true,
            voiceModel: true,
            language: true,
            recordingEnabled: true,
            customerId: true,
            partnerId: true
          }
        }
      }
    });

    if (!customer) {
      return NextResponse.json({ error: 'Customer not found' }, { status: 404 });
    }

    // Return the customer's assigned Retell agents
    return NextResponse.json(customer.retellAgents);

  } catch (error) {
    console.error('Error fetching Retell agents:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
