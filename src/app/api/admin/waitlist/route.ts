import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { prisma } from '@/lib/prisma';

// This route uses dynamic features, so it must be server-rendered
export const dynamic = 'force-dynamic';

// Verify admin authentication using custom Supabase admin cookies
async function verifyAdminAuth(request: NextRequest) {
  try {
    // Initialize Supabase client - SECURITY: Use server-side only variables
    const supabaseUrl = process.env.SUPABASE_URL || '';
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
    
    if (!supabaseUrl || !supabaseKey) {
      console.error('Supabase configuration error');
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
      return null;
    }
    
    // Create Supabase client
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    // Verify the token by setting it and getting the user
    const { data: { user }, error } = await supabase.auth.getUser(adminSessionToken);
    
    if (error || !user) {
      return null;
    }
    
    return user;
  } catch (error) {
    console.error('Admin auth verification error:', error);
    return null;
  }
}

export async function GET(request: NextRequest) {
  try {
    // Verify admin authentication
    const user = await verifyAdminAuth(request);
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get query parameters
    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search') || '';
    const status = searchParams.get('status') || '';
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');

    // Build where clause
    const whereClause: any = {};
    
    if (search) {
      whereClause.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
      ];
    }
    
    if (status && status !== 'all') {
      whereClause.status = status.toUpperCase();
    }

    // Fetch waitlist members with enhanced data
    const [waitlistMembers, totalCount] = await Promise.all([
      prisma.waitlist.findMany({
        where: whereClause,
        select: {
          id: true,
          name: true,
          email: true,
          position: true,
          status: true,
          source: true,
          referralCode: true,
          referralCount: true,
          notes: true,
          createdAt: true,
          updatedAt: true,
          referrals: {
            select: {
              id: true,
              name: true,
              email: true,
              position: true,
            }
          }
        },
        orderBy: [
          { position: 'asc' },
          { createdAt: 'asc' }
        ],
        take: limit,
        skip: offset,
      }),
      
      prisma.waitlist.count({
        where: whereClause,
      })
    ]);

    // Check if any waitlist members became partners
    const waitlistEmails = waitlistMembers.map(member => member.email);
    const partnersFromWaitlist = await prisma.partner.findMany({
      where: {
        emailAddress: {
          in: waitlistEmails
        }
      },
      select: {
        id: true,
        emailAddress: true,
        businessName: true,
        createdAt: true,
        subscriptionStatus: true,
        approvalStatus: true,
      }
    });

    // Create a map for quick lookup
    const partnerMap = new Map(
      partnersFromWaitlist.map(partner => [partner.emailAddress, partner])
    );

    // Enhance waitlist data with partner information
    const enhancedWaitlistMembers = waitlistMembers.map(member => ({
      ...member,
      becamePartner: partnerMap.has(member.email),
      partnerInfo: partnerMap.get(member.email) || null,
      daysSinceJoined: Math.floor(
        (new Date().getTime() - new Date(member.createdAt).getTime()) / (1000 * 60 * 60 * 24)
      ),
    }));

    return NextResponse.json({
      success: true,
      data: {
        members: enhancedWaitlistMembers,
        pagination: {
          total: totalCount,
          limit,
          offset,
          hasMore: offset + limit < totalCount,
        },
        stats: {
          totalMembers: totalCount,
          becamePartners: partnersFromWaitlist.length,
          conversionRate: totalCount > 0 ? ((partnersFromWaitlist.length / totalCount) * 100).toFixed(1) : '0',
        }
      }
    });

  } catch (error) {
    console.error('Error fetching waitlist data:', error);
    return NextResponse.json(
      { error: 'Failed to fetch waitlist data' },
      { status: 500 }
    );
  }
}
