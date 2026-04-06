import { NextRequest, NextResponse } from 'next/server';
import { verifyPartnerJWT } from '@/lib/auth';
import { logger } from '@/lib/logger';
import { supabaseAdmin } from '@/lib/supabase-admin';

const DEFAULT_BUCKET = 'files';

export async function POST(req: NextRequest) {
  try {
    // Verify partner authentication
    const partnerAuth = await verifyPartnerJWT(req);
    if (!partnerAuth || !partnerAuth.isValid || !partnerAuth.payload?.partnerId) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const partnerId = partnerAuth.payload.partnerId;
    const formData = await req.formData();
    const file = formData.get('file') as File;
    const documentType = formData.get('documentType') as string;

    if (!file) {
      return NextResponse.json(
        { success: false, error: 'No file provided' },
        { status: 400 }
      );
    }

    // Validate file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json(
        { success: false, error: 'File size must be less than 10MB' },
        { status: 400 }
      );
    }

    // Validate file type
    const allowedTypes = [
      'application/pdf',
      'image/jpeg',
      'image/png',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    ];
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json(
        { success: false, error: 'Invalid file type. Allowed: PDF, JPG, PNG, DOC, DOCX' },
        { status: 400 }
      );
    }

    // Generate storage path
    const timestamp = Date.now();
    const fileExtension = file.name.split('.').pop();
    const fileName = `${documentType || 'document'}_${timestamp}.${fileExtension}`;
    const storagePath = `${partnerId}/phone-activation/${fileName}`;

    // Convert file to buffer
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Upload to Supabase Storage
    const { error } = await supabaseAdmin.storage
      .from(DEFAULT_BUCKET)
      .upload(storagePath, buffer, {
        contentType: file.type,
        cacheControl: '3600',
        upsert: true,
      });

    if (error) {
      logger.error('Failed to upload phone activation document', new Error(error.message), {
        operation: 'phone_activation_upload',
        partnerId,
      });
      return NextResponse.json(
        { success: false, error: 'Failed to upload document' },
        { status: 500 }
      );
    }

    logger.info('Phone activation document uploaded', {
      operation: 'phone_activation_upload',
      partnerId,
      documentType,
      path: storagePath,
    });

    return NextResponse.json({
      success: true,
      data: {
        url: storagePath,
        name: file.name,
        size: file.size,
        mimeType: file.type,
        type: documentType,
      },
    });
  } catch (error) {
    logger.error('Phone activation upload failed', error as Error, {
      operation: 'phone_activation_upload',
    });
    return NextResponse.json(
      { success: false, error: 'Failed to upload document' },
      { status: 500 }
    );
  }
}

