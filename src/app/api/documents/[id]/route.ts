import { NextResponse, NextRequest } from 'next/server';

// This route uses dynamic features, so it must be server-rendered
export const dynamic = 'force-dynamic';

import { getAuth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/prisma';
import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';

// Initialize R2 client
const s3Client = new S3Client({
  region: 'auto',
  endpoint: process.env.R2_ENDPOINT,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY || '',
  },
});

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { userId } = await getAuth(req);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log('Deleting document:', params.id);

    // Get document with its knowledge base associations before deletion
    const document = await prisma.document.findUnique({
      where: { id: params.id },
      include: {
        knowledgeBases: {
          include: {
            knowledgeBase: true
          }
        }
      }
    });

    if (!document) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 });
    }

    // Get affected knowledge base IDs
    const affectedKnowledgeBaseIds = document.knowledgeBases.map(kb => kb.knowledgeBaseId);
    console.log('Affected knowledge bases:', affectedKnowledgeBaseIds);

    // Get current status of knowledge bases
    const kbs = await prisma.knowledgeBase.findMany({
      where: {
        id: {
          in: affectedKnowledgeBaseIds
        }
      },
      select: {
        id: true,
        isEmbed: true,
        reEmbed: true
      }
    });

    console.log('Knowledge base statuses before update:', kbs);

    await prisma.$transaction(async (prisma) => {
      // Set re-embed flag for affected knowledge bases
      if (affectedKnowledgeBaseIds.length > 0) {
        const updateResult = await prisma.knowledgeBase.updateMany({
          where: {
            id: {
              in: affectedKnowledgeBaseIds
            },
            isEmbed: 'done'
          },
          data: {
            reEmbed: true
          }
        });

        console.log('Updated knowledge bases:', updateResult);
      }

      // Delete document associations and the document itself
      await prisma.knowledgeBaseDocument.deleteMany({
        where: { documentId: params.id }
      });

      await prisma.document.delete({
        where: { id: params.id }
      });
    });

    // Verify the updates
    const verifyKbs = await prisma.knowledgeBase.findMany({
      where: {
        id: {
          in: affectedKnowledgeBaseIds
        }
      },
      select: {
        id: true,
        isEmbed: true,
        reEmbed: true
      }
    });

    console.log('Knowledge base statuses after update:', verifyKbs);

    // Delete from R2
    if (document.storageKey) {
      const deleteCommand = new DeleteObjectCommand({
        Bucket: document.bucketName,
        Key: document.storageKey,
      });
      await s3Client.send(deleteCommand);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting document:', error);
    return NextResponse.json(
      { error: 'Failed to delete document' },
      { status: 500 }
    );
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { userId } = await getAuth(req);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const formData = await req.formData();
    const file = formData.get('file');
    const knowledgeBaseIds = formData.get('knowledgeBaseIds') ?
      JSON.parse(formData.get('knowledgeBaseIds') as string) : [];

    if (!file || typeof file === 'string') {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    // Get the current document to check knowledge base associations
    const currentDoc = await prisma.document.findUnique({
      where: { id: params.id },
      include: {
        knowledgeBases: {
          include: {
            knowledgeBase: true
          }
        }
      }
    });

    if (!currentDoc) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 });
    }

    // Get current and new knowledge base IDs
    const currentKbIds = currentDoc.knowledgeBases.map(kb => kb.knowledgeBaseId);
    const addedKbIds = knowledgeBaseIds.filter((id: string) => !currentKbIds.includes(id));
    const removedKbIds = currentKbIds.filter((id: string) => !knowledgeBaseIds.includes(id));
    const affectedKbIds = [...addedKbIds, ...removedKbIds];

    // Upload new file to R2
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const key = `${userId}/${file.name}`;

    const command = new PutObjectCommand({
      Bucket: process.env.R2_DEFAULT_BUCKET,
      Key: key,
      Body: buffer,
      ContentType: file.type,
    });

    await s3Client.send(command);

    // Update document in database
    const updatedDoc = await prisma.$transaction(async (prisma) => {
      // Update document
      const doc = await prisma.document.update({
        where: { id: params.id },
        data: {
          originalName: file.name,
          storageKey: key,
          bucketName: process.env.R2_DEFAULT_BUCKET || '',
          mimeType: file.type,
          size: file.size,
          version: { increment: 1 }
        }
      });

      // Update knowledge base associations
      await prisma.knowledgeBaseDocument.deleteMany({
        where: { documentId: params.id }
      });

      if (knowledgeBaseIds.length > 0) {
        await prisma.knowledgeBaseDocument.createMany({
          data: knowledgeBaseIds.map((kbId: string) => ({
            documentId: params.id,
            knowledgeBaseId: kbId
          }))
        });
      }

      // Set re-embed flag for affected knowledge bases
      if (affectedKbIds.length > 0) {
        await prisma.knowledgeBase.updateMany({
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
      }

      return doc;
    });

    return NextResponse.json({ document: updatedDoc });
  } catch (error) {
    console.error('Error updating document:', error);
    return NextResponse.json(
      { error: 'Failed to update document' },
      { status: 500 }
    );
  }
}
