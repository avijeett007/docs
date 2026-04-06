import { NextResponse, NextRequest } from 'next/server';

// This route uses dynamic features, so it must be server-rendered
export const dynamic = 'force-dynamic';

import { getAuth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/prisma';
import { S3Client } from '@aws-sdk/client-s3';

interface KnowledgeBase {
  id: string;
  name: string;
  description: string;
}

interface UpdateMetadataRequest {
  documentId: string;
  knowledgeBases: KnowledgeBase[];
}

const s3Client = new S3Client({
  region: 'auto',
  endpoint: process.env.R2_ENDPOINT,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  },
});

export async function PATCH(req: NextRequest) {
  try {
    const { userId } = getAuth(req);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { documentId, knowledgeBases = [] } = body as UpdateMetadataRequest;

    console.log('Updating document metadata:', { documentId, knowledgeBases });

    if (!documentId) {
      return NextResponse.json({ error: 'Document ID is required' }, { status: 400 });
    }

    if (!Array.isArray(knowledgeBases)) {
      return NextResponse.json(
        { error: 'Knowledge bases must be an array' },
        { status: 400 }
      );
    }

    // Get document with current associations
    const document = await prisma.document.findFirst({
      where: { id: documentId, userId },
      include: {
        knowledgeBases: {
          include: {
            knowledgeBase: true,
          },
        },
      },
    });

    if (!document) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 });
    }

    // Calculate which knowledge bases are affected
    const currentKbIds = document.knowledgeBases.map(kb => kb.knowledgeBase.id);
    const newKbIds = knowledgeBases.map(kb => kb.id);
    const addedKbIds = newKbIds.filter(id => !currentKbIds.includes(id));
    const removedKbIds = currentKbIds.filter(id => !newKbIds.includes(id));
    const affectedKbIds = [...addedKbIds, ...removedKbIds];

    console.log('Knowledge base changes:', {
      current: currentKbIds,
      new: newKbIds,
      added: addedKbIds,
      removed: removedKbIds,
      affected: affectedKbIds
    });

    // Update database associations and reEmbed flags in a transaction
    await prisma.$transaction(async (prisma) => {
      // Delete existing associations
      await prisma.knowledgeBaseDocument.deleteMany({
        where: { documentId },
      });

      // Create new associations
      if (knowledgeBases.length > 0) {
        await prisma.knowledgeBaseDocument.createMany({
          data: knowledgeBases.map((kb) => ({
            documentId,
            knowledgeBaseId: kb.id,
          })),
        });
      }

      // Set reEmbed flag for affected knowledge bases
      if (affectedKbIds.length > 0) {
        const updateResult = await prisma.knowledgeBase.updateMany({
          where: {
            id: {
              in: affectedKbIds
            },
            isEmbed: 'done'
          },
          data: {
            reEmbed: true
          }
        });

        console.log('Updated knowledge bases:', updateResult);
      }
    });

    // Get updated document with new associations
    const updatedDocument = await prisma.document.findFirst({
      where: { id: documentId },
      include: {
        knowledgeBases: {
          include: {
            knowledgeBase: true,
          },
        },
      },
    });

    return NextResponse.json(updatedDocument);
  } catch (error) {
    console.error('Error updating document metadata:', error);
    return NextResponse.json(
      { error: 'Failed to update document metadata' },
      { status: 500 }
    );
  }
}
