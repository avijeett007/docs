import { NextRequest, NextResponse } from 'next/server';
import { verifyPartnerAuth } from '@/lib/auth/partnerAuth';
import { prisma } from '@/lib/prisma';
import { getStaticPageVideo } from '@/lib/staticPageVideos';

export const dynamic = 'force-dynamic';

// GET /api/partner/page-videos?path=/partner/settings
export async function GET(request: NextRequest) {
  try {
    // Verify partner authentication
    const partner = await verifyPartnerAuth(request);

    if (!partner) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const path = searchParams.get('path');

    if (!path) {
      return NextResponse.json(
        { error: 'Path parameter is required' },
        { status: 400 }
      );
    }

    try {
      // Try to get video from database first
      const pageVideo = await prisma.pageVideo.findFirst({
        where: {
          pageUrl: path,
          isActive: true
        }
      });

      if (pageVideo) {
        return NextResponse.json({
          success: true,
          video: {
            id: pageVideo.id,
            pageUrl: pageVideo.pageUrl,
            title: pageVideo.title,
            description: pageVideo.description,
            videoUrl: pageVideo.videoUrl,
            isActive: pageVideo.isActive,
            position: pageVideo.position || 'bottom-right'
          }
        });
      }

      // Fallback to static videos for development
      const staticVideo = getStaticPageVideo(path);
      if (staticVideo) {
        return NextResponse.json({
          success: true,
          video: staticVideo
        });
      }

      return NextResponse.json({
        success: true,
        video: null
      });

    } catch (dbError) {
      console.log('Database not available, using static videos:', dbError);
      
      // Fallback to static videos
      const staticVideo = getStaticPageVideo(path);
      if (staticVideo) {
        return NextResponse.json({
          success: true,
          video: staticVideo
        });
      }

      return NextResponse.json({
        success: true,
        video: null
      });
    }

  } catch (error) {
    console.error('Error fetching page video:', error);
    return NextResponse.json(
      { error: 'Failed to fetch page video' },
      { status: 500 }
    );
  }
}
