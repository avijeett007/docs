import { NextRequest, NextResponse } from 'next/server';
import { initTwilioClient } from '@/lib/twilio';
import { verifyWhitelabelAuth } from '@/lib/whitelabelAuth';
import { verifyPartnerAuth } from '@/lib/auth/partnerAuth';

export const dynamic = 'force-dynamic';

// Cache for bundle availability checks to avoid repeated API calls
const bundleAvailabilityCache = new Map<string, { available: boolean; timestamp: number }>();
const CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours

// Intelligent function to check if bundles are actually available/required
async function checkBundleAvailability(countryCode: string): Promise<boolean> {
  const cacheKey = `bundle_${countryCode}`;
  const cached = bundleAvailabilityCache.get(cacheKey);
  
  // Return cached result if still valid
  if (cached && (Date.now() - cached.timestamp) < CACHE_DURATION) {
    console.log(`Bundle availability for ${countryCode}: ${cached.available} (cached)`);
    return cached.available;
  }

  try {
    const twilioClient = initTwilioClient();
    
    // Try to create a minimal test bundle to check if the feature is available
    const testBundle = await twilioClient.createRegulatoryBundle({
      FriendlyName: `Test-${countryCode}-${Date.now()}`,
      RegulationType: 'phone_number',
      IsoCountry: countryCode,
    });

    // If successful, bundles are available
    if (testBundle && testBundle.sid) {
      console.log(`Bundles available for ${countryCode}`);
      
      // Cache the positive result
      bundleAvailabilityCache.set(cacheKey, { available: true, timestamp: Date.now() });
      
      return true;
    }
    
    return false;
  } catch (error: any) {
    console.log(`Bundle availability check for ${countryCode} failed:`, error.message);
    
    // Check specific error types to determine if bundles are not available
    if (error.message?.includes('was not found') || 
        error.message?.includes('404') ||
        error.message?.includes('not authorized') ||
        error.message?.includes('403') ||
        error.message?.includes('not available')) {
      
      console.log(`Bundles not available for ${countryCode} - caching result`);
      bundleAvailabilityCache.set(cacheKey, { available: false, timestamp: Date.now() });
      return false;
    }
    
    // For other errors (network, temporary issues), assume bundles might be required
    console.log(`Temporary error checking bundles for ${countryCode}, assuming required`);
    return true;
  }
}

export async function GET(req: NextRequest) {
  try {
    // Try whitelabel auth first, then partner auth
    let isAuthorized = false;
    
    try {
      const authResult = await verifyWhitelabelAuth(req);
      if (authResult && authResult.customerId) {
        isAuthorized = true;
      }
    } catch {
      // Try partner auth
      const partnerAuth = await verifyPartnerAuth(req);
      if (partnerAuth && partnerAuth.id) {
        isAuthorized = true;
      }
    }

    if (!isAuthorized) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(req.url);
    const countryCode = searchParams.get('countryCode');
    const numberType = searchParams.get('numberType');

    if (!countryCode) {
      return NextResponse.json(
        { error: 'Country code is required' },
        { status: 400 }
      );
    }

    // US has special handling - no bundles but needs 10DLC verification
    if (countryCode === 'US') {
      return NextResponse.json({
        success: true,
        requiresBundle: false,
        reason: 'US numbers use 10DLC verification instead of regulatory bundles'
      });
    }

    // Countries that typically don't require bundles
    const noBundleCountries = ['CA', 'AU', 'NZ', 'SG', 'HK', 'JP', 'KR'];
    if (noBundleCountries.includes(countryCode)) {
      return NextResponse.json({
        success: true,
        requiresBundle: false,
        reason: 'This country typically does not require regulatory bundles'
      });
    }

    // For European and other countries, intelligently check if bundles are available
    const potentialBundleCountries = [
      'GB', 'DE', 'FR', 'IT', 'ES', 'NL', 'BE', 'AT', 'CH', 'SE', 'NO', 'DK', 'FI',
      'IE', 'PT', 'PL', 'CZ', 'HU', 'SK', 'SI', 'HR', 'RO', 'BG', 'GR', 'CY',
      'MT', 'LU', 'LV', 'LT', 'EE'
    ];

    if (potentialBundleCountries.includes(countryCode)) {
      // Intelligently check if bundles are actually available for this country
      const bundleAvailable = await checkBundleAvailability(countryCode);
      
      return NextResponse.json({
        success: true,
        requiresBundle: bundleAvailable,
        reason: bundleAvailable 
          ? 'Regulatory bundles are available and required for this country'
          : 'Regulatory bundles are not available for your account/region'
      });
    }

    // For unknown countries, default to no bundle requirement
    return NextResponse.json({
      success: true,
      requiresBundle: false,
      reason: 'Unknown country - defaulting to no bundle requirement'
    });

  } catch (error: any) {
    console.error('Bundle check error:', error);
    return NextResponse.json(
      { 
        error: 'Failed to check bundle requirements',
        details: error.message 
      },
      { status: 500 }
    );
  }
}
