import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { KnowledgeBaseProcessingService } from '@/lib/services/knowledgeBaseProcessingService';
import { z } from 'zod';

// Mark this route as dynamic
export const dynamic = 'force-dynamic';

// Request validation schema
const processRequestSchema = z.object({
  triggeredBy: z.enum(['customer', 'partner']).optional().default('customer'),
});

// POST /api/whitelabel/knowledge-base/[id]/process
// Process knowledge base and deduct credits
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const kbId = params.id;
    
    // Get partner and customer info from headers or session
    const partnerId = request.headers.get('X-Partner-ID');
    const customerId = request.headers.get('X-Customer-ID');
    
    if (!partnerId || !customerId) {
      return NextResponse.json(
        { error: 'Partner ID and Customer ID are required' },
        { status: 400 }
      );
    }

    // Parse request body
    const body = await request.json().catch(() => ({}));
    const { triggeredBy } = processRequestSchema.parse(body);

    // Verify knowledge base exists and belongs to the partner/customer
    const knowledgeBase = await prisma.knowledgeBase.findFirst({
      where: {
        id: kbId,
        partnerId,
        customerId,
      },
      select: {
        id: true,
        name: true,
        partnerId: true,
        customerId: true,
      }
    });

    if (!knowledgeBase) {
      return NextResponse.json(
        { error: 'Knowledge base not found' },
        { status: 404 }
      );
    }

    // Process the knowledge base
    const result = await KnowledgeBaseProcessingService.processKnowledgeBase(
      kbId,
      partnerId,
      customerId,
      triggeredBy
    );

    if (!result.success) {
      const statusCode = result.error?.includes('not enabled') ? 403 :
                        result.error?.includes('Insufficient credits') ? 402 :
                        result.error?.includes('already processed') ? 409 : 500;

      return NextResponse.json(
        { 
          error: result.error,
          alreadyProcessed: result.alreadyProcessed,
        },
        { status: statusCode }
      );
    }

    return NextResponse.json({
      success: true,
      message: result.alreadyProcessed 
        ? 'Knowledge base is already processed or currently processing'
        : 'Knowledge base processing started successfully',
      data: {
        knowledgeBaseId: kbId,
        creditsDeducted: result.creditsDeducted,
        newBalance: result.newBalance,
        processedFiles: result.processedFiles,
        alreadyProcessed: result.alreadyProcessed,
      }
    });

  } catch (error) {
    console.error('Error processing knowledge base:', error);

    // Handle validation errors
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { 
          error: 'Invalid request data',
          details: error.errors.map(e => ({
            field: e.path.join('.'),
            message: e.message,
          }))
        },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to process knowledge base' },
      { status: 500 }
    );
  }
}

// GET /api/whitelabel/knowledge-base/[id]/process
// Get processing cost estimate
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const kbId = params.id;
    
    // Get partner and customer info from headers or session
    const partnerId = request.headers.get('X-Partner-ID');
    const customerId = request.headers.get('X-Customer-ID');
    
    if (!partnerId || !customerId) {
      return NextResponse.json(
        { error: 'Partner ID and Customer ID are required' },
        { status: 400 }
      );
    }

    // Verify knowledge base exists
    const knowledgeBase = await prisma.knowledgeBase.findFirst({
      where: {
        id: kbId,
        partnerId,
        customerId,
      },
      select: {
        id: true,
        name: true,
      }
    });

    if (!knowledgeBase) {
      return NextResponse.json(
        { error: 'Knowledge base not found' },
        { status: 404 }
      );
    }

    // Get processing cost estimate
    const estimate = await KnowledgeBaseProcessingService.getProcessingCostEstimate(
      kbId,
      partnerId,
      customerId
    );

    // Check if processing is enabled for customer
    const processingEnabled = await KnowledgeBaseProcessingService.isProcessingEnabledForCustomer(
      partnerId,
      customerId
    );

    return NextResponse.json({
      success: true,
      data: {
        knowledgeBaseId: kbId,
        knowledgeBaseName: knowledgeBase.name,
        estimatedCost: estimate.cost,
        costBreakdown: estimate.breakdown,
        canProcess: estimate.canProcess && processingEnabled,
        processingEnabled,
        insufficientCredits: !estimate.canProcess,
        error: estimate.error,
      }
    });

  } catch (error) {
    console.error('Error getting processing estimate:', error);
    return NextResponse.json(
      { error: 'Failed to get processing estimate' },
      { status: 500 }
    );
  }
}
