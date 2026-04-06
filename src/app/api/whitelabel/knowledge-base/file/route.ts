import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyOnboardingAuth } from '@/lib/onboardingAuth';
import { uploadFile } from '@/lib/supabase';
import { anythingLLMService, ensureAnythingLLMWorkspace } from '@/lib/anythingLLMService';
import FileValidationService from '@/lib/services/fileValidationService';
import PartnerStorageService from '@/lib/services/partnerStorageService';
import { logger } from '@/lib/logger';

// Mark this route as dynamic
export const dynamic = 'force-dynamic';

/**
 * Helper function to check if auto-embedding is enabled for a customer
 */
async function isAutoEmbeddingEnabled(customerId: string, partnerId: string): Promise<boolean> {
  // Get customer email first
  const customer = await prisma.customer.findUnique({
    where: { id: customerId },
    select: { email: true },
  });

  if (!customer?.email) {
    return false;
  }

  // Check UserOnboarding for autoEmbeddingEnabled flag
  const userOnboarding = await prisma.userOnboarding.findFirst({
    where: {
      email: customer.email,
      partnerId,
    },
    select: {
      autoEmbeddingEnabled: true,
    },
  });

  // Default to true for AI receptionist use case - auto-embed KB content by default
  return userOnboarding?.autoEmbeddingEnabled ?? true;
}

