import { NextResponse, NextRequest } from 'next/server';

// This route uses dynamic features, so it must be server-rendered
export const dynamic = 'force-dynamic';

import { getAuth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/prisma';
import { randomUUID } from 'crypto';

// Check for required environment variables and assert their types
const EMBEDDING_SERVICE_URL = process.env.EMBEDDING_SERVICE_URL as string;
const EMBEDDING_AUTH_TOKEN = process.env.EMBEDDING_AUTH_TOKEN as string;

if (!EMBEDDING_SERVICE_URL || !EMBEDDING_AUTH_TOKEN) {
  const missing = [];
  if (!EMBEDDING_SERVICE_URL) missing.push('EMBEDDING_SERVICE_URL');
  if (!EMBEDDING_AUTH_TOKEN) missing.push('EMBEDDING_AUTH_TOKEN');
  console.error(`Missing required environment variables: ${missing.join(', ')}`);
  throw new Error(`Required environment variables not set: ${missing.join(', ')}`);
}

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { userId } = await getAuth(req);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const knowledgeBaseId = params.id;

    // Check if knowledge base exists and belongs to user
    const knowledgeBase = await prisma.knowledgeBase.findUnique({
      where: {
        id: knowledgeBaseId,
        userId,
      },
    });

    if (!knowledgeBase) {
      return NextResponse.json({ error: 'Knowledge base not found' }, { status: 404 });
    }

    // Create embedding request
    const embeddingRequestId = randomUUID();
    await prisma.embeddingRequest.create({
      data: {
        id: embeddingRequestId,
        userId,
        knowledgeBaseId,
        status: 'in_progress',
      },
    });

    // Update knowledge base embedding status
    await prisma.knowledgeBase.update({
      where: { id: knowledgeBaseId },
      data: { 
        isEmbed: 'active',
        reEmbed: false  // Reset reEmbed flag
      },
    });

    // Call external embedding service
    const response = await fetch(EMBEDDING_SERVICE_URL, {
      method: 'POST',
      headers: {
        'Authorization': EMBEDDING_AUTH_TOKEN,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        knowledgeBaseId,
        userId,
        embeddingRequestId,
      }),
    });

    if (!response.ok) {
      // If external service fails, update status
      await prisma.embeddingRequest.update({
        where: { id: embeddingRequestId },
        data: {
          status: 'failed',
          error: 'Failed to initiate embedding process',
        },
      });
      
      await prisma.knowledgeBase.update({
        where: { id: knowledgeBaseId },
        data: { isEmbed: null },
      });

      return NextResponse.json(
        { error: 'Failed to initiate embedding process' },
        { status: 500 }
      );
    }

    const data = await response.json();
    return NextResponse.json({
      message: data.message,
      requestId: embeddingRequestId,
      cost: 0.0004 // $0.0004 per 1K tokens
    });
  } catch (error) {
    console.error('Error in embedding process:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
