import { NextRequest, NextResponse } from 'next/server';
import { verifyOnboardingAuth } from '@/lib/onboardingAuth';
import { prisma } from '@/lib/prisma';
import { anythingLLMService, ensureAnythingLLMWorkspace } from '@/lib/anythingLLMService';
import { logger } from '@/lib/logger';
import { z } from 'zod';

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

const addWebsiteUrlSchema = z.object({
  knowledgeBaseId: z.string().uuid(),
  baseUrl: z.string().url(),
  selectedPages: z.array(z.object({
    url: z.string().url(),
    title: z.string().optional(),
  })).max(100, 'Maximum 100 pages allowed per selection'),
  scrapingFrequency: z.enum(['24h', 'weekly', 'monthly']).default('24h'),
});

const updateWebsiteUrlSchema = z.object({
  id: z.string().uuid(),
  scrapingFrequency: z.enum(['24h', 'weekly', 'monthly']).optional(),
  isActive: z.boolean().optional(),
});

// Calculate next scrape time based on frequency
function calculateNextScrapeTime(frequency: string): Date {
  const now = new Date();
  switch (frequency) {
    case '24h':
      return new Date(now.getTime() + 24 * 60 * 60 * 1000);
    case 'weekly':
      return new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    case 'monthly':
      return new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    default:
      return new Date(now.getTime() + 24 * 60 * 60 * 1000);
  }
}

