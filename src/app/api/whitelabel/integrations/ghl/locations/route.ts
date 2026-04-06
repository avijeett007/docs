import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyCustomerJWT } from '@/lib/customerJwt';
import { prisma } from '@/lib/prisma';

const CONNECT_HUB_URL = process.env.CONNECT_HUB_URL || 'http://localhost:3001';

// Mark this route as dynamic
export const dynamic = 'force-dynamic';

/**
 * Get GHL locations for the connected account
 * GET /api/whitelabel/integrations/ghl/locations
 */
export async function GET(_request: NextRequest) {
  try {
    console.log('[whitelabel/integrations/ghl/locations] Starting locations fetch');

    // Get the customer token from cookies
    const cookieStore = cookies();
    const token = cookieStore.get('customer_token')?.value;

    if (!token) {
      console.log('[whitelabel/integrations/ghl/locations] No customer token found');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Verify the token
    const payload = await verifyCustomerJWT(token);
    if (!payload) {
      console.log('[whitelabel/integrations/ghl/locations] Invalid customer token');
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    console.log('[whitelabel/integrations/ghl/locations] Customer authenticated:', {
      customerId: payload.customerId,
      partnerId: payload.partnerId
    });

    // Get customer info
    const customer = await prisma.customer.findUnique({
      where: { id: payload.customerId },
    });

    if (!customer) {
      console.log('[whitelabel/integrations/ghl/locations] Customer not found');
      return NextResponse.json({ error: 'Customer not found' }, { status: 404 });
    }

    // First check if GHL is connected
    const statusResponse = await fetch(
      `${CONNECT_HUB_URL}/oauth/ghl/status?tenantId=${customer.id}&partnerId=${payload.partnerId}`,
      {
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );

    if (!statusResponse.ok) {
      console.error('[whitelabel/integrations/ghl/locations] Failed to check GHL connection status');
      return NextResponse.json(
        { error: 'Failed to check GHL connection status' },
        { status: 500 }
      );
    }

    const statusData = await statusResponse.json();
    
    if (!statusData.data.isConnected) {
      console.log('[whitelabel/integrations/ghl/locations] GHL not connected');
      return NextResponse.json(
        { error: 'GHL account not connected' },
        { status: 400 }
      );
    }

    // Get locations from Connect Hub
    const locationsResponse = await fetch(
      `${CONNECT_HUB_URL}/ghl/locations?tenantId=${customer.id}&partnerId=${payload.partnerId}`,
      {
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );

    if (!locationsResponse.ok) {
      const errorText = await locationsResponse.text();
      console.error('[whitelabel/integrations/ghl/locations] Connect Hub locations error:', errorText);
      return NextResponse.json(
        { error: 'Failed to fetch GHL locations' },
        { status: 500 }
      );
    }

    const locationsData = await locationsResponse.json();

    console.log('[whitelabel/integrations/ghl/locations] Locations fetched successfully');

    return NextResponse.json({
      success: true,
      locations: locationsData.data?.locations || [],
    });

  } catch (error) {
    console.error('[whitelabel/integrations/ghl/locations] Locations fetch error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
