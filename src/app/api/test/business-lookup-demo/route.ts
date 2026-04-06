import { NextRequest, NextResponse } from 'next/server';
import { searchBusinesses, getBusinessDetails } from '@/lib/business-lookup-utils';

/**
 * Demo endpoint for testing business lookup functionality without authentication
 * This bypasses partner authentication for testing purposes
 */

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get('query');
    const country = searchParams.get('country') || 'US';

    if (!query) {
      return NextResponse.json({
        success: false,
        error: 'Query parameter is required'
      }, { status: 400 });
    }

    // Search for businesses
    const businesses = await searchBusinesses(query, country);

    return NextResponse.json({
      success: true,
      data: {
        query,
        country,
        businesses: businesses.slice(0, 5) // Limit to 5 results for demo
      }
    });

  } catch (error) {
    console.error('Error in business lookup demo:', error);
    return NextResponse.json({
      success: false,
      error: 'Internal server error'
    }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { place_id } = body;

    if (!place_id) {
      return NextResponse.json({
        success: false,
        error: 'place_id is required'
      }, { status: 400 });
    }

    // Get business details
    const businessDetails = await getBusinessDetails(place_id);

    return NextResponse.json({
      success: true,
      data: {
        business: businessDetails
      }
    });

  } catch (error) {
    console.error('Error in business details demo:', error);
    return NextResponse.json({
      success: false,
      error: 'Internal server error'
    }, { status: 500 });
  }
}
