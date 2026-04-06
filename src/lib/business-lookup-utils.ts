// Use the shared Prisma singleton to avoid multiple Query Engines
import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';
import RedisClient from '@/lib/redis-client';
import { BusinessLookupErrorCodes, CreditDeductionResult, RateLimitResult } from '@/types/business-lookup';

// Business Lookup Configuration with Environment Variable Support
export const getBusinessLookupCreditsPerSearch = (): number => {
  return parseInt(process.env.BUSINESS_LOOKUP_CREDITS_PER_SEARCH || '10', 10);
};

export const getRateLimitConfig = () => ({
  requests: parseInt(process.env.BUSINESS_LOOKUP_RATE_LIMIT_REQUESTS || '100', 10),
  windowMs: parseInt(process.env.BUSINESS_LOOKUP_RATE_LIMIT_WINDOW_MS || '3600000', 10) // 1 hour default
});

export const getGoogleApiCosts = () => ({
  autocomplete: parseFloat(process.env.GOOGLE_PLACES_AUTOCOMPLETE_COST || '0.00283'),
  details: parseFloat(process.env.GOOGLE_PLACES_DETAILS_COST || '0.017')
});

// Credit Management Functions with Atomic Operations
export async function checkAndDeductCredits(
  partnerId: string,
  creditsRequired: number = getBusinessLookupCreditsPerSearch()
): Promise<CreditDeductionResult> {
  try {
    // First check if partner exists and has business lookup enabled
    const partner = await prisma.partner.findUnique({
      where: { id: partnerId },
      select: {
        creditBalance: true,
        businessLookupEnabled: true // Direct field from Partner model
      }
    } as any) as any;

    if (!partner) {
      return {
        success: false,
        credits_deducted: 0,
        credits_remaining: 0,
        error: 'Partner not found'
      };
    }

    // Check if business lookup is enabled
    const businessLookupEnabled = partner.businessLookupEnabled === true;

    if (!businessLookupEnabled) {
      return {
        success: false,
        credits_deducted: 0,
        credits_remaining: partner.creditBalance,
        error: 'Business lookup feature is disabled'
      };
    }

    // Atomic credit deduction - only update if sufficient credits exist
    const updatedPartner = await prisma.partner.updateMany({
      where: {
        id: partnerId,
        creditBalance: { gte: creditsRequired } // Only update if sufficient credits
      },
      data: {
        creditBalance: {
          decrement: creditsRequired
        },
        totalCreditsUsed: {
          increment: creditsRequired
        }
      }
    });

    // Check if the update actually happened (means sufficient credits existed)
    if (updatedPartner.count === 0) {
      return {
        success: false,
        credits_deducted: 0,
        credits_remaining: partner.creditBalance,
        error: 'Insufficient credits'
      };
    }

    // Get updated balance for response
    const finalPartner = await prisma.partner.findUnique({
      where: { id: partnerId },
      select: { creditBalance: true }
    });

    const finalBalance = finalPartner?.creditBalance || 0;

    // Log the credit transaction for transparency
    try {
      await prisma.creditTransaction.create({
        data: {
          partnerId,
          type: 'usage',
          amount: -creditsRequired, // negative for usage
          balanceAfter: finalBalance,
          description: 'Business lookup search',
          metadata: {
            feature: 'business_lookup',
            searchType: 'google_places_api',
            creditsPerSearch: getBusinessLookupCreditsPerSearch()
          }
        }
      });
    } catch (transactionError) {
      // Log error but don't fail the main operation
      logger.error('Failed to log credit transaction', transactionError as Error, {
        operation: 'business_lookup_credit_deduction',
        partnerId,
        creditsDeducted: creditsRequired
      });
    }

    return {
      success: true,
      credits_deducted: creditsRequired,
      credits_remaining: finalBalance
    };

  } catch (error) {
    logger.error('Credit deduction error', error as Error, {
      operation: 'business_lookup_credit_deduction',
      partnerId,
      creditsRequired
    });
    return {
      success: false,
      credits_deducted: 0,
      credits_remaining: 0,
      error: 'Failed to process credit deduction'
    };
  }
}

