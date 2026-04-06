import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyWhitelabelAuth } from '@/lib/whitelabelAuth';
import { embeddingService } from '@/lib/embeddingService';

// Mark this route as dynamic
export const dynamic = 'force-dynamic';

// GET /api/whitelabel/knowledge-base/[id]/status
// Get processing status for a knowledge base
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Verify authentication
    const authResult = await verifyWhitelabelAuth(request);
    if (!authResult) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { customerId, partnerId } = authResult;
    const kbId = params.id;

    // Verify the knowledge base belongs to the customer
    const knowledgeBase = await prisma.knowledgeBase.findFirst({
      where: {
        id: kbId,
        customerId,
        partnerId,
      },
    });

    if (!knowledgeBase) {
      return NextResponse.json(
        { error: 'Knowledge base not found' },
        { status: 404 }
      );
    }

    // Get local file status from database
    const localFiles = await prisma.knowledgeBaseFile.findMany({
      where: { 
        knowledgeBaseId: kbId,
        customerId,
        partnerId 
      },
      select: {
        id: true,
        name: true,
        embeddingStatus: true,
        vectorCount: true,
        processingCost: true,
        processedAt: true,
        embeddingError: true,
        fileSize: true,
        createdAt: true,
      },
    });

    // Calculate local statistics
    const localStats = {
      totalFiles: localFiles.length,
      processed: localFiles.filter(f => f.embeddingStatus === 'completed').length,
      processing: localFiles.filter(f => f.embeddingStatus === 'processing').length,
      failed: localFiles.filter(f => f.embeddingStatus === 'failed').length,
      pending: localFiles.filter(f => f.embeddingStatus === 'pending').length,
      legacy: localFiles.filter(f => f.embeddingStatus === 'legacy').length,
      totalVectors: localFiles.reduce((sum, f) => sum + (f.vectorCount || 0), 0),
      totalCost: localFiles.reduce((sum, f) => sum + Number(f.processingCost || 0), 0),
      totalSize: localFiles.reduce((sum, f) => sum + f.fileSize, 0),
    };

    let embeddingServiceStats = null;
    
    // Try to get status from embedding service
    try {
      const embeddingStatus = await embeddingService.getProcessingStatus(
        kbId,
        partnerId,
        customerId
      );

      if (embeddingStatus.status === 'success' && embeddingStatus.data) {
        embeddingServiceStats = embeddingStatus.data;
      }
    } catch (embeddingError) {
      console.warn('Failed to get embedding service status:', embeddingError);
      // Continue with local data only
    }

    // Combine local and embedding service data
    const response = {
      knowledgeBase: {
        id: knowledgeBase.id,
        name: knowledgeBase.name,
        description: knowledgeBase.description,
        qdrantCollectionName: knowledgeBase.qdrantCollectionName,
        embeddingConfig: knowledgeBase.embeddingConfig,
        createdAt: knowledgeBase.createdAt,
        updatedAt: knowledgeBase.updatedAt,
      },
      localStats,
      embeddingServiceStats,
      files: localFiles.map(file => ({
        id: file.id,
        name: file.name,
        embeddingStatus: file.embeddingStatus,
        vectorCount: file.vectorCount,
        processingCost: file.processingCost,
        processedAt: file.processedAt,
        embeddingError: file.embeddingError,
        fileSize: file.fileSize,
        createdAt: file.createdAt,
        statusIcon: getStatusIcon(file.embeddingStatus),
        statusText: getStatusText(file.embeddingStatus),
      })),
      summary: {
        isEmbeddingServiceEnabled: embeddingServiceStats !== null,
        migrationNeeded: localStats.legacy > 0,
        processingActive: localStats.processing > 0,
        hasErrors: localStats.failed > 0,
        completionPercentage: localStats.totalFiles > 0 
          ? Math.round((localStats.processed / localStats.totalFiles) * 100) 
          : 0,
      }
    };

    return NextResponse.json(response);

  } catch (error) {
    console.error('Error getting knowledge base status:', error);
    return NextResponse.json(
      { error: 'Failed to get knowledge base status' },
      { status: 500 }
    );
  }
}

function getStatusIcon(status: string | null): string {
  switch (status) {
    case 'completed':
      return '✅';
    case 'processing':
      return '⏳';
    case 'pending':
      return '📤';
    case 'failed':
      return '❌';
    case 'legacy':
      return '📁';
    default:
      return '❓';
  }
}

function getStatusText(status: string | null): string {
  switch (status) {
    case 'completed':
      return 'Processed';
    case 'processing':
      return 'Processing...';
    case 'pending':
      return 'Pending';
    case 'failed':
      return 'Failed';
    case 'legacy':
      return 'Legacy (needs migration)';
    default:
      return 'Unknown';
  }
}
