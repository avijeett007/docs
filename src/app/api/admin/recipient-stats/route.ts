import { NextRequest, NextResponse } from 'next/server';

// This route uses dynamic features, so it must be server-rendered
export const dynamic = 'force-dynamic';

import { prisma } from '@/lib/prisma';
import { createClient } from '@supabase/supabase-js';

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

// GET - Fetch recipient statistics
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

    // Get total partners count
    const totalPartners = await prisma.partner.count();

    // Get active partners count
    const activePartners = await prisma.partner.count({
      where: {
        approvalStatus: 'ACTIVE'
      }
    });

    // Get total waitlist count
    const totalWaitlist = await prisma.waitlist.count();

    // Get additional stats
    const pendingPartners = await prisma.partner.count({
      where: {
        approvalStatus: 'PENDING'
      }
    });

    const approvedPartners = await prisma.partner.count({
      where: {
        approvalStatus: 'APPROVED'
      }
    });

    const rejectedPartners = await prisma.partner.count({
      where: {
        approvalStatus: 'REJECTED'
      }
    });

    return NextResponse.json({
      totalPartners,
      activePartners,
      pendingPartners,
      approvedPartners,
      rejectedPartners,
      totalWaitlist,
      totalRecipients: activePartners + totalWaitlist, // Default targeting (active partners + waitlist)
      allRecipients: totalPartners + totalWaitlist // If including all partners
    });
  } catch (error) {
    console.error('Error fetching recipient stats:', error);
    return NextResponse.json(
      { error: 'Failed to fetch recipient statistics' },
      { status: 500 }
    );
  }
}
