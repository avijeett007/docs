import { NextRequest, NextResponse } from 'next/server';
import { initTwilioClient } from '@/lib/twilio';
import { verifyWhitelabelAuth } from '@/lib/whitelabelAuth';

export const dynamic = 'force-dynamic';

// Cache supported countries for 1 hour to avoid repeated API calls
let cachedCountries: any[] | null = null;
let cacheTimestamp: number = 0;
const CACHE_DURATION = 60 * 60 * 1000; // 1 hour in milliseconds

export async function GET(req: NextRequest) {
  try {
    // Authenticate the request
    const authResult = await verifyWhitelabelAuth(req);
    if (!authResult || !authResult.customerId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Check cache first
    const now = Date.now();
    if (cachedCountries && (now - cacheTimestamp) < CACHE_DURATION) {
      return NextResponse.json({
        success: true,
        data: {
          countries: cachedCountries,
          cached: true,
        }
      });
    }

    // Get fresh data from Twilio
    const twilioClient = initTwilioClient();
    const countries = await twilioClient.getSupportedCountries();

    // Filter and format countries with additional metadata
    const formattedCountries = countries
      .filter(country => country.country_code && country.subresource_uris)
      .map(country => ({
        code: country.country_code,
        name: country.country,
        beta: country.beta || false,
        supportedTypes: Object.keys(country.subresource_uris || {}),
      }))
      .sort((a, b) => a.name.localeCompare(b.name));

    // Update cache
    cachedCountries = formattedCountries;
    cacheTimestamp = now;

    return NextResponse.json({
      success: true,
      data: {
        countries: formattedCountries,
        cached: false,
        total: formattedCountries.length,
      }
    });

  } catch (error: any) {
    console.error('Failed to get supported countries:', error);
    
    return NextResponse.json(
      { 
        error: 'Failed to get supported countries',
        message: 'Unable to retrieve the list of supported countries. Please try again later.'
      },
      { status: 500 }
    );
  }
}
