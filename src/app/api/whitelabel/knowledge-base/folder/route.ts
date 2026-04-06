import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyWhitelabelAuth } from '@/lib/whitelabelAuth';

// Mark this route as dynamic
export const dynamic = 'force-dynamic';

// GET /api/whitelabel/knowledge-base/folder?knowledgeBaseId=xxx
// Get all folders for a knowledge base
export async function GET(request: NextRequest) {
  try {
    // Verify authentication
    const authResult = await verifyWhitelabelAuth(request);
    if (!authResult) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { customerId, partnerId } = authResult;

    // Get query parameters
    const url = new URL(request.url);
    const knowledgeBaseId = url.searchParams.get('knowledgeBaseId');
    const parentFolderId = url.searchParams.get('parentFolderId');

    if (!knowledgeBaseId) {
      return NextResponse.json(
        { error: 'Knowledge base ID is required' },
        { status: 400 }
      );
    }

    // Verify the knowledge base belongs to the customer
    const knowledgeBase = await prisma.knowledgeBase.findFirst({
      where: {
        id: knowledgeBaseId,
        customerId,
        partnerId,
      },
    });

    if (!knowledgeBase) {
      return NextResponse.json(
        { error: 'Knowledge base not found' },
        { status: 404 }
      );
    }

    // Get all folders for the knowledge base
    const folders = await prisma.knowledgeBaseFolder.findMany({
      where: {
        knowledgeBaseId,
        parentFolderId: parentFolderId || null,
      },
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
      orderBy: {
        name: 'asc',
      },
    });

    // Get files in the current folder
    const files = await prisma.knowledgeBaseFile.findMany({
      where: {
        knowledgeBaseId,
        folderId: parentFolderId || null,
      },
      select: {
        id: true,
        name: true,
        description: true,
        fileType: true,
        fileSize: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: {
        name: 'asc',
      },
    });

    return NextResponse.json({ folders, files });
  } catch (error) {
    console.error('Error fetching folders:', error);
    return NextResponse.json(
      { error: 'Failed to fetch folders' },
      { status: 500 }
    );
  }
}

// POST /api/whitelabel/knowledge-base/folder
// Create a new folder
export async function POST(request: NextRequest) {
  try {
    // Verify authentication
    const authResult = await verifyWhitelabelAuth(request);
    if (!authResult) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { customerId, partnerId } = authResult;

    // Parse request body
    const body = await request.json();
    const { name, description, knowledgeBaseId, parentFolderId } = body;

    if (!name || !knowledgeBaseId) {
      return NextResponse.json(
        { error: 'Name and knowledge base ID are required' },
        { status: 400 }
      );
    }

    // Verify the knowledge base belongs to the customer
    const knowledgeBase = await prisma.knowledgeBase.findFirst({
      where: {
        id: knowledgeBaseId,
        customerId,
        partnerId,
      },
    });

    if (!knowledgeBase) {
      return NextResponse.json(
        { error: 'Knowledge base not found' },
        { status: 404 }
      );
    }

    // If parentFolderId is provided, verify it belongs to the knowledge base
    if (parentFolderId) {
      const parentFolder = await prisma.knowledgeBaseFolder.findFirst({
        where: {
          id: parentFolderId,
          knowledgeBaseId,
        },
      });

      if (!parentFolder) {
        return NextResponse.json(
          { error: 'Parent folder not found' },
          { status: 404 }
        );
      }
    }

    // Create a new folder
    const folder = await prisma.knowledgeBaseFolder.create({
      data: {
        name,
        description,
        knowledgeBaseId,
        parentFolderId: parentFolderId || null,
      },
    });

    return NextResponse.json({ folder }, { status: 201 });
  } catch (error) {
    console.error('Error creating folder:', error);
    return NextResponse.json(
      { error: 'Failed to create folder' },
      { status: 500 }
    );
  }
}
