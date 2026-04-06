import { NextRequest, NextResponse } from 'next/server';
import { verifyPartnerJWT } from '@/lib/auth';

const CONNECT_HUB_URL = process.env.CONNECT_HUB_URL || 'http://localhost:3001';

/**
 * Get GHL calendars for a customer
 * GET /api/partner/customers/[customerId]/ghl/calendars
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
    
    // Call Connect Hub to get GHL calendars
    const response = await fetch(
      `${CONNECT_HUB_URL}/calendars/provider?tenantId=${customerId}&partnerId=${auth.payload.partnerId}&provider=ghl`,
      {
        headers: { 'Content-Type': 'application/json' }
      }
    );
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('Connect Hub calendar fetch error:', errorText);
      
      if (response.status === 404) {
        return NextResponse.json({
          success: false,
          error: 'No GHL connection found for this customer',
          calendars: []
        }, { status: 404 });
      }
      
      throw new Error('Failed to fetch GHL calendars');
    }
    
    const data = await response.json();
    
    return NextResponse.json({
      success: true,
      calendars: data.data?.calendars || []
    });
    
  } catch (error: any) {
    console.error('Error fetching GHL calendars:', error);
    return NextResponse.json(
      { error: 'Failed to load GHL calendars' },
      { status: 500 }
    );
  }
}
