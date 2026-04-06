import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyOnboardingAuth } from '@/lib/onboardingAuth';
import { embeddingService } from '@/lib/embeddingService';
import { z } from 'zod';

// Mark this route as dynamic
export const dynamic = 'force-dynamic';

// Request validation schema
const searchRequestSchema = z.object({
  query: z.string().min(1, 'Query is required').max(500, 'Query too long'),
  knowledgeBaseId: z.string().uuid('Invalid knowledge base ID'),
  limit: z.number().int().min(1).max(50).optional().default(10),
  scoreThreshold: z.number().min(0).max(1).optional().default(0.7),
  includeMetadata: z.boolean().optional().default(true),
});

// POST /api/whitelabel/knowledge-base/search
// Search across knowledge base using semantic search
export async function POST(request: NextRequest) {
  try {
    // Verify authentication (supports both prospect and customer tokens for onboarding)
    const authResult = await verifyOnboardingAuth(request);
    if (!authResult) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { customerId, partnerId } = authResult;

    // Parse and validate request body
    const body = await request.json();
    const validatedData = searchRequestSchema.parse(body);
    const { query, knowledgeBaseId, limit, scoreThreshold, includeMetadata } = validatedData;

    // Verify the knowledge base belongs to the customer
    const knowledgeBase = await prisma.knowledgeBase.findFirst({
      where: {
        id: knowledgeBaseId,
        customerId,
        partnerId,
      },
      select: {
        id: true,
        name: true,
        qdrantCollectionName: true,
        embeddingConfig: true,
      },
    });

    if (!knowledgeBase) {
      return NextResponse.json(
        { error: 'Knowledge base not found' },
        { status: 404 }
      );
    }

    // Check if embedding service is available and knowledge base has been processed
    if (!knowledgeBase.qdrantCollectionName) {
      return NextResponse.json({
        query,
        results: [],
        totalResults: 0,
        message: 'Knowledge base has not been processed for semantic search yet',
        suggestion: 'Please upload and process documents first',
      });
    }

    try {
      // Query the embedding service
      const searchResult = await embeddingService.queryKnowledgeBase(
        knowledgeBaseId,
        partnerId,
        customerId,
        query,
        {
          limit,
          scoreThreshold,
          includeMetadata,
        }
      );

      if (searchResult.status === 'success' && searchResult.data) {
        // Get file information for the results
        const fileIds = searchResult.data.results.map(r => r.file_id).filter(Boolean);
        const fileInfoMap = new Map();

        if (fileIds.length > 0) {
          const files = await prisma.knowledgeBaseFile.findMany({
            where: {
              id: { in: fileIds },
              customerId,
              partnerId,
            },
            select: {
              id: true,
              name: true,
              fileType: true,
              createdAt: true,
            },
          });

          files.forEach(file => {
            fileInfoMap.set(file.id, file);
          });
        }

        // Enhance results with file information
        const enhancedResults = searchResult.data.results.map(result => {
          const fileInfo = fileInfoMap.get(result.file_id);
          return {
            score: result.score,
            content: result.content,
            file_id: result.file_id,
            file_name: fileInfo?.name || result.file_name || 'Unknown file',
            file_type: fileInfo?.fileType,
            created_at: fileInfo?.createdAt,
            metadata: result.metadata,
            // Truncate content for display
            preview: result.content.length > 200 
              ? result.content.substring(0, 200) + '...' 
              : result.content,
          };
        });

        // Log the search for analytics
        try {
          await prisma.knowledgeBaseSearchLog.create({
            data: {
              query,
              knowledgeBaseId,
              customerId,
              partnerId,
              resultsCount: enhancedResults.length,
              searchDuration: 0, // Could be calculated if needed
              filters: {
                limit,
                scoreThreshold,
                includeMetadata,
              },
            },
          });
        } catch (logError) {
          console.warn('Failed to log search query:', logError);
          // Don't fail the request if logging fails
        }

        return NextResponse.json({
          query,
          results: enhancedResults,
          totalResults: enhancedResults.length,
          knowledgeBase: {
            id: knowledgeBase.id,
            name: knowledgeBase.name,
          },
          searchParams: {
            limit,
            scoreThreshold,
            includeMetadata,
          },
          timestamp: new Date().toISOString(),
        });

      } else {
        throw new Error('Invalid response from embedding service');
      }

    } catch (embeddingError) {
      console.error('Embedding service search failed:', embeddingError);
      
      // Return a helpful error message
      return NextResponse.json({
        query,
        results: [],
        totalResults: 0,
        error: 'Search service temporarily unavailable',
        message: 'The semantic search service is currently unavailable. Please try again later.',
        fallbackSuggestion: 'You can browse files manually in the knowledge base.',
      }, { status: 503 });
    }

  } catch (error) {
    console.error('Error searching knowledge base:', error);

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
      { error: 'Failed to search knowledge base' },
      { status: 500 }
    );
  }
}

// GET /api/whitelabel/knowledge-base/search?q=query&kb=id
// Simple search endpoint for quick queries
export async function GET(request: NextRequest) {
  try {
    // Verify authentication (supports both prospect and customer tokens for onboarding)
    const authResult = await verifyOnboardingAuth(request);
    if (!authResult) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const query = searchParams.get('q');
    const knowledgeBaseId = searchParams.get('kb');
    const limit = parseInt(searchParams.get('limit') || '5');

    if (!query || !knowledgeBaseId) {
      return NextResponse.json(
        { error: 'Query (q) and knowledge base ID (kb) are required' },
        { status: 400 }
      );
    }

    // Forward to POST endpoint with default parameters
    const postRequest = new NextRequest(request.url, {
      method: 'POST',
      headers: request.headers,
      body: JSON.stringify({
        query,
        knowledgeBaseId,
        limit,
        scoreThreshold: 0.7,
        includeMetadata: true,
      }),
    });

    return await POST(postRequest);

  } catch (error) {
    console.error('Error in GET search endpoint:', error);
    return NextResponse.json(
      { error: 'Failed to process search request' },
      { status: 500 }
    );
  }
}
