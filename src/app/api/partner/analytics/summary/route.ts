import { NextResponse, NextRequest } from 'next/server';
import { verifyPartnerJWT } from '@/lib/auth';

export const dynamic = 'force-dynamic';

const ANALYTICS_API_URL = process.env.ANALYTICS_API_URL;
const ANALYTICS_API_KEY = process.env.ANALYTICS_STANDARD_API_KEY;
// Environment variable to control analytics API version (default: v1)
const ANALYTICS_API_VERSION = process.env.ANALYTICS_API_VERSION || 'v1';

/**
 * Convert V3 analytics cost values from cents to dollars
 * V3 returns all costs in cents for consistency with database storage
 * V1 and V2 already return dollars, so this conversion makes V3 consistent
 */
function convertV3CostsToDollars(data: any): any {
  if (ANALYTICS_API_VERSION !== 'v3') {
    return data;
  }

  // Convert main cost fields from cents to dollars
  const converted = {
    ...data,
    totalCost: data.totalCost != null ? data.totalCost / 100 : 0,
    avgCost: data.avgCost != null ? data.avgCost / 100 : 0,
  };

  // Convert product costs if present
  if (Array.isArray(data.productCosts)) {
    converted.productCosts = data.productCosts.map((item: any) => ({
      ...item,
      cost: item.cost != null ? item.cost / 100 : 0
    }));
  }

  return converted;
}

export async function GET(request: NextRequest) {
  try {
    // Check if analytics service is configured
    if (!ANALYTICS_API_URL || !ANALYTICS_API_KEY) {
      return NextResponse.json({ error: 'Analytics service not configured' }, { status: 503 });
    }

    // Verify JWT and get partner
    const auth = await verifyPartnerJWT(request);
    if (!auth.isValid) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const partnerId = auth.payload?.partnerId;
    if (!partnerId) {
      return NextResponse.json(
        { error: 'Invalid partner ID' },
        { status: 401 }
      );
    }

    // Parse period from query params
    const searchParams = request.nextUrl.searchParams;
    const period = searchParams.get('period') || 'month';

    console.log('Fetching partner summary from analytics service:', {
      partnerId,
      period,
      analyticsApiUrl: ANALYTICS_API_URL,
      hasApiKey: !!ANALYTICS_API_KEY
    });

    // Make request to analytics service with cache-busting timestamp
    const timestamp = Date.now();
    // V2 and V3 use the same URL pattern /{version}/analytics/partner/{id}
    const endpoint = (ANALYTICS_API_VERSION === 'v2' || ANALYTICS_API_VERSION === 'v3')
      ? `${ANALYTICS_API_URL}/${ANALYTICS_API_VERSION}/analytics/partner/${partnerId}?period=${period}&v1_compatible=true&_t=${timestamp}`
      : `${ANALYTICS_API_URL}/api/v1/app/partner/${partnerId}/summary?period=${period}&_t=${timestamp}`;

    // Both V1 and V2 use the same authentication method (x-api-key)
    const response = await fetch(endpoint, {
      headers: {
        'x-api-key': ANALYTICS_API_KEY,
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache'
      }
    });

    if (!response.ok) {
      console.error(`Analytics service error: ${response.status}`);
      const errorText = await response.text();
      console.error('Analytics service error response:', errorText);
      // Return empty summary instead of error for graceful degradation
      return NextResponse.json({
        totalCost: 0,
        totalDuration: 0,
        totalCalls: 0,
        failedCalls: 0,
        successRate: 0,
        avgDuration: 0,
        avgCost: 0,
        productCosts: []
      });
    }

    let analyticsData = await response.json();
    console.log(`${ANALYTICS_API_VERSION.toUpperCase()} analytics service response:`, JSON.stringify(analyticsData, null, 2));

    // V3 returns costs in cents, convert to dollars for consistency with V1/V2
    if (ANALYTICS_API_VERSION === 'v3') {
      analyticsData = convertV3CostsToDollars(analyticsData);
      console.log('Converted V3 costs from cents to dollars');
    }

    // V2/V3 returns the exact format expected by the frontend, but we need to add avgCostPerMinute
    const summary = {
      ...analyticsData,
      avgCostPerMinute: analyticsData.totalDuration > 0 ?
        analyticsData.totalCost / (analyticsData.totalDuration / 60) : 0
    };

    console.log(`Successfully loaded partner summary from ${ANALYTICS_API_VERSION.toUpperCase()} analytics service:`, summary);
    // Add cache-busting headers to ensure fresh analytics data
    const nextResponse = NextResponse.json(summary);
    nextResponse.headers.set('Cache-Control', 'no-cache, no-store, must-revalidate, max-age=0');
    nextResponse.headers.set('Pragma', 'no-cache');
    nextResponse.headers.set('Expires', '0');
    nextResponse.headers.set('ETag', `"${Date.now()}"`);
    nextResponse.headers.set('Last-Modified', new Date().toUTCString());
    nextResponse.headers.set('Vary', '*');
    return nextResponse;

  } catch (error) {
    console.error('Error fetching partner summary from analytics service:', error);
    
    // Return empty summary instead of error for graceful degradation
    const errorResponse = NextResponse.json({
      totalCost: 0,
      totalDuration: 0,
      totalCalls: 0,
      failedCalls: 0,
      successRate: 0,
      avgDuration: 0,
      avgCost: 0,
      productCosts: []
    });
    // Add cache-busting headers even for error responses
    errorResponse.headers.set('Cache-Control', 'no-cache, no-store, must-revalidate, max-age=0');
    errorResponse.headers.set('Pragma', 'no-cache');
    errorResponse.headers.set('Expires', '0');
    errorResponse.headers.set('ETag', `"${Date.now()}"`);
    errorResponse.headers.set('Last-Modified', new Date().toUTCString());
    errorResponse.headers.set('Vary', '*');
    return errorResponse;
  }
}
