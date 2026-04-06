import { NextRequest, NextResponse } from 'next/server';

// This route uses dynamic features, so it must be server-rendered
export const dynamic = 'force-dynamic';

import { prisma } from '@/lib/prisma';
import { createClient } from '@supabase/supabase-js';

// Verify admin authentication using custom Supabase admin cookies
async function verifyAdminAuth(request: NextRequest) {
  try {
    // Initialize Supabase client - SECURITY: Use server-side only environment variables
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

// GET - Fetch all campaigns
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

    // Get query parameters for filtering
    const url = new URL(request.url);
    const status = url.searchParams.get('status');
    const limit = parseInt(url.searchParams.get('limit') || '50');
    const offset = parseInt(url.searchParams.get('offset') || '0');

    // Build where clause
    const where: any = {};
    if (status) {
      where.status = status;
    }

    // Fetch campaigns
    const campaigns = await prisma.emailCampaign.findMany({
      where,
      orderBy: {
        createdAt: 'desc',
      },
      take: limit,
      skip: offset,
    });

    // Get total count for pagination
    const totalCount = await prisma.emailCampaign.count({ where });

    return NextResponse.json({
      campaigns,
      totalCount,
      hasMore: offset + limit < totalCount
    });
  } catch (error) {
    console.error('Error fetching campaigns:', error);
    return NextResponse.json(
      { error: 'Failed to fetch campaigns' },
      { status: 500 }
    );
  }
}

// POST - Create or update a campaign
export async function POST(request: NextRequest) {
  try {
    // Verify admin authentication
    const user = await verifyAdminAuth(request);
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Parse request body
    const body = await request.json();
    const { 
      id, 
      name, 
      description, 
      subject, 
      htmlContent, 
      recipientType, 
      status = 'draft' 
    } = body;

    // Validate required fields
    if (!name || !subject || !htmlContent || !recipientType) {
      return NextResponse.json(
        { error: 'Missing required fields: name, subject, htmlContent, or recipientType' },
        { status: 400 }
      );
    }

    let campaign;

    if (id) {
      // Update existing campaign
      campaign = await prisma.emailCampaign.update({
        where: { id },
        data: {
          name,
          description,
          subject,
          htmlContent,
          recipientType,
          status,
          updatedAt: new Date()
        }
      });
    } else {
      // Create new campaign
      campaign = await prisma.emailCampaign.create({
        data: {
          name,
          description,
          subject,
          htmlContent,
          recipientType,
          status,
          targetCount: 0, // Will be updated when campaign is sent
          sentCount: 0
        }
      });
    }

    return NextResponse.json({ 
      success: true, 
      campaign 
    });
  } catch (error) {
    console.error('Error saving campaign:', error);
    return NextResponse.json(
      { error: 'Failed to save campaign', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

// DELETE - Delete a campaign
export async function DELETE(request: NextRequest) {
  try {
    // Verify admin authentication
    const user = await verifyAdminAuth(request);
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get campaign ID from query parameters
    const url = new URL(request.url);
    const campaignId = url.searchParams.get('id');

    if (!campaignId) {
      return NextResponse.json(
        { error: 'Campaign ID is required' },
        { status: 400 }
      );
    }

    // Delete the campaign
    await prisma.emailCampaign.delete({
      where: { id: campaignId }
    });

    return NextResponse.json({ 
      success: true, 
      message: 'Campaign deleted successfully' 
    });
  } catch (error) {
    console.error('Error deleting campaign:', error);
    return NextResponse.json(
      { error: 'Failed to delete campaign', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
