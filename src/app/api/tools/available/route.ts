import { NextRequest, NextResponse } from 'next/server';
import { getAuth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const { userId } = getAuth(req);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get all tools created by the user
    const tools = await prisma.tool.findMany({
      where: {
        userId
      },
      select: {
        id: true,
        name: true,
        description: true,
        version: true
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    return NextResponse.json({ tools });
  } catch (error) {
    console.error('Error fetching available tools:', error);
    return NextResponse.json(
      { error: 'Failed to fetch available tools' },
      { status: 500 }
    );
  }
}
