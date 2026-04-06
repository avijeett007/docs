import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/logger';
import { CountryDetectionResponse } from '@/types/business-lookup';

export const dynamic = 'force-dynamic';

// Country code to name mapping
const COUNTRY_NAMES: Record<string, string> = {
  'US': 'United States',
  'CA': 'Canada',
  'GB': 'United Kingdom',
  'AU': 'Australia',
  'DE': 'Germany',
  'FR': 'France',
  'IT': 'Italy',
  'ES': 'Spain',
  'NL': 'Netherlands',
  'BE': 'Belgium',
  'CH': 'Switzerland',
  'AT': 'Austria',
  'SE': 'Sweden',
  'NO': 'Norway',
  'DK': 'Denmark',
  'FI': 'Finland',
  'IE': 'Ireland',
  'PT': 'Portugal',
  'GR': 'Greece',
  'PL': 'Poland',
  'CZ': 'Czech Republic',
  'HU': 'Hungary',
  'RO': 'Romania',
  'BG': 'Bulgaria',
  'HR': 'Croatia',
  'SI': 'Slovenia',
  'SK': 'Slovakia',
  'LT': 'Lithuania',
  'LV': 'Latvia',
  'EE': 'Estonia',
  'JP': 'Japan',
  'KR': 'South Korea',
  'CN': 'China',
  'IN': 'India',
  'SG': 'Singapore',
  'HK': 'Hong Kong',
  'TW': 'Taiwan',
  'MY': 'Malaysia',
  'TH': 'Thailand',
  'PH': 'Philippines',
  'ID': 'Indonesia',
  'VN': 'Vietnam',
  'BR': 'Brazil',
  'MX': 'Mexico',
  'AR': 'Argentina',
  'CL': 'Chile',
  'CO': 'Colombia',
  'PE': 'Peru',
  'ZA': 'South Africa',
  'EG': 'Egypt',
  'NG': 'Nigeria',
  'KE': 'Kenya',
  'MA': 'Morocco',
  'IL': 'Israel',
  'AE': 'United Arab Emirates',
  'SA': 'Saudi Arabia',
  'TR': 'Turkey',
  'RU': 'Russia',
  'UA': 'Ukraine',
  'BY': 'Belarus',
  'KZ': 'Kazakhstan',
  'UZ': 'Uzbekistan',
  'NZ': 'New Zealand'
};

// Country code to flag emoji mapping
const COUNTRY_FLAGS: Record<string, string> = {
  'US': '🇺🇸', 'CA': '🇨🇦', 'GB': '🇬🇧', 'AU': '🇦🇺', 'DE': '🇩🇪',
  'FR': '🇫🇷', 'IT': '🇮🇹', 'ES': '🇪🇸', 'NL': '🇳🇱', 'BE': '🇧🇪',
  'CH': '🇨🇭', 'AT': '🇦🇹', 'SE': '🇸🇪', 'NO': '🇳🇴', 'DK': '🇩🇰',
  'FI': '🇫🇮', 'IE': '🇮🇪', 'PT': '🇵🇹', 'GR': '🇬🇷', 'PL': '🇵🇱',
  'CZ': '🇨🇿', 'HU': '🇭🇺', 'RO': '🇷🇴', 'BG': '🇧🇬', 'HR': '🇭🇷',
  'SI': '🇸🇮', 'SK': '🇸🇰', 'LT': '🇱🇹', 'LV': '🇱🇻', 'EE': '🇪🇪',
  'JP': '🇯🇵', 'KR': '🇰🇷', 'CN': '🇨🇳', 'IN': '🇮🇳', 'SG': '🇸🇬',
  'HK': '🇭🇰', 'TW': '🇹🇼', 'MY': '🇲🇾', 'TH': '🇹🇭', 'PH': '🇵🇭',
  'ID': '🇮🇩', 'VN': '🇻🇳', 'BR': '🇧🇷', 'MX': '🇲🇽', 'AR': '🇦🇷',
  'CL': '🇨🇱', 'CO': '🇨🇴', 'PE': '🇵🇪', 'ZA': '🇿🇦', 'EG': '🇪🇬',
  'NG': '🇳🇬', 'KE': '🇰🇪', 'MA': '🇲🇦', 'IL': '🇮🇱', 'AE': '🇦🇪',
  'SA': '🇸🇦', 'TR': '🇹🇷', 'RU': '🇷🇺', 'UA': '🇺🇦', 'BY': '🇧🇾',
  'KZ': '🇰🇿', 'UZ': '🇺🇿', 'NZ': '🇳🇿'
};

