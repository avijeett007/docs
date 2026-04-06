import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

/**
 * GET /api/whitelabel/business-lookup/photo
 * Proxy Google Places Photo API to avoid exposing API key to frontend
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const photoReference = searchParams.get('photo_reference');
    const maxWidth = searchParams.get('maxwidth') || '400';
    const maxHeight = searchParams.get('maxheight') || '400';

    if (!photoReference) {
      return NextResponse.json(
        { success: false, error: 'Photo reference is required' },
        { status: 400 }
      );
    }

    // Validate maxWidth and maxHeight
    const width = parseInt(maxWidth);
    const height = parseInt(maxHeight);
    if (isNaN(width) || isNaN(height) || width > 1600 || height > 1600) {
      return NextResponse.json(
        { success: false, error: 'Invalid dimensions' },
        { status: 400 }
      );
    }

    const apiKey = process.env.GOOGLE_PLACES_API_KEY;
    if (!apiKey) {
      logger.error('Google Places API key not configured', new Error('Missing API key'), {
        operation: 'business_lookup_photo'
      });
      return NextResponse.json(
        { success: false, error: 'Service temporarily unavailable' },
        { status: 503 }
      );
    }

    // Fetch photo from Google Places API
    const photoUrl = `https://maps.googleapis.com/maps/api/place/photo?maxwidth=${width}&maxheight=${height}&photo_reference=${photoReference}&key=${apiKey}`;
    
    const response = await fetch(photoUrl);
    
    if (!response.ok) {
      logger.warn('Google Places Photo API error', {
        operation: 'business_lookup_photo',
        photoReference,
        status: response.status,
        error: `HTTP ${response.status}`
      });
      return NextResponse.json(
        { success: false, error: 'Photo not available' },
        { status: 404 }
      );
    }

    // Get the image data
    const imageBuffer = await response.arrayBuffer();
    const contentType = response.headers.get('content-type') || 'image/jpeg';

    // Return the image with proper headers
    return new NextResponse(imageBuffer, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=86400', // Cache for 24 hours
        'Access-Control-Allow-Origin': '*',
      },
    });

  } catch (error) {
    logger.error('Business photo proxy error', error as Error, {
      operation: 'business_lookup_photo'
    });

    return NextResponse.json(
      { success: false, error: 'Failed to fetch photo' },
      { status: 500 }
    );
  }
}
