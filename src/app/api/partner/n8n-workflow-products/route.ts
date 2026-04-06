import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { 
  workflowProductFiltersSchema,
  sanitizeInput 
} from '@/lib/validations/n8n';

/**
 * GET /api/partner/n8n-workflow-products
 * Get published workflow products for partners
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    
    // Parse and validate query parameters
    const filters = sanitizeInput(workflowProductFiltersSchema, {
      category: searchParams.get('category') || undefined,
      difficulty: searchParams.get('difficulty') || undefined,
      search: searchParams.get('search') || undefined,
      tags: searchParams.get('tags') ? searchParams.get('tags')!.split(',') : undefined,
      page: parseInt(searchParams.get('page') || '1'),
      limit: parseInt(searchParams.get('limit') || '20'),
      sortBy: (searchParams.get('sortBy') as any) || 'sortOrder',
      sortOrder: (searchParams.get('sortOrder') as any) || 'asc',
    });

    // Build where clause - only show published and active products
    const where: any = {
      isActive: true,
      isPublished: true,
    };
    
    if (filters.category) where.category = filters.category;
    if (filters.difficulty) where.difficulty = filters.difficulty;
    if (filters.search) {
      where.OR = [
        { name: { contains: filters.search, mode: 'insensitive' } },
        { description: { contains: filters.search, mode: 'insensitive' } },
      ];
    }
    if (filters.tags && filters.tags.length > 0) {
      where.tags = { hasSome: filters.tags };
    }

    // Calculate pagination
    const skip = ((filters.page || 1) - 1) * (filters.limit || 10);

    // Get total count
    const total = await prisma.n8nWorkflowProduct.count({ where });

    // Get products (exclude sensitive admin fields)
    const products = await prisma.n8nWorkflowProduct.findMany({
      where,
      skip,
      take: filters.limit || 10,
      orderBy: { [filters.sortBy || 'createdAt']: filters.sortOrder || 'desc' },
      select: {
        id: true,
        name: true,
        description: true,
        category: true,
        tags: true,
        difficulty: true,
        estimatedSetupTime: true,
        requiredNodes: true,
        setupVideoUrl: true,
        setupVideoThumbnail: true,
        documentationUrl: true,
        blogArticleUrl: true,
        sortOrder: true,
        downloadCount: true,
        deploymentCount: true,
        publishedAt: true,
        createdAt: true,
        updatedAt: true,
        // Don't expose workflowJson, createdBy, or other admin fields
      },
    });

    // Calculate pagination metadata
    const limit = filters.limit || 10;
    const page = filters.page || 1;
    const totalPages = Math.ceil(total / limit);
    const hasNext = page < totalPages;
    const hasPrev = page > 1;

    return NextResponse.json({
      success: true,
      data: products,
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasNext,
        hasPrev,
      },
    });
  } catch (error) {
    console.error('Error fetching workflow products for partner:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch workflow products',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/partner/n8n-workflow-products/download
 * Track workflow product download
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { productId } = body;

    if (!productId) {
      return NextResponse.json(
        {
          success: false,
          error: 'Product ID is required',
        },
        { status: 400 }
      );
    }

    // Validate product exists and is published
    const product = await prisma.n8nWorkflowProduct.findFirst({
      where: {
        id: productId,
        isActive: true,
        isPublished: true,
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

    // Increment download count
    await prisma.n8nWorkflowProduct.update({
      where: { id: productId },
      data: {
        downloadCount: {
          increment: 1,
        },
      },
    });

    return NextResponse.json({
      success: true,
      message: 'Download tracked successfully',
    });
  } catch (error) {
    console.error('Error tracking workflow product download:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to track download',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
