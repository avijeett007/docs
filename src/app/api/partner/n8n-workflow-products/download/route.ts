import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyPartnerToken } from '@/lib/auth';
import { z } from 'zod';

const downloadTrackingSchema = z.object({
  productId: z.string().uuid('Invalid product ID format'),
});

/**
 * POST /api/partner/n8n-workflow-products/download
 * Track workflow product download
 */
export async function POST(request: NextRequest) {
  try {
    // Verify partner authentication
    const authResult = await verifyPartnerToken(request);
    if (!authResult.success || !authResult.partner) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { productId } = downloadTrackingSchema.parse(body);

    // Verify product exists and is published
    const product = await prisma.n8nWorkflowProduct.findUnique({
      where: { 
        id: productId,
        isPublished: true,
        isActive: true,
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
    console.error('Error tracking workflow download:', error);
    
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
        error: 'Failed to track download',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
