import { NextRequest, NextResponse } from 'next/server';
import { verifyPartnerAuth } from '@/lib/auth/partnerAuth';
import { prisma } from '@/lib/prisma';
import { decrypt } from '@/lib/encryption';

export const dynamic = 'force-dynamic'; // Required to make the POST request work correctly

// Analytics API URL from environment variables
const ANALYTICS_API_URL = process.env.ANALYTICS_API_URL || 'http://localhost:8001';
const ANALYTICS_API_KEY = process.env.ANALYTICS_ADMIN_API_KEY || process.env.ANALYTICS_STANDARD_API_KEY || '';

// Log the configuration for debugging
console.log('Analytics API Configuration:', {
  url: ANALYTICS_API_URL,
  keyDefined: !!ANALYTICS_API_KEY
});

/**
 * POST /api/analytics/register-api-key
 * Register an API key with the analytics service
 */
export async function POST(request: NextRequest) {
  try {
    // Verify partner authentication
    const partner = await verifyPartnerAuth(request);

    if (!partner) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Parse request body
    const { keyId, keyType } = await request.json();

    // Validate required fields
    if (!keyId || !keyType) {
      return NextResponse.json(
        { error: 'Key ID and key type are required' },
        { status: 400 }
      );
    }

    // Validate key type
    if (keyType !== 'partner' && keyType !== 'customer') {
      return NextResponse.json(
        { error: 'Invalid key type. Must be "partner" or "customer"' },
        { status: 400 }
      );
    }

    // Get the API key from the database
    let apiKey;
    let customerId = null;

    if (keyType === 'partner') {
      apiKey = await prisma.partnerApiKey.findUnique({
        where: {
          id: keyId,
          partnerId: partner.id,
        },
      });
    } else {
      apiKey = await prisma.customerApiKey.findUnique({
        where: {
          id: keyId,
          partnerId: partner.id,
        },
        include: {
          customer: true,
        },
      });

      if (apiKey) {
        customerId = apiKey.customerId;
      }
    }

    if (!apiKey) {
      return NextResponse.json(
        { error: 'API key not found' },
        { status: 404 }
      );
    }

    // Decrypt the API key
    const decryptedApiKey = await decrypt(apiKey.apiKey);

    // Prepare the request payload
    const payload = {
      api_key: decryptedApiKey,
      key_type: keyType,
      partner_id: partner.id,
      customer_id: customerId,
      name: apiKey.name,
      description: apiKey.description || '',
      rate_limit: apiKey.rateLimit || null,
      daily_limit: apiKey.dailyLimit || null,
      monthly_limit: apiKey.monthlyLimit || null,
      allowed_ips: apiKey.allowedIps || null,
    };

    console.log('Registering API key with analytics service:', {
      url: `${ANALYTICS_API_URL}/api/v1/api-keys/register`,
      keyType,
      partnerId: partner.id,
      customerId
    });

    let responseData;

    try {
      // Register the API key with the analytics service
      const response = await fetch(`${ANALYTICS_API_URL}/api/v1/api-keys/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': ANALYTICS_API_KEY,
        },
        body: JSON.stringify(payload),
      });

      // Log the response status
      console.log('Analytics service response status:', response.status);

      // Handle non-OK responses
      if (!response.ok) {
        let errorData;
        try {
          errorData = await response.json();
        } catch (e: any) {
          // If response is not JSON
          const text = await response.text();
          errorData = { text, parseError: e.message || 'Error parsing JSON response' };
        }

        console.error('Error registering API key with analytics service:', {
          status: response.status,
          statusText: response.statusText,
          errorData
        });

        return NextResponse.json(
          {
            error: 'Failed to register API key with analytics service',
            details: {
              status: response.status,
              message: response.statusText,
              data: errorData
            }
          },
          { status: 500 }
        );
      }

      // If we get here, the request was successful
      try {
        responseData = await response.json();
      } catch (e) {
        responseData = { success: true };
      }

    } catch (fetchError: any) {
      // Handle network errors or other fetch failures
      console.error('Network error when registering API key:', fetchError);

      return NextResponse.json(
        {
          error: 'Network error when connecting to analytics service',
          details: fetchError.message || 'Unknown network error'
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      message: 'API key registered successfully with analytics service',
      data: responseData,
    });
  } catch (error) {
    console.error('Error registering API key with analytics service:', error);
    return NextResponse.json(
      { error: 'Failed to register API key with analytics service' },
      { status: 500 }
    );
  }
}
