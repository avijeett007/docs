import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyPartnerToken } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase-admin';

export const dynamic = 'force-dynamic';

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED_IMAGE_TYPES = [
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/svg+xml',
];

// Use env var so it can be overridden; must be a PUBLIC bucket in Supabase
const DEFAULT_BUCKET = process.env.SUPABASE_PUBLIC_BUCKET || 'partner-assets';

/**
 * Ensures the target bucket exists and is set to public.
 * Creates it if missing, updates it to public if it exists but is private.
 */
async function ensurePublicBucket(bucketName: string): Promise<void> {
  const { data: bucket, error: getBucketError } = await supabaseAdmin.storage.getBucket(bucketName);

  if (getBucketError || !bucket) {
    // Bucket doesn't exist — create it as public
    const { error: createError } = await supabaseAdmin.storage.createBucket(bucketName, {
      public: true,
      fileSizeLimit: 10 * 1024 * 1024, // 10MB limit
    });
    if (createError) {
      throw new Error(`Failed to create bucket "${bucketName}": ${createError.message}`);
    }
    console.log(`[logo-upload] Created public bucket: ${bucketName}`);
    return;
  }

  if (!bucket.public) {
    // Bucket exists but is private — make it public
    const { error: updateError } = await supabaseAdmin.storage.updateBucket(bucketName, { public: true });
    if (updateError) {
      throw new Error(`Bucket "${bucketName}" exists but is private and could not be made public: ${updateError.message}`);
    }
    console.log(`[logo-upload] Updated bucket to public: ${bucketName}`);
  }
}

/**
 * POST /api/partner/experiences/[id]/logo
 * Upload a logo for an experience. Stores in Supabase storage.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const authResult = await verifyPartnerToken(request);
    if (!authResult.success || !authResult.partner) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const partner = authResult.partner;
    const { id } = params;

    // Verify experience ownership
    const experience = await prisma.partnerExperience.findUnique({
      where: { id },
    });

    if (!experience || experience.partnerId !== partner.id) {
      return NextResponse.json({ error: 'Experience not found' }, { status: 404 });
    }

    // Parse form data
    const formData = await request.formData();
    const file = formData.get('file');

    if (!file || typeof file === 'string') {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    const fileObj = file as File;

    // Validate file size
    if (fileObj.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: 'File too large. Maximum size is 5MB.' },
        { status: 400 }
      );
    }

    // Validate file type
    if (!ALLOWED_IMAGE_TYPES.includes(fileObj.type)) {
      return NextResponse.json(
        { error: 'Invalid file type. Allowed: JPEG, PNG, WebP, SVG.' },
        { status: 400 }
      );
    }

    // Generate storage path: experiences/{partnerId}/{experienceType}/logo.{ext}
    const fileExtension = fileObj.name.split('.').pop() || 'png';
    const storagePath = `experiences/${partner.id}/${experience.experienceType}/logo_${Date.now()}.${fileExtension}`;

    // Convert file to buffer
    const bytes = await fileObj.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Ensure the bucket exists and is public before uploading
    try {
      await ensurePublicBucket(DEFAULT_BUCKET);
    } catch (bucketError) {
      console.error('[logo-upload] Bucket setup error:', bucketError);
      return NextResponse.json(
        { error: `Storage bucket error: ${bucketError instanceof Error ? bucketError.message : 'Unknown error'}` },
        { status: 500 }
      );
    }

    // Upload to Supabase Storage
    const { error: uploadError } = await supabaseAdmin.storage
      .from(DEFAULT_BUCKET)
      .upload(storagePath, buffer, {
        contentType: fileObj.type,
        cacheControl: '3600',
        upsert: true,
      });

    if (uploadError) {
      console.error('[logo-upload] Supabase upload error:', uploadError.message, uploadError);
      return NextResponse.json(
        { error: `Failed to upload logo: ${uploadError.message}` },
        { status: 500 }
      );
    }

    // Get the public URL
    const { data: urlData } = supabaseAdmin.storage
      .from(DEFAULT_BUCKET)
      .getPublicUrl(storagePath);

    const logoUrl = urlData.publicUrl;

    // Update the experience's landingPageConfig.branding.logo
    const currentConfig = (experience.landingPageConfig as Record<string, unknown>) || {};
    const currentBranding = (currentConfig.branding as Record<string, unknown>) || {};

    const updatedConfig = {
      ...currentConfig,
      branding: {
        ...currentBranding,
        logo: logoUrl,
      },
    };

    await prisma.partnerExperience.update({
      where: { id },
      data: { landingPageConfig: updatedConfig },
    });

    return NextResponse.json({
      success: true,
      logoUrl,
    });
  } catch (error) {
    console.error('Error uploading experience logo:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

