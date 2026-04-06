import { NextRequest, NextResponse } from 'next/server';
import { verifyPartnerJWT } from '@/lib/auth';

const CONNECT_HUB_URL = process.env.CONNECT_HUB_URL || 'http://localhost:3001';

/**
 * Get GHL locations for a customer
 * GET /api/partner/customers/[customerId]/ghl/locations
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
    
    // Call Connect Hub to get GHL locations
    const response = await fetch(
      `${CONNECT_HUB_URL}/ghl/locations?tenantId=${customerId}&partnerId=${auth.payload.partnerId}`,
      {
        headers: { 'Content-Type': 'application/json' }
      }
    );
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('Connect Hub locations fetch error:', errorText);
      
      if (response.status === 404) {
        return NextResponse.json({
          success: true,
          locations: [],
          message: 'No GHL connection found for this customer'
        });
      }
      
      throw new Error('Failed to fetch GHL locations');
    }
    
    const data = await response.json();
    
    return NextResponse.json({
      success: true,
      locations: data.data?.locations || []
    });
    
  } catch (error: any) {
    console.error('Error fetching GHL locations:', error);
    return NextResponse.json(
      { error: 'Failed to load GHL locations' },
      { status: 500 }
    );
  }
}
