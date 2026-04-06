/**
 * GHL Sync Initialization API
 * 
 * Triggers initial sync for a partner's existing prospects and customers
 * This should be called when a partner first sets up their GHL token
 */

import { NextRequest, NextResponse } from 'next/server';
import { headers } from 'next/headers';

/**
 * POST /api/ghl/initialize-sync
 * 
 * Triggers KnotieManager to mark all existing prospects/customers as pending for sync
 * 
 * Body:
 * {
 *   partnerId: string
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const headersList = await headers();
    const apiKey = headersList.get('x-api-key');

    // Validate API key (should match KnotieManager's API key)
    const expectedApiKey = process.env.KNOTIE_MANAGER_API_KEY;
    if (!expectedApiKey || apiKey !== expectedApiKey) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { partnerId } = body;

    if (!partnerId) {
      return NextResponse.json(
        { error: 'partnerId is required' },
        { status: 400 }
      );
    }

    console.log(`[initialize-sync] Triggering initial sync for partner ${partnerId}`);

    // Call KnotieManager API to initialize sync
    const knotieManagerUrl = process.env.KNOTIE_MANAGER_URL || 'http://localhost:3002';
    const knotieManagerApiKey = process.env.KNOTIE_MANAGER_API_KEY;

    if (!knotieManagerApiKey) {
      console.error('[initialize-sync] KNOTIE_MANAGER_API_KEY not configured');
      return NextResponse.json(
        { error: 'Service configuration error' },
        { status: 500 }
      );
    }

    const response = await fetch(`${knotieManagerUrl}/api/ghl/initialize-sync`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': knotieManagerApiKey,
      },
      body: JSON.stringify({ partnerId }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[initialize-sync] KnotieManager API error: ${errorText}`);
      return NextResponse.json(
        { error: 'Failed to initialize sync' },
        { status: response.status }
      );
    }

    const result = await response.json();
    console.log(`[initialize-sync] Successfully initialized sync for partner ${partnerId}:`, result);

    return NextResponse.json({
      success: true,
      ...result,
    });
  } catch (error) {
    console.error('[initialize-sync] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/ghl/initialize-sync
 * 
 * Triggers initial sync for ALL partners with GHL tokens
 * This is useful for one-time initialization
 */
export async function GET(request: NextRequest) {
  try {
    const headersList = await headers();
    const apiKey = headersList.get('x-api-key');

    // Validate API key
    const expectedApiKey = process.env.KNOTIE_MANAGER_API_KEY;
    if (!expectedApiKey || apiKey !== expectedApiKey) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    console.log('[initialize-sync] Triggering initial sync for all partners');

    // Call KnotieManager API to initialize sync for all partners
    const knotieManagerUrl = process.env.KNOTIE_MANAGER_URL || 'http://localhost:3002';
    const knotieManagerApiKey = process.env.KNOTIE_MANAGER_API_KEY;

    if (!knotieManagerApiKey) {
      console.error('[initialize-sync] KNOTIE_MANAGER_API_KEY not configured');
      return NextResponse.json(
        { error: 'Service configuration error' },
        { status: 500 }
      );
    }

    const response = await fetch(`${knotieManagerUrl}/api/ghl/initialize-sync`, {
      method: 'GET',
      headers: {
        'x-api-key': knotieManagerApiKey,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[initialize-sync] KnotieManager API error: ${errorText}`);
      return NextResponse.json(
        { error: 'Failed to initialize sync' },
        { status: response.status }
      );
    }

    const result = await response.json();
    console.log('[initialize-sync] Successfully initialized sync for all partners:', result);

    return NextResponse.json({
      success: true,
      ...result,
    });
  } catch (error) {
    console.error('[initialize-sync] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

