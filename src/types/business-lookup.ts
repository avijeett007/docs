// Business Information Lookup Types
// Based on Google Places API (New) response structure

// Google Places API Response Types
export interface GooglePlacesAutocompleteResponse {
  suggestions: GooglePlacesSuggestion[];
}

export interface GooglePlacesSuggestion {
  placePrediction: GooglePlacePrediction;
}

export interface GooglePlacePrediction {
  place: string; // e.g., "places/ChIJ8cxIddh8hYAR-slH0R5QUZo"
  placeId: string; // e.g., "ChIJ8cxIddh8hYAR-slH0R5QUZo"
  text: GooglePlaceText;
  structuredFormat: GooglePlaceStructuredFormat;
  types: string[];
}

export interface GooglePlaceText {
  text: string;
  matches?: GooglePlaceMatch[];
}

export interface GooglePlaceMatch {
  startOffset?: number;
  endOffset: number;
}

export interface GooglePlaceStructuredFormat {
  mainText: GooglePlaceText;
  secondaryText: GooglePlaceText;
}

// Google Places Details API Response Types
export interface GooglePlaceDetailsResponse {
  id: string;
  displayName: {
    text: string;
    languageCode: string;
  };
  formattedAddress: string;
  nationalPhoneNumber?: string;
  internationalPhoneNumber?: string;
  websiteUri?: string;
  googleMapsUri?: string;
  rating?: number;
  userRatingCount?: number;
  priceLevel?: 'PRICE_LEVEL_FREE' | 'PRICE_LEVEL_INEXPENSIVE' | 'PRICE_LEVEL_MODERATE' | 'PRICE_LEVEL_EXPENSIVE' | 'PRICE_LEVEL_VERY_EXPENSIVE';
  businessStatus: 'OPERATIONAL' | 'CLOSED_TEMPORARILY' | 'CLOSED_PERMANENTLY';
  types: string[];
  location: {
    latitude: number;
    longitude: number;
  };
  regularOpeningHours?: {
    openNow: boolean;
    periods: OpeningPeriod[];
    weekdayDescriptions: string[];
  };
  photos?: PlacePhoto[];
  reviews?: PlaceReview[];
}

export interface OpeningPeriod {
  open: {
    day: number;
    hour: number;
    minute: number;
  };
  close?: {
    day: number;
    hour: number;
    minute: number;
  };
}

export interface PlacePhoto {
  name: string;
  widthPx: number;
  heightPx: number;
  authorAttributions: {
    displayName: string;
    uri: string;
    photoUri: string;
  }[];
}

export interface PlaceReview {
  name: string;
  relativePublishTimeDescription: string;
  rating: number;
  text: {
    text: string;
    languageCode: string;
  };
  originalText: {
    text: string;
    languageCode: string;
  };
  authorAttribution: {
    displayName: string;
    uri: string;
    photoUri: string;
  };
  publishTime: string;
}

// Our API Response Types
export interface CountryDetectionResponse {
  success: boolean;
  data?: {
    country: {
      code: string; // ISO 3166-1 alpha-2
      name: string;
      flag: string; // Unicode flag emoji
    };
    detected_from: 'cloudflare' | 'ip_geolocation' | 'default' | 'test_parameter';
    confidence: number; // 0-1 confidence score
  };
  error?: string;
}

export interface BusinessSearchRequest {
  query: string; // Business name to search
  country?: string; // ISO country code for region bias
  types?: string[]; // Google Places types filter
  location?: {
    lat: number;
    lng: number;
    radius?: number; // meters
  };
}

export interface BusinessSearchResponse {
  success: boolean;
  data?: {
    predictions: BusinessPrediction[];
    credits_remaining: number;
    search_id: string; // For audit tracking
  };
  error?: string;
}

export interface BusinessPrediction {
  place_id: string;
  description: string;
  structured_formatting: {
    main_text: string;
    secondary_text: string;
  };
  types: string[];
  distance_meters?: number;
  rating?: number;
  price_level?: number; // 0-4 scale
}

export interface BusinessDetailsRequest {
  place_id: string;
  fields?: string[]; // Optional field selection for cost optimization
}

export interface BusinessDetailsResponse {
  success: boolean;
  data?: {
    business: BusinessDetails;
    credits_deducted: number;
    credits_remaining: number;
    api_cost_usd: number;
  };
  error?: string;
}

export interface BusinessDetails {
  place_id: string;
  name: string;
  formatted_address: string;
  formatted_phone_number?: string;
  international_phone_number?: string;
  website?: string;
  url?: string; // Google Maps URL
  rating?: number;
  user_ratings_total?: number;
  price_level?: number;
  business_status: 'OPERATIONAL' | 'CLOSED_TEMPORARILY' | 'CLOSED_PERMANENTLY';
  types: string[];
  geometry: {
    location: {
      lat: number;
      lng: number;
    };
  };
  opening_hours?: {
    open_now: boolean;
    periods: OpeningPeriod[];
    weekday_text: string[];
  };
  photos?: PlacePhoto[];
  reviews?: PlaceReview[];
}

// Database Types
export interface BusinessLookupAuditData {
  id: string;
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
  createdAt: Date;
}

// Error Types
export enum BusinessLookupErrorCodes {
  INSUFFICIENT_CREDITS = 'INSUFFICIENT_CREDITS',
  RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED',
  INVALID_QUERY = 'INVALID_QUERY',
  GOOGLE_API_ERROR = 'GOOGLE_API_ERROR',
  FEATURE_DISABLED = 'FEATURE_DISABLED',
  INTERNAL_ERROR = 'INTERNAL_ERROR',
  INVALID_PLACE_ID = 'INVALID_PLACE_ID',
  AUTHENTICATION_FAILED = 'AUTHENTICATION_FAILED'
}

export interface BusinessLookupError {
  code: BusinessLookupErrorCodes;
  message: string;
  details?: any;
  timestamp: string;
  request_id: string;
}

// Rate Limiting Types
export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetTime: number;
  limit: number;
}

// Credit System Types
export interface CreditDeductionResult {
  success: boolean;
  credits_deducted: number;
  credits_remaining: number;
  error?: string;
}

// Configuration Types
export interface BusinessLookupConfig {
  enabled: boolean;
  credits_per_search: number;
  daily_limit: number;
  monthly_budget_usd: number;
  rate_limit_requests: number;
  rate_limit_window_ms: number;
}
