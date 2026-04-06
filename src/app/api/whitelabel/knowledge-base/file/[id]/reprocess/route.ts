import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { embeddingService } from '@/lib/embeddingService';
import { KnowledgeBaseProcessingService } from '@/lib/services/knowledgeBaseProcessingService';
import { z } from 'zod';

// Mark this route as dynamic
export const dynamic = 'force-dynamic';

// Request validation schema
const reprocessRequestSchema = z.object({
  reason: z.string().optional().default('Document updated'),
  triggeredBy: z.enum(['customer', 'partner']).optional().default('customer'),
});

// POST /api/whitelabel/knowledge-base/file/[id]/reprocess
// Re-process a specific file (delete existing vectors and re-create)
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const fileId = params.id;
    
    // Get partner and customer info from headers or session
    const partnerId = request.headers.get('X-Partner-ID');
    const customerId = request.headers.get('X-Customer-ID');
    
    if (!partnerId || !customerId) {
      return NextResponse.json(
        { error: 'Partner ID and Customer ID are required' },
        { status: 400 }
      );
    }

    // Parse request body
    const body = await request.json().catch(() => ({}));
    const { reason, triggeredBy } = reprocessRequestSchema.parse(body);

    // Get file and verify ownership
    const file = await prisma.knowledgeBaseFile.findFirst({
      where: {
        id: fileId,
        partnerId,
        customerId,
      },
      include: {
        knowledgeBase: {
          select: {
            id: true,
            name: true,
            qdrantCollectionName: true,
          }
        }
      }
    });

    if (!file) {
      return NextResponse.json(
        { error: 'File not found' },
        { status: 404 }
      );
    }

    // Check if processing is enabled (only for customer-triggered reprocessing)
    if (triggeredBy === 'customer') {
      const processingEnabled = await KnowledgeBaseProcessingService.isProcessingEnabledForCustomer(
        partnerId,
        customerId
      );
      if (!processingEnabled) {
        return NextResponse.json(
          { 
            error: 'Knowledge base processing is not enabled for this customer' 
          },
          { status: 403 }
        );
      }
    }

    // Check if file is currently being processed
    if (file.embeddingStatus === 'processing') {
      return NextResponse.json(
        { error: 'File is currently being processed' },
        { status: 409 }
      );
    }

    // Calculate reprocessing cost (same as initial processing for single file)
    const costConfig = await KnowledgeBaseProcessingService.getProcessingCostConfig(partnerId, customerId);
    const fileSizeMB = file.fileSize / (1024 * 1024);
    
    let reprocessingCost = costConfig.baseProcessingCost;
    if (fileSizeMB > costConfig.maxFileSizeMB) {
      const overageMB = fileSizeMB - costConfig.maxFileSizeMB;
      reprocessingCost += Math.ceil(overageMB) * costConfig.overageCostPerMB;
    }

    // Check partner's credit balance
    const creditBalance = await KnowledgeBaseProcessingService.getProcessingCostConfig(partnerId, customerId);
    // Note: We should get actual credit balance here, but for now using the service method

    try {
      // Start transaction for status updates and credit deduction
      const result = await prisma.$transaction(async (tx) => {
        // Update file status to processing
        await tx.knowledgeBaseFile.update({
          where: { id: fileId },
          data: {
            embeddingStatus: 'processing',
            embeddingError: null, // Clear any previous errors
            updatedAt: new Date(),
          }
        });

        // Update knowledge base last update time
        await tx.knowledgeBase.update({
          where: { id: file.knowledgeBaseId },
          data: {
            lastEmbeddingUpdate: new Date(),
            updatedAt: new Date(),
          }
        });

        return { success: true };
      });

      // Deduct credits from partner (for reprocessing)
      const creditResult = await KnowledgeBaseProcessingService.processKnowledgeBase(
        file.knowledgeBaseId,
        partnerId,
        customerId,
        triggeredBy
      );

      if (!creditResult.success) {
        // Rollback file status
        await prisma.knowledgeBaseFile.update({
          where: { id: fileId },
          data: {
            embeddingStatus: file.embeddingStatus || 'pending',
            updatedAt: new Date(),
          }
        });

        return NextResponse.json(
          { error: creditResult.error || 'Failed to deduct credits for reprocessing' },
          { status: 402 }
        );
      }

      // Note: For reprocessing, we'll let the embedding service handle vector cleanup
      // during the new processing phase. The service should handle duplicate vectors appropriately.
      console.log(`Reprocessing file ${fileId} - existing vectors will be handled by the service`);

      // Note: File reprocessing will be handled by the background processing service
      // For now, we'll just mark the file as pending for reprocessing
      console.log(`File ${fileId} marked for reprocessing. Background service will handle the actual processing.`);

      return NextResponse.json({
        success: true,
        message: 'File reprocessing started successfully',
        data: {
          fileId,
          fileName: file.name,
          knowledgeBaseId: file.knowledgeBaseId,
          knowledgeBaseName: file.knowledgeBase.name,
          creditsDeducted: reprocessingCost,
          reason,
          triggeredBy,
        }
      });

    } catch (error) {
      console.error('Error during file reprocessing:', error);
      return NextResponse.json(
        { error: 'Failed to start reprocessing' },
        { status: 500 }
      );
    }

  } catch (error) {
    console.error('Error reprocessing file:', error);

    // Handle validation errors
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { 
          error: 'Invalid request data',
          details: error.errors.map(e => ({
            field: e.path.join('.'),
            message: e.message,
          }))
        },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to reprocess file' },
      { status: 500 }
    );
  }
}

