// src/lib/services/presignedUrlService.ts
// Service for generating secure presigned URLs for knowledge base file access

import { prisma } from '@/lib/prisma';
import { createHash, randomBytes } from 'crypto';
import { logger } from '@/lib/logger';

export interface PresignedUrlOptions {
  expiresIn?: number; // Expiry time in seconds (default: 1 hour)
  allowedIPs?: string[]; // Optional IP whitelist
  maxDownloads?: number; // Optional download limit
  purpose?: string; // Purpose of the URL (e.g., 'agent_integration', 'api_access')
}

export interface PresignedUrlResult {
  url: string;
  token: string;
  expiresAt: Date;
  fileId: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
}

export interface PresignedUrlValidation {
  isValid: boolean;
  fileId?: string;
  fileName?: string;
  fileSize?: number;
  mimeType?: string;
  storageKey?: string;
  r2StorageKey?: string;
  bucketName?: string;
  error?: string;
  remainingDownloads?: number;
}

export class PresignedUrlService {
  private static readonly DEFAULT_EXPIRY = 3600; // 1 hour in seconds
  private static readonly MAX_EXPIRY = 86400; // 24 hours in seconds
  private static readonly SECRET_KEY = process.env.PRESIGNED_URL_SECRET || 'default-secret-key';

  /**
   * Generate a secure presigned URL for a knowledge base file
   */
  static async generatePresignedUrl(
    fileId: string,
    partnerId: string,
    customerId: string,
    options: PresignedUrlOptions = {}
  ): Promise<PresignedUrlResult | null> {
    try {
      // First, find the UserOnboarding ID from the Customer ID
      // This is needed because the presigned_urls table has a foreign key to UserOnboarding, not Customer
      const userOnboarding = await prisma.userOnboarding.findFirst({
        where: {
          customerId: customerId,
          partnerId: partnerId,
        },
        select: {
          id: true,
        },
      });

      if (!userOnboarding) {
        throw new Error('Customer onboarding record not found');
      }

      const userOnboardingId = userOnboarding.id;

      // Validate file access using Customer ID (as files are linked to Customer table)
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
            },
          },
        },
      });

      if (!file) {
        throw new Error('File not found or access denied');
      }

      // Set expiry time
      const expiresIn = Math.min(
        options.expiresIn || this.DEFAULT_EXPIRY,
        this.MAX_EXPIRY
      );
      const expiresAt = new Date(Date.now() + expiresIn * 1000);

      // Generate secure token
      const tokenData = {
        fileId,
        partnerId,
        customerId,
        expiresAt: expiresAt.getTime(),
        purpose: options.purpose || 'file_access',
        nonce: randomBytes(16).toString('hex'),
      };

      const token = this.generateSecureToken(tokenData);

      // Store presigned URL record using UserOnboarding ID (required by foreign key constraint)
      await prisma.presignedUrl.create({
        data: {
          token,
          fileId,
          partnerId,
          customerId: userOnboardingId, // Use UserOnboarding ID for the foreign key
          expiresAt,
          allowedIPs: options.allowedIPs ? JSON.stringify(options.allowedIPs) : null,
          maxDownloads: options.maxDownloads,
          downloadCount: 0,
          purpose: options.purpose || 'file_access',
          isActive: true,
        },
      });

      // Generate the presigned URL
      const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
      const url = `${baseUrl}/api/files/presigned/${token}`;

      return {
        url,
        token,
        expiresAt,
        fileId: file.id,
        fileName: file.name,
        fileSize: file.fileSize || 0,
        mimeType: file.fileType || 'application/octet-stream',
      };

    } catch (error) {
      logger.error('Error generating presigned URL', error as Error, {
        operation: 'presigned_url_service',
        fileId,
        partnerId,
        customerId
      });
      return null;
    }
  }

  /**
   * Validate a presigned URL token
   */
  static async validatePresignedUrl(
    token: string,
    clientIP?: string
  ): Promise<PresignedUrlValidation> {
    try {
      // Find the presigned URL record
      const presignedUrl = await prisma.presignedUrl.findUnique({
        where: { token },
        include: {
          file: {
            select: {
              id: true,
              name: true,
              fileSize: true,
              fileType: true,
              storageKey: true,
              r2StorageKey: true,
              bucketName: true,
            },
          },
        },
      });

      if (!presignedUrl) {
        return { isValid: false, error: 'Invalid or expired token' };
      }

      // Check if URL is active
      if (!presignedUrl.isActive) {
        return { isValid: false, error: 'URL has been deactivated' };
      }

      // Check expiry
      if (new Date() > presignedUrl.expiresAt) {
        // Deactivate expired URL
        await prisma.presignedUrl.update({
          where: { token },
          data: { isActive: false },
        });
        return { isValid: false, error: 'URL has expired' };
      }

      // Check download limit
      if (presignedUrl.maxDownloads && presignedUrl.downloadCount >= presignedUrl.maxDownloads) {
        return { isValid: false, error: 'Download limit exceeded' };
      }

      // Check IP whitelist
      if (presignedUrl.allowedIPs && clientIP) {
        const allowedIPs = JSON.parse(presignedUrl.allowedIPs);
        if (!allowedIPs.includes(clientIP)) {
          return { isValid: false, error: 'IP address not allowed' };
        }
      }

      // Increment download count
      await prisma.presignedUrl.update({
        where: { token },
        data: { downloadCount: presignedUrl.downloadCount + 1 },
      });

      return {
        isValid: true,
        fileId: presignedUrl.file.id,
        fileName: presignedUrl.file.name,
        fileSize: presignedUrl.file.fileSize || 0,
        mimeType: presignedUrl.file.fileType || 'application/octet-stream',
        storageKey: presignedUrl.file.storageKey,
        r2StorageKey: presignedUrl.file.r2StorageKey || undefined,
        bucketName: presignedUrl.file.bucketName,
        remainingDownloads: presignedUrl.maxDownloads 
          ? presignedUrl.maxDownloads - presignedUrl.downloadCount - 1
          : undefined,
      };

    } catch (error) {
      logger.error('Error validating presigned URL', error as Error, {
        operation: 'presigned_url_service',
        token
      });
      return { isValid: false, error: 'Validation failed' };
    }
  }

  /**
   * Generate multiple presigned URLs for a knowledge base
   */
  static async generateKnowledgeBaseUrls(
    knowledgeBaseId: string,
    partnerId: string,
    customerId: string,
    options: PresignedUrlOptions = {}
  ): Promise<PresignedUrlResult[]> {
    try {
      // Get all processed files from the knowledge base
      const files = await prisma.knowledgeBaseFile.findMany({
        where: {
          knowledgeBase: {
            id: knowledgeBaseId,
            partnerId,
            customerId,
          },
          embeddingStatus: 'completed', // Only include processed files
        },
        select: {
          id: true,
          name: true,
          fileSize: true,
          fileType: true,
        },
      });

      const results: PresignedUrlResult[] = [];

      for (const file of files) {
        const result = await this.generatePresignedUrl(
          file.id,
          partnerId,
          customerId,
          options
        );

        if (result) {
          results.push(result);
        }
      }

      return results;

    } catch (error) {
      logger.error('Error generating knowledge base URLs', error as Error, {
        operation: 'presigned_url_service',
        partnerId,
        customerId
      });
      return [];
    }
  }

  /**
   * Revoke a presigned URL
   */
  static async revokePresignedUrl(token: string, partnerId: string): Promise<boolean> {
    try {
      const result = await prisma.presignedUrl.updateMany({
        where: {
          token,
          partnerId,
        },
        data: {
          isActive: false,
        },
      });

      return result.count > 0;

    } catch (error) {
      logger.error('Error revoking presigned URL', error as Error, {
        operation: 'presigned_url_service',
        token
      });
      return false;
    }
  }

  /**
   * Clean up expired presigned URLs
   */
  static async cleanupExpiredUrls(): Promise<number> {
    try {
      const result = await prisma.presignedUrl.deleteMany({
        where: {
          OR: [
            { expiresAt: { lt: new Date() } },
            { isActive: false },
          ],
        },
      });

      return result.count;

    } catch (error) {
      logger.error('Error cleaning up expired URLs', error as Error, {
        operation: 'presigned_url_service'
      });
      return 0;
    }
  }

  /**
   * Generate a secure token using HMAC
   */
  private static generateSecureToken(data: any): string {
    const payload = JSON.stringify(data);
    const signature = createHash('sha256')
      .update(payload + this.SECRET_KEY)
      .digest('hex');
    
    const token = Buffer.from(payload).toString('base64url') + '.' + signature;
    return token;
  }

  /**
   * Get client IP from request headers
   */
  static getClientIP(request: Request): string | undefined {
    const forwarded = request.headers.get('x-forwarded-for');
    const realIP = request.headers.get('x-real-ip');
    const cfConnectingIP = request.headers.get('cf-connecting-ip');

    if (cfConnectingIP) return cfConnectingIP;
    if (realIP) return realIP;
    if (forwarded) return forwarded.split(',')[0].trim();

    return undefined;
  }
}

export default PresignedUrlService;