// Redis-based Rate Limiting Functions
export async function checkRateLimit(
  partnerId: string,
  limit?: number,
  windowMs?: number
): Promise<RateLimitResult> {
  const config = getRateLimitConfig();
  const actualLimit = limit || config.requests;
  const actualWindowMs = windowMs || config.windowMs;

  try {
    const redis = RedisClient.getInstance();
    const key = `business-lookup:${partnerId}`;
    const now = Date.now();
    const windowStart = now - actualWindowMs;

    // Use Redis sorted set to track requests in time window
    // Remove old entries outside the window
    await redis.zremrangebyscore(key, 0, windowStart);

    // Count current requests in window
    const currentCount = await redis.zcard(key);

    if (currentCount >= actualLimit) {
      // Get the oldest request time to calculate reset time
      const oldestRequests = await redis.zrange(key, 0, 0, 'WITHSCORES');
      const resetTime = oldestRequests.length > 0
        ? parseInt(oldestRequests[1] as string) + actualWindowMs
        : now + actualWindowMs;

      return {
        allowed: false,
        remaining: 0,
        resetTime,
        limit: actualLimit
      };
    }

    // Add current request
    await redis.zadd(key, now, `${now}-${Math.random()}`);

    // Set expiry for the key (cleanup)
    await redis.expire(key, Math.ceil(actualWindowMs / 1000));

    return {
      allowed: true,
      remaining: actualLimit - currentCount - 1,
      resetTime: now + actualWindowMs,
      limit: actualLimit
    };

  } catch (error) {
    logger.error('Redis rate limiting error, falling back to allow', error as Error, {
      operation: 'business_lookup_rate_limit',
      partnerId
    });

    // Fallback to allow request if Redis fails
    return {
      allowed: true,
      remaining: actualLimit - 1,
      resetTime: Date.now() + actualWindowMs,
      limit: actualLimit
    };
  }
}

// Audit Logging Functions
export async function logBusinessLookupAudit({
  partnerId,
  prospectId,
  searchQuery,
  searchType,
  placeId,
  creditsDeducted,
  apiCostUsd,
  responseTimeMs,
  success,
  errorCode,
  errorMessage,
  ipAddress,
  userAgent,
  countryDetected
}: {
  partnerId: string;
  prospectId?: string;
  searchQuery: string;
  searchType: 'autocomplete' | 'details';
  placeId?: string;
  creditsDeducted: number;
  apiCostUsd: number;
  responseTimeMs?: number;
  success: boolean;
  errorCode?: string;
  errorMessage?: string;
  ipAddress?: string;
  userAgent?: string;
  countryDetected?: string;
}): Promise<void> {
  try {
    await (prisma as any).businessLookupAudit.create({
      data: {
        partnerId,
        prospectId,
        searchQuery,
        searchType,
        placeId,
        creditsDeducted,
        apiCostUsd,
        responseTimeMs,
        success,
        errorCode,
        errorMessage,
        ipAddress,
        userAgent,
        countryDetected
      }
    });
  } catch (error) {
    logger.error('Failed to log business lookup audit', error as Error, {
      operation: 'business_lookup_audit_logging',
      partnerId,
      prospectId,
      searchQuery,
      searchType
    });
    // Don't throw - audit logging failure shouldn't break the main flow
  }
}

// Google Places API Helper Functions
export function getGooglePlacesHeaders(): HeadersInit {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  if (!apiKey) {
    throw new Error('Google Places API key not configured');
  }

  return {
    'Content-Type': 'application/json',
    'X-Goog-Api-Key': apiKey,
    'X-Goog-FieldMask': '*' // Request all available fields
  };
}

export function calculateGoogleApiCost(searchType: 'autocomplete' | 'details'): number {
  // Based on Google Places API pricing with environment variable support
  const costs = getGoogleApiCosts();

  switch (searchType) {
    case 'autocomplete':
      return costs.autocomplete; // Default: $2.83 per 1,000 requests
    case 'details':
      return costs.details; // Default: $17 per 1,000 requests for all fields
    default:
      return 0;
  }
}

// Error Handling Functions
export function handleGoogleApiError(error: any, _searchType: string): {
  errorCode: BusinessLookupErrorCodes;
  errorMessage: string;
} {
  if (error.status === 400) {
    return {
      errorCode: BusinessLookupErrorCodes.INVALID_QUERY,
      errorMessage: 'Invalid search query or parameters'
    };
  }
  
  if (error.status === 401 || error.status === 403) {
    return {
      errorCode: BusinessLookupErrorCodes.AUTHENTICATION_FAILED,
      errorMessage: 'Google API authentication failed'
    };
  }
  
  if (error.status === 429) {
    return {
      errorCode: BusinessLookupErrorCodes.RATE_LIMIT_EXCEEDED,
      errorMessage: 'Google API rate limit exceeded'
    };
  }
  
  return {
    errorCode: BusinessLookupErrorCodes.GOOGLE_API_ERROR,
    errorMessage: `Google API error: ${error.message || 'Unknown error'}`
  };
}

