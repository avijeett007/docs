import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyOnboardingAuth } from '@/lib/onboardingAuth';
import { embeddingService } from '@/lib/embeddingService';

// Mark this route as dynamic
export const dynamic = 'force-dynamic';

// GET /api/whitelabel/knowledge-base
// Get all knowledge bases for the current customer
export async function GET(request: NextRequest) {
  try {
    // Verify authentication (supports both prospect and customer tokens for onboarding)
    const authResult = await verifyOnboardingAuth(request);
    if (!authResult) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { customerId, partnerId } = authResult;

    // Get all knowledge bases for the customer
    const knowledgeBases = await prisma.knowledgeBase.findMany({
      where: {
        customerId,
        partnerId,
      },
      select: {
        id: true,
        name: true,
        description: true,
        createdAt: true,
        updatedAt: true,
        folders: {
          select: {
            id: true,
            name: true,
            description: true,
            createdAt: true,
            updatedAt: true,
            _count: {
              select: {
                files: true,
                childFolders: true,
              },
            },
          },
          where: {
            parentFolderId: null, // Only include root folders
          },
        },
        files: {
          select: {
            id: true,
            name: true,
            description: true,
            fileType: true,
            fileSize: true,
            createdAt: true,
            updatedAt: true,
          },
          where: {
            folderId: null, // Only include root files
          },
        },
        _count: {
          select: {
            folders: true,
            files: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    // Calculate total size for each knowledge base (including all files, not just root files)
    const knowledgeBasesWithTotalSize = await Promise.all(
      knowledgeBases.map(async (kb) => {
        // Get total size by aggregating all files in the knowledge base
        const totalSizeResult = await prisma.knowledgeBaseFile.aggregate({
          where: {
            knowledgeBaseId: kb.id,
          },
          _sum: {
            fileSize: true,
          },
        });

        const totalSize = totalSizeResult._sum.fileSize || 0;

        return {
          ...kb,
          totalSize,
        };
      })
    );

    return NextResponse.json({ knowledgeBases: knowledgeBasesWithTotalSize });
  } catch (error) {
    console.error('Error fetching knowledge bases:', error);
    return NextResponse.json(
      { error: 'Failed to fetch knowledge bases' },
      { status: 500 }
    );
  }
}

// POST /api/whitelabel/knowledge-base
// Create a new knowledge base
export async function POST(request: NextRequest) {
  try {
    // Verify authentication (supports both prospect and customer tokens for onboarding)
    const authResult = await verifyOnboardingAuth(request);
    if (!authResult) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { customerId, partnerId, userId } = authResult;

    // Parse request body
    const body = await request.json();
    const { name, description } = body;

    if (!name) {
      return NextResponse.json(
        { error: 'Name is required' },
        { status: 400 }
      );
    }

    // Create a new knowledge base
    const knowledgeBase = await prisma.knowledgeBase.create({
      data: {
        name,
        description,
        userId,
        customerId,
        partnerId,
      },
    });

    // Try to create collection in embedding service
    try {
      const embeddingResult = await embeddingService.createKnowledgeBase(
        knowledgeBase.id,
        partnerId,
        customerId,
        name
      );

      if (embeddingResult.status === 'success') {
        // Update knowledge base with embedding service info
        await prisma.knowledgeBase.update({
          where: { id: knowledgeBase.id },
          data: {
            qdrantCollectionName: embeddingResult.data?.collection_name,
            embeddingConfig: {
              model: 'text-embedding-3-small',
              chunk_size: 1024,
              chunk_overlap: 100,
              chunk_strategy: 'hierarchical'
            },
          },
        });

        console.log('Knowledge base collection created in embedding service:', {
          kbId: knowledgeBase.id,
          collectionName: embeddingResult.data?.collection_name
        });
      }
    } catch (embeddingError) {
      console.warn('Failed to create embedding service collection:', embeddingError);
      // Continue without embedding service - it can be created later
    }

    return NextResponse.json({ knowledgeBase }, { status: 201 });
  } catch (error) {
    console.error('Error creating knowledge base:', error);
    return NextResponse.json(
      { error: 'Failed to create knowledge base' },
      { status: 500 }
    );
  }
}
