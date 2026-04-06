import { NextResponse, NextRequest } from 'next/server';

// This route uses dynamic features, so it must be server-rendered
export const dynamic = 'force-dynamic';

import { getAuth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/prisma';
import { uploadToR2 } from '@/lib/r2';
import { Prisma } from '@prisma/client';
import { S3Client, DeleteObjectCommand } from '@aws-sdk/client-s3';

const S3 = new S3Client({
  region: 'auto',
  endpoint: process.env.R2_ENDPOINT,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  },
});

export async function POST(req: NextRequest) {
  try {
    const { userId } = getAuth(req);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log('Starting document upload process for user:', userId);
    const formData = await req.formData();
    const file = formData.get('file');
    const knowledgeBaseIds = (formData.get('knowledgeBaseIds') as string || '').split(',').filter(Boolean);

    if (!file || typeof file === 'string') {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    console.log('Received upload request:', {
      fileName: file.name,
      fileType: file.type,
      fileSize: file.size,
      knowledgeBaseIds
    });

    if (!file.name || !file.type) {
      return NextResponse.json({ error: 'Invalid file metadata' }, { status: 400 });
    }

    // Check all required environment variables
    if (!process.env.R2_ACCESS_KEY_ID || !process.env.R2_SECRET_ACCESS_KEY || 
        !process.env.R2_ENDPOINT || !process.env.R2_DEFAULT_BUCKET) {
      console.error('Missing required R2 configuration:', {
        hasAccessKey: !!process.env.R2_ACCESS_KEY_ID,
        hasSecretKey: !!process.env.R2_SECRET_ACCESS_KEY,
        hasEndpoint: !!process.env.R2_ENDPOINT,
        hasBucket: !!process.env.R2_DEFAULT_BUCKET
      });
      return NextResponse.json({ error: 'Storage configuration error: Missing required environment variables' }, { status: 500 });
    }

    // Convert File to Buffer for R2 upload
    console.log('Converting file to buffer...');
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    console.log('File converted to buffer, size:', buffer.length);

    try {
      console.log('Initiating R2 upload...');
      // Upload to R2
      const { key: storageKey } = await uploadToR2({
        file: buffer,
        fileName: file.name,
        mimeType: file.type,
        userId,
        metadata: {
          originalName: file.name,
          uploadedBy: userId,
        },
      });
      console.log('R2 upload completed, storage key:', storageKey);

      console.log('Creating document record in database...');
      // Create document record in database
      const doc = await prisma.$transaction(async (prisma) => {
        // Create the document
        const newDoc = await prisma.document.create({
          data: {
            userId,
            originalName: file.name,
            storageKey,
            bucketName: process.env.R2_DEFAULT_BUCKET || '',
            mimeType: file.type,
            size: file.size,
            metadata: {
              originalName: file.name,
              uploadedBy: userId,
            },
            knowledgeBases: knowledgeBaseIds.length > 0 ? {
              create: knowledgeBaseIds.map((knowledgeBaseId: string) => ({
                knowledgeBase: {
                  connect: { id: knowledgeBaseId }
                }
              }))
            } : undefined
          },
          include: {
            knowledgeBases: {
              include: {
                knowledgeBase: true
              }
            }
          }
        });

        // If there are knowledge bases, update their reEmbed flag
        if (knowledgeBaseIds.length > 0) {
          await prisma.knowledgeBase.updateMany({
            where: {
              id: {
                in: knowledgeBaseIds
              },
              isEmbed: 'done'
            },
            data: {
              reEmbed: true
            }
          });
        }

        return newDoc;
      });

      console.log('Document record created in database, ID:', doc.id);
      return NextResponse.json({ document: doc });
    } catch (uploadError) {
      console.error('Error during upload or database operation:', uploadError);
      return NextResponse.json({ 
        error: 'Failed to process document',
        details: uploadError instanceof Error ? uploadError.message : 'Unknown error'
      }, { status: 500 });
    }
  } catch (error) {
    console.error('Error in POST /api/documents:', error);
    return NextResponse.json({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  try {
    const { userId } = getAuth(req);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const documents = await prisma.document.findMany({
      where: { userId },
      include: {
        knowledgeBases: {
          include: {
            knowledgeBase: true
          }
        },
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    return NextResponse.json({ documents });
  } catch (error) {
    console.error('Error fetching documents:', error);
    return NextResponse.json(
      { error: 'Failed to fetch documents' },
      { status: 500 }
    );
  }
}

// Add document to knowledge bases
export async function PATCH(req: NextRequest) {
  try {
    const { userId } = getAuth(req);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { documentId, knowledgeBaseIds } = await req.json() as {
      documentId: string;
      knowledgeBaseIds: string[];
    };

    if (!documentId || !knowledgeBaseIds) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Verify document ownership
    const existingDoc = await prisma.document.findFirst({
      where: { id: documentId, userId },
      include: {
        knowledgeBases: {
          include: {
            knowledgeBase: true
          }
        }
      }
    });

    if (!existingDoc) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 });
    }

    // Calculate which knowledge bases are affected
    const currentKbIds = existingDoc.knowledgeBases.map(kb => kb.knowledgeBase.id);
    const addedKbIds = knowledgeBaseIds.filter(id => !currentKbIds.includes(id));

    // Update document and knowledge bases in a transaction
    const doc = await prisma.$transaction(async (prisma) => {
      // Add document to knowledge bases
      const updatedDoc = await prisma.document.update({
        where: { id: documentId },
        data: {
          knowledgeBases: {
            create: knowledgeBaseIds.map((knowledgeBaseId) => ({
              knowledgeBase: {
                connect: { id: knowledgeBaseId }
              }
            })),
          },
        },
        include: {
          knowledgeBases: {
            include: {
              knowledgeBase: true
            }
          },
        },
      });

      // Set reEmbed flag for newly added knowledge bases
      if (addedKbIds.length > 0) {
        await prisma.knowledgeBase.updateMany({
          where: {
            id: {
              in: addedKbIds
            },
            isEmbed: 'done'
          },
          data: {
            reEmbed: true
          }
        });
      }

      return updatedDoc;
    });

    return NextResponse.json({ document: doc });
  } catch (error) {
    console.error('Error updating document:', error);
    return NextResponse.json(
      { error: 'Failed to update document' },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { userId } = getAuth(req);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { documentId } = await req.json();
    if (!documentId) {
      return NextResponse.json({ error: 'Document ID is required' }, { status: 400 });
    }

    // Get document to verify ownership and get storage key
    const document = await prisma.document.findFirst({
      where: { id: documentId, userId },
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

    // Get affected knowledge base IDs before deletion
    const affectedKbIds = document.knowledgeBases.map(kb => kb.knowledgeBase.id);

    await prisma.$transaction(async (prisma) => {
      // Delete all knowledge base associations
      await prisma.knowledgeBaseDocument.deleteMany({
        where: {
          documentId: documentId,
        },
      });

      // Delete the document
      await prisma.document.delete({
        where: { id: documentId },
      });

      // Set reEmbed flag for affected knowledge bases
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
    });

    // Delete from R2
    const deleteCommand = new DeleteObjectCommand({
      Bucket: process.env.R2_DEFAULT_BUCKET,
      Key: document.storageKey,
    });

    await S3.send(deleteCommand);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting document:', error);
    return NextResponse.json(
      { error: 'Failed to delete document' },
      { status: 500 }
    );
  }
}

// Update document version
export async function PUT(req: NextRequest) {
  try {
    const { userId } = getAuth(req);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const formData = await req.formData();
    const file = formData.get('file');
    const documentId = formData.get('documentId') as string;

    if (!file || typeof file === 'string' || !documentId) {
      return NextResponse.json({ error: 'File and document ID are required' }, { status: 400 });
    }

    const fileObj = file as File;

    if (!fileObj.name || !fileObj.type) {
      return NextResponse.json({ error: 'Invalid file metadata' }, { status: 400 });
    }

    const bucketName = process.env.R2_BUCKET_NAME;
    if (!bucketName) {
      return NextResponse.json({ error: 'Storage configuration error' }, { status: 500 });
    }

    // Get existing document
    const existingDoc = await prisma.document.findFirst({
      where: { id: documentId, userId },
      include: {
        knowledgeBases: {
          include: {
            knowledgeBase: true
          }
        },
      },
    });

    if (!existingDoc) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 });
    }

    // Upload new version to R2
    const arrayBuffer = await fileObj.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const { key: storageKey } = await uploadToR2({
      file: buffer,
      fileName: fileObj.name,
      mimeType: fileObj.type,
      userId,
      metadata: {
        originalName: fileObj.name,
        uploadedBy: userId,
        version: (existingDoc.version + 1).toString(),
      },
    });

    // Delete old version from R2
    const deleteCommand = new DeleteObjectCommand({
      Bucket: process.env.R2_DEFAULT_BUCKET,
      Key: existingDoc.storageKey,
    });

    await S3.send(deleteCommand);

    // Get affected knowledge base IDs
    const affectedKbIds = existingDoc.knowledgeBases.map(kb => kb.knowledgeBase.id);

    // Update document in database and set reEmbed flags
    const updatedDoc = await prisma.$transaction(async (prisma) => {
      const doc = await prisma.document.update({
        where: { id: documentId },
        data: {
          storageKey,
          bucketName,
          mimeType: fileObj.type,
          size: fileObj.size,
          version: existingDoc.version + 1,
          metadata: {
            originalName: fileObj.name,
            uploadedBy: userId,
            version: (existingDoc.version + 1).toString(),
          },
        },
        include: {
          knowledgeBases: {
            include: {
              knowledgeBase: true
            }
          },
        },
      });

      // Set reEmbed flag for affected knowledge bases
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
