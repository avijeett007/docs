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

// PUT /api/admin/video-tutorials/[id]/sequence
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
    const { direction } = body;

    if (direction !== 'up' && direction !== 'down') {
      return NextResponse.json(
        { error: 'Direction must be "up" or "down"' },
        { status: 400 }
      );
    }

    // Get current video
    const currentVideo = await prisma.videoTutorial.findUnique({
      where: { id },
    });

    if (!currentVideo) {
      return NextResponse.json(
        { error: 'Video tutorial not found' },
        { status: 404 }
      );
    }

    // Get all videos ordered by sequence
    const allVideos = await prisma.videoTutorial.findMany({
      orderBy: {
        sequence: 'asc',
      },
    });

    const currentIndex = allVideos.findIndex(v => v.id === id);

    if (currentIndex === -1) {
      return NextResponse.json(
        { error: 'Video not found in sequence' },
        { status: 404 }
      );
    }

    // Calculate target index
    const targetIndex = direction === 'up'
      ? Math.max(0, currentIndex - 1)
      : Math.min(allVideos.length - 1, currentIndex + 1);

    // If no change in position, return early
    if (targetIndex === currentIndex) {
      return NextResponse.json({ success: true });
    }

    // Get target video
    const targetVideo = allVideos[targetIndex];

    // Swap sequences
    await prisma.$transaction([
      prisma.videoTutorial.update({
        where: { id: currentVideo.id },
        data: { sequence: targetVideo.sequence },
      }),
      prisma.videoTutorial.update({
        where: { id: targetVideo.id },
        data: { sequence: currentVideo.sequence },
      }),
    ]);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error updating sequence:', error);
    return NextResponse.json(
      { error: 'Failed to update sequence' },
      { status: 500 }
    );
  }
}
