import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

// Schema for document upload
const uploadSchema = z.object({
  phoneNumberId: z.string(),
  documentType: z.enum(['business_proof', 'address_proof', 'identity_proof', 'authorization_letter']),
  documentName: z.string(),
});

export async function POST(
  req: NextRequest,
  { params }: { params: { customerId: string; phoneNumberId: string } }
) {
  try {
    // Partner authentication is handled by middleware
    // Extract partner ID from JWT token in Authorization header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Unauthorized - No token provided' },
        { status: 401 }
      );
    }

    const token = authHeader.split(' ')[1];
    
    // Decode JWT to get partner ID (middleware already verified the token)
    let partnerId: string;
    try {
      const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString());
      partnerId = payload.partnerId; // JWT always uses partnerId field

      if (!partnerId) {
        throw new Error('Partner ID not found in token');
      }
    } catch (error) {
      return NextResponse.json(
        { error: 'Invalid token format' },
        { status: 401 }
      );
    }

    const { customerId, phoneNumberId } = params;

    // Search userOnboarding table first (like other partner APIs)
    const userOnboarding = await prisma.userOnboarding.findFirst({
      where: {
        customerId: customerId,
        partnerId: partnerId,
      },
      include: {
        customer: true,
      },
    });

    if (!userOnboarding || !userOnboarding.customer) {
      return NextResponse.json(
        { error: 'Customer not found or access denied' },
        { status: 404 }
      );
    }

    const customer = userOnboarding.customer;

    if (!customer) {
      return NextResponse.json(
        { error: 'Customer not found or access denied' },
        { status: 404 }
      );
    }

    // Verify the phone number belongs to this customer
    const phoneNumber = await prisma.phoneNumber.findFirst({
      where: {
        id: phoneNumberId,
        customerId: customerId,
        partnerId: partnerId,
      },
    });

    if (!phoneNumber) {
      return NextResponse.json(
        { error: 'Phone number not found or access denied' },
        { status: 404 }
      );
    }

    // Parse form data
    const formData = await req.formData();
    const file = formData.get('file');
    const documentType = formData.get('documentType') as string;
    const documentName = formData.get('documentName') as string;

    if (!file || typeof file === 'string') {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      );
    }

    const fileObj = file as File;

    // Validate form data
    const validationResult = uploadSchema.safeParse({
      phoneNumberId,
      documentType,
      documentName,
    });

    if (!validationResult.success) {
      return NextResponse.json(
        { error: 'Invalid form data', details: validationResult.error.errors },
        { status: 400 }
      );
    }

    // File validation
    const maxSize = 10 * 1024 * 1024; // 10MB
    if (fileObj.size > maxSize) {
      return NextResponse.json(
        { error: 'File size too large. Maximum size is 10MB.' },
        { status: 400 }
      );
    }

    const allowedTypes = [
      'application/pdf',
      'image/jpeg',
      'image/jpg',
      'image/png',
      'image/gif',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ];

    if (!allowedTypes.includes(fileObj.type)) {
      return NextResponse.json(
        { error: 'Invalid file type. Allowed types: PDF, JPEG, PNG, GIF, DOC, DOCX' },
        { status: 400 }
      );
    }

    console.log(`Partner ${partnerId} uploading document for customer ${customerId}, phone number ${phoneNumberId}`);

    // Convert file to buffer for storage
    const bytes = await fileObj.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // For now, we'll store the file as base64 in the database
    // In production, you'd want to upload to Supabase Storage or similar
    const fileBase64 = buffer.toString('base64');
    const fileUrl = `data:${fileObj.type};base64,${fileBase64}`;

    // Create document record
    const document = await prisma.regulatoryDocument.create({
      data: {
        phoneNumberId: phoneNumberId,
        customerId: customerId,
        partnerId: partnerId,
        documentType: documentType as any,
        documentName: documentName,
        fileUrl: fileUrl, // In production, this would be a Supabase Storage URL
        fileSize: fileObj.size,
        mimeType: fileObj.type,
        status: 'pending',
        // Note: partnerId field already tracks who uploaded this
      },
    });

    console.log('Document uploaded successfully:', document.id);

    return NextResponse.json({
      success: true,
      data: {
        id: document.id,
        documentType: document.documentType,
        documentName: document.documentName,
        status: document.status,
        fileSize: document.fileSize,
        mimeType: document.mimeType,
        uploadedAt: document.createdAt,
        uploadedBy: 'partner',
      },
      message: 'Document uploaded successfully. It will be reviewed for compliance.',
    });

  } catch (error: any) {
    console.error('Partner document upload error:', error);

    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    return NextResponse.json(
      { 
        success: false,
        error: 'Failed to upload document',
        message: 'Something went wrong while uploading the document. Please try again later.',
        details: process.env.NODE_ENV === 'development' ? errorMessage : undefined
      },
      { status: 500 }
    );
  }
}
