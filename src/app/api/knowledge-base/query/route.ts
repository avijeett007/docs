import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { embeddingService } from '@/lib/embeddingService';
import { z } from 'zod';

// Mark this route as dynamic
export const dynamic = 'force-dynamic';

// Request validation schema
const agentQuerySchema = z.object({
  query: z.string().min(1, 'Query is required').max(1000, 'Query too long'),
  knowledgeBaseIds: z.array(z.string().uuid()).min(1, 'At least one knowledge base ID required').max(10, 'Too many knowledge bases'),
  limit: z.number().int().min(1).max(20).optional().default(5),
  scoreThreshold: z.number().min(0).max(1).optional().default(0.7),
  agentId: z.string().optional(),
  sessionId: z.string().optional(),
});

// Verify agent authentication
async function verifyAgentAuth(request: NextRequest): Promise<{
  partnerId: string;
  customerId: string;
  agentId?: string;
} | null> {
  try {
    // Check for API key in headers
    const apiKey = request.headers.get('X-API-Key') || request.headers.get('Authorization')?.replace('Bearer ', '');
    
    if (!apiKey) {
      return null;
    }

    // For now, we'll use a simple API key validation
    // In production, this should validate against partner API keys
    if (apiKey === process.env.AGENT_API_KEY) {
      // Extract partner and customer info from request or use defaults
      const partnerId = request.headers.get('X-Partner-ID');
      const customerId = request.headers.get('X-Customer-ID');
      const agentId = request.headers.get('X-Agent-ID');

      if (!partnerId || !customerId) {
        return null;
      }

      return { partnerId, customerId, agentId: agentId || undefined };
    }

    // TODO: Implement proper partner API key validation
    // This would check against the partner_api_keys table
    
    return null;
  } catch (error) {
    console.error('Error verifying agent auth:', error);
    return null;
  }
}

// POST /api/knowledge-base/query
// Query knowledge bases for AI agents (LiveKit, etc.)
export async function POST(request: NextRequest) {
  try {
    // Verify agent authentication
    const authResult = await verifyAgentAuth(request);
    if (!authResult) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { partnerId, customerId, agentId } = authResult;

    // Parse and validate request body
    const body = await request.json();
    const validatedData = agentQuerySchema.parse(body);
    const { query, knowledgeBaseIds, limit, scoreThreshold } = validatedData;

    // Verify all knowledge bases belong to the customer
    const knowledgeBases = await prisma.knowledgeBase.findMany({
      where: {
        id: { in: knowledgeBaseIds },
        customerId,
        partnerId,
      },
      select: {
        id: true,
        name: true,
        qdrantCollectionName: true,
      },
    });

    if (knowledgeBases.length !== knowledgeBaseIds.length) {
      return NextResponse.json(
        { error: 'One or more knowledge bases not found or access denied' },
        { status: 403 }
      );
    }

    // Filter out knowledge bases that haven't been processed
    const processedKnowledgeBases = knowledgeBases.filter(kb => kb.qdrantCollectionName);

    if (processedKnowledgeBases.length === 0) {
      return NextResponse.json({
        query,
        results: [],
        totalResults: 0,
        knowledgeBasesQueried: 0,
        message: 'No processed knowledge bases available for search',
      });
    }

    const allResults = [];
    let queriedCount = 0;

    // Query each knowledge base
    for (const kb of processedKnowledgeBases) {
      try {
        const searchResult = await embeddingService.queryKnowledgeBase(
          kb.id,
          partnerId,
          customerId,
          query,
          {
            limit: Math.ceil(limit / processedKnowledgeBases.length), // Distribute limit across KBs
            scoreThreshold,
            includeMetadata: true,
          }
        );

        if (searchResult.status === 'success' && searchResult.data?.results) {
          // Add knowledge base context to results
          const resultsWithContext = searchResult.data.results.map(result => ({
            ...result,
            knowledge_base_id: kb.id,
            knowledge_base_name: kb.name,
            source_type: 'knowledge_base',
          }));

          allResults.push(...resultsWithContext);
          queriedCount++;
        }
      } catch (kbError) {
        console.error(`Error querying knowledge base ${kb.id}:`, kbError);
        // Continue with other knowledge bases
      }
    }

    // Sort by relevance score and limit results
    const sortedResults = allResults
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);

    // Get file information for the results
    const fileIds = sortedResults.map(r => r.file_id).filter(Boolean);
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

    // Enhance results with file information
    const enhancedResults = sortedResults.map(result => {
      const fileInfo = fileInfoMap.get(result.file_id);
      return {
        score: result.score,
        content: result.content,
        file_id: result.file_id,
        file_name: fileInfo?.name || result.file_name || 'Unknown file',
        file_type: fileInfo?.fileType,
        knowledge_base_id: result.knowledge_base_id,
        knowledge_base_name: result.knowledge_base_name,
        source_type: result.source_type,
        metadata: result.metadata,
      };
    });

    // Log the query for analytics
    try {
      await prisma.agentQueryLog.create({
        data: {
          query,
          agentId: agentId || 'unknown',
          partnerId,
          customerId,
          knowledgeBaseIds,
          resultsCount: enhancedResults.length,
          searchDuration: 0, // Could be calculated if needed
        },
      });
    } catch (logError) {
      console.warn('Failed to log agent query:', logError);
      // Don't fail the request if logging fails
    }

    return NextResponse.json({
      query,
      results: enhancedResults,
      totalResults: enhancedResults.length,
      knowledgeBasesQueried: queriedCount,
      searchParams: {
        limit,
        scoreThreshold,
      },
      timestamp: new Date().toISOString(),
    });

  } catch (error) {
    console.error('Error querying knowledge bases for agent:', error);

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
      { error: 'Failed to query knowledge bases' },
      { status: 500 }
    );
  }
}

// GET /api/knowledge-base/query?q=query&kb=id1,id2
// Simple query endpoint for agents
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get('q');
    const knowledgeBaseIds = searchParams.get('kb')?.split(',').filter(Boolean) || [];
    const limit = parseInt(searchParams.get('limit') || '5');

    if (!query || knowledgeBaseIds.length === 0) {
      return NextResponse.json(
        { error: 'Query (q) and knowledge base IDs (kb) are required' },
        { status: 400 }
      );
    }

    // Forward to POST endpoint
    const postRequest = new NextRequest(request.url, {
      method: 'POST',
      headers: request.headers,
      body: JSON.stringify({
        query,
        knowledgeBaseIds,
        limit,
        scoreThreshold: 0.7,
      }),
    });

    return await POST(postRequest);

  } catch (error) {
    console.error('Error in GET agent query endpoint:', error);
    return NextResponse.json(
      { error: 'Failed to process query request' },
      { status: 500 }
    );
  }
}
