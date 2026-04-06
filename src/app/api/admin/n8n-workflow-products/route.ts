import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import {
  createWorkflowProductSchema,
  workflowProductFiltersSchema,
  sanitizeInput
} from '@/lib/validations/n8n';
import { z } from 'zod';
import { verifyAdminAuth } from '@/lib/adminAuth';

/**
 * GET /api/admin/n8n-workflow-products
 * Get all workflow products with filtering and pagination
 */
export async function GET(request: NextRequest) {
  try {
    // Verify admin authentication
    const user = await verifyAdminAuth(request);
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized - Admin access required' },
        { status: 401 }
      );
    }
    const { searchParams } = new URL(request.url);
    
    // Parse and validate query parameters
    const filters = sanitizeInput(workflowProductFiltersSchema, {
      category: searchParams.get('category') || undefined,
      difficulty: searchParams.get('difficulty') || undefined,
      isActive: searchParams.get('isActive') ? searchParams.get('isActive') === 'true' : undefined,
      isPublished: searchParams.get('isPublished') ? searchParams.get('isPublished') === 'true' : undefined,
      search: searchParams.get('search') || undefined,
      tags: searchParams.get('tags') ? searchParams.get('tags')!.split(',') : undefined,
      page: parseInt(searchParams.get('page') || '1'),
      limit: parseInt(searchParams.get('limit') || '20'),
      sortBy: (searchParams.get('sortBy') as any) || 'sortOrder',
      sortOrder: (searchParams.get('sortOrder') as any) || 'asc',
    });

    // Build where clause
    const where: any = {};
    
    if (filters.category) where.category = filters.category;
    if (filters.difficulty) where.difficulty = filters.difficulty;
    if (filters.isActive !== undefined) where.isActive = filters.isActive;
    if (filters.isPublished !== undefined) where.isPublished = filters.isPublished;
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

    // Get products
    const products = await prisma.n8nWorkflowProduct.findMany({
      where,
      skip,
      take: filters.limit || 10,
      orderBy: { [filters.sortBy || 'createdAt']: filters.sortOrder || 'desc' },
      include: {
        _count: {
          select: {
            deployments: true,
          },
        },
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
    console.error('Error fetching workflow products:', error);
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
 * POST /api/admin/n8n-workflow-products
 * Create a new workflow product
 */
export async function POST(request: NextRequest) {
  try {
    // Verify admin authentication
    const user = await verifyAdminAuth(request);
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized - Admin access required' },
        { status: 401 }
      );
    }

    const body = await request.json();

    // Validate input
    const validatedData = sanitizeInput(createWorkflowProductSchema, body);

    // Get admin user ID from authentication
    const adminUserId = user.id;

    // Create workflow product
    const product = await prisma.n8nWorkflowProduct.create({
      data: {
        ...validatedData,
        createdBy: adminUserId,
      },
    });

    return NextResponse.json({
      success: true,
      data: product,
      message: 'Workflow product created successfully',
    });
  } catch (error) {
    console.error('Error creating workflow product:', error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          success: false,
          error: 'Validation error',
          details: error.errors,
        },
        { status: 400 }
      );
    }

    return NextResponse.json(
      {
        success: false,
        error: 'Failed to create workflow product',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/admin/n8n-workflow-products
 * Bulk delete workflow products
 */
export async function DELETE(request: NextRequest) {
  try {
    // Verify admin authentication
    const user = await verifyAdminAuth(request);
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized - Admin access required' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { ids } = body;

    if (!Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid request',
          message: 'Product IDs array is required',
        },
        { status: 400 }
      );
    }

    // Validate all IDs are UUIDs
    const uuidSchema = z.string().uuid();
    const validatedIds = ids.map(id => uuidSchema.parse(id));

    // Check if any products have active deployments
    const productsWithDeployments = await prisma.n8nWorkflowProduct.findMany({
      where: {
        id: { in: validatedIds },
        deployments: {
          some: {
            status: { in: ['pending', 'in_progress'] },
          },
        },
      },
      select: { id: true, name: true },
    });

    if (productsWithDeployments.length > 0) {
      return NextResponse.json(
        {
          success: false,
          error: 'Cannot delete products with active deployments',
          details: productsWithDeployments,
        },
        { status: 400 }
      );
    }

    // Delete products
    const result = await prisma.n8nWorkflowProduct.deleteMany({
      where: { id: { in: validatedIds } },
    });

    return NextResponse.json({
      success: true,
      data: { deletedCount: result.count },
      message: `Successfully deleted ${result.count} workflow products`,
    });
  } catch (error) {
    console.error('Error deleting workflow products:', error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          success: false,
          error: 'Validation error',
          details: error.errors,
        },
        { status: 400 }
      );
    }

    return NextResponse.json(
      {
        success: false,
        error: 'Failed to delete workflow products',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
