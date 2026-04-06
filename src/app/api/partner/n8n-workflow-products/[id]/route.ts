import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';

/**
 * GET /api/partner/n8n-workflow-products/[id]
 * Get a specific workflow product for partners (includes workflow JSON)
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;

    // Validate ID format
    const uuidSchema = z.string().uuid();
    const validatedId = uuidSchema.parse(id);

    // Get product - only if published and active
    const product = await prisma.n8nWorkflowProduct.findFirst({
      where: {
        id: validatedId,
        isActive: true,
        isPublished: true,
      },
      select: {
        id: true,
        name: true,
        description: true,
        category: true,
        tags: true,
        difficulty: true,
        estimatedSetupTime: true,
        workflowJson: true, // Include workflow JSON for deployment
        requiredNodes: true,
        setupVideoUrl: true,
        setupVideoThumbnail: true,
        documentationUrl: true,
        blogArticleUrl: true,
        sortOrder: true,
        downloadCount: true,
        deploymentCount: true,
        autoActivate: true,
        publishedAt: true,
        createdAt: true,
        updatedAt: true,
        // Don't expose createdBy or other admin fields
      },
    });

    if (!product) {
      return NextResponse.json(
        {
          success: false,
          error: 'Product not found or not available',
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: product,
    });
  } catch (error) {
    console.error('Error fetching workflow product for partner:', error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid product ID',
        },
        { status: 400 }
      );
    }

    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch workflow product',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