// GET - List website URLs for a knowledge base
export async function GET(request: NextRequest) {
  try {
    const authResult = await verifyOnboardingAuth(request);
    if (!authResult) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const knowledgeBaseId = searchParams.get('knowledgeBaseId');

    if (!knowledgeBaseId) {
      return NextResponse.json(
        { error: 'Knowledge base ID is required' },
        { status: 400 }
      );
    }

    // Verify knowledge base belongs to customer
    const knowledgeBase = await prisma.knowledgeBase.findFirst({
      where: {
        id: knowledgeBaseId,
        customerId: authResult.customerId,
        partnerId: authResult.partnerId,
      },
    });

    if (!knowledgeBase) {
      return NextResponse.json(
        { error: 'Knowledge base not found' },
        { status: 404 }
      );
    }

    // Get website URLs with their pages
    const websiteUrls = await prisma.knowledgeBaseWebsiteUrl.findMany({
      where: {
        knowledgeBaseId,
        customerId: authResult.customerId,
        partnerId: authResult.partnerId,
      },
      include: {
        pages: {
          orderBy: { createdAt: 'asc' },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({
      success: true,
      data: websiteUrls,
    });

  } catch (error: unknown) {
    logger.error('Error fetching website URLs:', error as Error);
    return NextResponse.json(
      { error: 'Failed to fetch website URLs' },
      { status: 500 }
    );
  }
}

// POST - Add website URL to knowledge base
export async function POST(request: NextRequest) {
  try {
    const authResult = await verifyOnboardingAuth(request);
    if (!authResult) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { knowledgeBaseId, baseUrl, selectedPages, scrapingFrequency } = addWebsiteUrlSchema.parse(body);

    // Verify knowledge base belongs to customer (include AnythingLLM fields)
    const knowledgeBase = await prisma.knowledgeBase.findFirst({
      where: {
        id: knowledgeBaseId,
        customerId: authResult.customerId,
        partnerId: authResult.partnerId,
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

    // Check if base URL already exists for this knowledge base
    const existingUrl = await prisma.knowledgeBaseWebsiteUrl.findFirst({
      where: {
        knowledgeBaseId,
        baseUrl,
        customerId: authResult.customerId,
        partnerId: authResult.partnerId,
      },
    });

    if (existingUrl) {
      return NextResponse.json(
        { error: 'This website URL is already added to the knowledge base' },
        { status: 400 }
      );
    }

    // Check if auto-embedding is enabled for this customer
    const autoEmbedding = await isAutoEmbeddingEnabled(authResult.customerId, authResult.partnerId);

    // Create website URL entry with selected pages
    const nextScrapeAt = calculateNextScrapeTime(scrapingFrequency);

    const websiteUrl = await prisma.knowledgeBaseWebsiteUrl.create({
      data: {
        knowledgeBaseId,
        customerId: authResult.customerId,
        partnerId: authResult.partnerId,
        baseUrl,
        scrapingFrequency,
        nextScrapeAt,
        pages: {
          create: selectedPages.map(page => ({
            url: page.url,
            title: page.title,
          })),
        },
      },
      include: {
        pages: true,
      },
    });

    logger.info('Website URL added to knowledge base', {
      operation: 'website_url_add',
      websiteUrlId: websiteUrl.id,
      baseUrl,
      pageCount: selectedPages.length,
      autoEmbeddingEnabled: autoEmbedding,
    });

    // If auto-embedding is enabled, upload links to AnythingLLM
    const anythingLLMResults: Array<{ pageId: string; url: string; success: boolean; documentId?: string; location?: string; error?: string }> = [];

    if (autoEmbedding) {
      try {
        // Ensure workspace exists (uses shared function with race condition protection)
        const workspaceSlug = await ensureAnythingLLMWorkspace(
          prisma,
          knowledgeBaseId,
          authResult.customerId,
          authResult.partnerId
        );

        if (workspaceSlug) {
          // Upload each page URL to AnythingLLM
          for (const page of websiteUrl.pages) {
            try {
              const linkResult = await anythingLLMService.uploadLink(page.url, workspaceSlug);

              if (linkResult.success && linkResult.documents?.[0]) {
                const doc = linkResult.documents[0];

                // Update page record with AnythingLLM data
                await prisma.knowledgeBaseWebsitePage.update({
                  where: { id: page.id },
                  data: {
                    anythingLLMDocumentId: doc.id,
                    anythingLLMDocumentLocation: doc.location,
                    anythingLLMProcessedAt: new Date(),
                  },
                });

                anythingLLMResults.push({
                  pageId: page.id,
                  url: page.url,
                  success: true,
                  documentId: doc.id,
                  location: doc.location,
                });

                logger.info('Website page uploaded to AnythingLLM', {
                  operation: 'anythingllm_link_upload',
                  pageId: page.id,
                  url: page.url,
                  documentId: doc.id,
                });
              } else {
                anythingLLMResults.push({
                  pageId: page.id,
                  url: page.url,
                  success: false,
                  error: 'No document returned from AnythingLLM',
                });
              }
            } catch (pageError) {
              logger.error('Failed to upload page to AnythingLLM', pageError as Error, {
                operation: 'anythingllm_link_upload',
                pageId: page.id,
                url: page.url,
              });

              anythingLLMResults.push({
                pageId: page.id,
                url: page.url,
                success: false,
                error: (pageError as Error).message,
              });
            }
          }
        }
      } catch (anythingLLMError) {
        logger.error('AnythingLLM integration failed', anythingLLMError as Error, {
          operation: 'anythingllm_link_upload',
          websiteUrlId: websiteUrl.id,
          knowledgeBaseId,
        });
      }
    }

    return NextResponse.json({
      success: true,
      data: websiteUrl,
      anythingLLM: autoEmbedding ? {
        enabled: true,
        results: anythingLLMResults,
      } : undefined,
    });

  } catch (error: unknown) {
    logger.error('Error adding website URL:', error as Error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request data', details: error.errors },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to add website URL' },
      { status: 500 }
    );
  }
}

// PUT - Update website URL settings
export async function PUT(request: NextRequest) {
  try {
    const authResult = await verifyOnboardingAuth(request);
    if (!authResult) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { id, scrapingFrequency, isActive } = updateWebsiteUrlSchema.parse(body);

    // Verify website URL belongs to customer
    const existingUrl = await prisma.knowledgeBaseWebsiteUrl.findFirst({
      where: {
        id,
        customerId: authResult.customerId,
        partnerId: authResult.partnerId,
      },
    });

    if (!existingUrl) {
      return NextResponse.json(
        { error: 'Website URL not found' },
        { status: 404 }
      );
    }

    // Prepare update data
    const updateData: any = {};
    
    if (scrapingFrequency !== undefined) {
      updateData.scrapingFrequency = scrapingFrequency;
      updateData.nextScrapeAt = calculateNextScrapeTime(scrapingFrequency);
    }
    
    if (isActive !== undefined) {
      updateData.isActive = isActive;
    }

    // Update website URL
    const updatedUrl = await prisma.knowledgeBaseWebsiteUrl.update({
      where: { id },
      data: updateData,
      include: {
        pages: true,
      },
    });

    return NextResponse.json({
      success: true,
      data: updatedUrl,
    });

  } catch (error: unknown) {
    logger.error('Error updating website URL:', error as Error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request data', details: error.errors },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to update website URL' },
      { status: 500 }
    );
  }
}

// DELETE - Remove website URL from knowledge base
export async function DELETE(request: NextRequest) {
  try {
    const authResult = await verifyOnboardingAuth(request);
    if (!authResult) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { error: 'Website URL ID is required' },
        { status: 400 }
      );
    }

    // Verify website URL belongs to customer
    const existingUrl = await prisma.knowledgeBaseWebsiteUrl.findFirst({
      where: {
        id,
        customerId: authResult.customerId,
        partnerId: authResult.partnerId,
      },
    });

    if (!existingUrl) {
      return NextResponse.json(
        { error: 'Website URL not found' },
        { status: 404 }
      );
    }

    // Delete website URL (pages will be deleted automatically due to cascade)
    await prisma.knowledgeBaseWebsiteUrl.delete({
      where: { id },
    });

    return NextResponse.json({
      success: true,
      message: 'Website URL removed successfully',
    });

  } catch (error: unknown) {
    logger.error('Error deleting website URL:', error as Error);
    return NextResponse.json(
      { error: 'Failed to delete website URL' },
      { status: 500 }
    );
  }
}
