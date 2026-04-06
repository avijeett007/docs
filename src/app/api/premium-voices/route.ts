import { NextRequest, NextResponse } from 'next/server';

// This route uses dynamic features, so it must be server-rendered
export const dynamic = 'force-dynamic';

import { prisma } from '@/lib/prisma';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { GetObjectCommand } from '@aws-sdk/client-s3';
import { S3 } from '@/lib/r2';

// GET /api/premium-voices - Get all premium voices (provider='grok') for onboarding
// These are pre-recorded voice samples for Grok/xAI premium agent mode
// This endpoint is public (like /api/retell/voices, /api/cartesia/voices, /api/inworld/voices)
// because it only returns voice metadata and signed URLs for playback during onboarding
export async function GET(req: NextRequest) {
  try {
    // Get URL parameters for filtering
    const url = new URL(req.url);
    const gender = url.searchParams.get('gender'); // 'male' or 'female'
    const limit = parseInt(url.searchParams.get('limit') || '20');

    // Build filter conditions
    const whereConditions: any = {
      isActive: true,
      provider: 'grok', // Only fetch Grok premium voices
    };

    if (gender) {
      whereConditions.sex = gender;
    }

    const voices = await prisma.voice.findMany({
      where: whereConditions,
      orderBy: {
        displayName: 'asc',
      },
      take: limit,
    });

    // Generate signed URLs for each voice's sample
    const bucket = process.env.VOICE_SAMPLES_BUCKET || 'voice-samples';
    const voicesWithSignedUrls = await Promise.all(
      voices.map(async (voice) => {
        let signedSampleUrl: string | null = null;

        if (voice.sampleUrl) {
          try {
            // Extract the key from the full URL
            const voiceUrl = new URL(voice.sampleUrl);
            const key = decodeURIComponent(voiceUrl.pathname.slice(1)); // Remove leading slash and decode

            if (key) {
              const command = new GetObjectCommand({
                Bucket: bucket,
                Key: key,
              });
              // Generate a signed URL that expires in 1 hour
              signedSampleUrl = await getSignedUrl(S3, command, { expiresIn: 3600 });
            }
          } catch (error) {
            console.error(`Error generating signed URL for voice ${voice.id}:`, error);
          }
        }

        return {
          ...voice,
          signedSampleUrl,
        };
      })
    );

    return NextResponse.json({
      success: true,
      voices: voicesWithSignedUrls,
      count: voicesWithSignedUrls.length
    });
  } catch (error) {
    console.error('Error fetching premium voices:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

