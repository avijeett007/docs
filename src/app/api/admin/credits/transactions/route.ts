import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { createClient } from '@supabase/supabase-js';

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
 * GET /api/admin/credits/transactions
 * Get detailed credit transaction history with filtering and export
 */
export async function GET(request: NextRequest) {
  try {
    // Verify admin authentication
    const user = await verifyAdminAuth(request);
    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);

    // Parse query parameters
    const partnerId = searchParams.get('partnerId');
    const type = searchParams.get('type'); // purchase, allocation, deduction, refund, adjustment
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const search = searchParams.get('search') || '';
    const sortBy = searchParams.get('sortBy') || 'createdAt';
    const sortOrder = searchParams.get('sortOrder') || 'desc';
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');
    const export_format = searchParams.get('export'); // csv, json
    const offset = (page - 1) * limit;

    // Build where clause
    const whereClause: any = {};

    if (partnerId) {
      whereClause.partnerId = partnerId;
    }

    if (type) {
      whereClause.type = type;
    }

    if (startDate || endDate) {
      whereClause.createdAt = {};
      if (startDate) {
        whereClause.createdAt.gte = new Date(startDate);
      }
      if (endDate) {
        whereClause.createdAt.lte = new Date(endDate);
      }
    }

    if (search) {
      whereClause.OR = [
        { description: { contains: search, mode: 'insensitive' } },
        { referenceId: { contains: search, mode: 'insensitive' } },
        { createdBy: { contains: search, mode: 'insensitive' } },
        { partner: { businessName: { contains: search, mode: 'insensitive' } } },
        { partner: { emailAddress: { contains: search, mode: 'insensitive' } } }
      ];
    }

    // Build order by clause
    const orderBy: any = {};
    orderBy[sortBy] = sortOrder;

    // Get transactions
    const [transactions, totalCount] = await Promise.all([
      prisma.creditTransaction.findMany({
        where: whereClause,
        include: {
          partner: {
            select: {
              id: true,
              businessName: true,
              emailAddress: true
            }
          }
        },
        orderBy,
        skip: export_format ? 0 : offset, // Don't paginate for exports
        take: export_format ? undefined : limit
      }),
      prisma.creditTransaction.count({ where: whereClause })
    ]);

    // If export is requested, return data in specified format
    if (export_format) {
      const exportData = transactions.map(tx => ({
        id: tx.id,
        partnerId: tx.partnerId,
        partnerName: tx.partner.businessName,
        partnerEmail: tx.partner.emailAddress,
        type: tx.type,
        amount: tx.amount,
        balanceAfter: tx.balanceAfter,
        description: tx.description,
        referenceId: tx.referenceId,
        createdBy: tx.createdBy,
        createdAt: tx.createdAt.toISOString(),
        metadata: JSON.stringify(tx.metadata)
      }));

      if (export_format === 'csv') {
        // Convert to CSV
        const headers = Object.keys(exportData[0] || {});
        const csvContent = [
          headers.join(','),
          ...exportData.map(row => 
            headers.map(header => {
              const value = row[header as keyof typeof row];
              // Escape commas and quotes in CSV
              return typeof value === 'string' && (value.includes(',') || value.includes('"'))
                ? `"${value.replace(/"/g, '""')}"` 
                : value;
            }).join(',')
          )
        ].join('\n');

        return new NextResponse(csvContent, {
          headers: {
            'Content-Type': 'text/csv',
            'Content-Disposition': `attachment; filename="credit-transactions-${new Date().toISOString().split('T')[0]}.csv"`
          }
        });
      } else if (export_format === 'json') {
        return new NextResponse(JSON.stringify(exportData, null, 2), {
          headers: {
            'Content-Type': 'application/json',
            'Content-Disposition': `attachment; filename="credit-transactions-${new Date().toISOString().split('T')[0]}.json"`
          }
        });
      }
    }

    // Get summary statistics for the filtered data
    const summaryStats = await prisma.creditTransaction.groupBy({
      by: ['type'],
      where: whereClause,
      _sum: {
        amount: true
      },
      _count: {
        id: true
      }
    });

    // Calculate total amounts by type
    const summary = summaryStats.reduce((acc, stat) => {
      acc[stat.type] = {
        totalAmount: stat._sum.amount || 0,
        count: stat._count.id
      };
      return acc;
    }, {} as Record<string, { totalAmount: number; count: number }>);

    return NextResponse.json({
      success: true,
      data: {
        transactions: transactions.map(tx => ({
          id: tx.id,
          partnerId: tx.partnerId,
          partner: {
            id: tx.partner.id,
            businessName: tx.partner.businessName,
            emailAddress: tx.partner.emailAddress
          },
          type: tx.type,
          amount: tx.amount,
          balanceAfter: tx.balanceAfter,
          description: tx.description,
          referenceId: tx.referenceId,
          createdBy: tx.createdBy,
          createdAt: tx.createdAt,
          metadata: tx.metadata
        })),
        summary,
        pagination: {
          page,
          limit,
          total: totalCount,
          totalPages: Math.ceil(totalCount / limit),
          hasNext: page * limit < totalCount,
          hasPrev: page > 1
        },
        filters: {
          partnerId,
          type,
          startDate,
          endDate,
          search,
          sortBy,
          sortOrder
        }
      }
    });

  } catch (error) {
    console.error('Error fetching credit transactions:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      },
      { status: 500 }
    );
  }
}