// Request Validation Functions
export function validateSearchQuery(query: string): { valid: boolean; error?: string } {
  if (!query || typeof query !== 'string') {
    return { valid: false, error: 'Search query is required' };
  }
  
  if (query.trim().length < 2) {
    return { valid: false, error: 'Search query must be at least 2 characters' };
  }
  
  if (query.length > 200) {
    return { valid: false, error: 'Search query must be less than 200 characters' };
  }
  
  return { valid: true };
}

export function validatePlaceId(placeId: string): { valid: boolean; error?: string } {
  if (!placeId || typeof placeId !== 'string') {
    return { valid: false, error: 'Place ID is required' };
  }

  // Google Place IDs are base64-like strings that can contain letters, numbers, hyphens, and underscores
  // They typically start with "ChIJ" but can have other prefixes
  if (placeId.length < 10 || placeId.length > 200) {
    return { valid: false, error: 'Invalid Place ID length' };
  }

  // Stricter validation - Google Place IDs follow specific patterns
  // Most common patterns: ChIJ*, GhIJ*, EhIJ*, etc. with base64-like characters
  // More restrictive to prevent injection attacks
  if (!placeId.match(/^[A-Za-z0-9_-]{10,200}$/)) {
    return { valid: false, error: 'Invalid Place ID format' };
  }

  return { valid: true };
}

// Google Places API Integration Functions
export async function searchBusinesses(query: string, country: string = 'US'): Promise<any[]> {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  if (!apiKey) {
    throw new Error('Google Places API key not configured');
  }

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
    throw new Error(`Google Places API error: ${response.status} ${errorText}`);
  }

  const searchResults = await response.json();

  // Transform to consistent format
  return searchResults.suggestions?.map((suggestion: any) => ({
    place_id: suggestion.placePrediction?.placeId,
    name: suggestion.placePrediction?.structuredFormat?.mainText?.text || suggestion.placePrediction?.text?.text,
    address: suggestion.placePrediction?.structuredFormat?.secondaryText?.text || '',
    description: suggestion.placePrediction?.text?.text || '',
    types: suggestion.placePrediction?.types || []
  })) || [];
}

export async function getBusinessDetails(placeId: string): Promise<any> {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  if (!apiKey) {
    throw new Error('Google Places API key not configured');
  }

  // Comprehensive field mask for all business data
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

  const response = await fetch(
    `https://places.googleapis.com/v1/places/${placeId}`,
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
    throw new Error(`Google Places API error: ${response.status} ${errorText}`);
  }

  const placeData = await response.json();

  // Transform to consistent format
  return {
    place_id: placeData.id,
    name: placeData.displayName?.text || 'Unknown Business',
    address: placeData.formattedAddress || '',
    phone: placeData.nationalPhoneNumber || placeData.internationalPhoneNumber || '',
    website: placeData.websiteUri || '',
    rating: placeData.rating || 0,
    review_count: placeData.userRatingCount || 0,
    price_level: placeData.priceLevel || 0,
    business_status: placeData.businessStatus || 'UNKNOWN',
    types: placeData.types || [],
    location: placeData.location ? {
      lat: placeData.location.latitude,
      lng: placeData.location.longitude
    } : null,
    business_hours: placeData.regularOpeningHours?.weekdayDescriptions || [],
    reviews: placeData.reviews?.slice(0, 5).map((review: any) => ({
      author_name: review.authorAttribution?.displayName || 'Anonymous',
      rating: review.rating || 0,
      text: review.text?.text || '',
      time: review.publishTime || ''
    })) || [],
    photos: placeData.photos?.slice(0, 5).map((photo: any) => ({
      photo_reference: photo.name,
      width: photo.widthPx || 0,
      height: photo.heightPx || 0
    })) || [],
    // Amenities
    amenities: {
      takeout: placeData.takeout,
      delivery: placeData.delivery,
      dine_in: placeData.dineIn,
      outdoor_seating: placeData.outdoorSeating,
      reservable: placeData.reservable,
      serves_breakfast: placeData.servesBreakfast,
      serves_lunch: placeData.servesLunch,
      serves_dinner: placeData.servesDinner,
      serves_beer: placeData.servesBeer,
      serves_wine: placeData.servesWine,
      good_for_children: placeData.goodForChildren,
      good_for_groups: placeData.goodForGroups,
      allows_dogs: placeData.allowsDogs
    }
  };
}
