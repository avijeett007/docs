import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import {
  updateWorkflowProductSchema,
  sanitizeInput
} from '@/lib/validations/n8n';
import { z } from 'zod';
import { verifyAdminAuth } from '@/lib/adminAuth';

/**
 * GET /api/admin/n8n-workflow-products/[id]
 * Get a specific workflow product by ID
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Verify admin authentication
    const user = await verifyAdminAuth(request);
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized - Admin access required' },
        { status: 401 }
      );
    }
    const { id } = params;

    // Validate ID format
    const uuidSchema = z.string().uuid();
    const validatedId = uuidSchema.parse(id);

    // Get product with deployment statistics
    const product = await prisma.n8nWorkflowProduct.findUnique({
      where: { id: validatedId },
      include: {
        deployments: {
          select: {
            id: true,
            status: true,
            createdAt: true,
            partner: {
              select: {
                id: true,
                businessName: true,
              },
            },
            customer: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
              },
            },
          },
          orderBy: { createdAt: 'desc' },
          take: 10, // Latest 10 deployments
        },
        _count: {
          select: {
            deployments: true,
          },
        },
      },
    });

    if (!product) {
      return NextResponse.json(
        {
          success: false,
          error: 'Product not found',
        },
        { status: 404 }
      );
    }

    // Calculate deployment statistics
    const deploymentStats = {
      total: product._count.deployments,
      successful: product.deployments.filter(d => d.status === 'completed').length,
      failed: product.deployments.filter(d => d.status === 'failed').length,
      pending: product.deployments.filter(d => d.status === 'pending').length,
      inProgress: product.deployments.filter(d => d.status === 'in_progress').length,
    };

    return NextResponse.json({
      success: true,
      data: {
        ...product,
        deploymentStats,
      },
    });
  } catch (error) {
    console.error('Error fetching workflow product:', error);
    
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

/**
 * PUT /api/admin/n8n-workflow-products/[id]
 * Update a workflow product
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Verify admin authentication
    const user = await verifyAdminAuth(request);
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized - Admin access required' },
        { status: 401 }
      );
    }
    const { id } = params;
    const body = await request.json();

    // Validate ID format
    const uuidSchema = z.string().uuid();
    const validatedId = uuidSchema.parse(id);

    // Validate input
    const validatedData = sanitizeInput(updateWorkflowProductSchema, body);

    // Check if product exists
    const existingProduct = await prisma.n8nWorkflowProduct.findUnique({
      where: { id: validatedId },
    });

    if (!existingProduct) {
      return NextResponse.json(
        {
          success: false,
          error: 'Product not found',
        },
        { status: 404 }
      );
    }

    // Handle publishing logic
    const updateData: any = { ...validatedData };
    if (validatedData.isPublished === true && !existingProduct.isPublished) {
      updateData.publishedAt = new Date();
    } else if (validatedData.isPublished === false) {
      updateData.publishedAt = null;
    }

    // Update product
    const product = await prisma.n8nWorkflowProduct.update({
      where: { id: validatedId },
      data: updateData,
    });

    return NextResponse.json({
      success: true,
      data: product,
      message: 'Workflow product updated successfully',
    });
  } catch (error) {
    console.error('Error updating workflow product:', error);
    
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
        error: 'Failed to update workflow product',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/admin/n8n-workflow-products/[id]
 * Delete a workflow product
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Verify admin authentication
    const user = await verifyAdminAuth(request);
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized - Admin access required' },
        { status: 401 }
      );
    }
    const { id } = params;

    // Validate ID format
    const uuidSchema = z.string().uuid();
    const validatedId = uuidSchema.parse(id);

    // Check if product exists
    const existingProduct = await prisma.n8nWorkflowProduct.findUnique({
      where: { id: validatedId },
      include: {
        deployments: {
          where: {
            status: { in: ['pending', 'in_progress'] },
          },
        },
      },
    });

    if (!existingProduct) {
      return NextResponse.json(
        {
          success: false,
          error: 'Product not found',
        },
        { status: 404 }
      );
    }

    // Check for active deployments
    if (existingProduct.deployments.length > 0) {
      return NextResponse.json(
        {
          success: false,
          error: 'Cannot delete product with active deployments',
          message: `Product has ${existingProduct.deployments.length} active deployments`,
        },
        { status: 400 }
      );
    }

    // Delete product
    await prisma.n8nWorkflowProduct.delete({
      where: { id: validatedId },
    });

    return NextResponse.json({
      success: true,
      message: 'Workflow product deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting workflow product:', error);
    
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
        error: 'Failed to delete workflow product',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
