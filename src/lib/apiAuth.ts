import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { logger } from './logger';

const PARTNER_API_KEY = process.env.PARTNER_API_KEY;

// API key configuration validated at startup

export function validateApiKey(request: NextRequest) {
  const authHeader = request.headers.get('Authorization');

  // Validate authorization header format

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    logger.error('API Key validation failed: Missing or invalid authorization header', new Error('Missing or invalid authorization header'), {
      operation: 'api_auth'
    });
    return {
      error: NextResponse.json(
        { error: 'Missing or invalid authorization header' },
        { status: 401 }
      ),
      isValid: false
    };
  }

  const apiKey = authHeader.split(' ')[1];

  if (!PARTNER_API_KEY) {
    logger.error('API Key validation failed: PARTNER_API_KEY environment variable not set', new Error('PARTNER_API_KEY environment variable not set'), {
      operation: 'api_auth'
    });
    return {
      error: NextResponse.json(
        { error: 'Server configuration error' },
        { status: 500 }
      ),
      isValid: false
    };
  }

  if (apiKey !== PARTNER_API_KEY) {
    logger.error('API Key validation failed: Invalid API key provided', new Error('Invalid API key provided'), {
      operation: 'api_auth'
    });
    return {
      error: NextResponse.json(
        { error: 'Invalid API key' },
        { status: 401 }
      ),
      isValid: false
    };
  }

  return { isValid: true };
}
