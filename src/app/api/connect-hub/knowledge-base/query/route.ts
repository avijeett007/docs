import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { embeddingService } from '@/lib/embeddingService';
import { z } from 'zod';

// Mark this route as dynamic
export const dynamic = 'force-dynamic';

// Request validation schema
const connectHubQuerySchema = z.object({
  query: z.string().min(1, 'Query is required').max(1000, 'Query too long'),
  knowledgeBaseId: z.string().uuid('Invalid knowledge base ID'),
  agentId: z.string().optional(),
  sessionId: z.string().optional(),
  limit: z.number().int().min(1).max(20).optional().default(5),
  scoreThreshold: z.number().min(0).max(1).optional().default(0.7),
});

// Verify Connect Hub authentication
async function verifyConnectHubAuth(request: NextRequest): Promise<{
  partnerId: string;
  customerId: string;
} | null> {
  try {
    // Check for Connect Hub API key
    const apiKey = request.headers.get('X-Connect-Hub-Key') || 
                   request.headers.get('Authorization')?.replace('Bearer ', '');
    
    if (!apiKey) {
      return null;
    }

    // For now, use environment variable for Connect Hub authentication
    if (apiKey === process.env.CONNECT_HUB_API_KEY) {
      // Extract partner and customer info from headers
      const partnerId = request.headers.get('X-Partner-ID');
      const customerId = request.headers.get('X-Customer-ID');

      if (!partnerId || !customerId) {
        return null;
      }

      return { partnerId, customerId };
    }

    // TODO: Implement proper Connect Hub API key validation
    // This would check against a connect_hub_api_keys table
    
    return null;
  } catch (error) {
    console.error('Error verifying Connect Hub auth:', error);
    return null;
  }
}

// POST /api/connect-hub/knowledge-base/query
// Query knowledge base for Connect Hub service (used by agents)
export async function POST(request: NextRequest) {
  try {
    // Verify Connect Hub authentication
    const authResult = await verifyConnectHubAuth(request);
    if (!authResult) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { partnerId, customerId } = authResult;

    // Parse and validate request body
    const body = await request.json();
    const validatedData = connectHubQuerySchema.parse(body);
    const { query, knowledgeBaseId, agentId, sessionId, limit, scoreThreshold } = validatedData;

    // Verify knowledge base exists and belongs to the partner/customer
    const knowledgeBase = await prisma.knowledgeBase.findFirst({
      where: {
        id: knowledgeBaseId,
        partnerId,
        customerId,
      },
      select: {
        id: true,
        name: true,
        qdrantCollectionName: true,
        totalVectors: true,
      },
    });

    if (!knowledgeBase) {
      return NextResponse.json(
        { error: 'Knowledge base not found or access denied' },
        { status: 403 }
      );
    }

    // Check if knowledge base has been processed
    if (!knowledgeBase.qdrantCollectionName || knowledgeBase.totalVectors === 0) {
      return NextResponse.json({
        query,
        results: [],
        totalResults: 0,
        message: 'Knowledge base has not been processed yet',
        knowledgeBase: {
          id: knowledgeBase.id,
          name: knowledgeBase.name,
          processed: false,
        },
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
          includeMetadata: true,
        }
      );

      if (searchResult.status !== 'success' || !searchResult.data?.results) {
        return NextResponse.json({
          query,
          results: [],
          totalResults: 0,
          error: 'Search failed',
          knowledgeBase: {
            id: knowledgeBase.id,
            name: knowledgeBase.name,
            processed: true,
          },
        });
      }

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
          },
        });

        files.forEach(file => {
          fileInfoMap.set(file.id, file);
        });
      }

      // Format results for Connect Hub
      const formattedResults = searchResult.data.results.map(result => {
        const fileInfo = fileInfoMap.get(result.file_id);
        return {
          score: result.score,
          content: result.content,
          file_id: result.file_id,
          file_name: fileInfo?.name || result.file_name || 'Unknown file',
          file_type: fileInfo?.fileType,
          source_type: 'knowledge_base',
          metadata: result.metadata,
        };
      });

      // Log the query for analytics
      try {
        await prisma.agentQueryLog.create({
          data: {
            query,
            agentId: agentId || 'connect-hub-unknown',
            partnerId,
            customerId,
            knowledgeBaseIds: [knowledgeBaseId],
            resultsCount: formattedResults.length,
            searchDuration: 0, // Could be calculated if needed
          },
        });
      } catch (logError) {
        console.warn('Failed to log Connect Hub query:', logError);
        // Don't fail the request if logging fails
      }

      return NextResponse.json({
        query,
        results: formattedResults,
        totalResults: formattedResults.length,
        knowledgeBase: {
          id: knowledgeBase.id,
          name: knowledgeBase.name,
          processed: true,
          totalVectors: knowledgeBase.totalVectors,
        },
        searchParams: {
          limit,
          scoreThreshold,
        },
        timestamp: new Date().toISOString(),
      });

    } catch (searchError) {
      console.error('Error querying embedding service:', searchError);
      return NextResponse.json({
        query,
        results: [],
        totalResults: 0,
        error: 'Search service temporarily unavailable',
        knowledgeBase: {
          id: knowledgeBase.id,
          name: knowledgeBase.name,
          processed: true,
        },
      });
    }

  } catch (error) {
    console.error('Error in Connect Hub knowledge base query:', error);

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
      { error: 'Failed to query knowledge base' },
      { status: 500 }
    );
  }
}

// GET /api/connect-hub/knowledge-base/query?q=query&kb=id
// Simple query endpoint for Connect Hub
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get('q');
    const knowledgeBaseId = searchParams.get('kb');
    const agentId = searchParams.get('agent_id');
    const limit = parseInt(searchParams.get('limit') || '5');

    if (!query || !knowledgeBaseId) {
      return NextResponse.json(
        { error: 'Query (q) and knowledge base ID (kb) are required' },
        { status: 400 }
      );
    }

    // Forward to POST endpoint
    const postRequest = new NextRequest(request.url, {
      method: 'POST',
      headers: request.headers,
      body: JSON.stringify({
        query,
        knowledgeBaseId,
        agentId,
        limit,
        scoreThreshold: 0.7,
      }),
    });

    return await POST(postRequest);

  } catch (error) {
    console.error('Error in GET Connect Hub query endpoint:', error);
    return NextResponse.json(
      { error: 'Failed to process query request' },
      { status: 500 }
    );
  }
}
