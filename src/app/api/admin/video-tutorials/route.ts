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
      console.log('No admin session token found in cookies');
      return null;
    }

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

    return user;
  } catch (error) {
    console.error('Exception in verifyAdminAuth:', error);
    return null;
  }
}

// GET /api/admin/video-tutorials
export async function GET(req: NextRequest) {
  try {
    // Verify admin authentication
    const user = await verifyAdminAuth(req);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get all video tutorials, ordered by sequence
    const videos = await prisma.videoTutorial.findMany({
      orderBy: {
        sequence: 'asc',
      },
    });

    return NextResponse.json({ videos });
  } catch (error) {
    console.error('Error fetching video tutorials:', error);
    return NextResponse.json(
      { error: 'Failed to fetch video tutorials' },
      { status: 500 }
    );
  }
}

// POST /api/admin/video-tutorials
export async function POST(req: NextRequest) {
  try {
    // Verify admin authentication
    const user = await verifyAdminAuth(req);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Parse request body
    const body = await req.json();
    const { title, description, videoUrl, thumbnailUrl, audience, isActive } = body;

    // Validate required fields
    if (!title || !videoUrl) {
      return NextResponse.json(
        { error: 'Title and video URL are required' },
        { status: 400 }
      );
    }

    // Get the highest sequence number
    const highestSequence = await prisma.videoTutorial.findFirst({
      orderBy: {
        sequence: 'desc',
      },
      select: {
        sequence: true,
      },
    });

    // Create new video tutorial
    const video = await prisma.videoTutorial.create({
      data: {
        title,
        description,
        videoUrl,
        thumbnailUrl,
        audience: audience || 'partner',
        isActive: isActive !== undefined ? isActive : true,
        sequence: highestSequence ? highestSequence.sequence + 1 : 0,
      },
    });

    return NextResponse.json({ video }, { status: 201 });
  } catch (error) {
    console.error('Error creating video tutorial:', error);
    return NextResponse.json(
      { error: 'Failed to create video tutorial' },
      { status: 500 }
    );
  }
}
