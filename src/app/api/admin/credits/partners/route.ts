import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { createClient } from '@supabase/supabase-js';
import { adminRateLimit } from '@/lib/rateLimit';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

// Verify admin authentication using custom Supabase admin cookies
async function verifyAdminAuth(request: NextRequest) {
  try {
    // Initialize Supabase client - SECURITY: Use server-side only environment variables
    const supabaseUrl = process.env.SUPABASE_URL || '';
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

    if (!supabaseUrl || !supabaseKey) {
      console.error('Supabase URL or Key is missing');
      return null;
    }

    // Extract cookies from the request
    const cookieHeader = request.headers.get('cookie') || '';

    // Parse cookies to find our custom admin session cookie
    const cookies = cookieHeader.split(';').reduce((acc, cookie) => {
      const [key, value] = cookie.trim().split('=');
      acc[key] = value;
      return acc;
    }, {} as Record<string, string>);

    // Check for our custom admin session token
    const adminSessionToken = cookies['supabase-admin-session'];

    if (!adminSessionToken) {
      console.log('Authentication failed: missing token');
      return null;
    }

    // Create Supabase client
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Verify the token by setting it and getting the user
    const { data: { user }, error } = await supabase.auth.getUser(adminSessionToken);

    if (error) {
      console.error('Authentication error');
      return null;
    }

    if (!user) {
      console.log('Authentication failed: invalid token');
      return null;
    }

    console.log('Admin authentication successful');
    return user;
  } catch (error) {
    console.error('Authentication exception');
    return null;
  }
}

/**
 * GET /api/admin/credits/partners
 * Search and filter partners with credit information
 */
// Input validation schema
const partnersQuerySchema = z.object({
  search: z.string().max(100).optional(),
  status: z.enum(['all', 'active', 'inactive']).optional(),
  creditFilter: z.enum(['all', 'low', 'high', 'zero']).optional(),
  page: z.string().regex(/^\d+$/).transform(Number).refine(n => n >= 1 && n <= 1000).optional(),
  limit: z.string().regex(/^\d+$/).transform(Number).refine(n => n >= 1 && n <= 100).optional()
});

export async function GET(request: NextRequest) {
  try {
    // Apply rate limiting
    const rateLimitResult = adminRateLimit(request);
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

    // Verify admin authentication
    const user = await verifyAdminAuth(request);
    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);

    // Validate query parameters
    const queryValidation = partnersQuerySchema.safeParse({
      search: searchParams.get('search') || undefined,
      status: searchParams.get('status') || undefined,
      creditFilter: searchParams.get('creditFilter') || undefined,
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

    const {
      search = '',
      status = 'all',
      creditFilter = 'all',
      page = 1,
      limit = 20
    } = queryValidation.data;

    // Additional parameters not in validation (for backward compatibility)
    const sortBy = searchParams.get('sortBy') || 'businessName';
    const sortOrder = searchParams.get('sortOrder') || 'asc';
    const offset = (page - 1) * limit;

    // Build where clause
    const whereClause: any = {};

    // Search filter
    if (search) {
      whereClause.OR = [
        { businessName: { contains: search, mode: 'insensitive' } },
        { emailAddress: { contains: search, mode: 'insensitive' } },
        { id: { contains: search, mode: 'insensitive' } }
      ];
    }

    // Status filter
    if (status !== 'all') {
      whereClause.approvalStatus = status.toUpperCase();
    }

    // Credit balance filters
    if (creditFilter !== 'all') {
      switch (creditFilter) {
        case 'low':
          whereClause.OR = [
            {
              AND: [
                { lowCreditThreshold: { not: null } },
                { creditBalance: { lte: prisma.partner.fields.lowCreditThreshold } }
              ]
            },
            {
              AND: [
                { lowCreditThreshold: null },
                { creditBalance: { lte: 1000 } }
              ]
            }
          ];
          break;
        case 'high':
          whereClause.creditBalance = { gte: 10000 };
          break;
        case 'zero':
          whereClause.creditBalance = { lte: 0 };
          break;
      }
    }

    // Build order by clause
    const orderBy: any = {};
    switch (sortBy) {
      case 'creditBalance':
        orderBy.creditBalance = sortOrder;
        break;
      case 'lastAllocation':
        orderBy.lastCreditAllocationDate = sortOrder;
        break;
      case 'businessName':
      default:
        orderBy.businessName = sortOrder;
        break;
    }

    // Get partners with pagination
    const [partners, totalCount] = await Promise.all([
      prisma.partner.findMany({
        where: whereClause,
        select: {
          id: true,
          businessName: true,
          emailAddress: true,
          approvalStatus: true,
          subscriptionStatus: true,
          creditBalance: true,
          monthlyCreditAllocation: true,
          lastCreditAllocationDate: true,
          lowCreditThreshold: true,
          lowCreditNotificationsEnabled: true,
          totalCreditsPurchased: true,
          totalCreditsUsed: true,
          createdAt: true,
          planId: true,
          billingInterval: true
        },
        orderBy,
        skip: offset,
        take: limit
      }),
      prisma.partner.count({ where: whereClause })
    ]);

    // Get recent transactions for each partner (last 3)
    const partnerIds = partners.map(p => p.id);
    const recentTransactions = await prisma.creditTransaction.findMany({
      where: {
        partnerId: { in: partnerIds }
      },
      select: {
        id: true,
        partnerId: true,
        type: true,
        amount: true,
        balanceAfter: true,
        description: true,
        createdAt: true
      },
      orderBy: { createdAt: 'desc' },
      take: partnerIds.length * 3 // Get up to 3 per partner
    });

    // Group transactions by partner
    const transactionsByPartner = recentTransactions.reduce((acc, tx) => {
      if (!acc[tx.partnerId]) acc[tx.partnerId] = [];
      if (acc[tx.partnerId].length < 3) {
        acc[tx.partnerId].push(tx);
      }
      return acc;
    }, {} as Record<string, any[]>);

    // Combine data
    const partnersWithTransactions = partners.map(partner => ({
      ...partner,
      recentTransactions: transactionsByPartner[partner.id] || [],
      isLowCredit: partner.creditBalance <= (partner.lowCreditThreshold || 1000),
      usageRate: partner.totalCreditsPurchased > 0 
        ? Math.round((partner.totalCreditsUsed / partner.totalCreditsPurchased) * 100)
        : 0
    }));

    return NextResponse.json({
      success: true,
      data: {
        partners: partnersWithTransactions,
        pagination: {
          page,
          limit,
          total: totalCount,
          totalPages: Math.ceil(totalCount / limit),
          hasNext: page * limit < totalCount,
          hasPrev: page > 1
        },
        filters: {
          search,
          status,
          creditFilter,
          sortBy,
          sortOrder
        }
      }
    });

  } catch (error) {
    console.error('Error searching partners:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      },
      { status: 500 }
    );
  }
}
