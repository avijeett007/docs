import { NextResponse, NextRequest } from 'next/server';

// This route uses dynamic features, so it must be server-rendered
export const dynamic = 'force-dynamic';

import { getAuth } from '@clerk/nextjs/server';
import { prisma, prismaWithRecovery } from '@/lib/prisma';

export async function GET(req: NextRequest) {
  try {
    const { userId } = getAuth(req);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // ✅ Auto-recovery enabled - will automatically handle "Engine is not yet connected" errors
    const knowledgeBases = await prismaWithRecovery(() =>
      prisma.knowledgeBase.findMany({
        where: {
          userId
        },
        orderBy: {
          createdAt: 'desc'
        }
      })
    );

    return NextResponse.json({ knowledgeBases });
  } catch (error) {
    console.error('Error fetching knowledge bases:', error);
    return NextResponse.json(
      { error: 'Failed to fetch knowledge bases' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const { userId } = getAuth(req);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { name, description } = await req.json();

    if (!name || !description) {
      return NextResponse.json(
        { error: 'Name and description are required' },
        { status: 400 }
      );
    }

    // ✅ Auto-recovery enabled for database creation
    const knowledgeBase = await prismaWithRecovery(() =>
      prisma.knowledgeBase.create({
        data: {
          name,
          description,
          userId
        }
      })
    );

    return NextResponse.json({ knowledgeBase });
  } catch (error) {
    console.error('Error creating knowledge base:', error);
    return NextResponse.json(
      { error: 'Failed to create knowledge base' },
      { status: 500 }
    );
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const { userId } = getAuth(req);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id, name, description } = await req.json();

    // ✅ Auto-recovery enabled for existence check
    const existingKnowledgeBase = await prismaWithRecovery(() =>
      prisma.knowledgeBase.findFirst({
        where: {
          id,
          userId
        }
      })
    );

    if (!existingKnowledgeBase) {
      return NextResponse.json({ error: 'Knowledge base not found' }, { status: 404 });
    }

    // ✅ Auto-recovery enabled for update operation
    const knowledgeBase = await prismaWithRecovery(() =>
      prisma.knowledgeBase.update({
        where: { id },
        data: {
          name,
          description
        }
      })
    );

    return NextResponse.json({ knowledgeBase });
  } catch (error) {
    console.error('Error updating knowledge base:', error);
    return NextResponse.json(
      { error: 'Failed to update knowledge base' },
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

    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { error: 'Knowledge base ID is required' },
        { status: 400 }
      );
    }

    // ✅ Auto-recovery enabled for existence check
    const existingKnowledgeBase = await prismaWithRecovery(() =>
      prisma.knowledgeBase.findFirst({
        where: {
          id,
          userId
        }
      })
    );

    if (!existingKnowledgeBase) {
      return NextResponse.json({ error: 'Knowledge base not found' }, { status: 404 });
    }

    // ✅ Auto-recovery enabled for cascading delete operations
    await prismaWithRecovery(() =>
      prisma.knowledgeBaseDocument.deleteMany({
        where: {
          knowledgeBaseId: id
        }
      })
    );

    await prismaWithRecovery(() =>
      prisma.knowledgeBase.delete({
        where: { id }
      })
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting knowledge base:', error);
    return NextResponse.json(
      { error: 'Failed to delete knowledge base' },
      { status: 500 }
    );
  }
}
