import { NextRequest, NextResponse } from 'next/server';
import PresignedUrlService from '@/lib/services/presignedUrlService';
import { downloadFile } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

/**
 * Allowed origins for CORS - restrict to known domains
 * Environment variable ALLOWED_FILE_ORIGINS can override this (comma-separated list)
 */
const getAllowedOrigins = (): string[] => {
  // Check for environment variable override
  if (process.env.ALLOWED_FILE_ORIGINS) {
    return process.env.ALLOWED_FILE_ORIGINS.split(',').map(origin => origin.trim());
  }

  // Default allowed origins
  return [
    'https://knotie-ai.pro',
    'https://www.knotie-ai.pro',
    'https://app.knotie-ai.pro',
    'https://knotie.ai',
    'https://www.knotie.ai',
    // Add localhost for development
    ...(process.env.NODE_ENV === 'development' ? [
      'http://localhost:3000',
      'http://localhost:3001',
      'http://localhost:3002',
    ] : []),
  ];
};

/**
 * Get CORS headers with origin validation
 * @param request - The incoming request
 * @returns CORS headers object
 */
const getCorsHeaders = (request: NextRequest): Record<string, string> => {
  const origin = request.headers.get('origin');
  const allowedOrigins = getAllowedOrigins();

  // Check if origin is allowed
  const isAllowedOrigin = origin && allowedOrigins.some(allowed => {
    // Exact match
    if (allowed === origin) return true;

    // Wildcard subdomain match (e.g., *.knotie-ai.pro)
    if (allowed.startsWith('*.')) {
      const domain = allowed.slice(2);
      return origin.endsWith(domain);
    }

    return false;
  });

  return {
    'Access-Control-Allow-Origin': isAllowedOrigin ? origin : allowedOrigins[0],
    'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Vary': 'Origin', // Important for caching with different origins
  };
};

/**
 * GET /api/files/presigned/[token]
 * Access a file using a presigned URL token
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { token: string } }
) {
  try {
    const { token } = params;

    if (!token) {
      return NextResponse.json(
        { error: 'Token is required' },
        { status: 400 }
      );
    }

    // Get client IP for validation
    const clientIP = PresignedUrlService.getClientIP(request);

    // Validate the presigned URL
    const validation = await PresignedUrlService.validatePresignedUrl(token, clientIP);

    if (!validation.isValid) {
      return NextResponse.json(
        { error: validation.error || 'Invalid or expired token' },
        { status: 403 }
      );
    }

    // Get file from storage
    let fileBuffer: Buffer;
    const contentType = validation.mimeType || 'application/octet-stream';

    console.log('[presigned/token] File download attempt:', {
      fileName: validation.fileName,
      r2StorageKey: validation.r2StorageKey,
      storageKey: validation.storageKey,
      bucketName: validation.bucketName
    });

    try {
      if (validation.r2StorageKey && validation.bucketName) {
        // Download from R2/Supabase storage
        console.log(`[presigned/token] Downloading from R2: bucket=${validation.bucketName}, key=${validation.r2StorageKey}`);
        const fileData = await downloadFile(validation.bucketName, validation.r2StorageKey);
        if (!fileData) {
          throw new Error('File not found in storage');
        }
        fileBuffer = Buffer.from(fileData);
      } else if (validation.storageKey) {
        // Fallback to legacy storage key - use the bucket name from the database
        const bucketName = validation.bucketName || 'files'; // Default to 'files' if no bucket specified

        // For legacy files, we need to construct the full path with partner/customer IDs
        // The storage key in database is: ${knowledgeBaseId}/${fileName}
        // But the actual file path in Supabase is: ${partnerId}/${customerId}/${knowledgeBaseId}/${fileName}

        // Decode the token to get partner and customer IDs with validation
        let partnerId: string | undefined;
        let customerId: string | undefined;

        try {
          // Validate token structure (should have at least 2 parts separated by '.')
          const tokenParts = token.split('.');
          if (tokenParts.length < 2) {
            throw new Error('Invalid token structure');
          }

          const [payloadBase64] = tokenParts;

          // Validate base64url format
          if (!/^[A-Za-z0-9_-]+$/.test(payloadBase64)) {
            throw new Error('Invalid token encoding');
          }

          const payloadString = Buffer.from(payloadBase64, 'base64url').toString('utf-8');
          const payload = JSON.parse(payloadString);

          // Validate payload structure
          if (typeof payload !== 'object' || payload === null) {
            throw new Error('Invalid token payload');
          }

          partnerId = payload.partnerId;
          customerId = payload.customerId;

          // Validate IDs are strings if present
          if (partnerId !== undefined && typeof partnerId !== 'string') {
            console.warn('Invalid partnerId type in token');
            partnerId = undefined;
          }
          if (customerId !== undefined && typeof customerId !== 'string') {
            console.warn('Invalid customerId type in token');
            customerId = undefined;
          }
        } catch (error) {
          console.error('Error decoding token for partner/customer IDs:', error);
          // Don't expose detailed error to client
          return NextResponse.json(
            { error: 'Invalid token format' },
            { status: 400 }
          );
        }

        // Construct the full storage path by prepending partner/customer IDs
        let fullStorageKey = validation.storageKey;
        if (partnerId && customerId) {
          fullStorageKey = `${partnerId}/${customerId}/${validation.storageKey}`;
        }

        console.log(`[presigned/token] Downloading from legacy storage: bucket=${bucketName}, key=${fullStorageKey}`);
        const fileData = await downloadFile(bucketName, fullStorageKey);
        if (!fileData) {
          throw new Error('File not found in storage');
        }
        fileBuffer = Buffer.from(fileData);
      } else {
        throw new Error('No storage key available');
      }
    } catch (storageError) {
      console.error('Error downloading file from storage:', storageError);
      return NextResponse.json(
        { error: 'File not found or inaccessible' },
        { status: 404 }
      );
    }

    // Set appropriate headers
    const headers = new Headers();
    headers.set('Content-Type', contentType);
    headers.set('Content-Length', fileBuffer.length.toString());
    headers.set('Content-Disposition', `attachment; filename="${validation.fileName}"`);
    headers.set('Cache-Control', 'private, no-cache, no-store, must-revalidate');
    headers.set('Pragma', 'no-cache');
    headers.set('Expires', '0');

    // Add CORS headers with origin validation
    const corsHeaders = getCorsHeaders(request);
    Object.entries(corsHeaders).forEach(([key, value]) => {
      headers.set(key, value);
    });

    // Add security headers
    headers.set('X-Content-Type-Options', 'nosniff');
    headers.set('X-Frame-Options', 'DENY');
    headers.set('X-XSS-Protection', '1; mode=block');

    // Add download tracking headers
    if (validation.remainingDownloads !== undefined) {
      headers.set('X-Remaining-Downloads', validation.remainingDownloads.toString());
    }

    return new NextResponse(fileBuffer as unknown as BodyInit, {
      status: 200,
      headers,
    });

  } catch (error) {
    console.error('Error serving presigned file:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * HEAD /api/files/presigned/[token]
 * Get file metadata without downloading the file
 */
