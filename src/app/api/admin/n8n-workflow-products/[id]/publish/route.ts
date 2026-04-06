import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';
import { verifyAdminAuth } from '@/lib/adminAuth';

/**
 * POST /api/admin/n8n-workflow-products/[id]/publish
 * Publish a workflow product
 */
export async function POST(
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

    // Check if product exists and is not already published
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

    if (existingProduct.isPublished) {
      return NextResponse.json(
        {
          success: false,
          error: 'Product is already published',
        },
        { status: 400 }
      );
    }

    // Validate product is ready for publishing
    const validationErrors = validateProductForPublishing(existingProduct);
    if (validationErrors.length > 0) {
      return NextResponse.json(
        {
          success: false,
          error: 'Product is not ready for publishing',
          details: validationErrors,
        },
        { status: 400 }
      );
    }

    // Publish product
    const product = await prisma.n8nWorkflowProduct.update({
      where: { id: validatedId },
      data: {
        isPublished: true,
        publishedAt: new Date(),
        isActive: true, // Ensure product is active when published
      },
    });

    return NextResponse.json({
      success: true,
      data: product,
      message: 'Workflow product published successfully',
    });
  } catch (error) {
    console.error('Error publishing workflow product:', error);
    
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
        error: 'Failed to publish workflow product',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/admin/n8n-workflow-products/[id]/publish
 * Unpublish a workflow product
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

    // Check if product exists and is published
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

    if (!existingProduct.isPublished) {
      return NextResponse.json(
        {
          success: false,
          error: 'Product is not published',
        },
        { status: 400 }
      );
    }

    // Check for active deployments
    if (existingProduct.deployments.length > 0) {
      return NextResponse.json(
        {
          success: false,
          error: 'Cannot unpublish product with active deployments',
          message: `Product has ${existingProduct.deployments.length} active deployments`,
        },
        { status: 400 }
      );
    }

    // Unpublish product
    const product = await prisma.n8nWorkflowProduct.update({
      where: { id: validatedId },
      data: {
        isPublished: false,
        publishedAt: null,
      },
    });

    return NextResponse.json({
      success: true,
      data: product,
      message: 'Workflow product unpublished successfully',
    });
  } catch (error) {
    console.error('Error unpublishing workflow product:', error);
    
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
        error: 'Failed to unpublish workflow product',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

/**
 * Validate if a product is ready for publishing
 */
function validateProductForPublishing(product: any): string[] {
  const errors: string[] = [];

  // Check required fields
  if (!product.name || product.name.trim().length === 0) {
    errors.push('Product name is required');
  }

  if (!product.description || product.description.trim().length === 0) {
    errors.push('Product description is required');
  }

  if (!product.workflowJson || Object.keys(product.workflowJson).length === 0) {
    errors.push('Workflow JSON is required');
  }

  // Validate workflow JSON structure
  if (product.workflowJson) {
    if (!product.workflowJson.nodes || !Array.isArray(product.workflowJson.nodes)) {
      errors.push('Workflow must contain nodes');
    } else if (product.workflowJson.nodes.length === 0) {
      errors.push('Workflow must contain at least one node');
    }

    if (!product.workflowJson.connections || typeof product.workflowJson.connections !== 'object') {
      errors.push('Workflow must contain connections');
    }

    // Check for Knotie node
    const hasKnotieNode = product.workflowJson.nodes?.some(
      (node: any) => node.type === 'n8n-nodes-knotie.knotie' || node.type.includes('knotie')
    );

    if (!hasKnotieNode) {
      errors.push('Workflow must contain at least one Knotie AI node');
    }
  }

  // Check category
  const validCategories = ['email', 'crm', 'social', 'automation', 'general'];
  if (!validCategories.includes(product.category)) {
    errors.push('Product must have a valid category');
  }

  // Check difficulty
  const validDifficulties = ['beginner', 'intermediate', 'advanced'];
  if (!validDifficulties.includes(product.difficulty)) {
    errors.push('Product must have a valid difficulty level');
  }

  // Validate URLs if provided
  if (product.setupVideoUrl) {
    try {
      new URL(product.setupVideoUrl);
    } catch {
      errors.push('Setup video URL must be a valid URL');
    }
  }

  if (product.documentationUrl) {
    try {
      new URL(product.documentationUrl);
    } catch {
      errors.push('Documentation URL must be a valid URL');
    }
  }

  if (product.blogArticleUrl) {
    try {
      new URL(product.blogArticleUrl);
    } catch {
      errors.push('Blog article URL must be a valid URL');
    }
  }

  return errors;
}
