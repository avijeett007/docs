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

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Verify admin authentication
    const user = await verifyAdminAuth(request);
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const waitlistId = params.id;

    // Fetch waitlist member details
    const member = await prisma.waitlist.findUnique({
      where: { id: waitlistId },
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
          },
          orderBy: {
            position: 'asc'
          }
        }
      }
    });

    if (!member) {
      return NextResponse.json(
        { error: 'Waitlist member not found' },
        { status: 404 }
      );
    }

    // Check if this member became a partner
    const partnerInfo = await prisma.partner.findFirst({
      where: {
        emailAddress: member.email
      },
      select: {
        id: true,
        businessName: true,
        createdAt: true,
        subscriptionStatus: true,
        approvalStatus: true,
      }
    });

    // Calculate days since joined
    const daysSinceJoined = Math.floor(
      (new Date().getTime() - new Date(member.createdAt).getTime()) / (1000 * 60 * 60 * 24)
    );

    // Build enhanced member data
    const memberDetails = {
      ...member,
      daysSinceJoined,
      becamePartner: !!partnerInfo,
      partnerInfo: partnerInfo || null,
    };

    return NextResponse.json({
      success: true,
      data: memberDetails
    });

  } catch (error) {
    console.error('Error fetching waitlist member details:', error);
    return NextResponse.json(
      { error: 'Failed to fetch member details' },
      { status: 500 }
    );
  }
}
