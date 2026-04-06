import { NextRequest, NextResponse } from 'next/server';

// Standalone Business Lookup Demo API
// This bypasses all OpenTelemetry issues and demonstrates full Google Places API capabilities

export async function POST(request: NextRequest) {
  try {
    const { place_id } = await request.json();

    if (!place_id) {
      return NextResponse.json(
        { error: 'place_id is required' },
        { status: 400 }
      );
    }

    const apiKey = process.env.GOOGLE_PLACES_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: 'Google Places API key not configured' },
        { status: 500 }
      );
    }

    // Comprehensive field mask to capture ALL available business data
    const fieldMask = [
      // Basic Information
      'id', 'displayName', 'formattedAddress', 'location',
      'types', 'businessStatus', 'priceLevel',
      
      // Contact Information
      'nationalPhoneNumber', 'internationalPhoneNumber',
      'websiteUri', 'googleMapsUri',
      
      // Ratings & Reviews
      'rating', 'userRatingCount', 'reviews',
      
      // Business Hours
      'regularOpeningHours', 'currentOpeningHours',
      
      // Additional Details
      'editorialSummary', 'primaryType', 'primaryTypeDisplayName',
      'shortFormattedAddress', 'adrFormatAddress',
      'utcOffsetMinutes', 'iconMaskBaseUri', 'iconBackgroundColor',
      
      // Photos
      'photos',
      
      // Accessibility & Amenities
      'accessibilityOptions', 'parkingOptions', 'paymentOptions',
      'outdoorSeating', 'liveMusic', 'menuForChildren',
      'servesBeer', 'servesWine', 'servesBrunch', 'servesLunch',
      'servesDinner', 'takeout', 'delivery', 'dineIn',
      'curbsidePickup', 'reservable', 'servesBreakfast',
      'servesVegetarianFood', 'restroom', 'goodForChildren',
      'goodForGroups', 'goodForWatchingSports', 'allowsDogs'
    ].join(',');

    console.log('🔍 Fetching comprehensive business data for place_id:', place_id);
    console.log('📋 Field mask:', fieldMask);

    const response = await fetch(
      `https://places.googleapis.com/v1/places/${place_id}`,
      {
        method: 'GET',
        headers: {
          'X-Goog-Api-Key': apiKey,
          'X-Goog-FieldMask': fieldMask,
          'Content-Type': 'application/json',
        },
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ Google Places API error:', response.status, errorText);
      return NextResponse.json(
        { 
          error: 'Google Places API error',
          status: response.status,
          details: errorText
        },
        { status: response.status }
      );
    }

    const businessData = await response.json();
    
    console.log('✅ Successfully fetched business data');
    console.log('📊 Business name:', businessData.displayName?.text);
    console.log('⭐ Rating:', businessData.rating);
    console.log('💬 Review count:', businessData.userRatingCount);
    console.log('📞 Phone:', businessData.nationalPhoneNumber);
    console.log('🌐 Website:', businessData.websiteUri);
    console.log('📍 Address:', businessData.formattedAddress);
    console.log('🏷️ Business types:', businessData.types);
    console.log('📝 Reviews available:', businessData.reviews?.length || 0);

    // Return comprehensive business data
    return NextResponse.json({
      success: true,
      place_id,
      business_data: businessData,
      summary: {
        name: businessData.displayName?.text,
        rating: businessData.rating,
        review_count: businessData.userRatingCount,
        phone: businessData.nationalPhoneNumber,
        website: businessData.websiteUri,
        address: businessData.formattedAddress,
        business_types: businessData.types,
        reviews_available: businessData.reviews?.length || 0,
        photos_available: businessData.photos?.length || 0,
        business_status: businessData.businessStatus,
        price_level: businessData.priceLevel
      }
    });

  } catch (error) {
    console.error('❌ Business lookup error:', error);
    return NextResponse.json(
      { 
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

// Search endpoint for business autocomplete
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get('query');
    const country = searchParams.get('country') || 'US';

    if (!query) {
      return NextResponse.json(
        { error: 'query parameter is required' },
        { status: 400 }
      );
    }

    const apiKey = process.env.GOOGLE_PLACES_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: 'Google Places API key not configured' },
        { status: 500 }
      );
    }

    console.log('🔍 Searching for businesses:', query, 'in country:', country);

    const response = await fetch(
      'https://places.googleapis.com/v1/places:autocomplete',
      {
        method: 'POST',
        headers: {
          'X-Goog-Api-Key': apiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          input: query,
          includedRegionCodes: [country],
          includeQueryPredictions: true
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ Google Places Autocomplete API error:', response.status, errorText);
      return NextResponse.json(
        { 
          error: 'Google Places API error',
          status: response.status,
          details: errorText
        },
        { status: response.status }
      );
    }

    const searchResults = await response.json();
    
    console.log('✅ Found', searchResults.suggestions?.length || 0, 'business suggestions');

    return NextResponse.json({
      success: true,
      query,
      country,
      suggestions: searchResults.suggestions || []
    });

  } catch (error) {
    console.error('❌ Business search error:', error);
    return NextResponse.json(
      { 
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
