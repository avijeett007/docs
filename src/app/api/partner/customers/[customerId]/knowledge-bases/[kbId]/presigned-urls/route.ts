import { NextRequest, NextResponse } from 'next/server';
import { verifyPartnerAuth } from '@/lib/auth/partnerAuth';
import PresignedUrlService from '@/lib/services/presignedUrlService';

export const dynamic = 'force-dynamic';

/**
 * POST /api/partner/customers/[customerId]/knowledge-bases/[kbId]/presigned-urls
 * Generate presigned URLs for knowledge base files
 */
export async function POST(
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
    const { prisma } = await import('@/lib/db');
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

    // Parse request body
    const body = await request.json();
    const {
      fileIds, // Optional: specific file IDs to generate URLs for
      expiresIn = 3600, // Default 1 hour
      maxDownloads,
      allowedIPs,
      purpose = 'agent_integration'
    } = body;

    const options = {
      expiresIn: Math.min(expiresIn, 86400), // Max 24 hours
      maxDownloads,
      allowedIPs,
      purpose,
    };

    let results = [];

    if (fileIds && Array.isArray(fileIds)) {
      // Generate URLs for specific files
      for (const fileId of fileIds) {
        const result = await PresignedUrlService.generatePresignedUrl(
          fileId,
          partnerId,
          actualCustomerId,
          options
        );
        if (result) {
          results.push(result);
        }
      }
    } else {
      // Generate URLs for all files in the knowledge base
      results = await PresignedUrlService.generateKnowledgeBaseUrls(
        kbId,
        partnerId,
        actualCustomerId,
        options
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        knowledgeBaseId: kbId,
        customerId: actualCustomerId,
        urls: results,
        totalUrls: results.length,
        expiresIn: options.expiresIn,
        purpose: options.purpose,
      },
    });

  } catch (error) {
    console.error('Error generating presigned URLs:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/partner/customers/[customerId]/knowledge-bases/[kbId]/presigned-urls
 * Get existing presigned URLs for a knowledge base
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

    // Verify the customer belongs to this partner
    const { prisma } = await import('@/lib/db');
    const customer = await prisma.userOnboarding.findFirst({
      where: {
        id: customerId,
        partnerId: partnerId,
      },
    });

    if (!customer) {
      return NextResponse.json(
        { success: false, error: 'Customer not found or access denied' },
        { status: 404 }
      );
    }

    // Get the actual customer ID
    const actualCustomerId = customer.customerId;

    if (!actualCustomerId) {
      return NextResponse.json(
        { success: false, error: 'Customer has no associated customer record' },
        { status: 404 }
      );
    }

    const presignedUrls = await prisma.presignedUrl.findMany({
      where: {
        partnerId,
        customerId: actualCustomerId,
        isActive: true,
        expiresAt: {
          gt: new Date(),
        },
        file: {
          knowledgeBase: {
            id: kbId,
          },
        },
      },
      include: {
        file: {
          select: {
            id: true,
            name: true,
            fileSize: true,
            fileType: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    const formattedUrls = presignedUrls.map(url => ({
      token: url.token,
      url: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/files/presigned/${url.token}`,
      fileId: url.file.id,
      fileName: url.file.name,
      fileSize: url.file.fileSize,
      mimeType: url.file.fileType,
      expiresAt: url.expiresAt,
      downloadCount: url.downloadCount,
      maxDownloads: url.maxDownloads,
      purpose: url.purpose,
      createdAt: url.createdAt,
    }));

    return NextResponse.json({
      success: true,
      data: {
        knowledgeBaseId: kbId,
        customerId: actualCustomerId,
        urls: formattedUrls,
        totalUrls: formattedUrls.length,
      },
    });

  } catch (error) {
    console.error('Error fetching presigned URLs:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      },
      { status: 500 }
    );
  }
}
