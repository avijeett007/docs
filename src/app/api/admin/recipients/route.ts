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

// Define recipient types for better type safety
type RecipientType = 'partner' | 'waitlist';

interface Recipient {
  id: string;
  name: string;
  email: string;
  type: RecipientType;
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

    // Get the recipient type from query parameters (optional filter)
    const url = new URL(request.url);
    const typeFilter = url.searchParams.get('type') as RecipientType | null;

    let recipients: Recipient[] = [];

    // Fetch partners if no filter or filter is 'partner'
    if (!typeFilter || typeFilter === 'partner') {
      const partners = await prisma.partner.findMany({
        select: {
          id: true,
          businessName: true,
          emailAddress: true,
          approvalStatus: true,
        },
        // Remove the where clause to include all partners regardless of approval status
        orderBy: {
          businessName: 'asc',
        },
      });

      const partnerRecipients = partners.map((partner) => ({
        id: partner.id,
        name: partner.businessName,
        email: partner.emailAddress,
        type: 'partner' as RecipientType,
        businessName: partner.businessName,
        approvalStatus: partner.approvalStatus
      }));
      
      recipients = [...recipients, ...partnerRecipients];
    }

    // Fetch waitlist members if no filter or filter is 'waitlist'
    if (!typeFilter || typeFilter === 'waitlist') {
      const waitlistMembers = await prisma.waitlist.findMany({
        select: {
          id: true,
          name: true,
          email: true,
        },
        orderBy: {
          name: 'asc',
        },
      });

      const waitlistRecipients = waitlistMembers.map((member) => ({
        id: member.id,
        name: member.name,
        email: member.email,
        type: 'waitlist' as RecipientType
      }));
      
      recipients = [...recipients, ...waitlistRecipients];
    }

    return NextResponse.json({ recipients });
  } catch (error) {
    console.error('Error fetching recipients:', error);
    return NextResponse.json(
      { error: 'Failed to fetch recipients' },
      { status: 500 }
    );
  }
}