// POST /api/whitelabel/knowledge-base/file
// Upload a file to a knowledge base
export async function POST(request: NextRequest) {
  try {
    // Verify authentication (supports both prospect and customer tokens for onboarding)
    const authResult = await verifyOnboardingAuth(request);
    if (!authResult) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { customerId, partnerId } = authResult;

    // Parse form data
    const formData = await request.formData();
    const file = formData.get('file');
    const knowledgeBaseId = formData.get('knowledgeBaseId') as string;
    const folderId = formData.get('folderId') as string || null;
    const description = formData.get('description') as string || '';

    if (!file || typeof file === 'string' || !knowledgeBaseId) {
      return NextResponse.json(
        { error: 'File and knowledge base ID are required' },
        { status: 400 }
      );
    }

    // Cast to File after validation
    const fileObj = file as File;

    // Validate file format
    const validation = FileValidationService.validateFile(fileObj);
    if (!validation.isValid) {
      return NextResponse.json(
        { error: validation.error },
        { status: 400 }
      );
    }

    // Check partner storage quota
    const storageCheck = await PartnerStorageService.checkStorageAvailability(partnerId, fileObj.size);
    if (!storageCheck.hasSpace) {
      return NextResponse.json(
        {
          error: `Insufficient storage space. Required: ${storageCheck.requiredMB.toFixed(2)} MB, Available: ${storageCheck.availableMB.toFixed(2)} MB`,
          code: 'STORAGE_QUOTA_EXCEEDED',
          details: {
            requiredMB: storageCheck.requiredMB,
            availableMB: storageCheck.availableMB,
            quota: storageCheck.quota
          }
        },
        { status: 413 } // Payload Too Large
      );
    }

    // Verify the knowledge base belongs to the customer (include AnythingLLM fields)
    const knowledgeBase = await prisma.knowledgeBase.findFirst({
      where: {
        id: knowledgeBaseId,
        customerId,
        partnerId,
      },
      select: {
        id: true,
        name: true,
        anythingLLMWorkspaceSlug: true,
        anythingLLMWorkspaceId: true,
      },
    });

    if (!knowledgeBase) {
      return NextResponse.json(
        { error: 'Knowledge base not found' },
        { status: 404 }
      );
    }

    // If folderId is provided, verify it belongs to the knowledge base
    if (folderId) {
      const folder = await prisma.knowledgeBaseFolder.findFirst({
        where: {
          id: folderId,
          knowledgeBaseId,
        },
      });

      if (!folder) {
        return NextResponse.json(
          { error: 'Folder not found' },
          { status: 404 }
        );
      }
    }

    // Check if auto-embedding is enabled for this customer
    const autoEmbedding = await isAutoEmbeddingEnabled(customerId, partnerId);

    // Create a unique storage path
    const timestamp = Date.now();
    const fileExtension = fileObj.name.split('.').pop();
    const fileName = `${fileObj.name.split('.')[0]}-${timestamp}.${fileExtension}`;
    const storagePath = `${knowledgeBaseId}/${fileName}`;

    logger.info('Uploading file:', {
      fileName,
      fileSize: fileObj.size,
      fileType: fileObj.type,
      customerId,
      partnerId,
      knowledgeBaseId,
      storagePath,
      autoEmbeddingEnabled: autoEmbedding,
    });

    // Upload to Supabase storage
    const { error } = await uploadFile(
      fileObj,
      storagePath,
      customerId,
      partnerId
    );

    if (error) {
      logger.error('Supabase storage error:', error, {
        operation: 'file_upload',
        customerId,
        partnerId,
        knowledgeBaseId,
      });
      return NextResponse.json(
        { error: `Failed to upload file to storage: ${error.message}` },
        { status: 500 }
      );
    }

    // Create a new file record in the database
    const fileRecord = await prisma.knowledgeBaseFile.create({
      data: {
        name: fileObj.name,
        description,
        fileType: fileObj.type,
        fileSize: fileObj.size,
        storageKey: storagePath, // This is the path within the knowledge base folder
        bucketName: 'files', // Use the default bucket name
        folderId: folderId || null,
        knowledgeBaseId,
        customerId,
        partnerId,
        embeddingStatus: autoEmbedding ? 'pending' : 'legacy', // Set based on auto-embedding flag
      },
    });

    logger.info('File record created', {
      operation: 'file_upload',
      fileId: fileRecord.id,
      fileName: fileRecord.name,
      autoEmbeddingEnabled: autoEmbedding,
    });

    // If auto-embedding is enabled, upload to AnythingLLM
    let anythingLLMResult = null;
    if (autoEmbedding) {
      try {
        // Ensure workspace exists (uses shared function with race condition protection)
        const workspaceSlug = await ensureAnythingLLMWorkspace(
          prisma,
          knowledgeBaseId,
          customerId,
          partnerId
        );

        if (workspaceSlug) {
          // Upload file to AnythingLLM
          const allMResult = await anythingLLMService.uploadDocument(
            fileObj,
            fileObj.name,
            workspaceSlug
          );

          // Update file record with AnythingLLM data
          if (allMResult.success && allMResult.documents?.[0]) {
            const doc = allMResult.documents[0];
            await prisma.knowledgeBaseFile.update({
              where: { id: fileRecord.id },
              data: {
                anythingLLMDocumentId: doc.id,
                anythingLLMDocumentLocation: doc.location,
                anythingLLMProcessedAt: new Date(),
                embeddingStatus: 'completed',
              },
            });

            anythingLLMResult = {
              documentId: doc.id,
              location: doc.location,
              workspaceSlug,
            };

            logger.info('File uploaded to AnythingLLM successfully', {
              operation: 'anythingllm_upload',
              fileId: fileRecord.id,
              documentId: doc.id,
              documentLocation: doc.location,
            });
          }
        }
      } catch (anythingLLMError) {
        // Log the error but don't fail the upload - file is already in storage
        logger.error('AnythingLLM upload failed', anythingLLMError as Error, {
          operation: 'anythingllm_upload',
          fileId: fileRecord.id,
          knowledgeBaseId,
        });

        // Update embedding status to failed
        await prisma.knowledgeBaseFile.update({
          where: { id: fileRecord.id },
          data: {
            embeddingStatus: 'failed',
            embeddingError: (anythingLLMError as Error).message,
          },
        });
      }
    }

    // Update partner storage usage
    await PartnerStorageService.recalculateStorageUsage(partnerId);

    return NextResponse.json({
      file: fileRecord,
      anythingLLM: anythingLLMResult,
    }, { status: 201 });
  } catch (error) {
    logger.error('Error uploading file:', error as Error, {
      operation: 'file_upload',
    });
    return NextResponse.json(
      { error: 'Failed to upload file' },
      { status: 500 }
    );
  }
}

// GET /api/whitelabel/knowledge-base/file?id=xxx
// Get a file by ID
export async function GET(request: NextRequest) {
  try {
    // Verify authentication (supports both prospect and customer tokens for onboarding)
    const authResult = await verifyOnboardingAuth(request);
    if (!authResult) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { customerId, partnerId } = authResult;

    // Get query parameters
    const url = new URL(request.url);
    const fileId = url.searchParams.get('id');

    if (!fileId) {
      return NextResponse.json(
        { error: 'File ID is required' },
        { status: 400 }
      );
    }

    // Get the file
    const file = await prisma.knowledgeBaseFile.findFirst({
      where: {
        id: fileId,
        customerId,
        partnerId,
      },
    });

    if (!file) {
      return NextResponse.json(
        { error: 'File not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ file });
  } catch (error) {
    logger.error('Error fetching file', error instanceof Error ? error : undefined, { operation: 'GET_KNOWLEDGE_BASE_FILE' });
    return NextResponse.json(
      { error: 'Failed to fetch file' },
      { status: 500 }
    );
  }
}
