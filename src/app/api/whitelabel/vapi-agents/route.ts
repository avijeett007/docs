import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyCustomerJWT } from '@/lib/customerJwt';
import { prisma } from '@/lib/prisma';

// Mark this route as dynamic
export const dynamic = 'force-dynamic';

export async function GET(_req: NextRequest) {
  try {
    console.log('[whitelabel/vapi-agents] Starting VAPI agents fetch');

    // Get the customer token from cookies
    const cookieStore = cookies();
    const token = cookieStore.get('customer_token')?.value;

    if (!token) {
      console.log('[whitelabel/vapi-agents] No customer token found');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Verify the token
    const payload = await verifyCustomerJWT(token);
    if (!payload) {
      console.log('[whitelabel/vapi-agents] Invalid token');
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    console.log('[whitelabel/vapi-agents] Customer authenticated:', payload.customerId);

    // Get the customer record for the authenticated user
    console.log('[whitelabel/vapi-agents] Looking up customer:', payload.customerId);

    const customer = await prisma.customer.findUnique({
      where: { id: payload.customerId },
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
      console.log('[whitelabel/vapi-agents] Customer not found');
      return NextResponse.json({ error: 'Customer not found' }, { status: 404 });
    }

    console.log('[whitelabel/vapi-agents] Found customer with', customer.vapiAgents.length, 'VAPI agents');

    // Return the assigned agents
    return NextResponse.json(customer.vapiAgents);

  } catch (error) {
    console.error('[whitelabel/vapi-agents] Error fetching customer agents:', error);
    return NextResponse.json(
      {
        error: 'Internal server error',
        message: 'An unexpected error occurred while fetching VAPI agents.',
        userFriendlyMessage: 'We encountered an issue while retrieving your voice agents. Please try again later or contact support if the problem persists.'
      },
      { status: 500 }
    );
  }
}
