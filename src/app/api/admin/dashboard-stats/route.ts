import { NextRequest, NextResponse } from 'next/server';
import { format, subMonths, startOfMonth, endOfMonth } from 'date-fns';
import { protectAdminRoute } from '@/lib/admin-route-protection';
import { createClient } from '@supabase/supabase-js';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic'; // Required because this route uses request.headers

// Verify admin authentication using custom Supabase admin cookies
/*
async function _verifyAdminAuth(request: NextRequest) {
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
    console.log('Cookie header:', cookieHeader);

    // Parse cookies to find our custom admin session cookie
    const cookies = cookieHeader.split(';').reduce((acc, cookie) => {
      const [key, value] = cookie.trim().split('=');
      acc[key] = value;
      return acc;
    }, {} as Record<string, string>);

    // Check for our custom admin session token
    const adminSessionToken = cookies['supabase-admin-session'];

    if (!adminSessionToken) {
      console.log('No admin session token found in cookies');
      return null;
    }

    console.log('Admin session token found, verifying...');

    // Create Supabase client
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Verify the token by setting it and getting the user
    const { data: { user }, error } = await supabase.auth.getUser(adminSessionToken);

    if (error) {
      console.error('Error verifying admin token:', error.message);
      return null;
    }

    if (!user) {
      console.log('No user found for the provided token');
      return null;
    }

    console.log('Admin user authenticated successfully:', user.email);
    return user;
  } catch (error) {
    console.error('Exception in verifyAdminAuth:', error);
    return null;
  }
}
*/

export async function GET(request: NextRequest) {
  try {
    // Protect route with MFA enforcement
    const protectionResult = await protectAdminRoute(request);
    if (protectionResult) {
      return protectionResult;
    }

    // Get counts
    const waitlistCount = await prisma.waitlist.count();
    const partnerCount = await prisma.partner.count();
    const customerCount = await prisma.customer.count();

    // Generate growth data for the last 6 months
    const growthData = [];
    const currentDate = new Date();

    for (let i = 5; i >= 0; i--) {
      const monthDate = subMonths(currentDate, i);
      const monthStart = startOfMonth(monthDate);
      const monthEnd = endOfMonth(monthDate);

      const partnersCount = await prisma.partner.count({
        where: {
          createdAt: {
            gte: monthStart,
            lte: monthEnd,
          },
        },
      });

      growthData.push({
        date: format(monthDate, 'MMM yyyy'),
        partners: partnersCount,
      });
    }

    return NextResponse.json({
      waitlistCount,
      partnerCount,
      customerCount,
      growthData,
    });
  } catch (error) {
    console.error('Error fetching dashboard stats:', error);
    return NextResponse.json(
      { error: 'Failed to fetch dashboard statistics' },
      { status: 500 }
    );
  }
}
