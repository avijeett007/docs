import { NextRequest, NextResponse } from 'next/server';
import { logger } from './logger';

export type ApiHandler = (
  req: NextRequest,
  params?: any
) => Promise<NextResponse>;

export function createDynamicApiHandler(handler: ApiHandler): ApiHandler {
  return async (req: NextRequest, params?: any) => {
    try {
      return await handler(req, params);
    } catch (error) {
      logger.error('API Error', error as Error, {
        operation: 'api_handler'
      });
      return NextResponse.json(
        { error: 'Internal Server Error' },
        { status: 500 }
      );
    }
  };
}

// Add this to the top of your API route files:
// export const dynamic = 'force-dynamic';
// export const runtime = 'edge'; // Optional: Use edge runtime for better performance
