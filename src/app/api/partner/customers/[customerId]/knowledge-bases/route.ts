import { NextRequest, NextResponse } from 'next/server';
import { verifyPartnerAuth } from '@/lib/auth/partnerAuth';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

/**
 * GET /api/partner/customers/[customerId]/knowledge-bases
 * Get all knowledge bases for a specific customer (for partner use in agent creation)
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { customerId: string } }
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
    const { customerId } = params;

    if (!customerId) {
      return NextResponse.json(
        { success: false, error: 'Customer ID is required' },
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

    const knowledgeBases = await prisma.knowledgeBase.findMany({
      where: {
        customerId: actualCustomerId,
        partnerId,
      },
      include: {
        _count: {
          select: {
            files: true,
            folders: true,
            websiteUrls: true,
          },
        },
        files: {
          select: {
            fileSize: true,
            embeddingStatus: true,
          },
        },
        websiteUrls: {
          select: {
            id: true,
            baseUrl: true,
            scrapingFrequency: true,
            isActive: true,
            lastScrapedAt: true,
            nextScrapeAt: true,
            _count: {
              select: {
                pages: true,
              },
            },
            pages: {
              select: {
                id: true,
                url: true,
                title: true,
                scrapingStatus: true,
                lastScrapedAt: true,
              },
            },
          },
        },
        providerMappings: {
          select: {
            id: true,
            provider: true,
            providerKnowledgeBaseId: true,
            lastSyncedAt: true,
            syncStatus: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    // Calculate total sizes and processed file counts
    const knowledgeBasesWithStats = knowledgeBases.map(kb => {
      const totalSize = kb.files.reduce((sum, file) => sum + (file.fileSize || 0), 0);
      const processedFiles = kb.files.filter(file =>
        file.embeddingStatus === 'completed'
      ).length;
      const processingFiles = kb.files.filter(file =>
        file.embeddingStatus === 'processing'
      ).length;

      // Calculate website URL stats
      const totalWebsiteUrls = kb._count.websiteUrls;
      const activeWebsiteUrls = kb.websiteUrls.filter(url => url.isActive).length;
      const totalWebsitePages = kb.websiteUrls.reduce((sum, url) => sum + url._count.pages, 0);
      const scrapedWebsitePages = kb.websiteUrls.reduce((sum, url) =>
        sum + url.pages.filter(page => page.scrapingStatus === 'completed').length, 0
      );
      const processingWebsitePages = kb.websiteUrls.reduce((sum, url) =>
        sum + url.pages.filter(page => page.scrapingStatus === 'processing').length, 0
      );

      // Determine if knowledge base is ready (has processed files OR scraped pages)
      const hasProcessedContent = processedFiles > 0 || scrapedWebsitePages > 0;
      const hasProcessingContent = processingFiles > 0 || processingWebsitePages > 0;

      return {
        id: kb.id,
        name: kb.name,
        description: kb.description,
        createdAt: kb.createdAt,
        updatedAt: kb.updatedAt,
        totalFiles: kb._count.files,
        totalFolders: kb._count.folders,
        totalWebsiteUrls,
        activeWebsiteUrls,
        totalWebsitePages,
        scrapedWebsitePages,
        processingWebsitePages,
        totalSize,
        processedFiles,
        processingFiles,
        isReady: hasProcessedContent,
        processingStatus: hasProcessingContent ? 'processing' :
                         hasProcessedContent ? 'completed' :
                         (processedFiles > 0 || scrapedWebsitePages > 0) ? 'partial' : 'pending',
        websiteUrls: kb.websiteUrls.map(url => ({
          id: url.id,
          baseUrl: url.baseUrl,
          scrapingFrequency: url.scrapingFrequency,
          isActive: url.isActive,
          lastScrapedAt: url.lastScrapedAt,
          nextScrapeAt: url.nextScrapeAt,
          totalPages: url._count.pages,
          scrapedPages: url.pages.filter(page => page.scrapingStatus === 'completed').length,
          processingPages: url.pages.filter(page => page.scrapingStatus === 'processing').length,
          pages: url.pages.map(page => ({
            id: page.id,
            url: page.url,
            title: page.title,
            scrapingStatus: page.scrapingStatus,
            lastScrapedAt: page.lastScrapedAt,
          })),
        })),
        providerMappings: kb.providerMappings.map(mapping => ({
          id: mapping.id,
          provider: mapping.provider,
          providerKnowledgeBaseId: mapping.providerKnowledgeBaseId,
          lastSyncedAt: mapping.lastSyncedAt,
          syncStatus: mapping.syncStatus,
        })),
      };
    });

    return NextResponse.json({
      success: true,
      data: {
        customer: {
          id: customer.id,
          firstName: customer.firstName,
          lastName: customer.lastName,
          companyName: customer.userOnboarding[0]?.companyName || null,
          email: customer.email,
        },
        knowledgeBases: knowledgeBasesWithStats,
        summary: {
          totalKnowledgeBases: knowledgeBasesWithStats.length,
          readyKnowledgeBases: knowledgeBasesWithStats.filter(kb => kb.isReady).length,
          totalFiles: knowledgeBasesWithStats.reduce((sum, kb) => sum + kb.totalFiles, 0),
          totalWebsiteUrls: knowledgeBasesWithStats.reduce((sum, kb) => sum + kb.totalWebsiteUrls, 0),
          totalWebsitePages: knowledgeBasesWithStats.reduce((sum, kb) => sum + kb.totalWebsitePages, 0),
          totalSize: knowledgeBasesWithStats.reduce((sum, kb) => sum + kb.totalSize, 0),
        },
      },
    });

  } catch (error) {
    console.error('Error fetching customer knowledge bases:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