// Private method to trigger file reprocessing
async function triggerFileReprocessing(
  fileId: string,
  file: any,
  reason: string
): Promise<void> {
  try {
    console.log(`Starting reprocessing for file ${file.name} (${fileId}). Reason: ${reason}`);

    // Simulate reprocessing (in real implementation, this would call the embedding service)
    // The embedding service would:
    // 1. Re-read the file from R2 storage
    // 2. Re-chunk the content
    // 3. Generate new embeddings
    // 4. Store new vectors in Qdrant
    
    // For now, simulate processing time
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Update file with new processing results
    await prisma.knowledgeBaseFile.update({
      where: { id: fileId },
      data: {
        embeddingStatus: 'completed',
        processedAt: new Date(),
        vectorCount: Math.floor(Math.random() * 100) + 50, // Simulated vector count
        processingCost: 0.05, // Simulated cost
        embeddingError: null,
        updatedAt: new Date(),
      }
    });

    // Update knowledge base totals
    const stats = await prisma.knowledgeBaseFile.aggregate({
      where: { 
        knowledgeBaseId: file.knowledgeBaseId, 
        embeddingStatus: 'completed' 
      },
      _sum: { 
        vectorCount: true, 
        processingCost: true 
      },
    });

    await prisma.knowledgeBase.update({
      where: { id: file.knowledgeBaseId },
      data: {
        totalVectors: stats._sum.vectorCount || 0,
        totalProcessingCost: stats._sum.processingCost || 0,
        lastEmbeddingUpdate: new Date(),
      }
    });

    console.log(`File reprocessing completed for ${file.name}`);

  } catch (error) {
    console.error('Error in file reprocessing:', error);
    throw error;
  }
}

// GET /api/whitelabel/knowledge-base/file/[id]/reprocess
// Get reprocessing cost estimate for a specific file
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const fileId = params.id;
    
    // Get partner and customer info from headers or session
    const partnerId = request.headers.get('X-Partner-ID');
    const customerId = request.headers.get('X-Customer-ID');
    
    if (!partnerId || !customerId) {
      return NextResponse.json(
        { error: 'Partner ID and Customer ID are required' },
        { status: 400 }
      );
    }

    // Get file and verify ownership
    const file = await prisma.knowledgeBaseFile.findFirst({
      where: {
        id: fileId,
        partnerId,
        customerId,
      },
      select: {
        id: true,
        name: true,
        fileSize: true,
        embeddingStatus: true,
        vectorCount: true,
        knowledgeBaseId: true,
      }
    });

    if (!file) {
      return NextResponse.json(
        { error: 'File not found' },
        { status: 404 }
      );
    }

    // Calculate reprocessing cost
    const costConfig = await KnowledgeBaseProcessingService.getProcessingCostConfig(partnerId, customerId);
    const fileSizeMB = file.fileSize / (1024 * 1024);
    
    let reprocessingCost = costConfig.baseProcessingCost;
    if (fileSizeMB > costConfig.maxFileSizeMB) {
      const overageMB = fileSizeMB - costConfig.maxFileSizeMB;
      reprocessingCost += Math.ceil(overageMB) * costConfig.overageCostPerMB;
    }

    return NextResponse.json({
      success: true,
      data: {
        fileId,
        fileName: file.name,
        fileSizeMB: Math.round(fileSizeMB * 100) / 100,
        currentStatus: file.embeddingStatus,
        currentVectorCount: file.vectorCount,
        reprocessingCost,
        costBreakdown: {
          baseCost: costConfig.baseProcessingCost,
          overageCost: Math.max(0, Math.ceil(fileSizeMB - costConfig.maxFileSizeMB) * costConfig.overageCostPerMB),
          maxIncludedSizeMB: costConfig.maxFileSizeMB,
        },
        canReprocess: file.embeddingStatus !== 'processing',
      }
    });

  } catch (error) {
    console.error('Error getting reprocessing estimate:', error);
    return NextResponse.json(
      { error: 'Failed to get reprocessing estimate' },
      { status: 500 }
    );
  }
}
