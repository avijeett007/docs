// src/lib/services/partnerStorageService.ts
// Service for managing partner knowledge base storage quotas and usage tracking

import { prisma } from '@/lib/prisma';
import { Decimal } from '@prisma/client/runtime/library';
import { logger } from '@/lib/logger';

export interface StorageQuota {
  partnerId: string;
  totalQuotaMB: number; // Free + Purchased
  usedMB: number;
  availableMB: number;
  freeQuotaMB: number;
  purchasedMB: number;
  utilizationPercentage: number;
  isOverQuota: boolean;
  lastCalculatedAt: Date | null;
}

export interface StorageUsageBreakdown {
  totalFiles: number;
  totalSizeMB: number;
  knowledgeBases: Array<{
    id: string;
    name: string;
    fileCount: number;
    sizeMB: number;
  }>;
}

export class PartnerStorageService {
  /**
   * Get partner's current storage quota and usage
   */
  static async getStorageQuota(partnerId: string): Promise<StorageQuota | null> {
    try {
      const partner = await prisma.partner.findUnique({
        where: { id: partnerId },
        select: {
          kbStorageQuotaMB: true,
          kbStorageUsedMB: true,
          kbStoragePurchasedMB: true,
          kbStorageLastCalculatedAt: true,
        }
      });

      if (!partner) {
        return null;
      }

      const freeQuotaMB = partner.kbStorageQuotaMB || 100; // Default 100MB
      const purchasedMB = partner.kbStoragePurchasedMB || 0;
      const totalQuotaMB = freeQuotaMB + purchasedMB;
      const usedMB = Number(partner.kbStorageUsedMB) || 0;
      const availableMB = Math.max(0, totalQuotaMB - usedMB);
      const utilizationPercentage = totalQuotaMB > 0 ? (usedMB / totalQuotaMB) * 100 : 0;

      return {
        partnerId,
        totalQuotaMB,
        usedMB,
        availableMB,
        freeQuotaMB,
        purchasedMB,
        utilizationPercentage,
        isOverQuota: usedMB > totalQuotaMB,
        lastCalculatedAt: partner.kbStorageLastCalculatedAt,
      };
    } catch (error) {
      logger.error('Error getting storage quota', error as Error, {
        operation: 'partner_storage_service',
        partnerId
      });
      return null;
    }
  }

  /**
   * Calculate and update partner's storage usage from actual files
   */
  static async recalculateStorageUsage(partnerId: string): Promise<{ success: boolean; usageMB: number; error?: string }> {
    try {
      // Calculate total storage used by all knowledge base files for this partner
      const result = await prisma.knowledgeBaseFile.aggregate({
        where: {
          knowledgeBase: {
            partnerId: partnerId
          }
        },
        _sum: {
          fileSize: true
        }
      });

      const totalBytes = result._sum.fileSize || 0;
      const totalMB = totalBytes / (1024 * 1024); // Convert bytes to MB

      // Update partner's storage usage
      await prisma.partner.update({
        where: { id: partnerId },
        data: {
          kbStorageUsedMB: new Decimal(totalMB.toFixed(3)),
          kbStorageLastCalculatedAt: new Date(),
        }
      });

      return {
        success: true,
        usageMB: totalMB,
      };
    } catch (error) {
      logger.error('Error recalculating storage usage', error as Error, {
        operation: 'partner_storage_service',
        partnerId
      });
      return {
        success: false,
        usageMB: 0,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Check if partner has sufficient storage for a new file
   */
  static async checkStorageAvailability(
    partnerId: string, 
    fileSizeBytes: number
  ): Promise<{ hasSpace: boolean; availableMB: number; requiredMB: number; quota: StorageQuota | null }> {
    try {
      const quota = await this.getStorageQuota(partnerId);
      if (!quota) {
        return { hasSpace: false, availableMB: 0, requiredMB: 0, quota: null };
      }

      const requiredMB = fileSizeBytes / (1024 * 1024);
      const hasSpace = quota.availableMB >= requiredMB;

      return {
        hasSpace,
        availableMB: quota.availableMB,
        requiredMB,
        quota,
      };
    } catch (error) {
      logger.error('Error checking storage availability', error as Error, {
        operation: 'partner_storage_service',
        partnerId,
        fileSizeBytes
      });
      return { hasSpace: false, availableMB: 0, requiredMB: 0, quota: null };
    }
  }

  /**
   * Get detailed storage usage breakdown by knowledge base
   */
  static async getStorageUsageBreakdown(partnerId: string): Promise<StorageUsageBreakdown | null> {
    try {
      const knowledgeBases = await prisma.knowledgeBase.findMany({
        where: { partnerId },
        include: {
          files: {
            select: {
              fileSize: true,
            }
          }
        }
      });

      const breakdown: StorageUsageBreakdown = {
        totalFiles: 0,
        totalSizeMB: 0,
        knowledgeBases: [],
      };

      for (const kb of knowledgeBases) {
        const fileCount = kb.files.length;
        const totalBytes = kb.files.reduce((sum, file) => sum + (file.fileSize || 0), 0);
        const sizeMB = totalBytes / (1024 * 1024);

        breakdown.totalFiles += fileCount;
        breakdown.totalSizeMB += sizeMB;
        breakdown.knowledgeBases.push({
          id: kb.id,
          name: kb.name,
          fileCount,
          sizeMB: Number(sizeMB.toFixed(3)),
        });
      }

      breakdown.totalSizeMB = Number(breakdown.totalSizeMB.toFixed(3));

      return breakdown;
    } catch (error) {
      logger.error('Error getting storage usage breakdown', error as Error, {
        operation: 'partner_storage_service',
        partnerId
      });
      return null;
    }
  }

  /**
   * Purchase additional storage for partner
   */
  static async purchaseAdditionalStorage(
    partnerId: string, 
    additionalMB: number
  ): Promise<{ success: boolean; newTotalQuota: number; error?: string }> {
    try {
      const partner = await prisma.partner.findUnique({
        where: { id: partnerId },
        select: {
          kbStoragePurchasedMB: true,
          kbStorageQuotaMB: true,
        }
      });

      if (!partner) {
        return { success: false, newTotalQuota: 0, error: 'Partner not found' };
      }

      const newPurchasedMB = (partner.kbStoragePurchasedMB || 0) + additionalMB;
      const freeQuotaMB = partner.kbStorageQuotaMB || 100;
      const newTotalQuota = freeQuotaMB + newPurchasedMB;

      await prisma.partner.update({
        where: { id: partnerId },
        data: {
          kbStoragePurchasedMB: newPurchasedMB,
        }
      });

      return {
        success: true,
        newTotalQuota,
      };
    } catch (error) {
      logger.error('Error purchasing additional storage', error as Error, {
        operation: 'partner_storage_service',
        partnerId,
        additionalMB
      });
      return {
        success: false,
        newTotalQuota: 0,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Get storage pricing information
   */
  static getStoragePricing(): { pricePerGB: number; minimumPurchaseGB: number } {
    return {
      pricePerGB: 8, // $8 per GB
      minimumPurchaseGB: 1, // Minimum 1GB purchase
    };
  }

  /**
   * Calculate storage cost for additional storage
   */
  static calculateStorageCost(additionalMB: number): { costUSD: number; storageGB: number } {
    const pricing = this.getStoragePricing();
    const storageGB = Math.ceil(additionalMB / 1024); // Round up to nearest GB
    const costUSD = storageGB * pricing.pricePerGB;

    return {
      costUSD,
      storageGB,
    };
  }
}

export default PartnerStorageService;
