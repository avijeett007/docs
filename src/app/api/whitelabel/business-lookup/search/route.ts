import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/logger';
import {
  BusinessSearchRequest,
  BusinessSearchResponse,
  BusinessLookupErrorCodes,
  GooglePlacesAutocompleteResponse
} from '@/types/business-lookup';
import {
  checkAndDeductCredits,
  checkRateLimit,
  logBusinessLookupAudit,
  getGooglePlacesHeaders,
  calculateGoogleApiCost,
  handleGoogleApiError,
  validateSearchQuery,
  getBusinessLookupCreditsPerSearch
} from '@/lib/business-lookup-utils';

export async function POST(request: NextRequest): Promise<NextResponse<BusinessSearchResponse>> {
  const startTime = Date.now();
  let partnerId: string | undefined;
  let searchQuery: string | undefined;
  let creditsDeducted = 0;
  let apiCostUsd = 0;

  try {
    // Get partner ID from headers or query params
    partnerId = request.headers.get('x-partner-id') || 
                new URL(request.url).searchParams.get('partnerId') || 
                undefined;

    if (!partnerId) {
      const errorResponse: BusinessSearchResponse = {
        success: false,
        error: 'Partner ID is required'
      };
      return NextResponse.json(errorResponse, { status: 400 });
    }

    // Parse request body
    const body: BusinessSearchRequest = await request.json();
    searchQuery = body.query;

    // Validate input
    const queryValidation = validateSearchQuery(body.query);
    if (!queryValidation.valid) {
      const errorResponse: BusinessSearchResponse = {
        success: false,
        error: queryValidation.error
      };
      return NextResponse.json(errorResponse, { status: 400 });
    }

    // Check rate limiting
    const rateLimitResult = await checkRateLimit(partnerId);
    if (!rateLimitResult.allowed) {
      await logBusinessLookupAudit({
        partnerId,
        searchQuery: body.query,
        searchType: 'autocomplete',
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

      const errorResponse: BusinessSearchResponse = {
        success: false,
        error: 'Rate limit exceeded. Please try again later.'
      };
      return NextResponse.json(errorResponse, { status: 429 });
    }

    // Calculate costs
    apiCostUsd = calculateGoogleApiCost('autocomplete');
    const creditsRequired = getBusinessLookupCreditsPerSearch();

    // Check and deduct credits
    const creditResult = await checkAndDeductCredits(partnerId, creditsRequired);
    if (!creditResult.success) {
      await logBusinessLookupAudit({
        partnerId,
        searchQuery: body.query,
        searchType: 'autocomplete',
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

      const errorResponse: BusinessSearchResponse = {
        success: false,
        error: creditResult.error
      };
      return NextResponse.json(errorResponse, { status: 402 });
    }

    creditsDeducted = creditResult.credits_deducted;

    // Prepare Google Places API request
    const googleApiUrl = `https://places.googleapis.com/v1/places:autocomplete`;
    
    const requestBody = {
      input: body.query,
      includedPrimaryTypes: body.types || ['establishment'],
      languageCode: 'en',
      regionCode: body.country || 'US',
      ...(body.location && {
        locationBias: {
          circle: {
            center: {
              latitude: body.location.lat,
              longitude: body.location.lng
            },
            radius: body.location.radius || 50000 // 50km default
          }
        }
      })
    };

    // Call Google Places API
    const googleResponse = await fetch(googleApiUrl, {
      method: 'POST',
      headers: getGooglePlacesHeaders(),
      body: JSON.stringify(requestBody)
    });

    if (!googleResponse.ok) {
      const errorData = await googleResponse.json().catch(() => ({}));
      const { errorCode, errorMessage } = handleGoogleApiError({
        status: googleResponse.status,
        message: errorData.error?.message
      }, 'autocomplete');

      await logBusinessLookupAudit({
        partnerId,
        searchQuery: body.query,
        searchType: 'autocomplete',
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

      const errorResponse: BusinessSearchResponse = {
        success: false,
        error: errorMessage
      };
      return NextResponse.json(errorResponse, { status: 500 });
    }

    const googleData: GooglePlacesAutocompleteResponse = await googleResponse.json();

    // Transform Google response to our format
    const predictions = googleData.suggestions?.map(suggestion => ({
      place_id: suggestion.placePrediction.placeId,
      description: suggestion.placePrediction.text.text,
      structured_formatting: {
        main_text: suggestion.placePrediction.structuredFormat.mainText.text,
        secondary_text: suggestion.placePrediction.structuredFormat.secondaryText.text
      },
      types: suggestion.placePrediction.types || []
    })) || [];

    // Log successful search
    await logBusinessLookupAudit({
      partnerId,
      searchQuery: body.query,
      searchType: 'autocomplete',
      creditsDeducted,
      apiCostUsd,
      responseTimeMs: Date.now() - startTime,
      success: true,
      ipAddress: request.headers.get('CF-Connecting-IP') || request.headers.get('X-Forwarded-For')?.split(',')[0],
      userAgent: request.headers.get('User-Agent') || undefined,
      countryDetected: request.headers.get('CF-IPCountry') || undefined
    });

    const response: BusinessSearchResponse = {
      success: true,
      data: {
        predictions,
        credits_remaining: creditResult.credits_remaining,
        search_id: `search_${Date.now()}_${partnerId.slice(-8)}`
      }
    };

    return NextResponse.json(response);

  } catch (error) {
    logger.error('Business search error', error as Error, {
      operation: 'business_lookup_search',
      partnerId,
      searchQuery
    });

    // Log error if we have the required data
    if (partnerId && searchQuery) {
      await logBusinessLookupAudit({
        partnerId,
        searchQuery,
        searchType: 'autocomplete',
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

    const errorResponse: BusinessSearchResponse = {
      success: false,
      error: 'Internal server error'
    };

    return NextResponse.json(errorResponse, { status: 500 });
  }
}
