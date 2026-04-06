// src/lib/services/knowledgeBaseProcessingService.ts
// Service for handling knowledge base processing, credit deduction, and cost management

/**
 * IMPORTANT: Knowledge Base Processing Status
 *
 * Current Implementation Status:
 * - ✅ File upload and storage (Supabase/R2)
 * - ✅ Database schema and relationships
 * - ✅ Cost calculation logic
 * - ✅ Credit balance checking
 * - ❌ Actual document processing (MOCKED)
 * - ❌ Embedding generation (EXTERNAL SERVICE NOT BUILT)
 * - ❌ Vector search (REQUIRES EMBEDDINGS)
 *
 * Credit System Issue:
 * - Currently checks partner.creditBalance for processing
 * - UI shows customer.creditBalance (creates UX confusion)
 * - Customer sees 2078 credits but gets "insufficient credits" error
 * - Need to resolve: use partner credits OR customer credits consistently
 *
 * TODO for Full Implementation:
 * 1. Build external embedding service (Python FastAPI)
 * 2. Implement actual document processing pipeline
 * 3. Connect to LlamaParse API for document parsing
 * 4. Generate embeddings using OpenAI text-embedding-3-small
 * 5. Store vectors in Qdrant database
 * 6. Enable actual credit deduction for real processing
 * 7. Resolve partner vs customer credit balance discrepancy
 *
 * Current Behavior:
 * - Files are uploaded and stored successfully
 * - Processing is mocked (updates status to 'completed' with fake data)
 * - No actual embeddings are generated
 * - Search functionality returns empty results
 * - Credits are not deducted (processing is disabled in UI)
 */

import { prisma } from '@/lib/prisma';
import { CreditService } from './creditService';
import { embeddingService } from '@/lib/embeddingService';
import { logger } from '@/lib/logger';

export interface ProcessingCostConfig {
  baseProcessingCost: number; // Cost in credits (default 50)
  maxFileSizeMB: number; // Max file size for base cost (default 10MB)
  overageCostPerMB: number; // Additional cost per MB over limit
  partnerCustomCost?: number; // Partner-specific cost override
}

export interface ProcessingResult {
  success: boolean;
  creditsDeducted?: number;
  newBalance?: number;
  processedFiles?: number;
  totalVectors?: number;
  error?: string;
  alreadyProcessed?: boolean;
}

export class KnowledgeBaseProcessingService {
  
  /**
   * Get processing cost configuration for a partner
   */
  static async getProcessingCostConfig(partnerId: string, customerId: string): Promise<ProcessingCostConfig> {
    try {
      // Check if partner has custom processing costs configured
      const partnerConfig = await prisma.partner.findUnique({
        where: { id: partnerId },
        select: {
          kbProcessingCostCredits: true,
          kbMaxFileSizeMB: true,
          kbOverageCostPerMB: true,
        }
      });

      return {
        baseProcessingCost: partnerConfig?.kbProcessingCostCredits || 50, // Default 50 credits
        maxFileSizeMB: partnerConfig?.kbMaxFileSizeMB || 10, // Default 10MB
        overageCostPerMB: partnerConfig?.kbOverageCostPerMB || 5, // Default 5 credits per MB
        partnerCustomCost: partnerConfig?.kbProcessingCostCredits || undefined,
      };
    } catch (error) {
      logger.error('Error getting processing cost config', error as Error, {
        operation: 'knowledge_base_processing',
        partnerId
      });
      // Return default configuration
      return {
        baseProcessingCost: 50,
        maxFileSizeMB: 10,
        overageCostPerMB: 5,
      };
    }
  }

  /**
   * Calculate processing cost based on files and configuration
   */
  static calculateProcessingCost(
    files: Array<{ fileSize: number; embeddingStatus: string | null }>,
    config: ProcessingCostConfig
  ): { totalCost: number; breakdown: any } {
    // Filter files that need processing (not already completed)
    const filesToProcess = files.filter(f => 
      f.embeddingStatus !== 'completed' && f.embeddingStatus !== 'processing'
    );

    if (filesToProcess.length === 0) {
      // Still calculate total size for display purposes, even if no processing needed
      const totalSizeBytes = files.reduce((sum, file) => sum + file.fileSize, 0);
      const totalSizeMB = totalSizeBytes / (1024 * 1024);

      return {
        totalCost: 0,
        breakdown: {
          message: 'No files need processing',
          filesToProcess: 0,
          totalFiles: files.length,
          totalSizeMB: Math.round(totalSizeMB * 100) / 100,
          baseCost: 0,
          overageMB: 0,
          overageCost: 0,
          maxIncludedSizeMB: config.maxFileSizeMB,
        }
      };
    }

    // Calculate total file size in MB
    const totalSizeBytes = filesToProcess.reduce((sum, file) => sum + file.fileSize, 0);
    const totalSizeMB = totalSizeBytes / (1024 * 1024);

    let totalCost = config.baseProcessingCost;

    // Add overage cost if files exceed the limit
    if (totalSizeMB > config.maxFileSizeMB) {
      const overageMB = totalSizeMB - config.maxFileSizeMB;
      const overageCost = Math.ceil(overageMB) * config.overageCostPerMB;
      totalCost += overageCost;
    }

    return {
      totalCost,
      breakdown: {
        filesToProcess: filesToProcess.length,
        totalFiles: files.length,
        totalSizeMB: Math.round(totalSizeMB * 100) / 100,
        baseCost: config.baseProcessingCost,
        overageMB: Math.max(0, totalSizeMB - config.maxFileSizeMB),
        overageCost: Math.max(0, Math.ceil(totalSizeMB - config.maxFileSizeMB) * config.overageCostPerMB),
        maxIncludedSizeMB: config.maxFileSizeMB,
      }
    };
  }

