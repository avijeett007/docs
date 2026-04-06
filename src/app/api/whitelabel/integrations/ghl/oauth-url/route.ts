import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyCustomerJWT } from '@/lib/customerJwt';

const CONNECT_HUB_URL = process.env.CONNECT_HUB_URL || 'http://localhost:3001';

// Mark this route as dynamic
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    console.log('[whitelabel/integrations/ghl/oauth-url] Starting OAuth URL generation');

    // Get the customer token from cookies
    const cookieStore = cookies();
    const token = cookieStore.get('customer_token')?.value;

    if (!token) {
      console.log('[whitelabel/integrations/ghl/oauth-url] No customer token found');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Verify the JWT token
    const payload = await verifyCustomerJWT(token);
    if (!payload) {
      console.log('[whitelabel/integrations/ghl/oauth-url] Invalid customer token');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log('[whitelabel/integrations/ghl/oauth-url] Customer authenticated:', {
      customerId: payload.customerId,
      partnerId: payload.partnerId
    });

    // Get the redirect URL from query params (where to redirect after OAuth)
    const { searchParams } = new URL(request.url);
    const returnTo = searchParams.get('redirectUrl') || '/whitelabel/integration';

    // Call Connect Hub to get OAuth URL using GET with query params (use crm-hl to avoid branding)
    const oauthUrl = new URL(`${CONNECT_HUB_URL}/oauth/crm-hl/url`);
    oauthUrl.searchParams.set('tenantId', payload.customerId);
    oauthUrl.searchParams.set('partnerId', payload.partnerId);
    oauthUrl.searchParams.set('userId', payload.customerId); // Use customer ID as user ID
    oauthUrl.searchParams.set('returnTo', returnTo);

    console.log('[whitelabel/integrations/ghl/oauth-url] Calling Connect Hub:', oauthUrl.toString());

    const response = await fetch(oauthUrl.toString(), {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[whitelabel/integrations/ghl/oauth-url] Connect Hub OAuth URL error:', errorText);
      return NextResponse.json(
        { error: 'Failed to generate OAuth URL' },
        { status: 500 }
      );
    }

    const data = await response.json();
    
    console.log('[whitelabel/integrations/ghl/oauth-url] OAuth URL generated successfully');
    
    return NextResponse.json({
      success: true,
      oauthUrl: data.data.authUrl,
      state: data.data.state
    });

  } catch (error) {
    console.error('[whitelabel/integrations/ghl/oauth-url] OAuth URL generation error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
