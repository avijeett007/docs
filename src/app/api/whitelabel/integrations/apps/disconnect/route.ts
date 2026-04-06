import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyCustomerJWT } from '@/lib/customerJwt';

const CONNECT_HUB_URL = process.env.CONNECT_HUB_URL || 'http://localhost:3001';

// Mark this route as dynamic
export const dynamic = 'force-dynamic';

export async function DELETE(request: NextRequest) {
  try {
    console.log('[whitelabel/integrations/apps/disconnect] Starting app disconnection');

    // Get the customer token from cookies
    const cookieStore = cookies();
    const token = cookieStore.get('customer_token')?.value;

    if (!token) {
      console.log('[whitelabel/integrations/apps/disconnect] No customer token found');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Verify the JWT token
    const payload = await verifyCustomerJWT(token);
    if (!payload) {
      console.log('[whitelabel/integrations/apps/disconnect] Invalid customer token');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log('[whitelabel/integrations/apps/disconnect] Customer authenticated:', {
      customerId: payload.customerId,
      partnerId: payload.partnerId
    });

    // Get the app name from query params
    const { searchParams } = new URL(request.url);
    const appName = searchParams.get('appName');
    
    if (!appName) {
      console.log('[whitelabel/integrations/apps/disconnect] No app name provided');
      return NextResponse.json({ error: 'App name is required' }, { status: 400 });
    }

    console.log('[whitelabel/integrations/apps/disconnect] Disconnecting app:', appName);

    // Route to correct provider based on app type
    let disconnectUrl: URL;

    if (appName === 'gohighlevel') {
      // GHL disconnect - managed in-house, not through Composio
      disconnectUrl = new URL(`${CONNECT_HUB_URL}/oauth/ghl/disconnect`);
      disconnectUrl.searchParams.set('tenantId', payload.customerId);
      disconnectUrl.searchParams.set('partnerId', payload.partnerId);
      console.log('[whitelabel/integrations/apps/disconnect] Using GHL disconnect endpoint for:', appName);
    } else {
      // Composio disconnect for all other apps
      disconnectUrl = new URL(`${CONNECT_HUB_URL}/oauth/composio/disconnect`);
      disconnectUrl.searchParams.set('tenantId', payload.customerId);
      disconnectUrl.searchParams.set('partnerId', payload.partnerId);
      disconnectUrl.searchParams.set('appName', appName);
      console.log('[whitelabel/integrations/apps/disconnect] Using Composio disconnect endpoint for:', appName);
    }

    console.log('[whitelabel/integrations/apps/disconnect] Calling Connect Hub:', disconnectUrl.toString());

    const response = await fetch(disconnectUrl.toString(), {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[whitelabel/integrations/apps/disconnect] Connect Hub disconnect error:', errorText);
      return NextResponse.json(
        { error: 'Failed to disconnect app' },
        { status: 500 }
      );
    }

    const data = await response.json();

    const providerType = appName === 'gohighlevel' ? 'GHL' : 'Composio';
    console.log(`[whitelabel/integrations/apps/disconnect] ${providerType} app disconnected successfully:`, appName);

    return NextResponse.json({
      success: true,
      message: `App disconnected successfully`,
      appName,
      provider: providerType
    });

  } catch (error) {
    console.error('[whitelabel/integrations/apps/disconnect] Disconnect error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
