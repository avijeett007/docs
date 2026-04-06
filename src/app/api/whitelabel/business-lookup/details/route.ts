import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/logger';
import {
  BusinessDetailsRequest,
  BusinessDetailsResponse,
  BusinessLookupErrorCodes,
  GooglePlaceDetailsResponse
} from '@/types/business-lookup';
import {
  checkAndDeductCredits,
  checkRateLimit,
  logBusinessLookupAudit,
  getGooglePlacesHeaders,
  calculateGoogleApiCost,
  handleGoogleApiError,
  validatePlaceId,
  getBusinessLookupCreditsPerSearch
} from '@/lib/business-lookup-utils';

export async function POST(request: NextRequest): Promise<NextResponse<BusinessDetailsResponse>> {
  const startTime = Date.now();
  let partnerId: string | undefined;
  let placeId: string | undefined;
  let creditsDeducted = 0;
  let apiCostUsd = 0;

  try {
    // Get partner ID from headers or query params
    partnerId = request.headers.get('x-partner-id') || 
                new URL(request.url).searchParams.get('partnerId') || 
                undefined;

    if (!partnerId) {
      const errorResponse: BusinessDetailsResponse = {
        success: false,
        error: 'Partner ID is required'
      };
      return NextResponse.json(errorResponse, { status: 400 });
    }

    // Parse request body
    const body: BusinessDetailsRequest = await request.json();
    placeId = body.place_id;

    // Validate input
    const placeIdValidation = validatePlaceId(body.place_id);
    if (!placeIdValidation.valid) {
      logger.warn('Place ID validation failed', {
        operation: 'business_lookup_details',
        partnerId,
        placeId: body.place_id,
        validationError: placeIdValidation.error,
        error: placeIdValidation.error
      });
      const errorResponse: BusinessDetailsResponse = {
        success: false,
        error: placeIdValidation.error
      };
      return NextResponse.json(errorResponse, { status: 400 });
    }

    logger.info('Place ID validation passed', {
      operation: 'business_lookup_details',
      partnerId,
      placeId: body.place_id
    });

    // Check rate limiting
    const rateLimitResult = await checkRateLimit(partnerId);
    if (!rateLimitResult.allowed) {
      await logBusinessLookupAudit({
        partnerId,
        searchQuery: `place_details:${body.place_id}`,
        searchType: 'details',
        placeId: body.place_id,
        creditsDeducted: 0,
        apiCostUsd: 0,
        responseTimeMs: Date.now() - startTime,
        success: false,
        errorCode: BusinessLookupErrorCodes.RATE_LIMIT_EXCEEDED,
        errorMessage: 'Rate limit exceeded',
        ipAddress: request.headers.get('CF-Connecting-IP') || request.headers.get('X-Forwarded-For')?.split(',')[0],
        userAgent: request.headers.get('User-Agent') || undefined,
        countryDetected: request.headers.get('CF-IPCountry') || undefined
      });

      const errorResponse: BusinessDetailsResponse = {
        success: false,
        error: 'Rate limit exceeded. Please try again later.'
      };
      return NextResponse.json(errorResponse, { status: 429 });
    }

    // Calculate costs
    apiCostUsd = calculateGoogleApiCost('details');
    const creditsRequired = getBusinessLookupCreditsPerSearch();

    // Check and deduct credits
    const creditResult = await checkAndDeductCredits(partnerId, creditsRequired);
    if (!creditResult.success) {
      await logBusinessLookupAudit({
        partnerId,
        searchQuery: `place_details:${body.place_id}`,
        searchType: 'details',
        placeId: body.place_id,
        creditsDeducted: 0,
        apiCostUsd,
        responseTimeMs: Date.now() - startTime,
        success: false,
        errorCode: creditResult.error?.includes('disabled') ? 
          BusinessLookupErrorCodes.FEATURE_DISABLED : 
          BusinessLookupErrorCodes.INSUFFICIENT_CREDITS,
        errorMessage: creditResult.error,
        ipAddress: request.headers.get('CF-Connecting-IP') || request.headers.get('X-Forwarded-For')?.split(',')[0],
        userAgent: request.headers.get('User-Agent') || undefined,
        countryDetected: request.headers.get('CF-IPCountry') || undefined
      });

      const errorResponse: BusinessDetailsResponse = {
        success: false,
        error: creditResult.error
      };
      return NextResponse.json(errorResponse, { status: 402 });
    }

    creditsDeducted = creditResult.credits_deducted;

    // Prepare Google Places API request with comprehensive field selection
    // Note: Google Places API (New) uses a different URL structure
    const googleApiUrl = `https://places.googleapis.com/v1/places/${body.place_id}`;

    // Request all available fields to capture maximum business data
    const fieldMask = [
      // Basic Information
      'id', 'displayName', 'formattedAddress', 'location', 'types',
      'businessStatus', 'priceLevel', 'rating', 'userRatingCount',

      // Contact Information
      'nationalPhoneNumber', 'internationalPhoneNumber', 'websiteUri',

      // Business Hours
      'regularOpeningHours', 'currentOpeningHours',

      // Reviews & Photos
      'reviews', 'photos',

      // Accessibility & Amenities
      'accessibilityOptions', 'parkingOptions', 'paymentOptions',
      'outdoorSeating', 'liveMusic', 'menuForChildren',
      'servesBeer', 'servesWine', 'servesBrunch', 'servesLunch',
      'servesDinner', 'takeout', 'delivery', 'dineIn',
      'curbsidePickup', 'reservable', 'servesBreakfast',
      'servesVegetarianFood', 'restroom', 'goodForChildren',
      'goodForGroups', 'goodForWatchingSports', 'allowsDogs'
    ].join(',');

    // Validate API key before making request
    const apiKey = process.env.GOOGLE_PLACES_API_KEY;
    if (!apiKey) {
      logger.error('Google Places API key not configured', new Error('Missing API key'), {
        operation: 'business_lookup_details',
        partnerId,
        placeId
      });
      return NextResponse.json(
        {
          success: false,
          error: 'Service configuration error'
        },
        { status: 500 }
      );
    }

    // Call Google Places API
    const googleResponse = await fetch(googleApiUrl, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': apiKey,
        'X-Goog-FieldMask': fieldMask
      }
    });

    if (!googleResponse.ok) {
      const errorData = await googleResponse.json().catch(() => ({}));
      const { errorCode, errorMessage } = handleGoogleApiError({
        status: googleResponse.status,
        message: errorData.error?.message
      }, 'details');

      await logBusinessLookupAudit({
        partnerId,
        searchQuery: `place_details:${body.place_id}`,
        searchType: 'details',
        placeId: body.place_id,
        creditsDeducted,
        apiCostUsd,
        responseTimeMs: Date.now() - startTime,
        success: false,
        errorCode,
        errorMessage,
        ipAddress: request.headers.get('CF-Connecting-IP') || request.headers.get('X-Forwarded-For')?.split(',')[0],
        userAgent: request.headers.get('User-Agent') || undefined,
        countryDetected: request.headers.get('CF-IPCountry') || undefined
      });

      const errorResponse: BusinessDetailsResponse = {
        success: false,
        error: errorMessage
      };
      return NextResponse.json(errorResponse, { status: 500 });
    }

    const googleData: GooglePlaceDetailsResponse = await googleResponse.json();

    // Transform Google response to our comprehensive format
    const businessDetails = {
      place_id: googleData.id,
      name: googleData.displayName?.text || 'Unknown Business',
      formatted_address: googleData.formattedAddress || '',
      formatted_phone_number: googleData.nationalPhoneNumber,
      international_phone_number: googleData.internationalPhoneNumber,
      website: googleData.websiteUri,
      url: googleData.googleMapsUri,
      rating: googleData.rating,
      user_ratings_total: googleData.userRatingCount,
      price_level: googleData.priceLevel ? 
        ['PRICE_LEVEL_FREE', 'PRICE_LEVEL_INEXPENSIVE', 'PRICE_LEVEL_MODERATE', 'PRICE_LEVEL_EXPENSIVE', 'PRICE_LEVEL_VERY_EXPENSIVE']
          .indexOf(googleData.priceLevel) : undefined,
      business_status: googleData.businessStatus,
      types: googleData.types || [],
      geometry: {
        location: {
          lat: googleData.location?.latitude || 0,
          lng: googleData.location?.longitude || 0
        }
      },
      opening_hours: googleData.regularOpeningHours ? {
        open_now: googleData.regularOpeningHours.openNow,
        periods: googleData.regularOpeningHours.periods || [],
        weekday_text: googleData.regularOpeningHours.weekdayDescriptions || []
      } : undefined,
      photos: googleData.photos || [],
      reviews: googleData.reviews || [],
      // Additional comprehensive data
      editorial_summary: (googleData as any).editorialSummary?.text,
      primary_type: (googleData as any).primaryType,
      accessibility_options: (googleData as any).accessibilityOptions,
      amenities: {
        allows_dogs: (googleData as any).allowsDogs,
        restroom: (googleData as any).restroom,
        good_for_children: (googleData as any).goodForChildren,
        good_for_groups: (googleData as any).goodForGroups,
        outdoor_seating: (googleData as any).outdoorSeating,
        takeout: (googleData as any).takeout,
        delivery: (googleData as any).delivery,
        dine_in: (googleData as any).dineIn,
        curbside_pickup: (googleData as any).curbsidePickup,
        reservable: (googleData as any).reservable,
        wheelchair_accessible: {
          entrance: (googleData as any).wheelchairAccessibleEntrance,
          parking: (googleData as any).wheelchairAccessibleParking,
          restroom: (googleData as any).wheelchairAccessibleRestroom,
          seating: (googleData as any).wheelchairAccessibleSeating
        }
      },
      dining_options: {
        serves_breakfast: (googleData as any).servesBreakfast,
        serves_brunch: (googleData as any).servesBrunch,
        serves_lunch: (googleData as any).servesLunch,
        serves_dinner: (googleData as any).servesDinner,
        serves_beer: (googleData as any).servesBeer,
        serves_wine: (googleData as any).servesWine,
        serves_vegetarian_food: (googleData as any).servesVegetarianFood
      }
    };

    // Log successful details request
    await logBusinessLookupAudit({
      partnerId,
      searchQuery: `place_details:${body.place_id}`,
      searchType: 'details',
      placeId: body.place_id,
      creditsDeducted,
      apiCostUsd,
      responseTimeMs: Date.now() - startTime,
      success: true,
      ipAddress: request.headers.get('CF-Connecting-IP') || request.headers.get('X-Forwarded-For')?.split(',')[0],
      userAgent: request.headers.get('User-Agent') || undefined,
      countryDetected: request.headers.get('CF-IPCountry') || undefined
    });

    const response: BusinessDetailsResponse = {
      success: true,
      data: {
        business: businessDetails,
        credits_deducted: creditsDeducted,
        credits_remaining: creditResult.credits_remaining,
        api_cost_usd: apiCostUsd
      }
    };

    return NextResponse.json(response);

  } catch (error) {
    logger.error('Business details error', error as Error, {
      operation: 'business_lookup_details',
      partnerId,
      placeId
    });

    // Log error if we have the required data
    if (partnerId && placeId) {
      await logBusinessLookupAudit({
        partnerId,
        searchQuery: `place_details:${placeId}`,
        searchType: 'details',
        placeId,
        creditsDeducted,
        apiCostUsd,
        responseTimeMs: Date.now() - startTime,
        success: false,
        errorCode: BusinessLookupErrorCodes.INTERNAL_ERROR,
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
        ipAddress: request.headers.get('CF-Connecting-IP') || request.headers.get('X-Forwarded-For')?.split(',')[0],
        userAgent: request.headers.get('User-Agent') || undefined,
        countryDetected: request.headers.get('CF-IPCountry') || undefined
      });
    }

    const errorResponse: BusinessDetailsResponse = {
      success: false,
      error: 'Internal server error'
    };

    return NextResponse.json(errorResponse, { status: 500 });
  }
}
