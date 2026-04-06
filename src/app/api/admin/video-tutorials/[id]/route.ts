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

// GET /api/admin/video-tutorials/[id]
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Verify admin authentication
    const user = await verifyAdminAuth(req);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const id = params.id;

    // Get video tutorial by ID
    const video = await prisma.videoTutorial.findUnique({
      where: { id },
    });

    if (!video) {
      return NextResponse.json(
        { error: 'Video tutorial not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ video });
  } catch (error) {
    console.error('Error fetching video tutorial:', error);
    return NextResponse.json(
      { error: 'Failed to fetch video tutorial' },
      { status: 500 }
    );
  }
}

// PUT /api/admin/video-tutorials/[id]
export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Verify admin authentication
    const user = await verifyAdminAuth(req);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const id = params.id;

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

    // Check if video exists
    const existingVideo = await prisma.videoTutorial.findUnique({
      where: { id },
    });

    if (!existingVideo) {
      return NextResponse.json(
        { error: 'Video tutorial not found' },
        { status: 404 }
      );
    }

    // Update video tutorial
    const video = await prisma.videoTutorial.update({
      where: { id },
      data: {
        title,
        description,
        videoUrl,
        thumbnailUrl,
        audience: audience || 'partner',
        isActive: isActive !== undefined ? isActive : true,
      },
    });

    return NextResponse.json({ video });
  } catch (error) {
    console.error('Error updating video tutorial:', error);
    return NextResponse.json(
      { error: 'Failed to update video tutorial' },
      { status: 500 }
    );
  }
}

// DELETE /api/admin/video-tutorials/[id]
export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Verify admin authentication
    const user = await verifyAdminAuth(req);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const id = params.id;

    // Check if video exists
    const existingVideo = await prisma.videoTutorial.findUnique({
      where: { id },
    });

    if (!existingVideo) {
      return NextResponse.json(
        { error: 'Video tutorial not found' },
        { status: 404 }
      );
    }

    // Delete video tutorial
    await prisma.videoTutorial.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting video tutorial:', error);
    return NextResponse.json(
      { error: 'Failed to delete video tutorial' },
      { status: 500 }
    );
  }
}
