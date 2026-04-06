import { NextRequest, NextResponse } from 'next/server';
import { verifyWhitelabelAuth } from '@/lib/whitelabelAuth';
import { prisma } from '@/lib/prisma';
import { uploadFile, getFileUrl } from '@/lib/supabase';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_FILE_TYPES = [
  'application/pdf',
  'image/jpeg',
  'image/jpg',
  'image/png',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
];

const uploadSchema = z.object({
  phoneNumberId: z.string().uuid(),
  documentType: z.enum(['business_proof', 'address_proof', 'identity_proof', 'authorization_letter']),
  documentName: z.string(),
});

export async function POST(req: NextRequest) {
  try {
    // Authenticate the request
    const authResult = await verifyWhitelabelAuth(req);
    if (!authResult || !authResult.customerId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { customerId, partnerId } = authResult;

    // Parse form data
    const formData = await req.formData();
    const file = formData.get('file');
    const phoneNumberId = formData.get('phoneNumberId') as string;
    const documentType = formData.get('documentType') as string;
    const documentName = formData.get('documentName') as string;

    if (!file || typeof file === 'string') {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      );
    }

    const fileObj = file as File;

    // Validate metadata
    const validationResult = uploadSchema.safeParse({
      phoneNumberId,
      documentType,
      documentName,
    });

    if (!validationResult.success) {
      return NextResponse.json(
        { error: 'Invalid request data', details: validationResult.error.errors },
        { status: 400 }
      );
    }

    const metadata = validationResult.data;

    // Validate file size
    if (fileObj.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: 'File too large', maxSize: MAX_FILE_SIZE },
        { status: 400 }
      );
    }

    // Validate file type
    if (!ALLOWED_FILE_TYPES.includes(fileObj.type)) {
      return NextResponse.json(
        { error: 'Invalid file type', allowedTypes: ALLOWED_FILE_TYPES },
        { status: 400 }
      );
    }

    // Verify phone number ownership
    const phoneNumber = await prisma.phoneNumber.findFirst({
      where: {
        id: metadata.phoneNumberId,
        customerId,
      },
    });

    if (!phoneNumber) {
      return NextResponse.json(
        { error: 'Phone number not found or access denied' },
        { status: 404 }
      );
    }

    // Generate file path
    const timestamp = Date.now();
    const fileExtension = fileObj.name.split('.').pop();
    const fileName = `${metadata.documentType}_${timestamp}.${fileExtension}`;
    const filePath = `regulatory/${phoneNumber.phoneNumber}/${fileName}`;

    // Upload to Supabase storage
    const { data: uploadData, error: uploadError } = await uploadFile(
      fileObj,
      filePath,
      customerId,
      partnerId
    );

    if (uploadError || !uploadData) {
      console.error('Supabase upload error:', uploadError);
      return NextResponse.json(
        { error: 'Failed to upload document' },
        { status: 500 }
      );
    }

    // Get the public URL for the uploaded file
    const url = await getFileUrl(partnerId, customerId, filePath);
    
    if (!url) {
      console.error('Failed to get file URL');
      return NextResponse.json(
        { error: 'Failed to get file URL' },
        { status: 500 }
      );
    }

    // Create regulatory document record
    const document = await prisma.regulatoryDocument.create({
      data: {
        phoneNumberId: metadata.phoneNumberId,
        customerId,
        partnerId,
        documentType: metadata.documentType,
        documentName: metadata.documentName,
        fileUrl: url,
        fileSize: fileObj.size,
        mimeType: fileObj.type,
        status: 'pending',
      },
      include: {
        phoneNumber: {
          select: {
            phoneNumber: true,
            friendlyName: true,
          },
        },
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        document: {
          id: document.id,
          documentType: document.documentType,
          documentName: document.documentName,
          fileUrl: document.fileUrl,
          fileSize: document.fileSize,
          mimeType: document.mimeType,
          status: document.status,
          phoneNumber: document.phoneNumber,
          createdAt: document.createdAt,
        },
      },
    });

  } catch (error) {
    console.error('Document upload error:', error);
    return NextResponse.json(
      { error: 'Failed to upload document', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}