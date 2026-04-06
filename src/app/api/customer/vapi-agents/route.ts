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
        vapiAgents: {
          select: {
            id: true,
            name: true,
            profitMultiplier: true,
            customerId: true,
            partner: {
              select: {
                vapiApiKey: true,
                defaultProfitMargin: true
              }
            }
          }
        }
      }
    });

    if (!customer) {
      return NextResponse.json({ error: 'Customer not found' }, { status: 404 });
    }

    // Return the assigned agents
    return NextResponse.json(customer.vapiAgents);

  } catch (error) {
    console.error('Error fetching customer agents:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
