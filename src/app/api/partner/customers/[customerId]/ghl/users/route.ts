import { NextRequest, NextResponse } from 'next/server';
import { verifyPartnerJWT } from '@/lib/auth';

const CONNECT_HUB_URL = process.env.CONNECT_HUB_URL || 'http://localhost:3001';

/**
 * Get GHL users for a customer's location
 * GET /api/partner/customers/[customerId]/ghl/users
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { customerId: string } }
) {
  try {
    // Verify partner authentication
    const auth = await verifyPartnerJWT(request);
    if (!auth.isValid || !auth.payload) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { customerId } = params;

    // Call Connect Hub to get GHL users
    const response = await fetch(
      `${CONNECT_HUB_URL}/ghl/users?tenantId=${customerId}&partnerId=${auth.payload.partnerId}`,
      {
        headers: { 'Content-Type': 'application/json' }
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Connect Hub users fetch error:', errorText);

      if (response.status === 404) {
        return NextResponse.json({
          success: false,
          error: 'No GHL connection found for this customer',
          users: []
        }, { status: 404 });
      }

      throw new Error('Failed to fetch GHL users');
    }

    const data = await response.json();

    return NextResponse.json({
      success: true,
      users: data.data?.users || []
    });

  } catch (error: any) {
    console.error('Error fetching GHL users:', error);
    return NextResponse.json(
      { error: 'Failed to load GHL users' },
      { status: 500 }
    );
  }
}

