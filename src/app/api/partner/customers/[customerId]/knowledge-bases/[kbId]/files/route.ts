import { NextRequest, NextResponse } from 'next/server';
import { verifyPartnerAuth } from '@/lib/auth/partnerAuth';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

/**
 * GET /api/partner/customers/[customerId]/knowledge-bases/[kbId]/files
 * Get all files from a specific knowledge base (for partner use in agent creation)
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { customerId: string; kbId: string } }
) {
  try {
    // Verify partner authentication
    const authResult = await verifyPartnerAuth(request);
    if (!authResult) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const partnerId = authResult.id;
    const { customerId, kbId } = params;

    if (!customerId || !kbId) {
      return NextResponse.json(
        { success: false, error: 'Customer ID and Knowledge Base ID are required' },
        { status: 400 }
      );
    }

    // Since we now pass the actual Customer ID directly, verify it exists and belongs to this partner
    const customer = await prisma.customer.findFirst({
      where: {
        id: customerId,
      },
      include: {
        userOnboarding: {
          where: {
            partnerId: partnerId,
          },
        },
      },
    });

    if (!customer || customer.userOnboarding.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Customer not found or access denied' },
        { status: 404 }
      );
    }

    // Use the customerId directly since it's already the actual Customer ID
    const actualCustomerId = customerId;

    const knowledgeBase = await prisma.knowledgeBase.findFirst({
      where: {
        id: kbId,
        customerId: actualCustomerId,
        partnerId,
      },
    });

    if (!knowledgeBase) {
      return NextResponse.json(
        { success: false, error: 'Knowledge base not found or access denied' },
        { status: 404 }
      );
    }

    // Get query parameters for filtering
    const url = new URL(request.url);
    const includeProcessing = url.searchParams.get('includeProcessing') === 'true';
    const onlyReady = url.searchParams.get('onlyReady') === 'true';
    const folderId = url.searchParams.get('folderId');

    // Build where clause for files
    // We need to handle both Customer ID and UserOnboarding ID scenarios
    // since files might have been created with either ID format
    const userOnboarding = customer.userOnboarding[0];
    const possibleCustomerIds = [customerId]; // Start with actual Customer ID
    if (userOnboarding?.id && userOnboarding.id !== customerId) {
      possibleCustomerIds.push(userOnboarding.id); // Add UserOnboarding ID as fallback
    }

    console.log('[files/route] Request params:', {
      customerId,
      kbId,
      folderId,
      includeProcessing,
      onlyReady,
      userOnboardingId: userOnboarding?.id,
      possibleCustomerIds
    });

    const whereClause: any = {
      knowledgeBaseId: kbId,
      customerId: { in: possibleCustomerIds }, // Support both ID formats
    };

    // Filter by folder (including null for root folder)
    whereClause.folderId = folderId || null;

    // Filter by processing status
    if (onlyReady) {
      whereClause.embeddingStatus = 'completed';
    } else if (!includeProcessing) {
      whereClause.embeddingStatus = {
        in: ['completed', 'pending', 'failed', 'legacy'], // Include legacy files
      };
    }

    // Get files with folder information
    const files = await prisma.knowledgeBaseFile.findMany({
      where: whereClause,
      include: {
        folder: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: [
        { folder: { name: 'asc' } },
        { name: 'asc' },
      ],
    });

    // Get folders for navigation
    const folders = await prisma.knowledgeBaseFolder.findMany({
      where: {
        knowledgeBaseId: kbId,
        parentFolderId: folderId || null,
      },
      include: {
        _count: {
          select: {
            files: true,
            childFolders: true,
          },
        },
      },
      orderBy: {
        name: 'asc',
      },
    });

    // Format files for response
    const formattedFiles = files.map(file => ({
      id: file.id,
      name: file.name,
      description: file.description,
      fileType: file.fileType,
      fileSize: file.fileSize,
      embeddingStatus: file.embeddingStatus,
      processedAt: file.processedAt,
      createdAt: file.createdAt,
      updatedAt: file.updatedAt,
      folder: file.folder ? {
        id: file.folder.id,
        name: file.folder.name,
      } : null,
      // Include storage keys for file access
      storageKey: file.storageKey,
      r2StorageKey: file.r2StorageKey,
      bucketName: file.bucketName,
    }));

    // Format folders for response
    const formattedFolders = folders.map(folder => ({
      id: folder.id,
      name: folder.name,
      description: folder.description,
      fileCount: (folder as any)._count?.files || 0,
      folderCount: (folder as any)._count?.childFolders || 0,
      createdAt: folder.createdAt,
      updatedAt: folder.updatedAt,
    }));

    // Calculate statistics
    const stats = {
      totalFiles: files.length,
      totalFolders: folders.length,
      totalSize: files.reduce((sum, file) => sum + (file.fileSize || 0), 0),
      readyFiles: files.filter(f => f.embeddingStatus === 'completed').length,
      processingFiles: files.filter(f => f.embeddingStatus === 'processing').length,
      pendingFiles: files.filter(f => f.embeddingStatus === 'pending').length,
      failedFiles: files.filter(f => f.embeddingStatus === 'failed').length,
    };

    console.log('[files/route] Query results:', {
      filesFound: files.length,
      foldersFound: folders.length,
      whereClause,
      folderQuery: { knowledgeBaseId: kbId, parentFolderId: folderId || null }
    });

    return NextResponse.json({
      success: true,
      data: {
        knowledgeBase: {
          id: knowledgeBase.id,
          name: knowledgeBase.name,
          description: knowledgeBase.description,
        },
        customer: {
          id: customer.id,
          firstName: customer.firstName,
          lastName: customer.lastName,
          companyName: customer.userOnboarding[0]?.companyName || null,
        },
        currentFolder: folderId ? {
          id: folderId,
        } : null,
        folders: formattedFolders,
        files: formattedFiles,
        stats,
      },
    });

  } catch (error) {
    console.error('Error fetching knowledge base files:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      },
      { status: 500 }
    );
  }
}
