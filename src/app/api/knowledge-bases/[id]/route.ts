import { NextRequest, NextResponse } from 'next/server';

// This route uses dynamic features, so it must be server-rendered
export const dynamic = 'force-dynamic';

import { getAuth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/prisma';

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { userId } = getAuth(req);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = params;
    const data = await req.json();

    // Update the knowledge base
    const knowledgeBase = await prisma.knowledgeBase.update({
      where: { id },
      data: {
        autoEmbed: data.autoEmbed,
        updatedAt: new Date(),
      },
    });

    return NextResponse.json({ knowledgeBase });
  } catch (error) {
    console.error('Error updating knowledge base:', error);
    return NextResponse.json(
      { error: 'Failed to update knowledge base' },
      { status: 500 }
    );
  }
}