  /**
   * Check if partner has enabled KB processing for a customer
   */
  static async isProcessingEnabledForCustomer(partnerId: string, customerId: string): Promise<boolean> {
    try {
      const customer = await prisma.customer.findFirst({
        where: {
          id: customerId,
        },
        select: {
          kbProcessingEnabled: true,
        }
      });

      return customer?.kbProcessingEnabled || false;
    } catch (error) {
      logger.error('Error checking KB processing enabled', error as Error, {
        operation: 'knowledge_base_processing',
        partnerId
      });
      return false;
    }
  }

  /**
   * Process knowledge base - deduct credits and trigger embedding service
   */
  static async processKnowledgeBase(
    kbId: string,
    partnerId: string,
    customerId: string,
    triggeredBy: 'customer' | 'partner' = 'customer'
  ): Promise<ProcessingResult> {
    try {
      // Get knowledge base and files
      const knowledgeBase = await prisma.knowledgeBase.findFirst({
        where: { id: kbId, partnerId, customerId },
        include: {
          files: {
            select: {
              id: true,
              name: true,
              fileSize: true,
              embeddingStatus: true,
              r2StorageKey: true,
            }
          }
        }
      });

      if (!knowledgeBase) {
        return { success: false, error: 'Knowledge base not found' };
      }

      // Check if processing is enabled (only for customer-triggered processing)
      if (triggeredBy === 'customer') {
        const processingEnabled = await this.isProcessingEnabledForCustomer(partnerId, customerId);
        if (!processingEnabled) {
          return { 
            success: false, 
            error: 'Knowledge base processing is not enabled for this customer' 
          };
        }
      }

      // Get processing cost configuration
      const costConfig = await this.getProcessingCostConfig(partnerId, customerId);
      
      // Calculate processing cost
      const { totalCost, breakdown } = this.calculateProcessingCost(knowledgeBase.files, costConfig);

      // Check if there are files to process
      if (totalCost === 0) {
        return { 
          success: true, 
          alreadyProcessed: true,
          error: 'All files are already processed or currently processing'
        };
      }

      // Check partner's credit balance
      const creditBalance = await CreditService.getPartnerCreditBalance(partnerId);
      if (!creditBalance || creditBalance.currentBalance < totalCost) {
        return { 
          success: false, 
          error: `Insufficient credits. Required: ${totalCost}, Available: ${creditBalance?.currentBalance || 0}` 
        };
      }

      // Start transaction for credit deduction and status updates
      const result = await prisma.$transaction(async (tx) => {
        // Update files to processing status
        const filesToProcess = knowledgeBase.files.filter(f => 
          f.embeddingStatus !== 'completed' && f.embeddingStatus !== 'processing'
        );

        await tx.knowledgeBaseFile.updateMany({
          where: {
            id: { in: filesToProcess.map(f => f.id) },
          },
          data: {
            embeddingStatus: 'processing',
            updatedAt: new Date(),
          }
        });

        // Update knowledge base status
        await tx.knowledgeBase.update({
          where: { id: kbId },
          data: {
            lastEmbeddingUpdate: new Date(),
            updatedAt: new Date(),
          }
        });

        return { filesToProcess };
      });

      // Deduct credits from partner
      const creditResult = await CreditService.deductCredits(
        partnerId,
        totalCost,
        'knowledge_base_processing',
        customerId,
        undefined, // agentId
        undefined, // sessionId
        undefined, // durationSeconds
        breakdown,
        {
          knowledgeBaseId: kbId,
          knowledgeBaseName: knowledgeBase.name,
          filesProcessed: result.filesToProcess.length,
          triggeredBy,
          costBreakdown: breakdown,
        }
      );

      if (!creditResult.success) {
        // Rollback file status updates
        await prisma.knowledgeBaseFile.updateMany({
          where: {
            id: { in: result.filesToProcess.map(f => f.id) },
          },
          data: {
            embeddingStatus: 'pending',
            updatedAt: new Date(),
          }
        });

        return { 
          success: false, 
          error: creditResult.error || 'Failed to deduct credits' 
        };
      }

      // Trigger embedding service processing (async)
      this.triggerEmbeddingServiceProcessing(kbId, partnerId, customerId, result.filesToProcess)
        .catch(error => {
          logger.error('Embedding service processing failed', error as Error, {
            operation: 'knowledge_base_processing',
            knowledgeBaseId: kbId
          });
          // Update files back to pending status
          prisma.knowledgeBaseFile.updateMany({
            where: {
              id: { in: result.filesToProcess.map(f => f.id) },
            },
            data: {
              embeddingStatus: 'failed',
              embeddingError: error.message,
              updatedAt: new Date(),
            }
          }).catch((error) => {
            logger.error('Error updating knowledge base status', error as Error, {
              operation: 'knowledge_base_processing',
              knowledgeBaseId: kbId
            });
          });
        });

      return {
        success: true,
        creditsDeducted: totalCost,
        newBalance: creditResult.newBalance,
        processedFiles: result.filesToProcess.length,
      };

    } catch (error) {
      logger.error('Error processing knowledge base', error as Error, {
        operation: 'knowledge_base_processing',
        knowledgeBaseId: kbId
      });
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  }

  /**
   * Trigger embedding service processing (async)
   */
  private static async triggerEmbeddingServiceProcessing(
    kbId: string,
    partnerId: string,
    customerId: string,
    filesToProcess: Array<{ id: string; name: string; r2StorageKey: string | null }>
  ): Promise<void> {
    try {
      // For each file, trigger processing in the embedding service
      for (const file of filesToProcess) {
        if (!file.r2StorageKey) {
          logger.warn('File has no R2 storage key, skipping', {
            operation: 'knowledge_base_processing',
            fileId: file.id
          });
          continue;
        }

        // MOCKED PROCESSING - NOT IMPLEMENTED YET
        // TODO: Replace with actual embedding service call
        // Real implementation would:
        // 1. Call embeddingService.processFile(file.r2StorageKey, kbId, partnerId, customerId)
        // 2. Embedding service would download file from R2
        // 3. Parse document using LlamaParse API
        // 4. Generate embeddings using OpenAI text-embedding-3-small
        // 5. Store vectors in Qdrant database
        // 6. Send webhook back to update file status

        logger.info('MOCK: Processing file in knowledge base', {
          operation: 'knowledge_base_processing',
          fileName: file.name,
          knowledgeBaseId: kbId
        });

        // MOCK: Update file status to completed (this would be done by webhook in real implementation)
        await prisma.knowledgeBaseFile.update({
          where: { id: file.id },
          data: {
            embeddingStatus: 'completed',
            processedAt: new Date(),
            vectorCount: 50, // MOCK: This would come from the embedding service
            processingCost: 0.05, // MOCK: This would come from the embedding service
            updatedAt: new Date(),
          }
        });
      }

      // Update knowledge base totals
      const stats = await prisma.knowledgeBaseFile.aggregate({
        where: { knowledgeBaseId: kbId, embeddingStatus: 'completed' },
        _sum: { vectorCount: true, processingCost: true },
      });

      await prisma.knowledgeBase.update({
        where: { id: kbId },
        data: {
          totalVectors: stats._sum.vectorCount || 0,
          totalProcessingCost: stats._sum.processingCost || 0,
          lastEmbeddingUpdate: new Date(),
        }
      });

    } catch (error) {
      logger.error('Error in embedding service processing', error as Error, {
        operation: 'knowledge_base_processing',
        knowledgeBaseId: kbId
      });
      throw error;
    }
  }

  /**
   * Get processing cost estimate without actually processing
   */
  static async getProcessingCostEstimate(
    kbId: string,
    partnerId: string,
    customerId: string
  ): Promise<{ cost: number; breakdown: any; canProcess: boolean; error?: string }> {
    try {
      const knowledgeBase = await prisma.knowledgeBase.findFirst({
        where: { id: kbId, partnerId, customerId },
        include: {
          files: {
            select: { fileSize: true, embeddingStatus: true }
          }
        }
      });

      if (!knowledgeBase) {
        return { cost: 0, breakdown: {}, canProcess: false, error: 'Knowledge base not found' };
      }

      const costConfig = await this.getProcessingCostConfig(partnerId, customerId);
      const { totalCost, breakdown } = this.calculateProcessingCost(knowledgeBase.files, costConfig);

      // Check credit balance
      const creditBalance = await CreditService.getPartnerCreditBalance(partnerId);
      const canProcess = creditBalance ? creditBalance.currentBalance >= totalCost : false;

      return {
        cost: totalCost,
        breakdown,
        canProcess,
        error: !canProcess ? 'Insufficient credits' : undefined,
      };

    } catch (error) {
      logger.error('Error getting processing cost estimate', error as Error, {
        operation: 'knowledge_base_processing',
        knowledgeBaseId: kbId
      });
      return { 
        cost: 0, 
        breakdown: {}, 
        canProcess: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  }
}

// Export for use in API routes
export default KnowledgeBaseProcessingService;
