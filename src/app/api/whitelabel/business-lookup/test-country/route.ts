import { NextRequest, NextResponse } from 'next/server';

/**
 * Test endpoint for simulating different countries for business lookup testing
 * This allows testing the business lookup feature with different country codes
 * without needing VPN or real Cloudflare headers
 * 
 * Usage:
 * GET /api/whitelabel/business-lookup/test-country?country=US
 * GET /api/whitelabel/business-lookup/test-country?country=GB
 * GET /api/whitelabel/business-lookup/test-country?country=CA
 */

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const testCountry = searchParams.get('country') || 'US';
    
    // Validate country code (should be 2 letters)
    if (!/^[A-Z]{2}$/.test(testCountry)) {
      return NextResponse.json({
        success: false,
        error: 'Invalid country code. Must be 2 uppercase letters (e.g., US, GB, CA)'
      }, { status: 400 });
    }

    // Country code to name mapping for common countries
    const countryNames: { [key: string]: string } = {
      'US': 'United States',
      'GB': 'United Kingdom', 
      'CA': 'Canada',
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
      'TH': 'Thailand',
      'MY': 'Malaysia',
      'ID': 'Indonesia',
      'PH': 'Philippines',
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
      'TN': 'Tunisia',
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

    const countryName = countryNames[testCountry] || testCountry;
    
    // Get flag emoji for the country
    const getFlagEmoji = (countryCode: string): string => {
      const codePoints = countryCode
        .toUpperCase()
        .split('')
        .map(char => 127397 + char.charCodeAt(0));
      return String.fromCodePoint(...codePoints);
    };

    const flagEmoji = getFlagEmoji(testCountry);

    return NextResponse.json({
      success: true,
      country: {
        code: testCountry,
        name: countryName,
        flag: flagEmoji
      },
      message: `Test country set to ${countryName} ${flagEmoji}`,
      note: 'This is a test endpoint for simulating different countries. Use this country code in your business lookup requests.'
    });

  } catch (error) {
    console.error('Error in test country endpoint:', error);
    return NextResponse.json({
      success: false,
      error: 'Internal server error'
    }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { country, query } = body;

    if (!country || !query) {
      return NextResponse.json({
        success: false,
        error: 'Both country and query are required'
      }, { status: 400 });
    }

    // Simulate a business search with the test country
    const searchUrl = new URL('/api/whitelabel/business-lookup/search', request.url);
    
    // Create a new request with the test country header
    const searchRequest = new Request(searchUrl.toString(), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'CF-IPCountry': country, // Simulate Cloudflare country header
        'x-partner-id': request.headers.get('x-partner-id') || 'test-partner'
      },
      body: JSON.stringify({ query, country })
    });

    // Forward to the actual search endpoint
    const response = await fetch(searchRequest);
    const data = await response.json();

    return NextResponse.json({
      success: true,
      testCountry: country,
      searchResults: data
    });

  } catch (error) {
    console.error('Error in test country search:', error);
    return NextResponse.json({
      success: false,
      error: 'Internal server error'
    }, { status: 500 });
  }
}
