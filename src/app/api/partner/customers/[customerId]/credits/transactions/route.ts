import { NextRequest, NextResponse } from 'next/server';
import { CustomerCreditService } from '@/lib/services/customerCreditService';
import { partnerRateLimit } from '@/lib/rateLimit';
import { z } from 'zod';

// Input validation schema for query parameters
const transactionsQuerySchema = z.object({
  page: z.string().regex(/^\d+$/).transform(Number).refine(n => n >= 1 && n <= 1000).optional(),
  limit: z.string().regex(/^\d+$/).transform(Number).refine(n => n >= 1 && n <= 100).optional()
});

// Verify partner authentication
async function verifyPartnerAuth(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    const cookieHeader = request.headers.get('cookie');
    
    let token = null;
    
    // Try Authorization header first
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.substring(7);
    }
    // Try cookie as fallback
    else if (cookieHeader) {
      const cookies = cookieHeader.split(';').reduce((acc, cookie) => {
        const [key, value] = cookie.trim().split('=');
        acc[key] = value;
        return acc;
      }, {} as Record<string, string>);
      
      token = cookies['partner_token'];
    }

    if (!token) {
      return null;
    }

    // Import JWT verification
    const { verifyJWT } = await import('@/lib/jwt');
    const payload = await verifyJWT(token);
    
    if (!payload || !payload.partnerId) {
      return null;
    }

    return payload;
  } catch (error) {
    console.error('Partner authentication error:', error);
    return null;
  }
}

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: { customerId: string } }
) {
  try {
    // Apply rate limiting
    const rateLimitResult = partnerRateLimit(request);
    if (!rateLimitResult.success) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Rate limit exceeded',
          retryAfter: Math.ceil((rateLimitResult.resetTime - Date.now()) / 1000)
        },
        { 
          status: 429,
          headers: {
            'X-RateLimit-Limit': rateLimitResult.total.toString(),
            'X-RateLimit-Remaining': rateLimitResult.remaining.toString(),
            'X-RateLimit-Reset': rateLimitResult.resetTime.toString()
          }
        }
      );
    }

    // Verify partner authentication
    const partner = await verifyPartnerAuth(request);
    if (!partner) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    
    // Validate query parameters
    const queryValidation = transactionsQuerySchema.safeParse({
      page: searchParams.get('page') || undefined,
      limit: searchParams.get('limit') || undefined
    });

    if (!queryValidation.success) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Invalid query parameters',
          details: queryValidation.error.errors
        },
        { status: 400 }
      );
    }

    const { page = 1, limit = 20 } = queryValidation.data;
    const offset = (page - 1) * limit;

    const customerId = params.customerId;
    const partnerId = partner.partnerId;

    // Get customer transactions
    const result = await CustomerCreditService.getCustomerTransactions(
      customerId,
      partnerId,
      limit,
      offset
    );

    if (!result.success) {
      // Determine appropriate status code and error code based on error type
      let statusCode = 404;
      let errorCode = 'CUSTOMER_NOT_FOUND';

      if (result.error?.includes('portal access')) {
        statusCode = 403;
        errorCode = 'PORTAL_NOT_ENABLED';
      } else if (result.error?.includes('not been provisioned')) {
        statusCode = 403;
        errorCode = 'CUSTOMER_NOT_PROVISIONED';
      } else if (result.error?.includes('access denied')) {
        statusCode = 404;
        errorCode = 'CUSTOMER_NOT_FOUND';
      }

      return NextResponse.json(
        {
          success: false,
          error: result.error,
          code: errorCode
        },
        { status: statusCode }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        transactions: result.data?.transactions || [],
        pagination: {
          page,
          limit,
          total: result.data?.total || 0,
          hasMore: result.data?.hasMore || false,
          totalPages: Math.ceil((result.data?.total || 0) / limit)
        }
      }
    });

  } catch (error) {
    console.error('Get customer transactions error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
