import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';

// This route uses dynamic features, so it must be server-rendered
export const dynamic = 'force-dynamic';

import { prisma } from '@/lib/prisma';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { GetObjectCommand } from '@aws-sdk/client-s3';
import { S3 } from '@/lib/r2';
import { verifyJWT } from '@/lib/jwt';

// GET /api/voices/[id]/play - Get a signed URL to play a voice sample (protected, requires partner authentication)
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Check for partner token in Authorization header first, then cookies
    let token = req.headers.get('Authorization')?.replace('Bearer ', '');

    if (!token) {
      // Fallback to checking cookies
      token = cookies().get('partner_token')?.value;
    }

    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Verify partner JWT token
    const decodedToken = await verifyJWT(token);
    if (!decodedToken || !decodedToken.partnerId) {
      return NextResponse.json({
        error: 'Invalid token',
        message: 'Your session has expired. Please log in again.'
      }, { status: 401 });
    }

    // Verify partner exists
    const partner = await prisma.partner.findUnique({
      where: { id: decodedToken.partnerId }
    });

    if (!partner) {
      return NextResponse.json({
        error: 'Partner not found',
        message: 'Your account could not be found.'
      }, { status: 401 });
    }

    const voice = await prisma.voice.findUnique({
      where: { id: params.id },
    });

    if (!voice || !voice.sampleUrl) {
      return NextResponse.json({ error: 'Voice not found' }, { status: 404 });
    }

    // Extract the key from the full URL
    let key: string;
    try {
      const url = new URL(voice.sampleUrl);
      key = decodeURIComponent(url.pathname.slice(1)); // Remove leading slash and decode
    } catch (error) {
      console.error('Error parsing sample URL:', error);
      return NextResponse.json(
        { error: 'Invalid sample URL format' },
        { status: 400 }
      );
    }

    // Ensure we have a key
    if (!key) {
      return NextResponse.json(
        { error: 'Invalid sample URL: no key found' },
        { status: 400 }
      );
    }

    const bucket = process.env.VOICE_SAMPLES_BUCKET || 'voice-samples';
    const command = new GetObjectCommand({
      Bucket: bucket,
      Key: key,
    });

    try {
      // Generate a signed URL that expires in 1 hour
      const signedUrl = await getSignedUrl(S3, command, { expiresIn: 3600 });
      return NextResponse.json({ url: signedUrl });
    } catch (error) {
      console.error('Error generating signed URL:', error);
      return NextResponse.json(
        { error: 'Failed to generate playback URL' },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('Error getting voice play URL:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
