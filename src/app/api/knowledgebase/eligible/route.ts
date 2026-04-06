export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getAuth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/prisma';

export async function GET(req: NextRequest) {
  try {
    const { userId } = getAuth(req);
    
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Fetch eligible knowledgebases
    const eligibleKnowledgebases = await prisma.knowledgeBase.findMany({
      where: {
        userId,
        isEmbed: 'done',
        reEmbed: false,
        documents: {
          some: {} // Has at least one document
        }
      },
      include: {
        _count: {
          select: {
            documents: true
          }
        }
      }
    });

    return NextResponse.json(eligibleKnowledgebases);
  } catch (error) {
    console.error('Error fetching eligible knowledgebases:', error);
    return NextResponse.json(
      { error: 'Failed to fetch eligible knowledgebases' },
      { status: 500 }
    );
  }
}