export async function HEAD(
  request: NextRequest,
  { params }: { params: { token: string } }
) {
  try {
    const { token } = params;

    if (!token) {
      return new NextResponse(null, { status: 400 });
    }

    // Get client IP for validation
    const clientIP = PresignedUrlService.getClientIP(request);

    // Validate the presigned URL (without incrementing download count)
    const validation = await PresignedUrlService.validatePresignedUrl(token, clientIP);

    if (!validation.isValid) {
      return new NextResponse(null, { status: 403 });
    }

    // Set metadata headers
    const headers = new Headers();
    headers.set('Content-Type', validation.mimeType || 'application/octet-stream');
    headers.set('Content-Length', (validation.fileSize || 0).toString());
    headers.set('Content-Disposition', `attachment; filename="${validation.fileName}"`);
    headers.set('Cache-Control', 'private, no-cache, no-store, must-revalidate');

    // Add CORS headers with origin validation
    const corsHeaders = getCorsHeaders(request);
    Object.entries(corsHeaders).forEach(([key, value]) => {
      headers.set(key, value);
    });

    // Add download tracking headers
    if (validation.remainingDownloads !== undefined) {
      headers.set('X-Remaining-Downloads', validation.remainingDownloads.toString());
    }

    return new NextResponse(null, {
      status: 200,
      headers,
    });

  } catch (error) {
    console.error('Error getting presigned file metadata:', error);
    return new NextResponse(null, { status: 500 });
  }
}

/**
 * OPTIONS /api/files/presigned/[token]
 * Handle CORS preflight requests with origin validation
 */
export async function OPTIONS(request: NextRequest) {
  const corsHeaders = getCorsHeaders(request);
  const headers = new Headers(corsHeaders);
  headers.set('Access-Control-Max-Age', '86400'); // Cache preflight for 24 hours

  return new NextResponse(null, {
    status: 200,
    headers,
  });
}