function detectCountryFromCloudflare(request: NextRequest): { code: string; confidence: number } | null {
  // Check Cloudflare CF-IPCountry header
  const cfCountry = request.headers.get('CF-IPCountry');
  
  if (cfCountry && cfCountry !== 'XX' && COUNTRY_NAMES[cfCountry]) {
    return {
      code: cfCountry,
      confidence: 0.95 // High confidence for Cloudflare detection
    };
  }
  
  return null;
}

function detectCountryFromIP(ipAddress: string): { code: string; confidence: number } | null {
  // This is a simplified IP geolocation fallback
  // In production, you would use a service like MaxMind GeoLite2
  
  // For now, we'll implement basic IP range detection for common cases
  // This is just a placeholder - you should integrate with a proper IP geolocation service
  
  if (ipAddress.startsWith('127.') || ipAddress === '::1') {
    // Localhost - default to US
    return { code: 'US', confidence: 0.3 };
  }
  
  // Add more IP range detection logic here
  // For now, return null to fall back to default
  return null;
}

function getDefaultCountry(): { code: string; confidence: number } {
  return {
    code: 'US', // Default to United States
    confidence: 0.1 // Low confidence for default
  };
}

export async function GET(request: NextRequest): Promise<NextResponse<CountryDetectionResponse>> {
  const startTime = Date.now();
  let detectionMethod: 'cloudflare' | 'ip_geolocation' | 'default' | 'test_parameter' = 'default';

  try {
    let detectedCountry: { code: string; confidence: number };

    // Check for test country parameter first (for development/testing)
    const { searchParams } = new URL(request.url);
    const testCountry = searchParams.get('testCountry') || searchParams.get('country');

    if (testCountry && /^[A-Z]{2}$/.test(testCountry) && COUNTRY_NAMES[testCountry]) {
      detectedCountry = { code: testCountry, confidence: 1.0 };
      detectionMethod = 'test_parameter';
    } else {
      // Try Cloudflare detection first
      const cloudflareResult = detectCountryFromCloudflare(request);
      if (cloudflareResult) {
        detectedCountry = cloudflareResult;
        detectionMethod = 'cloudflare';
      } else {
        // Fall back to IP geolocation
        const clientIP = request.headers.get('CF-Connecting-IP') ||
                        request.headers.get('X-Forwarded-For')?.split(',')[0] ||
                        request.headers.get('X-Real-IP') ||
                        '127.0.0.1';

        const ipResult = detectCountryFromIP(clientIP);
        if (ipResult) {
          detectedCountry = ipResult;
          detectionMethod = 'ip_geolocation';
        } else {
          // Use default
          detectedCountry = getDefaultCountry();
          detectionMethod = 'default';
        }
      }
    }

    const response: CountryDetectionResponse = {
      success: true,
      data: {
        country: {
          code: detectedCountry.code,
          name: COUNTRY_NAMES[detectedCountry.code] || 'Unknown',
          flag: COUNTRY_FLAGS[detectedCountry.code] || '🌍'
        },
        detected_from: detectionMethod,
        confidence: detectedCountry.confidence
      }
    };

    // Log successful country detection
    logger.info('Country detection successful', {
      operation: 'country_detection',
      country: detectedCountry.code,
      method: detectionMethod,
      confidence: detectedCountry.confidence,
      responseTimeMs: Date.now() - startTime
    });

    return NextResponse.json(response);

  } catch (error) {
    logger.error('Country detection error', error as Error, {
      operation: 'country_detection',
      responseTimeMs: Date.now() - startTime
    });

    const errorResponse: CountryDetectionResponse = {
      success: false,
      error: 'Failed to detect country'
    };

    return NextResponse.json(errorResponse, { status: 500 });
  }
}
