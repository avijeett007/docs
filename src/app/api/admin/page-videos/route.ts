import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminAuth } from '@/lib/adminAuth';
import { prisma } from '@/lib/prisma';

// GET /api/admin/page-videos
export async function GET(request: NextRequest) {
  try {
    // Verify admin authentication
    const admin = await verifyAdminAuth(request);
    if (!admin) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    try {
      const videos = await prisma.pageVideo.findMany({
        orderBy: [
          { pageUrl: 'asc' },
          { createdAt: 'desc' }
        ]
      });



      return NextResponse.json({
        success: true,
        videos
      });
    } catch (dbError) {
      console.log('Database not available, returning empty list:', dbError);
      return NextResponse.json({
        success: true,
        videos: []
      });
    }

  } catch (error) {
    console.error('Error fetching page videos:', error);
    return NextResponse.json(
      { error: 'Failed to fetch page videos' },
      { status: 500 }
    );
  }
}

// POST /api/admin/page-videos
export async function POST(request: NextRequest) {
  try {
    // Verify admin authentication
    const admin = await verifyAdminAuth(request);

    if (!admin) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { pageUrl, title, description, videoUrl, position, isActive } = body;

    // Validate required fields
    if (!pageUrl || !title || !videoUrl) {
      return NextResponse.json(
        { error: 'Missing required fields: pageUrl, title, videoUrl' },
        { status: 400 }
      );
    }

    try {
      // Check if video already exists for this page
      const existingVideo = await prisma.pageVideo.findUnique({
        where: { pageUrl }
      });

      if (existingVideo) {
        return NextResponse.json(
          { error: 'A video already exists for this page. Use PUT to update it.' },
          { status: 409 }
        );
      }

      const video = await prisma.pageVideo.create({
        data: {
          pageUrl,
          title,
          description: description || null,
          videoUrl,
          position: position || 'bottom-right',
          isActive: isActive !== undefined ? isActive : true
        }
      });

      return NextResponse.json({
        success: true,
        video
      }, { status: 201 });

    } catch (dbError) {
      console.error('Database error:', dbError);
      return NextResponse.json(
        { error: 'Database not available. Please ensure the database is running and the PageVideo table exists.' },
        { status: 503 }
      );
    }

  } catch (error) {
    console.error('Error creating page video:', error);
    return NextResponse.json(
      { error: 'Failed to create page video' },
      { status: 500 }
    );
  }
}
