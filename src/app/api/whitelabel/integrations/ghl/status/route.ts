import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyCustomerJWT } from '@/lib/customerJwt';

const CONNECT_HUB_URL = process.env.CONNECT_HUB_URL || 'http://localhost:3001';

// Mark this route as dynamic
export const dynamic = 'force-dynamic';

export async function GET(_request: NextRequest) {
  try {
    console.log('[whitelabel/integrations/ghl/status] Starting GHL status check');

    // Get the customer token from cookies
    const cookieStore = cookies();
    const token = cookieStore.get('customer_token')?.value;

    if (!token) {
      console.log('[whitelabel/integrations/ghl/status] No customer token found');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Verify the JWT token
    const payload = await verifyCustomerJWT(token);
    if (!payload) {
      console.log('[whitelabel/integrations/ghl/status] Invalid customer token');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log('[whitelabel/integrations/ghl/status] Customer authenticated:', {
      customerId: payload.customerId,
      partnerId: payload.partnerId
    });

    // Call Connect Hub to check OAuth status
    const statusUrl = new URL(`${CONNECT_HUB_URL}/oauth/ghl/status`);
    statusUrl.searchParams.set('tenantId', payload.customerId);
    statusUrl.searchParams.set('partnerId', payload.partnerId);

    console.log('[whitelabel/integrations/ghl/status] Calling Connect Hub:', statusUrl.toString());

    const response = await fetch(statusUrl.toString(), {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[whitelabel/integrations/ghl/status] Connect Hub status error:', errorText);
      return NextResponse.json(
        { error: 'Failed to check GHL status' },
        { status: 500 }
      );
    }

    const data = await response.json();
    
    console.log('[whitelabel/integrations/ghl/status] Status check completed successfully');
    
    return NextResponse.json(data);

  } catch (error) {
    console.error('[whitelabel/integrations/ghl/status] Status check error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
