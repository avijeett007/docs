import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminAuth } from '@/lib/adminAuth';
import { prisma } from '@/lib/prisma';

// PUT /api/admin/page-videos/[id]
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Verify admin authentication
    const admin = await verifyAdminAuth(request);
    if (!admin) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { id } = params;
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
      // Check if video exists
      const existingVideo = await prisma.pageVideo.findUnique({
        where: { id }
      });

      if (!existingVideo) {
        return NextResponse.json(
          { error: 'Video not found' },
          { status: 404 }
        );
      }

      // Check if another video exists for this page (if pageUrl is changing)
      if (pageUrl !== existingVideo.pageUrl) {
        const conflictingVideo = await prisma.pageVideo.findUnique({
          where: { pageUrl }
        });

        if (conflictingVideo) {
          return NextResponse.json(
            { error: 'A video already exists for this page' },
            { status: 409 }
          );
        }
      }

      const video = await prisma.pageVideo.update({
        where: { id },
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
      });

    } catch (dbError) {
      console.error('Database error:', dbError);
      return NextResponse.json(
        { error: 'Database not available' },
        { status: 503 }
      );
    }

  } catch (error) {
    console.error('Error updating page video:', error);
    return NextResponse.json(
      { error: 'Failed to update page video' },
      { status: 500 }
    );
  }
}

// DELETE /api/admin/page-videos/[id]
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Verify admin authentication
    const admin = await verifyAdminAuth(request);
    if (!admin) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { id } = params;

    try {
      // Check if video exists
      const existingVideo = await prisma.pageVideo.findUnique({
        where: { id }
      });

      if (!existingVideo) {
        return NextResponse.json(
          { error: 'Video not found' },
          { status: 404 }
        );
      }

      await prisma.pageVideo.delete({
        where: { id }
      });

      return NextResponse.json({
        success: true,
        message: 'Video deleted successfully'
      });

    } catch (dbError) {
      console.error('Database error:', dbError);
      return NextResponse.json(
        { error: 'Database not available' },
        { status: 503 }
      );
    }

  } catch (error) {
    console.error('Error deleting page video:', error);
    return NextResponse.json(
      { error: 'Failed to delete page video' },
      { status: 500 }
    );
  }
}
