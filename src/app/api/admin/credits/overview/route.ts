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
 * GET /api/admin/credits/overview
 * Get credit system overview for admin dashboard
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

    // Get overall credit statistics
    const [
      totalPartners,
      activePartners,
      creditStats,
      recentTransactions,
      lowCreditPartners
    ] = await Promise.all([
      // Total partners
      prisma.partner.count(),
      
      // Active partners with subscriptions
      prisma.partner.count({
        where: {
          approvalStatus: 'ACTIVE',
          subscriptionStatus: 'ACTIVE'
        }
      }),
      
      // Credit statistics
      prisma.partner.aggregate({
        _sum: {
          creditBalance: true,
          totalCreditsPurchased: true,
          totalCreditsUsed: true,
          monthlyCreditAllocation: true
        },
        _avg: {
          creditBalance: true
        },
        where: {
          approvalStatus: 'ACTIVE'
        }
      }),
      
      // Recent transactions (last 10)
      prisma.creditTransaction.findMany({
        take: 10,
        orderBy: { createdAt: 'desc' },
        include: {
          partner: {
            select: {
              id: true,
              businessName: true,
              emailAddress: true
            }
          }
        }
      }),
      
      // Partners with low credit balances
      prisma.partner.findMany({
        where: {
          approvalStatus: 'ACTIVE',
          OR: [
            {
              AND: [
                { lowCreditThreshold: { not: null } },
                { creditBalance: { lte: prisma.partner.fields.lowCreditThreshold } }
              ]
            },
            {
              AND: [
                { lowCreditThreshold: null },
                { creditBalance: { lte: 1000 } } // Default threshold
              ]
            }
          ]
        },
        select: {
          id: true,
          businessName: true,
          emailAddress: true,
          creditBalance: true,
          lowCreditThreshold: true
        },
        take: 20,
        orderBy: { creditBalance: 'asc' }
      })
    ]);

    // Calculate additional metrics
    const totalCreditsInSystem = creditStats._sum.creditBalance || 0;
    const totalCreditsPurchased = creditStats._sum.totalCreditsPurchased || 0;
    const totalCreditsUsed = creditStats._sum.totalCreditsUsed || 0;
    const averageCreditBalance = Math.round(creditStats._avg.creditBalance || 0);
    const totalMonthlyAllocation = creditStats._sum.monthlyCreditAllocation || 0;

    // Calculate usage rate
    const usageRate = totalCreditsPurchased > 0 
      ? Math.round((totalCreditsUsed / totalCreditsPurchased) * 100) 
      : 0;

    // Get transaction type breakdown for the last 30 days
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const transactionBreakdown = await prisma.creditTransaction.groupBy({
      by: ['type'],
      _sum: {
        amount: true
      },
      _count: {
        id: true
      },
      where: {
        createdAt: { gte: thirtyDaysAgo }
      }
    });

    return NextResponse.json({
      success: true,
      data: {
        overview: {
          totalPartners,
          activePartners,
          totalCreditsInSystem,
          totalCreditsPurchased,
          totalCreditsUsed,
          averageCreditBalance,
          totalMonthlyAllocation,
          usageRate
        },
        recentTransactions: recentTransactions.map(tx => ({
          id: tx.id,
          type: tx.type,
          amount: tx.amount,
          balanceAfter: tx.balanceAfter,
          description: tx.description,
          createdAt: tx.createdAt,
          partner: {
            id: tx.partner.id,
            businessName: tx.partner.businessName,
            emailAddress: tx.partner.emailAddress
          }
        })),
        lowCreditPartners: lowCreditPartners.map(partner => ({
          id: partner.id,
          businessName: partner.businessName,
          emailAddress: partner.emailAddress,
          creditBalance: partner.creditBalance,
          lowCreditThreshold: partner.lowCreditThreshold || 1000
        })),
        transactionBreakdown: transactionBreakdown.map(item => ({
          type: item.type,
          totalAmount: item._sum.amount || 0,
          count: item._count.id
        }))
      }
    });

  } catch (error) {
    console.error('Error fetching credit overview:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      },
      { status: 500 }
    );
  }
}
